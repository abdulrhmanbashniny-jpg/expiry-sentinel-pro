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

  console.log('=== Process Scheduled Tests Started ===');
  console.log('Saudi Time:', getSaudiDate().toISOString());

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    // Fetch pending scheduled tests that are due
    const { data: pendingTests, error: fetchError } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('job_type', 'scheduled_whatsapp_test')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${pendingTests?.length || 0} pending scheduled tests`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get WhatsApp config
    const { data: whatsappIntegration } = await supabase
      .from('integrations')
      .select('config, is_active')
      .eq('key', 'whatsapp')
      .single();

    if (!whatsappIntegration?.is_active) {
      console.log('WhatsApp integration is not active');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp integration is not active',
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const waConfig = whatsappIntegration.config as any;
    const apiKey = waConfig?.apikey || waConfig?.access_token;

    if (!waConfig?.api_base_url || !apiKey || !waConfig?.instance_name) {
      console.log('WhatsApp configuration is incomplete');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp configuration is incomplete',
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const test of pendingTests || []) {
      results.processed++;
      
      const metadata = test.metadata as any;
      const scheduledFor = new Date(metadata?.scheduled_for);
      
      // Check if scheduled time has passed
      if (scheduledFor > now) {
        console.log(`Test ${test.id} scheduled for ${scheduledFor.toISOString()}, skipping (not yet due)`);
        results.skipped++;
        continue;
      }

      console.log(`Processing scheduled test ${test.id}`);

      // Update status to running
      await supabase
        .from('automation_runs')
        .update({ 
          status: 'running',
          started_at: now.toISOString()
        })
        .eq('id', test.id);

      try {
        // Format phone number
        let phone = (metadata?.phone || '').replace(/\D/g, '');
        if (phone.startsWith('05')) {
          phone = '966' + phone.substring(1);
        } else if (phone.startsWith('00')) {
          phone = phone.substring(2);
        } else if (phone.startsWith('+')) {
          phone = phone.substring(1);
        }
        const jid = `${phone}@s.whatsapp.net`;

        console.log(`Sending WhatsApp to ${phone} (${jid})`);

        const response = await fetch(
          `${waConfig.api_base_url}/message/sendText/${waConfig.instance_name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({
              number: jid,
              textMessage: { text: metadata?.message || 'Test message' },
            }),
          }
        );

        const result = await response.json();
        console.log('WhatsApp API response:', result);

        if (result.key || result.status === 'PENDING' || result.messageId) {
          // Success
          await supabase
            .from('automation_runs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - now.getTime(),
              items_success: 1,
              items_processed: 1,
              results: {
                message_id: result.key?.id || result.messageId,
                sent_to: phone,
                sent_at: new Date().toISOString(),
              },
            })
            .eq('id', test.id);

          // Log to notification_log with a dummy item_id (for tracking)
          // First, find any item to use as reference, or use a placeholder approach
          const { data: anyItem } = await supabase
            .from('items')
            .select('id')
            .limit(1)
            .single();

          if (anyItem) {
            // Get or create a test recipient
            const { data: testRecipient } = await supabase
              .from('recipients')
              .select('id')
              .eq('whatsapp_number', phone)
              .maybeSingle();

            const recipientId = testRecipient?.id;

            if (recipientId) {
              await supabase.from('notification_log').insert({
                item_id: anyItem.id,
                recipient_id: recipientId,
                reminder_day: 0,
                scheduled_for: metadata?.scheduled_for,
                sent_at: new Date().toISOString(),
                status: 'sent',
                provider_message_id: result.key?.id || result.messageId || null,
                channel: 'whatsapp',
              });
            }
          }

          results.sent++;
          console.log(`✅ Scheduled WhatsApp test sent successfully to ${phone}`);
        } else {
          throw new Error(result.message || result.error || 'WhatsApp API error');
        }
      } catch (error: any) {
        console.error(`Failed to send scheduled test ${test.id}:`, error.message);
        
        await supabase
          .from('automation_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - now.getTime(),
            items_failed: 1,
            items_processed: 1,
            error_message: error.message,
            results: {
              error: error.message,
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', test.id);

        results.failed++;
        results.errors.push(`Test ${test.id}: ${error.message}`);
      }
    }

    console.log('=== Process Scheduled Tests Completed ===');
    console.log('Results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        saudi_time: getSaudiDate().toISOString(),
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Process scheduled tests error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
