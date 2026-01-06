import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Authentication helper - يقرأ المفتاح الداخلي من قاعدة البيانات
async function verifyAuth(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // 1) مفتاح داخلي للاستدعاءات من n8n
  const internalKey = req.headers.get('x-internal-key');

  if (internalKey) {
    // قراءة المفتاح المتوقع من جدول integrations
    const { data: n8nIntegration } = await adminClient
      .from('integrations')
      .select('config')
      .eq('key', 'n8n')
      .single();

    const expectedKey = (n8nIntegration?.config as Record<string, any>)?.internal_key;

    if (expectedKey && internalKey === expectedKey) {
      return { user: { id: 'internal-system' }, error: null };
    }
  }

  // 2) JWT من Supabase Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

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
    const instanceName = config.instance_name || config.phone_number_id || 'evolution';

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

    // Format phone number (remove + and spaces, keep only digits)
    const formattedPhone = phone.replace(/[\s+\-()]/g, '');

    // Send message via Evolution API (AppsLink uses Evolution API)
    // Endpoint: POST /message/sendText/{instance}
    // Remove /api/v1 suffix if present, as Evolution API doesn't use it
    const baseUrl = apiBaseUrl
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
    const sendUrl = `${baseUrl}/message/sendText/${instanceName}`;
    
    console.log('Sending to Evolution API:', { sendUrl, phone: formattedPhone, instance: instanceName });
    
    // Evolution API v2 format (flat text field)
    // Also try v1 format with textMessage wrapper if v2 fails
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'apikey': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseText = await response.text();
    let result: any;
    
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log('Evolution API response:', { status: response.status, result });

    if (!response.ok) {
      console.error('Evolution API error:', result);
      
      // Log failed notification
      if (item_id && recipient_id) {
        await supabase.from('notification_log').insert({
          item_id,
          recipient_id,
          reminder_day: 0,
          scheduled_for: new Date().toISOString(),
          status: 'failed',
          error_message: result.message || result.error || JSON.stringify(result),
        });
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.message || result.error || 'فشل إرسال الرسالة',
          code: 'SEND_FAILED',
          details: result
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract message ID from Evolution API response
    // Evolution API returns: { key: { remoteJid: "...", id: "MESSAGE_ID" }, status: "PENDING" }
    const messageId = result?.key?.id || result?.message_id || result?.id;
    
    console.log('WhatsApp message sent successfully:', { messageId, result });

    // Log successful notification
    if (item_id && recipient_id) {
      await supabase.from('notification_log').insert({
        item_id,
        recipient_id,
        reminder_day: 0,
        scheduled_for: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        status: 'sent',
        provider_message_id: messageId,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        phone: formattedPhone,
        raw_response: result,
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
