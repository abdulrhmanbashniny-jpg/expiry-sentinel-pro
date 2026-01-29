import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

interface NotificationRequest {
  type: 'reminder' | 'invitation' | 'alert' | 'system';
  channels: ('whatsapp' | 'telegram' | 'email' | 'in_app')[];
  recipient: {
    user_id?: string;
    profile_id?: string;
    recipient_id?: string;
    name: string;
    phone?: string;
    email?: string;
    telegram_id?: string;
  };
  data: Record<string, any>;
  template_key?: string;
  tenant_id?: string;
  item_id?: string;
  priority?: 'low' | 'normal' | 'high';
}

interface ChannelResult {
  channel: string;
  success: boolean;
  message_id?: string;
  error?: string;
}

// Apply template with variables
function applyTemplate(templateText: string, data: Record<string, any>): string {
  let result = templateText;
  for (const [key, value] of Object.entries(data)) {
    if (key === 'dynamic_fields' && typeof value === 'object') {
      for (const [dKey, dValue] of Object.entries(value as object)) {
        result = result.replace(new RegExp(`{{dynamic_fields\\.${dKey}}}`, 'g'), String(dValue || ''));
      }
    } else {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
    }
  }
  result = result.replace(/{{[\w.]+}}/g, '');
  return result.trim();
}

