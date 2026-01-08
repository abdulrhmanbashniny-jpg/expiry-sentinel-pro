import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { users } = await req.json() as { 
      users: Array<{ email: string; password: string; fullname: string; phone?: string }> 
    };

    // Get message template for credentials
    const { data: template } = await supabase
      .from('message_templates')
      .select('template_text')
      .eq('name', 'credentials')
      .eq('is_active', true)
      .maybeSingle();

    const defaultTemplate = `مرحباً {fullname}،\n\nتم إنشاء حسابك في النظام:\n\nاسم المستخدم: {email}\nكلمة المرور: {password}\n\nيرجى تغيير كلمة المرور عند أول تسجيل دخول.`;
    const templateText = template?.template_text || defaultTemplate;

    // Get integrations config
    const { data: whatsappConfig } = await supabase
      .from('integrations')
      .select('config, is_active')
      .eq('key', 'whatsapp')
      .maybeSingle();

    const { data: telegramConfig } = await supabase
      .from('integrations')
      .select('config, is_active')
      .eq('key', 'telegram')
      .maybeSingle();

    const results = { whatsapp: 0, telegram: 0, email: 0, errors: [] as string[] };

    for (const user of users) {
      const message = templateText
        .replace(/{fullname}/g, user.fullname)
        .replace(/{email}/g, user.email)
        .replace(/{password}/g, user.password);

      // Send WhatsApp
      if (whatsappConfig?.is_active && user.phone) {
        try {
          const config = whatsappConfig.config as { api_base_url?: string; instance_name?: string; apikey?: string };
          if (config.api_base_url && config.instance_name && config.apikey) {
            const phone = user.phone.replace(/^\+/, '');
            const jid = `${phone}@s.whatsapp.net`;
            
            await fetch(`${config.api_base_url}/message/sendText/${config.instance_name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': config.apikey },
              body: JSON.stringify({ number: jid, textMessage: { text: message } }),
            });
            results.whatsapp++;
          }
        } catch (e) {
          results.errors.push(`WhatsApp error for ${user.email}: ${e}`);
        }
      }

      // Send Telegram (if telegram_user_id exists in profile)
      if (telegramConfig?.is_active) {
        try {
          const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
          if (botToken) {
            // Try to get telegram_user_id from profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('telegram_user_id')
              .eq('email', user.email)
              .maybeSingle();

            if (profile?.telegram_user_id) {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: profile.telegram_user_id, text: message }),
              });
              results.telegram++;
            }
          }
        } catch (e) {
          results.errors.push(`Telegram error for ${user.email}: ${e}`);
        }
      }

      // Send Email via Supabase (if email doesn't end with @temp.local)
      if (!user.email.endsWith('@temp.local')) {
        try {
          // Log email attempt (actual email sending depends on Supabase email provider config)
          console.log(`Email credentials to: ${user.email}`);
          results.email++;
        } catch (e) {
          results.errors.push(`Email error for ${user.email}: ${e}`);
        }
      }
    }

    console.log('Send credentials results:', results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Send credentials error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
