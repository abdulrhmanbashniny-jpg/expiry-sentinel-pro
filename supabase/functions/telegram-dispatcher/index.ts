import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

// AI Agent System Prompt
const SYSTEM_PROMPT = `أنت مساعد إداري ذكي لنظام تنبيهات انتهاء الصلاحية (Expiry Guard).
مهامك:
- مساعدة الموظفين في البحث عن المعاملات ومتابعتها
- الإجابة على الاستفسارات حول تواريخ الانتهاء
- تنفيذ العمليات حسب صلاحيات المستخدم

قواعد هامة:
1. تحدث دائماً بالعربية
2. كن مختصراً ومحترفاً
3. إذا طُلب منك عملية لا تملك صلاحيتها، اعتذر بلطف واشرح السبب
4. للحذف أو التعديلات الحساسة، تأكد أن المستخدم admin

الأدوات المتاحة لك:
- search_items: البحث عن معاملات
- get_item_details: تفاصيل معاملة محددة
- get_due_items: المعاملات القريبة من الانتهاء
- create_item: إنشاء معاملة جديدة (HR و admin فقط)
- update_item: تعديل معاملة (HR و admin فقط)
- delete_item: حذف معاملة (admin فقط)

دور المستخدم الحالي: {USER_ROLE}
اسم المستخدم: {USER_NAME}`;

