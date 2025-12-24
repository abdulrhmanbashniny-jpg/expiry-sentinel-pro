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

    const { recipient_id } = await req.json();

    if (!recipient_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing recipient_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching recipient:', recipient_id, 'by user:', user.id);

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
