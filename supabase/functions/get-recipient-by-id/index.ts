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
    const { recipient_id } = await req.json();

    if (!recipient_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing recipient_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: recipient, error } = await supabase
      .from('recipients')
      .select('id, name, whatsapp_number, telegram_id, is_active')
      .eq('id', recipient_id)
      .single();

    if (error || !recipient) {
      console.error('Recipient not found:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'المستلم غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Recipient found:', recipient.name);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: recipient.id,
          name: recipient.name,
          telegram_id: recipient.telegram_id,
          whatsapp_number: recipient.whatsapp_number,
          is_active: recipient.is_active
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-recipient-by-id:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'حدث خطأ في النظام' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
