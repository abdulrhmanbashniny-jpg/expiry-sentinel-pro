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

const defaultTemplate = `🔔 تنبيه: {{title}}

📅 تاريخ الانتهاء: {{expiry_date}}
⏰ الوقت: {{expiry_time}}
⏳ الأيام المتبقية: {{days_left}} يوم

📁 الفئة: {{category}}
👤 المسؤول: {{responsible_person}}

ملاحظة: {{notes}}

---
HR Expiry Reminder System`;

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

    const { item_id, recipient_id } = await req.json();

    if (!item_id || !recipient_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing item_id or recipient_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Preparing message for item:', item_id, 'recipient:', recipient_id, 'by:', user.id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch item
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`
        *,
        category:categories(name)
      `)
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return new Response(
        JSON.stringify({ success: false, error: 'العنصر غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recipient
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .select('*')
      .eq('id', recipient_id)
      .single();

    if (recipientError || !recipient) {
      return new Response(
        JSON.stringify({ success: false, error: 'المستلم غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'whatsapp_template')
      .single();

    const template = settings?.value?.template || defaultTemplate;

    // Calculate days left
    const expiryDate = new Date(item.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Format message
    const message = template
      .replace(/\{\{title\}\}/g, item.title)
      .replace(/\{\{expiry_date\}\}/g, new Date(item.expiry_date).toLocaleDateString('ar-SA'))
      .replace(/\{\{expiry_time\}\}/g, item.expiry_time || '09:00')
      .replace(/\{\{days_left\}\}/g, daysLeft.toString())
      .replace(/\{\{category\}\}/g, item.category?.name || 'غير محدد')
      .replace(/\{\{responsible_person\}\}/g, item.responsible_person || 'غير محدد')
      .replace(/\{\{notes\}\}/g, item.notes || 'لا توجد ملاحظات');

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          phone: recipient.whatsapp_number,
          telegram_id: recipient.telegram_id,
          recipient_name: recipient.name,
          message,
          item_id: item.id,
          recipient_id: recipient.id,
          days_left: daysLeft,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in prepare-message:', error);
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
