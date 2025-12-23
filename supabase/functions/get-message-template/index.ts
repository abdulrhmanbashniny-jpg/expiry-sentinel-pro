import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Authentication helper
async function verifyAuth(req: Request) {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'GET') {
      // Get template
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'whatsapp_template')
        .single();

      const template = settings?.value?.template || defaultTemplate;

      return new Response(
        JSON.stringify({
          success: true,
          template,
          variables: [
            '{{title}}',
            '{{expiry_date}}',
            '{{expiry_time}}',
            '{{days_left}}',
            '{{category}}',
            '{{responsible_person}}',
            '{{notes}}',
          ],
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'POST') {
      // Update template
      const { template } = await req.json();

      if (!template) {
        return new Response(
          JSON.stringify({ success: false, error: 'Template is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'whatsapp_template',
          value: { template },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'تم حفظ القالب بنجاح' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-message-template:', error);
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
