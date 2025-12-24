import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get webhook secret from integration config (optional verification)
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('key', 'whatsapp')
      .single();

    const webhookSecret = (integration?.config as any)?.webhook_secret;
    const receivedSecret = req.headers.get('x-webhook-secret');

    // Optional: Verify webhook secret if configured
    if (webhookSecret && receivedSecret !== webhookSecret) {
      console.warn('Invalid webhook secret received');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid webhook secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('AppsLink webhook received:', JSON.stringify(body).substring(0, 500));

    // Handle different webhook event types from AppsLink
    const eventType = body.event || body.type || body.status;
    const messageId = body.message_id || body.id;
    const status = body.status || body.delivery_status;
    const phone = body.from || body.phone || body.sender;
    const message = body.message || body.text || body.body;

    // Update notification log based on status
    if (messageId && status) {
      // Map AppsLink status to our status enum
      let mappedStatus: 'pending' | 'sent' | 'failed' | 'skipped' = 'sent';
      
      if (['delivered', 'read', 'seen'].includes(status.toLowerCase())) {
        mappedStatus = 'sent';
      } else if (['failed', 'undelivered', 'rejected'].includes(status.toLowerCase())) {
        mappedStatus = 'failed';
      }

      // Update existing notification log
      const { data: updated, error: updateError } = await supabase
        .from('notification_log')
        .update({
          status: mappedStatus,
          seen_at: status.toLowerCase() === 'read' ? new Date().toISOString() : null,
        })
        .eq('provider_message_id', messageId)
        .select();

      if (updateError) {
        console.error('Error updating notification log:', updateError);
      } else {
        console.log(`Updated notification status to ${mappedStatus} for message ${messageId}`);
      }
    }

    // Handle incoming messages (replies from recipients)
    if (eventType === 'MESSAGES_SET' || eventType === 'message' || eventType === 'incoming') {
      if (phone && message) {
        console.log(`Incoming WhatsApp message from ${phone}: ${message}`);
        
        // Find recipient by phone number
        const { data: recipient } = await supabase
          .from('recipients')
          .select('id, name')
          .eq('whatsapp_number', phone)
          .single();

        if (recipient) {
          // Log the conversation
          await supabase.from('conversation_logs').insert({
            platform: 'whatsapp',
            user_identifier: phone,
            user_message: message,
            ref_number: recipient.name,
            metadata: {
              recipient_id: recipient.id,
              raw_webhook: body,
            },
          });
          console.log(`Logged incoming message from recipient: ${recipient.name}`);
        } else {
          // Log anyway with unknown recipient
          await supabase.from('conversation_logs').insert({
            platform: 'whatsapp',
            user_identifier: phone,
            user_message: message,
            ref_number: 'unknown',
            metadata: { raw_webhook: body },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed',
        event_type: eventType,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in appslink-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
