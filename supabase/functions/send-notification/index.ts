import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { item_id, recipient_id, days_left, status, provider_message_id, error_message } = await req.json();

    console.log('Logging notification:', { item_id, recipient_id, days_left, status });

    if (!item_id || !recipient_id || days_left === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: item_id, recipient_id, days_left' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate notification
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('notification_log')
      .select('id')
      .eq('item_id', item_id)
      .eq('recipient_id', recipient_id)
      .eq('reminder_day', days_left)
      .gte('created_at', `${today}T00:00:00`)
      .single();

    if (existing) {
      console.log('Notification already logged for today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          message: 'تم تسجيل الإشعار مسبقاً اليوم',
          log_id: existing.id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert notification log
    const { data: logEntry, error: logError } = await supabase
      .from('notification_log')
      .insert({
        item_id,
        recipient_id,
        reminder_day: days_left,
        scheduled_for: new Date().toISOString(),
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        status: status || 'pending',
        provider_message_id: provider_message_id || null,
        error_message: error_message || null,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging notification:', logError);
      throw logError;
    }

    console.log('Notification logged successfully:', logEntry.id);

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logEntry.id,
        status: logEntry.status,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'حدث خطأ' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
