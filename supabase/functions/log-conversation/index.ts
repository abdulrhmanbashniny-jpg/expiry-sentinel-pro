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

  // 1) أولاً: مفتاح داخلي للاستدعاءات الخلفية (مثلاً من n8n)
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
      // نرجع مستخدم وهمي يمثل النظام الداخلي
      return { user: { id: 'internal-system' }, error: null };
    }
  }

  // 2) إن لم يوجد مفتاح داخلي، نرجع للطريقة العادية (JWT من Supabase Auth)
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
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, ref_number, user_message, ai_response, timestamp } = await req.json();

    console.log('Logging conversation:', { phone, ref_number, by_user: user.id });

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

    // Store in conversation_logs table (properly secured)
    const { data, error } = await supabase
      .from('conversation_logs')
      .insert({
        ref_number: ref_number,
        platform: 'whatsapp',
        user_identifier: phone,
        user_message: user_message,
        bot_response: ai_response,
        metadata: {
          timestamp: timestamp || new Date().toISOString()
        }
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
