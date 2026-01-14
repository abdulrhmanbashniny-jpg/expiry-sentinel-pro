import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Timezone: Saudi Arabia (Asia/Riyadh = UTC+3)
const TIMEZONE_OFFSET_HOURS = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const DAILY_RATE_LIMIT_PER_RECIPIENT = 5;

function getSaudiDate(): Date {
  const now = new Date();
  now.setHours(now.getHours() + TIMEZONE_OFFSET_HOURS);
  return now;
}

// Retry helper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.log(`Retry ${i + 1}/${retries} failed:`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

// Apply template with variables
function applyTemplate(templateText: string, data: Record<string, any>): string {
  let result = templateText;

  // Replace regular variables
  for (const [key, value] of Object.entries(data)) {
    if (key === 'dynamic_fields' && typeof value === 'object') {
      for (const [dKey, dValue] of Object.entries(value as object)) {
        result = result.replace(new RegExp(`{{dynamic_fields\\.${dKey}}}`, 'g'), String(dValue || ''));
      }
    } else {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
    }
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const runId = crypto.randomUUID();
  console.log('=== Automated Reminder Job Started ===');
  console.log('Run ID:', runId);
  console.log('Saudi Time:', getSaudiDate().toISOString());

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create automation run log
    const { data: runLog } = await supabase
      .from('automation_runs')
      .insert({
        job_type: 'daily_reminders',
        status: 'running',
        metadata: { run_id: runId }
      })
      .select()
      .single();

    // 1. Get active channel templates
    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('is_active', true)
      .in('channel', ['telegram', 'whatsapp']);

    const telegramTemplate = templates?.find(t => t.channel === 'telegram' && t.is_default) || 
                             templates?.find(t => t.channel === 'telegram');
    const whatsappTemplate = templates?.find(t => t.channel === 'whatsapp' && t.is_default) || 
                             templates?.find(t => t.channel === 'whatsapp');

    console.log('Templates loaded:', { 
      telegram: telegramTemplate?.name || 'none', 
      whatsapp: whatsappTemplate?.name || 'none' 
    });

    // 2. Get integration configs
    const { data: integrations } = await supabase
      .from('integrations')
      .select('key, config, is_active')
      .in('key', ['telegram', 'whatsapp']);

    const telegramConfig = integrations?.find(i => i.key === 'telegram');
    const whatsappConfig = integrations?.find(i => i.key === 'whatsapp');

    // 3. Fetch active items with reminder rules
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        id, title, ref_number, expiry_date, expiry_time, workflow_status, notes,
        responsible_person, dynamic_fields,
        category:categories(id, name, code),
        department:departments(id, name),
        reminder_rule:reminder_rules(id, name, days_before, is_active)
      `)
      .eq('status', 'active')
      .neq('workflow_status', 'finished');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      throw itemsError;
    }

    console.log(`Found ${items?.length || 0} active items`);

    const today = getSaudiDate();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const results = {
      processed: 0,
      telegram_sent: 0,
      whatsapp_sent: 0,
      skipped: 0,
      failed: 0,
      rate_limited: 0,
      errors: [] as string[],
    };

    // 4. Process each item
    for (const item of items || []) {
      const reminderRule = item.reminder_rule as any;
      if (!reminderRule || !reminderRule.is_active) {
        continue;
      }

      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Check reminder rules
      const daysBefore = reminderRule.days_before as number[];
      if (!daysBefore.includes(daysUntilExpiry)) {
        continue;
      }

      results.processed++;
      console.log(`Processing: ${item.title} (${daysUntilExpiry} days until expiry)`);

      // 5. Get recipients for item
      const { data: itemRecipients } = await supabase
        .from('item_recipients')
        .select(`
          recipient:recipients(id, name, telegram_id, whatsapp_number, is_active)
        `)
        .eq('item_id', item.id);

      const activeRecipients = itemRecipients
        ?.map(ir => ir.recipient)
        .filter(r => r && (r as any).is_active) || [];

      if (activeRecipients.length === 0) {
        console.log(`No active recipients for: ${item.title}`);
        continue;
      }

      // Prepare message data (common for both channels)
      const PUBLISHED_APP_URL = 'https://expiry-sentinel-pro.lovable.app';
      const remainingText = daysUntilExpiry === 0 ? 'اليوم' : 
                           daysUntilExpiry === 1 ? 'غداً' : 
                           `${daysUntilExpiry} يوم`;

      const messageData = {
        title: item.title,
        item_code: item.ref_number || '-',
        ref_number: item.ref_number || '-',
        item_title: item.title,
        department_name: (item.department as any)?.name || '-',
        category: (item.category as any)?.name || '-',
        category_name: (item.category as any)?.name || '-',
        due_date: item.expiry_date,
        expiry_date: item.expiry_date,
        remaining_text: remainingText,
        days_left: daysUntilExpiry,
        creator_note: item.notes || '',
        responsible_person: item.responsible_person || '-',
        assignee: item.responsible_person || '-',
        item_url: `${PUBLISHED_APP_URL}/items/${item.id}`,
        work_status: item.workflow_status,
        validity_status: 'active',
        dynamic_fields: item.dynamic_fields || {},
      };

      // 6. Send to each recipient
      for (const recipient of activeRecipients) {
        const r = recipient as any;

        // Add recipient name to message data
        const recipientMessageData = { ...messageData, recipient_name: r.name };

        // Check for duplicate notification today
        const { data: existingLog } = await supabase
          .from('notification_log')
          .select('id')
          .eq('item_id', item.id)
          .eq('recipient_id', r.id)
          .eq('reminder_day', daysUntilExpiry)
          .gte('created_at', todayStr)
          .lt('created_at', new Date(today.getTime() + 86400000).toISOString().split('T')[0])
          .maybeSingle();

        if (existingLog) {
          console.log(`Skipping duplicate: ${item.title} -> ${r.name}`);
          results.skipped++;
          continue;
        }

        // Check rate limit
        const { data: rateLimit } = await supabase
          .from('rate_limits')
          .select('count')
          .eq('recipient_id', r.id)
          .eq('date', todayStr)
          .maybeSingle();

        if (rateLimit && rateLimit.count >= DAILY_RATE_LIMIT_PER_RECIPIENT) {
          console.log(`Rate limited: ${r.name}`);
          results.rate_limited++;
          continue;
        }

        // Try Telegram first
        if (r.telegram_id && telegramConfig?.is_active && telegramTemplate) {
          try {
            const message = applyTemplate(telegramTemplate.template_text, recipientMessageData);
            const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

            if (TELEGRAM_BOT_TOKEN) {
              const result = await withRetry(async () => {
                const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: r.telegram_id,
                    text: message,
                    parse_mode: 'HTML',
                  }),
                });
                return response.json();
              });

              if (result.ok) {
                await supabase.from('notification_log').insert({
                  item_id: item.id,
                  recipient_id: r.id,
                  reminder_day: daysUntilExpiry,
                  scheduled_for: new Date().toISOString(),
                  sent_at: new Date().toISOString(),
                  status: 'sent',
                  provider_message_id: result.result.message_id.toString(),
                });

                // Update rate limit
                try {
                  await supabase.rpc('increment_rate_limit', { 
                    p_channel: 'telegram', 
                    p_recipient_id: r.id,
                    p_date: todayStr
                  });
                } catch {
                  // Fallback: upsert directly
                  await supabase.from('rate_limits').upsert({
                    channel: 'telegram',
                    recipient_id: r.id,
                    date: todayStr,
                    count: (rateLimit?.count || 0) + 1,
                    last_sent_at: new Date().toISOString()
                  }, { onConflict: 'channel,recipient_id,date' });
                }

                results.telegram_sent++;
                console.log(`✅ Telegram sent to ${r.name}`);
                continue; // Skip WhatsApp if Telegram succeeded
              } else {
                throw new Error(result.description || 'Telegram API error');
              }
            }
          } catch (error: any) {
            console.error(`Telegram error for ${r.name}:`, error.message);
            results.errors.push(`Telegram: ${r.name} - ${error.message}`);
          }
        }

        // Try WhatsApp as fallback or primary
        if (r.whatsapp_number && whatsappConfig?.is_active && whatsappTemplate) {
          try {
            const message = applyTemplate(whatsappTemplate.template_text, recipientMessageData);
            const waConfig = whatsappConfig.config as any;

            if (waConfig?.api_base_url && waConfig?.apikey && waConfig?.instance_name) {
              // Format phone number for WhatsApp
              let phone = r.whatsapp_number.replace(/\D/g, '');
              if (phone.startsWith('05')) {
                phone = '966' + phone.substring(1);
              } else if (phone.startsWith('00')) {
                phone = phone.substring(2);
              } else if (phone.startsWith('+')) {
                phone = phone.substring(1);
              }
              const jid = `${phone}@s.whatsapp.net`;

              const result = await withRetry(async () => {
                const response = await fetch(
                  `${waConfig.api_base_url}/message/sendText/${waConfig.instance_name}`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': waConfig.apikey,
                    },
                    body: JSON.stringify({
                      number: jid,
                      text: message,
                    }),
                  }
                );
                return response.json();
              });

              if (result.key || result.status === 'PENDING' || result.messageId) {
                await supabase.from('notification_log').insert({
                  item_id: item.id,
                  recipient_id: r.id,
                  reminder_day: daysUntilExpiry,
                  scheduled_for: new Date().toISOString(),
                  sent_at: new Date().toISOString(),
                  status: 'sent',
                  provider_message_id: result.key?.id || result.messageId || null,
                });

                // Update rate limit
                try {
                  await supabase.from('rate_limits').upsert({
                    channel: 'whatsapp',
                    recipient_id: r.id,
                    date: todayStr,
                    count: (rateLimit?.count || 0) + 1,
                    last_sent_at: new Date().toISOString()
                  }, { onConflict: 'channel,recipient_id,date' });
                } catch (e) {
                  console.log('Rate limit update failed:', e);
                }

                results.whatsapp_sent++;
                console.log(`✅ WhatsApp sent to ${r.name}`);
              } else {
                throw new Error(result.message || 'WhatsApp API error');
              }
            }
          } catch (error: any) {
            console.error(`WhatsApp error for ${r.name}:`, error.message);
            results.errors.push(`WhatsApp: ${r.name} - ${error.message}`);
            
            // Log failed notification
            await supabase.from('notification_log').insert({
              item_id: item.id,
              recipient_id: r.id,
              reminder_day: daysUntilExpiry,
              scheduled_for: new Date().toISOString(),
              status: 'failed',
              error_message: error.message,
            });
            results.failed++;
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    // Update automation run log
    if (runLog?.id) {
      await supabase.from('automation_runs').update({
        status: results.failed > 0 && results.telegram_sent === 0 && results.whatsapp_sent === 0 
          ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        items_processed: results.processed,
        items_success: results.telegram_sent + results.whatsapp_sent,
        items_failed: results.failed,
        results: results,
      }).eq('id', runLog.id);
    }

    console.log('=== Automated Reminder Job Completed ===');
    console.log(`Duration: ${duration}ms`);
    console.log('Results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        timestamp: new Date().toISOString(),
        saudi_time: getSaudiDate().toISOString(),
        duration_ms: duration,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fatal error in automated-reminders:', error);
    
    // Update automation run log with error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    await supabase.from('automation_runs').insert({
      job_type: 'daily_reminders',
      status: 'failed',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error_message: error.message,
    });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
