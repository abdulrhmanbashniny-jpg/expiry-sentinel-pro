import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Published app URL
const PUBLISHED_APP_URL = 'https://expiry-sentinel-pro.lovable.app';

// Authentication helper
async function verifyAuth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }
  return { user, error: null };
}

// Apply template with variables
function applyTemplate(templateText: string, data: Record<string, any>): string {
  let result = templateText;

  // Replace regular variables
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
  }

  // Process conditionals {{#if field}}...{{/if}}
  result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, field, content) => {
    return data[field] ? content : '';
  });

  // Remove unreplaced variables
  result = result.replace(/{{[\w.]+}}/g, '');

  return result.trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { item_id, recipient_id } = await req.json();
    
    console.log('Test WhatsApp notification request:', { item_id, recipient_id, by_user: user.id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch item details with department
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`
        *,
        category:categories(id, name, code),
        department:departments(id, name),
        reminder_rule:reminder_rules(name, days_before)
      `)
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      console.error('Error fetching item:', itemError);
      return new Response(
        JSON.stringify({ success: false, error: 'العنصر غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recipient details
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .select('*')
      .eq('id', recipient_id)
      .single();

    if (recipientError || !recipient) {
      console.error('Error fetching recipient:', recipientError);
      return new Response(
        JSON.stringify({ success: false, error: 'المستلم غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp template from message_templates table
    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('channel', 'whatsapp')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1);

    const template = templates?.[0];
    
    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: 'لا يوجد قالب واتساب متاح' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate days left
    const expiryDate = new Date(item.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const remainingText = daysLeft === 0 ? 'اليوم' : 
                          daysLeft === 1 ? 'غداً' : 
                          daysLeft < 0 ? `متأخر ${Math.abs(daysLeft)} يوم` :
                          `${daysLeft} يوم`;

    // Build message data with all placeholders
    const messageData = {
      // Required fields
      recipient_name: recipient.name,
      title: item.title,
      item_title: item.title,
      item_code: item.ref_number || '-',
      ref_number: item.ref_number || '-',
      due_date: item.expiry_date,
      expiry_date: item.expiry_date,
      remaining_text: remainingText,
      days_left: daysLeft,
      item_url: `${PUBLISHED_APP_URL}/items/${item.id}`,
      
      // Optional fields
      department_name: item.department?.name || '-',
      category: item.category?.name || '-',
      category_name: item.category?.name || '-',
      creator_note: item.notes || '',
      notes: item.notes || '',
      responsible_person: item.responsible_person || '-',
      expiry_time: item.expiry_time || '09:00',
    };

    // Apply template
    const message = applyTemplate(template.template_text, messageData);

    console.log('Prepared test message for WhatsApp:', {
      to: recipient.whatsapp_number,
      recipientName: recipient.name,
      messageLength: message.length,
      templateUsed: template.name
    });

    // Log the test notification
    const { data: logEntry, error: logError } = await supabase
      .from('notification_log')
      .insert({
        item_id: item.id,
        recipient_id: recipient.id,
        reminder_day: daysLeft,
        scheduled_for: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        status: 'sent',
        provider_message_id: `test_whatsapp_${Date.now()}`,
        error_message: null,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    // Return the prepared message
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          recipient: {
            name: recipient.name,
            whatsapp_number: recipient.whatsapp_number,
          },
          item: {
            id: item.id,
            title: item.title,
            ref_number: item.ref_number,
            expiry_date: item.expiry_date,
            expiry_time: item.expiry_time,
            days_left: daysLeft,
          },
          message: message,
          template_used: template.name,
          log_id: logEntry?.id,
          webhook_payload: {
            phone: recipient.whatsapp_number,
            message: message,
            item_id: item.id,
            recipient_id: recipient.id,
            is_test: true,
          }
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in test-whatsapp function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'حدث خطأ في النظام' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
