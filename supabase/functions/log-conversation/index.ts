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
    const { phone, ref_number, user_message, ai_response, timestamp } = await req.json();

    console.log('Logging conversation:', { phone, ref_number });

    if (!phone || !ref_number || !user_message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'بيانات المحادثة غير مكتملة' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store in settings table as conversation log
    const conversationData = {
      phone,
      ref_number,
      user_message,
      ai_response,
      timestamp: timestamp || new Date().toISOString()
    };

    // Using settings table to store conversation logs
    const { data, error } = await supabase
      .from('settings')
      .insert({
        key: `conversation_${ref_number}`,
        value: conversationData
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging conversation:', error);
      throw error;
    }

    console.log('Conversation logged successfully:', data.id);

    return new Response(
      JSON.stringify({
        success: true,
        log_id: data.id,
        ref_number: ref_number
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in log-conversation:', error);
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
