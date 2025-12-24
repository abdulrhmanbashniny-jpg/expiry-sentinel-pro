import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Authentication helper (supports both internal key and JWT)
async function verifyAuth(req: Request) {
  // 1) مفتاح داخلي للاستدعاءات من n8n
  const internalKey = req.headers.get('x-internal-key');
  const expectedKey = Deno.env.get('INTERNAL_FUNCTION_KEY');
  
  if (internalKey && expectedKey && internalKey === expectedKey) {
    return { user: { id: 'internal-system' }, error: null };
  }

  // 2) JWT من Supabase Auth
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { phone, message, recipient_id, item_id, action } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get WhatsApp integration config
    const { data: integration } = await supabase
      .from('integrations')
      .select('config, is_active')
      .eq('key', 'whatsapp')
      .single();

    if (!integration?.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'تكامل WhatsApp غير مفعل',
          code: 'INTEGRATION_DISABLED'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = integration.config as Record<string, any>;
    const apiBaseUrl = config.api_base_url;
    const accessToken = config.access_token;
    const phoneNumberId = config.phone_number_id;

    // Handle status check
    if (action === 'check') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          configured: !!(apiBaseUrl && accessToken),
          provider: 'appslink'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending WhatsApp message via AppsLink:', { phone, by_user: user.id });

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'بيانات الإرسال غير مكتملة (phone, message)',
          code: 'INVALID_REQUEST'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiBaseUrl || !accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'إعدادات AppsLink غير مكتملة',
          code: 'CONFIG_MISSING'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = phone.replace(/[\s+\-]/g, '');

    // Send message via AppsLink API
    // AppsLink API structure (adjust based on their actual API documentation)
    const sendUrl = `${apiBaseUrl.replace(/\/$/, '')}/messages/send`;
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: formattedPhone,
        message: message,
        sender_id: phoneNumberId || undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('AppsLink API error:', result);
      
      // Log failed notification
      if (item_id && recipient_id) {
        await supabase.from('notification_log').insert({
          item_id,
          recipient_id,
          reminder_day: 0,
          scheduled_for: new Date().toISOString(),
          status: 'failed',
          error_message: result.message || JSON.stringify(result),
        });
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.message || 'فشل إرسال الرسالة',
          code: 'SEND_FAILED',
          details: result
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('WhatsApp message sent successfully:', result);

    // Log successful notification
    if (item_id && recipient_id) {
      await supabase.from('notification_log').insert({
        item_id,
        recipient_id,
        reminder_day: 0,
        scheduled_for: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        status: 'sent',
        provider_message_id: result.message_id || result.id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.message_id || result.id,
        phone: formattedPhone,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-whatsapp:', error);
    const errorMessage = error instanceof Error ? error.message : 'حدث خطأ في النظام';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