// Format phone number for WhatsApp
function formatWhatsAppNumber(phone: string): string {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('05')) {
    formatted = '966' + formatted.substring(1);
  } else if (formatted.startsWith('00')) {
    formatted = formatted.substring(2);
  } else if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  }
  return `${formatted}@s.whatsapp.net`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: NotificationRequest = await req.json();
    console.log('Unified Notification Request:', JSON.stringify(payload, null, 2));

    const { type, channels, recipient, data, template_key, tenant_id, item_id, priority } = payload;

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No channels specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ChannelResult[] = [];

    // Get tenant notification settings
    let tenantSettings: any = null;
    if (tenant_id) {
      const { data: settings } = await supabase
        .from('tenant_notification_settings')
        .select('*')
        .eq('tenant_id', tenant_id)
        .single();
      tenantSettings = settings;
    }

    // Get templates based on template_key or use defaults
    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('is_active', true)
      .in('channel', channels);

    // Get integration configs
    const { data: integrations } = await supabase
      .from('integrations')
      .select('key, config, is_active')
      .in('key', ['telegram', 'whatsapp', 'email']);

    const telegramConfig = integrations?.find(i => i.key === 'telegram');
    const whatsappConfig = integrations?.find(i => i.key === 'whatsapp');

    // Also check tenant-specific integrations
    if (tenant_id) {
      const { data: tenantIntegrations } = await supabase
        .from('tenant_integrations')
        .select('integration_key, config, is_active')
        .eq('tenant_id', tenant_id)
        .in('integration_key', ['telegram', 'whatsapp', 'email']);
      
      // Override with tenant-specific if available
      if (tenantIntegrations) {
        for (const ti of tenantIntegrations) {
          if (ti.integration_key === 'telegram' && ti.is_active) {
            // Use tenant telegram config if available
          }
          if (ti.integration_key === 'whatsapp' && ti.is_active) {
            // Use tenant whatsapp config if available
          }
        }
      }
    }

    // Prepare message data with recipient name
    const messageData = {
      ...data,
      recipient_name: recipient.name,
    };

    // ============================================
    // TELEGRAM CHANNEL
    // ============================================
    if (channels.includes('telegram') && recipient.telegram_id) {
      const isEnabled = tenantSettings?.telegram_enabled !== false && telegramConfig?.is_active;
      
      if (isEnabled) {
        try {
          const template = templates?.find(t => t.channel === 'telegram' && (t.template_key === template_key || t.is_default));
          const message = template ? applyTemplate(template.template_text, messageData) : JSON.stringify(messageData);
          
          const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
          
          if (TELEGRAM_BOT_TOKEN) {
            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: recipient.telegram_id,
                text: message,
                parse_mode: 'HTML',
              }),
            });
            
            const result = await response.json();
            
            if (result.ok) {
              results.push({ 
                channel: 'telegram', 
                success: true, 
                message_id: result.result.message_id.toString() 
              });
              console.log('✅ Telegram sent to:', recipient.name);
            } else {
              throw new Error(result.description || 'Telegram API error');
            }
          }
        } catch (error: any) {
          console.error('Telegram error:', error.message);
          results.push({ channel: 'telegram', success: false, error: error.message });
        }
      }
    }

    // ============================================
    // WHATSAPP CHANNEL
    // ============================================
    if (channels.includes('whatsapp') && recipient.phone) {
      const isEnabled = tenantSettings?.whatsapp_enabled !== false && whatsappConfig?.is_active;
      
      if (isEnabled) {
        try {
          const template = templates?.find(t => t.channel === 'whatsapp' && (t.template_key === template_key || t.is_default));
          const message = template ? applyTemplate(template.template_text, messageData) : JSON.stringify(messageData);
          
          const waConfig = whatsappConfig?.config as any;
          const apiKey = waConfig?.apikey || waConfig?.access_token;
          
          if (waConfig?.api_base_url && apiKey && waConfig?.instance_name) {
            const jid = formatWhatsAppNumber(recipient.phone);
            
            const response = await fetch(
              `${waConfig.api_base_url}/message/sendText/${waConfig.instance_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': apiKey,
                },
                body: JSON.stringify({
                  number: jid,
                  textMessage: { text: message },
                }),
              }
            );
            
            const result = await response.json();
            
            if (result.key || result.status === 'PENDING' || result.messageId) {
              results.push({ 
                channel: 'whatsapp', 
                success: true, 
                message_id: result.key?.id || result.messageId 
              });
              console.log('✅ WhatsApp sent to:', recipient.name);
            } else {
              throw new Error(result.message || 'WhatsApp API error');
            }
          }
        } catch (error: any) {
          console.error('WhatsApp error:', error.message);
          results.push({ channel: 'whatsapp', success: false, error: error.message });
        }
      }
    }

    // ============================================
    // EMAIL CHANNEL
    // ============================================
    if (channels.includes('email') && recipient.email) {
      const isEnabled = tenantSettings?.email_enabled === true;
      
      if (isEnabled) {
        try {
          // Email implementation - using Resend if configured
          const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
          
          if (RESEND_API_KEY) {
            const template = templates?.find(t => t.channel === 'email' && (t.template_key === template_key || t.is_default));
            const subject = data.email_subject || `إشعار من HR Reminder`;
            const body = template ? applyTemplate(template.template_text, messageData) : JSON.stringify(messageData);
            
            const fromAddress = tenantSettings?.email_from_address || 'noreply@hr-reminder.com';
            const fromName = tenantSettings?.email_from_name || 'HR Reminder';
            
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: `${fromName} <${fromAddress}>`,
                to: [recipient.email],
                subject: subject,
                html: body,
              }),
            });
            
            const result = await response.json();
            
            if (result.id) {
              results.push({ channel: 'email', success: true, message_id: result.id });
              console.log('✅ Email sent to:', recipient.email);
            } else {
              throw new Error(result.message || 'Email API error');
            }
          } else {
            results.push({ channel: 'email', success: false, error: 'Email not configured (no API key)' });
          }
        } catch (error: any) {
          console.error('Email error:', error.message);
          results.push({ channel: 'email', success: false, error: error.message });
        }
      } else {
        results.push({ channel: 'email', success: false, error: 'Email disabled for tenant' });
      }
    }

    // ============================================
    // IN-APP NOTIFICATION
    // ============================================
    if (channels.includes('in_app') && (recipient.user_id || recipient.profile_id)) {
      try {
        const userId = recipient.user_id || recipient.profile_id;
        
        // Get user_id from profile if we only have profile_id
        let targetUserId = userId;
        if (recipient.profile_id && !recipient.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', recipient.profile_id)
            .single();
          targetUserId = profile?.user_id;
        }
        
        if (targetUserId) {
          const { data: notification, error } = await supabase
            .from('in_app_notifications')
            .insert({
              user_id: targetUserId,
              tenant_id: tenant_id,
              title: data.notification_title || data.title || 'إشعار جديد',
              message: data.notification_message || data.remaining_text || '',
              entity_type: type === 'reminder' ? 'item' : type,
              entity_id: item_id || data.entity_id,
              action_url: data.item_url || data.action_url,
              priority: priority || 'normal',
              notification_type: type,
              source_channel: 'system',
            })
            .select()
            .single();
          
          if (error) throw error;
          
          results.push({ channel: 'in_app', success: true, message_id: notification.id });
          console.log('✅ In-app notification created for:', recipient.name);
        }
      } catch (error: any) {
        console.error('In-app notification error:', error.message);
        results.push({ channel: 'in_app', success: false, error: error.message });
      }
    }

    // Log to notification_log if item_id provided
    if (item_id) {
      for (const result of results) {
        try {
          const recipientId = recipient.recipient_id || recipient.profile_id;
          if (recipientId) {
            await supabase.from('notification_log').insert({
              item_id: item_id,
              recipient_id: recipientId,
              tenant_id: tenant_id,
              reminder_day: data.days_left || 0,
              scheduled_for: new Date().toISOString(),
              sent_at: result.success ? new Date().toISOString() : null,
              status: result.success ? 'sent' : 'failed',
              channel: result.channel,
              provider_message_id: result.message_id,
              error_message: result.error,
            });
          }
        } catch (logError) {
          console.warn('Failed to log notification:', logError);
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Unified notification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
