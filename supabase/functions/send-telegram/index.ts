import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { chat_id, message, parse_mode, action } = body;

    // Handle status check request
    if (action === 'check') {
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      return new Response(
        JSON.stringify({ 
          success: true, 
          configured: !!TELEGRAM_BOT_TOKEN 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending Telegram message to:', chat_id);

    if (!chat_id || !message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'بيانات الإرسال غير مكتملة' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'لم يتم تكوين بوت التيليجرام' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        text: message,
        parse_mode: parse_mode || 'HTML',
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      console.error('Telegram API error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'حدث خطأ في النظام'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Telegram message sent successfully:', result.result.message_id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.result.message_id,
        chat_id: chat_id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-telegram:', error);
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
