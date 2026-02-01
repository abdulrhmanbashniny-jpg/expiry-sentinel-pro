// escalate-unacknowledged-reminders Edge Function
// Runs hourly to check and escalate unacknowledged reminders

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

interface EscalationTarget {
  level: number;
  roleField: string;
  roleName: string;
  delayHours: number;
}

const ESCALATION_LEVELS: EscalationTarget[] = [
  { level: 1, roleField: 'supervisor_id', roleName: 'supervisor', delayHours: 24 },
  { level: 2, roleField: 'manager_id', roleName: 'manager', delayHours: 24 },
  { level: 3, roleField: 'director_id', roleName: 'director', delayHours: 24 },
  { level: 4, roleField: 'hr_admin', roleName: 'hr_admin', delayHours: 24 }
];

// Get the next recipient in the escalation hierarchy
async function getNextRecipient(
  tenantId: string,
  employeeId: string,
  level: number
): Promise<string | null> {
  try {
    if (level === 4) {
      // For HR level - get any HR admin
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('role', 'hr_admin')
        .limit(1)
        .single();
      
      if (error) {
        console.log('No HR admin found:', error);
        return null;
      }
      return data?.id || null;
    }

    // Get from organizational hierarchy
    const target = ESCALATION_LEVELS.find(e => e.level === level);
    if (!target) return null;

    const { data, error } = await supabase
      .from('organizational_hierarchy')
      .select(target.roleField)
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .single();

    if (error) {
      console.log(`No hierarchy found for employee ${employeeId}:`, error);
      return null;
    }

    return data?.[target.roleField] || null;
  } catch (error) {
    console.error(`Error getting next recipient for level ${level}:`, error);
    return null;
  }
}

// Create an escalation notification
async function sendEscalationNotification(
  tenantId: string,
  recipientId: string,
  escalationLogId: string,
  itemId: string,
  level: number,
  itemDetails: { name: string; expiryDate: string }
): Promise<void> {
  try {
    const levelNames = ['N/A', 'Supervisor', 'Manager', 'Director', 'HR Department'];
    const levelNamesAr = ['N/A', 'المشرف', 'المدير', 'المدير العام', 'إدارة الموارد البشرية'];

    const title = `تصعيد - ${levelNamesAr[level]}`;
    const message = `معاملة [${itemDetails.name}] لم تُستلم من المستويات السابقة. برجاء المراجعة الفورية.`;

    // Create in-app notification
    const { error: notifError } = await supabase
      .from('in_app_notifications')
      .insert({
        tenant_id: tenantId,
        recipient_id: recipientId,
        item_id: itemId,
        title,
        message,
        type: 'escalation',
        priority: 'high',
        related_escalation_id: escalationLogId
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
    }

    // TODO: Send via WhatsApp and Email channels
    console.log(`Notification sent to ${recipientId} for escalation level ${level}`);
  } catch (error) {
    console.error('Error sending escalation notification:', error);
  }
}

// Process escalation
async function escalateReminder(escalationLog: any): Promise<void> {
  try {
    const { 
      id, 
      tenant_id, 
      current_recipient_id, 
      escalation_level,
      original_recipient_id,
      reminder_id,
      item_id
    } = escalationLog;

    const nextLevel = escalation_level + 1;

    // Get item details for notification
    const { data: itemData } = await supabase
      .from('items')
      .select('name, expiry_date')
      .eq('id', item_id)
      .single();

    // Get next recipient
    const nextRecipient = await getNextRecipient(
      tenant_id,
      original_recipient_id,
      nextLevel
    );

    if (!nextRecipient) {
      // No more escalation levels
      console.log(`No next recipient for escalation level ${nextLevel}`);
      
      // Mark current as expired
      await supabase
        .from('escalation_log')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      return;
    }

    // Mark current escalation as escalated
    await supabase
      .from('escalation_log')
      .update({
        status: 'escalated',
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Create new escalation log entry
    const nextEscalationAt = new Date();
    nextEscalationAt.setHours(nextEscalationAt.getHours() + 24);

    const { error: insertError } = await supabase
      .from('escalation_log')
      .insert({
        tenant_id,
        reminder_id,
        item_id,
        original_recipient_id,
        escalation_level: nextLevel,
        current_recipient_id: nextRecipient,
        previous_recipient_id: current_recipient_id,
        status: 'pending',
        next_escalation_at: nextEscalationAt.toISOString()
      });

    if (insertError) {
      console.error('Error creating escalation log:', insertError);
      return;
    }

    // Send notification
    await sendEscalationNotification(
      tenant_id,
      nextRecipient,
      id,
      item_id,
      nextLevel,
      itemData || { name: 'Unknown', expiryDate: 'N/A' }
    );

    console.log(`Escalated reminder to level ${nextLevel} for recipient ${nextRecipient}`);
  } catch (error) {
    console.error('Error processing escalation:', error);
  }
}

// Main handler
Deno.serve(async (req) => {
  // Verify the request is from Supabase scheduler
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Starting escalation check...');

    // Get all pending escalations that should be escalated
    const now = new Date();
    const { data: pendingEscalations, error } = await supabase
      .from('escalation_log')
      .select('*')
      .eq('status', 'pending')
      .lte('next_escalation_at', now.toISOString())
      .limit(100); // Process up to 100 at a time

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    console.log(`Found ${pendingEscalations?.length || 0} escalations to process`);

    // Process each escalation
    let processedCount = 0;
    if (pendingEscalations && pendingEscalations.length > 0) {
      for (const escalation of pendingEscalations) {
        await escalateReminder(escalation);
        processedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} escalations`,
        escalated: processedCount
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in escalate-reminders function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
