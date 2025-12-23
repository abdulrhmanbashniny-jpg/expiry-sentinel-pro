import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    // Handle incoming message
    const message = update.message || update.edited_message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const chatId = message.chat.id;
    const text = message.text || '';
    const fromUser = message.from;

    console.log(`Message from ${fromUser.first_name} (${chatId}): ${text}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate reference number for this conversation
    const refNumber = `TG-${Date.now().toString(36).toUpperCase()}`;

    // Process commands
    let responseText = '';

    if (text.startsWith('/start')) {
      responseText = `مرحباً ${fromUser.first_name}! 👋

أنا مساعدك الإداري لنظام التنبيهات.

📋 <b>الأوامر المتاحة:</b>
/search [كلمة البحث] - البحث عن معاملة
/expiring - عرض المعاملات القريبة من الانتهاء
/help - عرض المساعدة

رقم المرجع: <code>${refNumber}</code>`;
    } 
    else if (text.startsWith('/search')) {
      let query = text.replace('/search', '').trim();
      if (!query) {
        responseText = '❌ الرجاء إدخال كلمة للبحث\n\nمثال: /search رخصة';
      } else {
        // Sanitize input: only allow letters (Arabic/English), numbers, spaces, and basic punctuation
        const sanitizedQuery = query
          .replace(/[%_\\'";\-\-]/g, '') // Remove SQL special characters
          .substring(0, 100); // Limit length
        
        if (!sanitizedQuery || !/^[\p{L}\p{N}\s\-_.]+$/u.test(sanitizedQuery)) {
          responseText = '❌ حروف غير مسموحة في البحث';
        } else {
          // Escape special ILIKE characters
          const escapedQuery = sanitizedQuery.replace(/[%_]/g, '');
          
          // Search items with sanitized input
          const { data: items, error } = await supabase
            .from('items')
            .select(`
              id, ref_number, title, expiry_date, status,
              categories:category_id(name, code)
            `)
            .or(`title.ilike.%${escapedQuery}%,notes.ilike.%${escapedQuery}%,responsible_person.ilike.%${escapedQuery}%,ref_number.ilike.%${escapedQuery}%`)
            .eq('status', 'active')
            .order('expiry_date')
            .limit(5);

        if (error) {
          console.error('Search error:', error);
          responseText = '❌ حدث خطأ في البحث';
        } else if (!items || items.length === 0) {
          responseText = `🔍 لم يتم العثور على نتائج لـ "${query}"`;
        } else {
          responseText = `🔍 <b>نتائج البحث عن "${query}":</b>\n\n`;
          items.forEach((item: any, index: number) => {
            const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const status = daysLeft < 0 ? '🔴 منتهي' : daysLeft <= 7 ? '🟡 قريب' : '🟢 نشط';
            responseText += `${index + 1}. <b>${item.title}</b>\n`;
            responseText += `   📌 الرقم: <code>${item.ref_number || 'غير محدد'}</code>\n`;
            responseText += `   📅 الانتهاء: ${item.expiry_date} (${status})\n\n`;
          });
        }
        }
      }
    }
    else if (text.startsWith('/expiring')) {
      const today = new Date();
      const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id, ref_number, title, expiry_date, status,
          categories:category_id(name, code)
        `)
        .eq('status', 'active')
        .gte('expiry_date', today.toISOString().split('T')[0])
        .lte('expiry_date', next30Days.toISOString().split('T')[0])
        .order('expiry_date')
        .limit(10);

      if (error) {
        console.error('Query error:', error);
        responseText = '❌ حدث خطأ في جلب البيانات';
      } else if (!items || items.length === 0) {
        responseText = '✅ لا توجد معاملات تنتهي خلال 30 يوم';
      } else {
        responseText = `⏰ <b>المعاملات القريبة من الانتهاء:</b>\n\n`;
        items.forEach((item: any, index: number) => {
          const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const urgency = daysLeft <= 7 ? '🔴' : daysLeft <= 14 ? '🟡' : '🟢';
          responseText += `${urgency} <b>${item.title}</b>\n`;
          responseText += `   📌 <code>${item.ref_number || 'غير محدد'}</code>\n`;
          responseText += `   ⏳ متبقي: ${daysLeft} يوم\n\n`;
        });
      }
    }
    else if (text.startsWith('/help')) {
      responseText = `📚 <b>دليل الاستخدام:</b>

🔹 <b>/search [كلمة]</b>
   البحث عن معاملة بالاسم أو الرقم

🔹 <b>/expiring</b>
   عرض المعاملات التي تنتهي خلال 30 يوم

🔹 <b>/help</b>
   عرض هذه الرسالة

💡 <i>يمكنك أيضاً إرسال رقم المعاملة مباشرة للاستفسار عنها</i>`;
    }
    else if (text.match(/^[A-Z]{2,5}-\d{4}-\d{4}$/)) {
      // Direct reference number query
      const { data: item, error } = await supabase
        .from('items')
        .select(`
          *, 
          categories:category_id(name, code),
          reminder_rules:reminder_rule_id(name, days_before)
        `)
        .eq('ref_number', text.toUpperCase())
        .maybeSingle();

      if (error || !item) {
        responseText = `❌ لم يتم العثور على معاملة برقم: <code>${text}</code>`;
      } else {
        const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const status = daysLeft < 0 ? '🔴 منتهي' : daysLeft <= 7 ? '🟡 قريب جداً' : daysLeft <= 30 ? '🟢 قريب' : '✅ نشط';
        
        responseText = `📄 <b>تفاصيل المعاملة:</b>

📌 <b>الرقم:</b> <code>${item.ref_number}</code>
📋 <b>العنوان:</b> ${item.title}
📁 <b>الفئة:</b> ${item.categories?.name || 'غير محدد'}
📅 <b>تاريخ الانتهاء:</b> ${item.expiry_date}
⏳ <b>المتبقي:</b> ${daysLeft} يوم ${status}
👤 <b>المسؤول:</b> ${item.responsible_person || 'غير محدد'}
🏢 <b>القسم:</b> ${item.owner_department || 'غير محدد'}

📝 <b>ملاحظات:</b> ${item.notes || 'لا توجد'}`;
      }
    }
    else {
      responseText = `مرحباً! 👋

للمساعدة، استخدم الأوامر التالية:
• /search [كلمة] - للبحث
• /expiring - المعاملات القريبة من الانتهاء
• /help - دليل المستخدم

أو أرسل رقم المعاملة مباشرة (مثل: LIC-2025-0001)`;
    }

    // Send response
    if (responseText) {
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML'
        })
      });

      // Log conversation to dedicated table
      await supabase.from('conversation_logs').insert({
        ref_number: refNumber,
        platform: 'telegram',
        user_identifier: chatId.toString(),
        user_message: text,
        bot_response: responseText,
        metadata: {
          user: fromUser
        }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
