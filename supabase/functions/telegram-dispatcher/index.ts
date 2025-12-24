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
5. عند /start أو /help، قدم نفسك واشرح الأوامر المتاحة
6. استخدم الأدوات للإجابة على أسئلة المعاملات

الأدوات المتاحة لك:
- search_items: البحث عن معاملات
- get_item_details: تفاصيل معاملة محددة
- get_due_items: المعاملات القريبة من الانتهاء
- create_item: إنشاء معاملة جديدة (HR و admin فقط)
- update_item: تعديل معاملة (HR و admin فقط)
- delete_item: حذف معاملة (admin فقط)

دور المستخدم الحالي: {USER_ROLE}
اسم المستخدم: {USER_NAME}

أمثلة على الاستخدام:
- "ما المعاملات القريبة من الانتهاء؟" -> استخدم get_due_items
- "ابحث عن رخصة البلدية" -> استخدم search_items
- "تفاصيل المعاملة REF-2025-0001" -> استخدم get_item_details
- "/start" أو "/help" -> قدم تعريف بالنظام والأوامر المتاحة`;

// Tool definitions for AI
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_items",
      description: "البحث عن معاملات بالاسم أو الوصف أو المسؤول",
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
      description: "الحصول على المعاملات القريبة من الانتهاء خلال عدد أيام محدد",
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
  console.log(`Executing tool: ${toolName} with args:`, JSON.stringify(args));
  
  switch (toolName) {
    case "search_items": {
      const { data, error } = await supabase
        .from('items')
        .select('ref_number, title, expiry_date, status, responsible_person, category:categories(name)')
        .or(`title.ilike.%${args.query}%,notes.ilike.%${args.query}%,responsible_person.ilike.%${args.query}%`)
        .limit(10);
      
      if (error) {
        console.error('Search error:', error);
        return `خطأ في البحث: ${error.message}`;
      }
      if (!data?.length) return "لم يتم العثور على نتائج مطابقة للبحث";
      
      return `نتائج البحث (${data.length}):\n━━━━━━━━━━━━━━━━━━━━\n` + 
        data.map((item: any) => 
          `📄 ${item.ref_number}: ${item.title}\n   📅 ${item.expiry_date} | 👤 ${item.responsible_person || 'غير محدد'} | 📁 ${item.category?.name || 'بدون فئة'}`
        ).join('\n\n');
    }
    
    case "get_item_details": {
      const { data, error } = await supabase
        .from('items')
        .select('*, category:categories(name, risk_level), reminder_rule:reminder_rules(name, days_before)')
        .eq('ref_number', args.ref_number)
        .single();
      
      if (error) {
        console.error('Item details error:', error);
        return `خطأ: ${error.message}`;
      }
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
        .select('ref_number, title, expiry_date, responsible_person, category:categories(name)')
        .eq('status', 'active')
        .gte('expiry_date', today)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(15);
      
      if (error) {
        console.error('Due items error:', error);
        return `خطأ: ${error.message}`;
      }
      if (!data?.length) return `✅ لا توجد معاملات تنتهي خلال ${days} أيام القادمة`;
      
      return `⏰ المعاملات التي تنتهي خلال ${days} أيام (${data.length}):\n━━━━━━━━━━━━━━━━━━━━\n` +
        data.map((item: any) => {
          const expiryDate = new Date(item.expiry_date);
          const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return `📄 ${item.ref_number}: ${item.title}\n   📅 ${item.expiry_date} (${daysLeft} يوم) | 👤 ${item.responsible_person || 'غير محدد'}`;
        }).join('\n\n');
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
      
      if (error) {
        console.error('Create error:', error);
        return `خطأ في الإنشاء: ${error.message}`;
      }
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
      
      if (error) {
        console.error('Update error:', error);
        return `خطأ في التحديث: ${error.message}`;
      }
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
      
      if (error) {
        console.error('Delete error:', error);
        return `خطأ في الحذف: ${error.message}`;
      }
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
  
  console.log('Calling AI with messages:', JSON.stringify(messages.slice(-3)));
  
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
    throw new Error(`AI error: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('AI response:', JSON.stringify(result.choices?.[0]?.message));
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get request body first to log it
    const body = await req.json();
    console.log('Received request body:', JSON.stringify(body));
    
    // Verify internal key (n8n -> telegram-dispatcher)
    // مصدر الحقيقة هو قاعدة البيانات (integrations.config.internal_key)،
    // لكننا نقبل أيضاً قيمة البيئة INTERNAL_FUNCTION_KEY للتوافق.
    const internalKey = req.headers.get('x-internal-key');

    const expectedEnvKey = Deno.env.get('INTERNAL_FUNCTION_KEY') || undefined;

    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('config')
      .eq('key', 'n8n')
      .maybeSingle();

    if (integrationError) {
      console.error('Auth check failed - cannot read integrations config:', integrationError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cfg = (integration?.config as Record<string, any> | null) ?? null;
    const expectedDbKey = (cfg?.internal_key as string | undefined) || (cfg?.internalkey as string | undefined);

    const allowedKeys = new Set([expectedEnvKey, expectedDbKey].filter(Boolean) as string[]);

    if (!internalKey || allowedKeys.size === 0 || !allowedKeys.has(internalKey)) {
      console.error('Auth failed - key mismatch');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Extract fields - handle different possible field names from n8n
    const telegram_user_id = body.telegram_user_id || body.user_id || body.from?.id?.toString();
    const chat_id = body.chat_id || body.message?.chat?.id;
    const message_text = body.message_text || body.text || body.message?.text || '';
    
    console.log(`Processing: user_id=${telegram_user_id}, chat_id=${chat_id}, text="${message_text}"`);
    
    if (!chat_id || !message_text) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        chat_id: chat_id || 'unknown',
        reply_text: 'عذراً، لم أستطع قراءة رسالتك. حاول مرة أخرى.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Find user by telegram_user_id
    let userRole = 'employee';
    let userName = 'مستخدم';
    
    if (telegram_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('telegram_user_id', telegram_user_id.toString())
        .single();
      
      if (profile) {
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
    }
    
    console.log(`User: ${userName}, Role: ${userRole}`);
    
    // Get conversation history (last 5 exchanges)
    const { data: history } = await supabase
      .from('conversation_logs')
      .select('user_message, bot_response')
      .eq('user_identifier', telegram_user_id?.toString() || chat_id?.toString())
      .eq('platform', 'telegram')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Build messages array
    const messages: any[] = [];
    
    // Add history in reverse order (oldest first)
    if (history && history.length > 0) {
      for (const log of [...history].reverse()) {
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
    let assistantMessage = aiResponse.choices?.[0]?.message;
    
    if (!assistantMessage) {
      throw new Error('No response from AI');
    }
    
    let replyText = '';
    
    // Process tool calls if any
    let iterations = 0;
    const maxIterations = 5;
    
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
      iterations++;
      console.log(`Processing tool calls (iteration ${iterations})`);
      
      const toolResults: any[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.error('Failed to parse tool args:', toolCall.function.arguments);
        }
        
        console.log(`Executing tool: ${toolName}`);
        const result = await executeTool(supabase, toolName, toolArgs, userRole);
        console.log(`Tool result: ${result.substring(0, 200)}...`);
        
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
      assistantMessage = aiResponse.choices?.[0]?.message;
      
      if (!assistantMessage) {
        throw new Error('No response from AI after tool call');
      }
    }
    
    replyText = assistantMessage.content || 'عذراً، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى.';
    
    console.log(`Final reply: ${replyText.substring(0, 200)}...`);
    
    // Log conversation
    await supabase.from('conversation_logs').insert({
      user_identifier: telegram_user_id?.toString() || chat_id?.toString(),
      platform: 'telegram',
      ref_number: `TG-${Date.now()}`,
      user_message: message_text,
      bot_response: replyText,
      metadata: { chat_id, user_role: userRole, user_name: userName }
    });
    
    return new Response(JSON.stringify({
      chat_id,
      reply_text: replyText
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
