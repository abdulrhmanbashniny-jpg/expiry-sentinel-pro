import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { item_id, recipient_id, test_message } = await req.json();
    
    console.log('Test WhatsApp notification request:', { item_id, recipient_id, test_message });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch item details
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`
        *,
        category:categories(name),
        reminder_rule:reminder_rules(name, days_before)
      `)
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      console.error('Error fetching item:', itemError);
      return new Response(
        JSON.stringify({ success: false, error: 'العنصر غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recipient details
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .select('*')
      .eq('id', recipient_id)
      .single();

    if (recipientError || !recipient) {
      console.error('Error fetching recipient:', recipientError);
      return new Response(
        JSON.stringify({ success: false, error: 'المستلم غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get message template from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'whatsapp_template')
      .single();

    const defaultTemplate = `🔔 تنبيه: {{title}}

📅 تاريخ الانتهاء: {{expiry_date}}
⏰ الوقت: {{expiry_time}}
⏳ الأيام المتبقية: {{days_left}} يوم

📁 الفئة: {{category}}
👤 المسؤول: {{responsible_person}}

ملاحظة: {{notes}}

---
HR Expiry Reminder System`;

    const template = settings?.value?.template || defaultTemplate;

    // Calculate days left
    const expiryDate = new Date(item.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Format the message
    const message = template
      .replace(/\{\{title\}\}/g, item.title)
      .replace(/\{\{expiry_date\}\}/g, new Date(item.expiry_date).toLocaleDateString('ar-SA'))
      .replace(/\{\{expiry_time\}\}/g, item.expiry_time || '09:00')
      .replace(/\{\{days_left\}\}/g, daysLeft.toString())
      .replace(/\{\{category\}\}/g, item.category?.name || 'غير محدد')
      .replace(/\{\{responsible_person\}\}/g, item.responsible_person || 'غير محدد')
      .replace(/\{\{notes\}\}/g, item.notes || 'لا توجد ملاحظات');

    console.log('Prepared test message for WhatsApp:', {
      to: recipient.whatsapp_number,
      recipientName: recipient.name,
      message: message.substring(0, 100) + '...'
    });

    // Log the test notification
    const { data: logEntry, error: logError } = await supabase
      .from('notification_log')
      .insert({
        item_id: item.id,
        recipient_id: recipient.id,
        reminder_day: daysLeft,
        scheduled_for: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        status: 'sent',
        provider_message_id: `test_${Date.now()}`,
        error_message: null,
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    // Return the prepared message for n8n or direct WhatsApp integration
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          recipient: {
            name: recipient.name,
            whatsapp_number: recipient.whatsapp_number,
          },
          item: {
            id: item.id,
            title: item.title,
            expiry_date: item.expiry_date,
            expiry_time: item.expiry_time,
            days_left: daysLeft,
          },
          message: message,
          log_id: logEntry?.id,
          webhook_payload: {
            phone: recipient.whatsapp_number,
            message: message,
            item_id: item.id,
            recipient_id: recipient.id,
            is_test: true,
          }
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in test-whatsapp function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