// Tool definitions for AI
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_items",
      description: "البحث عن معاملات بالاسم أو الوصف",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "كلمة البحث" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_item_details",
      description: "الحصول على تفاصيل معاملة محددة برقمها المرجعي",
      parameters: {
        type: "object",
        properties: {
          ref_number: { type: "string", description: "الرقم المرجعي للمعاملة" }
        },
        required: ["ref_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_due_items",
      description: "الحصول على المعاملات القريبة من الانتهاء",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "عدد الأيام للبحث (افتراضي 7)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_item",
      description: "إنشاء معاملة جديدة - متاح لـ HR و admin فقط",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المعاملة" },
          expiry_date: { type: "string", description: "تاريخ الانتهاء YYYY-MM-DD" },
          responsible_person: { type: "string", description: "المسؤول" },
          category_id: { type: "string", description: "معرف الفئة (اختياري)" },
          notes: { type: "string", description: "ملاحظات (اختياري)" }
        },
        required: ["title", "expiry_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_item",
      description: "تعديل معاملة - متاح لـ HR و admin فقط",
      parameters: {
        type: "object",
        properties: {
          ref_number: { type: "string", description: "الرقم المرجعي" },
          title: { type: "string" },
          expiry_date: { type: "string" },
          responsible_person: { type: "string" },
          notes: { type: "string" },
          status: { type: "string", enum: ["active", "archived", "expired"] }
        },
        required: ["ref_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_item",
      description: "حذف معاملة - متاح لـ admin فقط",
      parameters: {
        type: "object",
        properties: {
          ref_number: { type: "string", description: "الرقم المرجعي للمعاملة المراد حذفها" }
        },
        required: ["ref_number"]
      }
    }
  }
];

// Execute tool functions
async function executeTool(supabase: any, toolName: string, args: any, userRole: string): Promise<string> {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  switch (toolName) {
    case "search_items": {
      const { data, error } = await supabase
        .from('items')
        .select('ref_number, title, expiry_date, status, responsible_person, category:categories(name)')
        .or(`title.ilike.%${args.query}%,notes.ilike.%${args.query}%,responsible_person.ilike.%${args.query}%`)
        .limit(10);
      
      if (error) return `خطأ في البحث: ${error.message}`;
      if (!data?.length) return "لم يتم العثور على نتائج";
      
      return data.map((item: any) => 
        `📄 ${item.ref_number}: ${item.title}\n   📅 ${item.expiry_date} | 👤 ${item.responsible_person || 'غير محدد'} | 📁 ${item.category?.name || 'بدون فئة'}`
      ).join('\n\n');
    }
    
    case "get_item_details": {
      const { data, error } = await supabase
        .from('items')
        .select('*, category:categories(name, risk_level), reminder_rule:reminder_rules(name, days_before)')
        .eq('ref_number', args.ref_number)
        .single();
      
      if (error) return `خطأ: ${error.message}`;
      if (!data) return "المعاملة غير موجودة";
      
      const today = new Date();
      const expiryDate = new Date(data.expiry_date);
      const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return `📋 تفاصيل المعاملة: ${data.ref_number}
━━━━━━━━━━━━━━━━━━━━
📌 العنوان: ${data.title}
📅 تاريخ الانتهاء: ${data.expiry_date}
⏳ المتبقي: ${daysLeft > 0 ? `${daysLeft} يوم` : daysLeft === 0 ? 'اليوم!' : `متأخر ${Math.abs(daysLeft)} يوم`}
📊 الحالة: ${data.status === 'active' ? '🟢 نشط' : data.status === 'expired' ? '🔴 منتهي' : '📦 مؤرشف'}
👤 المسؤول: ${data.responsible_person || 'غير محدد'}
🏢 القسم: ${data.owner_department || 'غير محدد'}
📁 الفئة: ${data.category?.name || 'بدون فئة'} ${data.category?.risk_level === 'high' ? '⚠️' : ''}
📝 ملاحظات: ${data.notes || 'لا توجد'}`;
    }
    
    case "get_due_items": {
      const days = args.days || 7;
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      
      const { data, error } = await supabase
        .from('items')
        .select('ref_number, title, expiry_date, responsible_person')
        .eq('status', 'active')
        .gte('expiry_date', today)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(15);
      
      if (error) return `خطأ: ${error.message}`;
      if (!data?.length) return `لا توجد معاملات تنتهي خلال ${days} أيام القادمة ✅`;
      
      return `⏰ المعاملات التي تنتهي خلال ${days} أيام:\n━━━━━━━━━━━━━━━━━━━━\n` +
        data.map((item: any) => `📄 ${item.ref_number}: ${item.title}\n   📅 ${item.expiry_date} | 👤 ${item.responsible_person || 'غير محدد'}`).join('\n\n');
    }
    
    case "create_item": {
      if (!['admin', 'system_admin', 'hr_user'].includes(userRole)) {
        return "⛔ عذراً، لا تملك صلاحية إنشاء معاملات جديدة";
      }
      
      const { data, error } = await supabase
        .from('items')
        .insert({
          title: args.title,
          expiry_date: args.expiry_date,
          responsible_person: args.responsible_person,
          category_id: args.category_id,
          notes: args.notes,
          status: 'active'
        })
        .select('ref_number, title')
        .single();
      
      if (error) return `خطأ في الإنشاء: ${error.message}`;
      return `✅ تم إنشاء المعاملة بنجاح!\nالرقم المرجعي: ${data.ref_number}\nالعنوان: ${data.title}`;
    }
    
    case "update_item": {
      if (!['admin', 'system_admin', 'hr_user'].includes(userRole)) {
        return "⛔ عذراً، لا تملك صلاحية تعديل المعاملات";
      }
      
      const updates: any = {};
      if (args.title) updates.title = args.title;
      if (args.expiry_date) updates.expiry_date = args.expiry_date;
      if (args.responsible_person) updates.responsible_person = args.responsible_person;
      if (args.notes) updates.notes = args.notes;
      if (args.status) updates.status = args.status;
      
      const { error } = await supabase
        .from('items')
        .update(updates)
        .eq('ref_number', args.ref_number);
      
      if (error) return `خطأ في التحديث: ${error.message}`;
      return `✅ تم تحديث المعاملة ${args.ref_number} بنجاح`;
    }
    
    case "delete_item": {
      if (!['admin', 'system_admin'].includes(userRole)) {
        return "⛔ عذراً، الحذف متاح فقط للمديرين";
      }
      
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('ref_number', args.ref_number);
      
      if (error) return `خطأ في الحذف: ${error.message}`;
      return `🗑️ تم حذف المعاملة ${args.ref_number} بنجاح`;
    }
    
    default:
      return "أداة غير معروفة";
  }
}

// Call AI with tools
async function callAI(messages: any[], userRole: string, userName: string): Promise<any> {
  const systemPrompt = SYSTEM_PROMPT
    .replace('{USER_ROLE}', userRole)
    .replace('{USER_NAME}', userName);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: TOOLS,
      tool_choice: 'auto'
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', response.status, errorText);
    throw new Error(`AI error: ${response.status}`);
  }
  
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify internal key
    const internalKey = req.headers.get('x-internal-key');
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('key', 'n8n')
      .single();
    
    const expectedKey = integration?.config?.internal_key;
    if (!internalKey || internalKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { telegram_user_id, chat_id, message_text } = await req.json();
    
    console.log(`Processing message from Telegram user: ${telegram_user_id}`);
    
    // Find user by telegram_user_id
    let userRole = 'employee';
    let userName = 'مستخدم';
    let userId: string | null = null;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('telegram_user_id', telegram_user_id)
      .single();
    
    if (profile) {
      userId = profile.user_id;
      userName = profile.full_name || 'مستخدم';
      
      // Get user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', profile.user_id)
        .single();
      
      if (roleData) {
        userRole = roleData.role;
      }
    }
    
    console.log(`User: ${userName}, Role: ${userRole}`);
    
    // Get conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('conversation_logs')
      .select('user_message, bot_response')
      .eq('user_identifier', telegram_user_id)
      .eq('platform', 'telegram')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Build messages array
    const messages: any[] = [];
    
    // Add history in reverse order
    if (history && history.length > 0) {
      for (const log of history.reverse()) {
        if (log.user_message) {
          messages.push({ role: 'user', content: log.user_message });
        }
        if (log.bot_response) {
          messages.push({ role: 'assistant', content: log.bot_response });
        }
      }
    }
    
    // Add current message
    messages.push({ role: 'user', content: message_text });
    
    // Call AI
    let aiResponse = await callAI(messages, userRole, userName);
    let assistantMessage = aiResponse.choices[0].message;
    let replyText = '';
    
    // Process tool calls if any
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: any[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        const result = await executeTool(supabase, toolName, toolArgs, userRole);
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }
      
      // Add assistant message and tool results
      messages.push(assistantMessage);
      messages.push(...toolResults);
      
      // Call AI again with tool results
      aiResponse = await callAI(messages, userRole, userName);
      assistantMessage = aiResponse.choices[0].message;
    }
    
    replyText = assistantMessage.content || 'عذراً، لم أتمكن من معالجة طلبك';
    
    // Log conversation
    await supabase.from('conversation_logs').insert({
      user_identifier: telegram_user_id,
      platform: 'telegram',
      ref_number: `TG-${Date.now()}`,
      user_message: message_text,
      bot_response: replyText,
      metadata: { chat_id, user_role: userRole }
    });
    
    return new Response(JSON.stringify({
      chat_id,
      reply_text: replyText,
      reply_markup: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Dispatcher error:', error);
    return new Response(JSON.stringify({
      error: error?.message || 'Unknown error',
      reply_text: 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة لاحقاً.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
