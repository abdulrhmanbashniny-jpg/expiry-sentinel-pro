import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Timezone: Saudi Arabia (Asia/Riyadh = UTC+3)
const TIMEZONE_OFFSET_HOURS = 3;

function getSaudiDate(): Date {
  const now = new Date();
  now.setHours(now.getHours() + TIMEZONE_OFFSET_HOURS);
  return now;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== Automated Reminder Job Started ===');
  console.log('Saudi Time:', getSaudiDate().toISOString());

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. جلب العناصر النشطة مع قواعد التذكير
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        id, title, ref_number, expiry_date, expiry_time, workflow_status,
        category:categories(name, code),
        reminder_rule:reminder_rules(id, name, days_before, is_active)
      `)
      .eq('status', 'active')
      .neq('workflow_status', 'finished');

    if (itemsError) {
      console.error('Error fetching items:', itemsError);
      return new Response(
        JSON.stringify({ success: false, error: itemsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${items?.length || 0} active items`);

    const today = getSaudiDate();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 2. معالجة كل عنصر
    for (const item of items || []) {
      const reminderRule = item.reminder_rule as any;
      if (!reminderRule || !reminderRule.is_active) {
        continue;
      }

      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // التحقق من قواعد التذكير
      const daysBefore = reminderRule.days_before as number[];
      if (!daysBefore.includes(daysUntilExpiry)) {
        continue;
      }

      results.processed++;
      console.log(`Processing item: ${item.title} (${daysUntilExpiry} days until expiry)`);

      // 3. جلب المستلمين للعنصر
      const { data: itemRecipients, error: recipientsError } = await supabase
        .from('item_recipients')
        .select(`
          recipient:recipients(id, name, telegram_id, whatsapp_number, is_active)
        `)
        .eq('item_id', item.id);

      if (recipientsError) {
        console.error(`Error fetching recipients for item ${item.id}:`, recipientsError);
        results.errors.push(`Failed to fetch recipients for ${item.title}`);
        continue;
      }

      const activeRecipients = itemRecipients
        ?.map(ir => ir.recipient)
        .filter(r => r && (r as any).is_active) || [];

      if (activeRecipients.length === 0) {
        console.log(`No active recipients for item: ${item.title}`);
        continue;
      }

      // 4. إرسال التذكيرات لكل مستلم
      for (const recipient of activeRecipients) {
        const r = recipient as any;

        // التحقق من عدم التكرار - نفس العنصر + المستلم + يوم التذكير + نفس اليوم
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
          console.log(`Skipping duplicate: ${item.title} -> ${r.name} (day ${daysUntilExpiry})`);
          results.skipped++;
          continue;
        }

        // تحضير الرسالة
        const expiryText = daysUntilExpiry === 0 ? 'اليوم' : 
                          daysUntilExpiry === 1 ? 'غداً' : 
                          `خلال ${daysUntilExpiry} يوم`;
        
        const message = `🔔 تذكير تلقائي\n\n` +
          `📋 العنصر: ${item.title}\n` +
          `🔖 الرقم: ${item.ref_number || '-'}\n` +
          `📁 الفئة: ${(item.category as any)?.name || '-'}\n` +
          `📅 تاريخ الانتهاء: ${item.expiry_date}\n` +
          `⏰ ينتهي: ${expiryText}\n\n` +
          `يرجى اتخاذ الإجراء اللازم.`;

        // إرسال عبر تيليجرام (الأولوية)
        if (r.telegram_id) {
          try {
            const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
            if (TELEGRAM_BOT_TOKEN) {
              const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: r.telegram_id,
                  text: message,
                  parse_mode: 'HTML',
                }),
              });

              const result = await response.json();

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
                results.sent++;
                console.log(`✅ Sent to ${r.name} via Telegram`);
              } else {
                await supabase.from('notification_log').insert({
                  item_id: item.id,
                  recipient_id: r.id,
                  reminder_day: daysUntilExpiry,
                  scheduled_for: new Date().toISOString(),
                  status: 'failed',
                  error_message: result.description || 'Telegram API error',
                });
                results.failed++;
                results.errors.push(`Telegram error for ${r.name}: ${result.description}`);
              }
            }
          } catch (error: any) {
            console.error(`Error sending to ${r.name}:`, error);
            results.failed++;
            results.errors.push(`Exception for ${r.name}: ${error.message}`);
          }
        } else if (r.whatsapp_number) {
          // Fallback to WhatsApp if no Telegram ID
          // WhatsApp يتطلب تكامل خارجي - نسجل فقط كـ pending
          await supabase.from('notification_log').insert({
            item_id: item.id,
            recipient_id: r.id,
            reminder_day: daysUntilExpiry,
            scheduled_for: new Date().toISOString(),
            status: 'pending',
          });
          results.skipped++;
          console.log(`⏳ Queued for ${r.name} (WhatsApp - requires external processing)`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log('=== Automated Reminder Job Completed ===');
    console.log(`Duration: ${duration}ms`);
    console.log(`Results:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        saudi_time: getSaudiDate().toISOString(),
        duration_ms: duration,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fatal error in automated-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
