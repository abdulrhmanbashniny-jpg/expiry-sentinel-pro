import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

// AI Advisor System Prompt for Admins
const SYSTEM_PROMPT = `أنت مستشار امتثال ذكي لنظام Expiry Guard.
أنت تتحدث مع مدير النظام ولديك صلاحيات كاملة للوصول للبيانات والتحليلات.

مهامك:
- تحليل بيانات الالتزام والأداء
- تقديم تقارير وإحصائيات
- اقتراح سياسات تحسين
- الإجابة على الأسئلة التحليلية

تحدث بالعربية دائماً وكن مختصراً ومهنياً.
استخدم الأرقام والإحصائيات عند الإمكان.
قدم اقتراحات عملية وقابلة للتطبيق.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_global_stats",
      description: "إحصائيات عامة عن النظام",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_score_by_department",
      description: "درجات الالتزام حسب القسم",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["weekly", "monthly", "yearly"], description: "الفترة الزمنية" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_score_by_category",
      description: "درجات الالتزام حسب الفئة",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["weekly", "monthly", "yearly"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_expiring_summary",
      description: "ملخص المعاملات المنتهية والقادمة",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "عدد الأيام" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_trend_analysis",
      description: "تحليل الاتجاه الزمني للالتزام",
      parameters: {
        type: "object",
        properties: {
          months: { type: "number", description: "عدد الأشهر للتحليل" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_top_performers",
      description: "أفضل وأسوأ المسؤولين أداءً",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "عدد النتائج" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggest_improvements",
      description: "اقتراحات لتحسين الأداء بناءً على البيانات",
      parameters: { type: "object", properties: {} }
    }
  }
];

async function executeTool(supabase: any, toolName: string, args: any): Promise<string> {
  console.log(`Executing admin tool: ${toolName}`, args);
  
  switch (toolName) {
    case "get_global_stats": {
      const today = new Date().toISOString().split('T')[0];
      
      const [itemsResult, expiredResult, activeResult, notificationsResult] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact' }),
        supabase.from('items').select('id', { count: 'exact' }).eq('status', 'expired'),
        supabase.from('items').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('notification_log').select('id', { count: 'exact' }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      ]);
      
      const total = itemsResult.count || 0;
      const expired = expiredResult.count || 0;
      const active = activeResult.count || 0;
      const notifications = notificationsResult.count || 0;
      
      return `📊 إحصائيات النظام العامة:
━━━━━━━━━━━━━━━━━━━━
📋 إجمالي المعاملات: ${total}
🟢 معاملات نشطة: ${active}
🔴 معاملات منتهية: ${expired}
📧 إشعارات آخر 30 يوم: ${notifications}
📈 نسبة الالتزام: ${total > 0 ? Math.round(((total - expired) / total) * 100) : 0}%`;
    }
    
    case "get_score_by_department": {
      const { data } = await supabase
        .from('items')
        .select('owner_department, status, expiry_date');
      
      if (!data?.length) return "لا توجد بيانات كافية للتحليل";
      
      const deptStats: Record<string, { total: number, onTime: number, late: number }> = {};
      const today = new Date();
      
      for (const item of data) {
        const dept = item.owner_department || 'غير محدد';
        if (!deptStats[dept]) deptStats[dept] = { total: 0, onTime: 0, late: 0 };
        deptStats[dept].total++;
        
        if (item.status === 'expired' || new Date(item.expiry_date) < today) {
          deptStats[dept].late++;
        } else {
          deptStats[dept].onTime++;
        }
      }
      
      const results = Object.entries(deptStats)
        .map(([dept, stats]) => ({
          dept,
          score: Math.round((stats.onTime / stats.total) * 100),
          ...stats
        }))
        .sort((a, b) => b.score - a.score);
      
      return `📊 أداء الأقسام:
━━━━━━━━━━━━━━━━━━━━
${results.map((r, i) => 
  `${i + 1}. ${r.dept}: ${r.score}% ${r.score >= 80 ? '🟢' : r.score >= 60 ? '🟡' : '🔴'}
   (${r.total} معاملة | ${r.onTime} في الوقت | ${r.late} متأخر)`
).join('\n\n')}`;
    }
    
    case "get_score_by_category": {
      const { data } = await supabase
        .from('items')
        .select('status, expiry_date, category:categories(name, risk_level)');
      
      if (!data?.length) return "لا توجد بيانات كافية";
      
      const catStats: Record<string, { total: number, onTime: number, late: number, risk: string }> = {};
      const today = new Date();
      
      for (const item of data) {
        const cat = item.category?.name || 'بدون فئة';
        if (!catStats[cat]) catStats[cat] = { total: 0, onTime: 0, late: 0, risk: item.category?.risk_level || 'medium' };
        catStats[cat].total++;
        
        if (item.status === 'expired' || new Date(item.expiry_date) < today) {
          catStats[cat].late++;
        } else {
          catStats[cat].onTime++;
        }
      }
      
      const results = Object.entries(catStats)
        .map(([cat, stats]) => ({
          cat,
          score: Math.round((stats.onTime / stats.total) * 100),
          ...stats
        }))
        .sort((a, b) => a.score - b.score);
      
      return `📁 أداء الفئات:
━━━━━━━━━━━━━━━━━━━━
${results.map(r => 
  `${r.cat} ${r.risk === 'high' ? '⚠️' : ''}: ${r.score}% ${r.score >= 80 ? '🟢' : r.score >= 60 ? '🟡' : '🔴'}
   (${r.total} معاملة | ${r.late} متأخر)`
).join('\n')}`;
    }
    
    case "get_expiring_summary": {
      const days = args.days || 30;
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      
      const { data } = await supabase
        .from('items')
        .select('ref_number, title, expiry_date, responsible_person, category:categories(name)')
        .eq('status', 'active')
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });
      
      if (!data?.length) return `✅ لا توجد معاملات تنتهي خلال ${days} يوم`;
      
      const expired = data.filter((i: any) => new Date(i.expiry_date) < today);
      const thisWeek = data.filter((i: any) => {
        const d = new Date(i.expiry_date);
        return d >= today && d <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      });
      
      return `📅 ملخص المعاملات (${days} يوم):
━━━━━━━━━━━━━━━━━━━━
🔴 منتهية: ${expired.length}
⚠️ هذا الأسبوع: ${thisWeek.length}
📋 الإجمالي: ${data.length}

أهم المعاملات:
${data.slice(0, 5).map((i: any) => `• ${i.ref_number}: ${i.title} (${i.expiry_date})`).join('\n')}`;
    }
    
    case "get_trend_analysis": {
      const months = args.months || 6;
      const results: { month: string, total: number, late: number }[] = [];
      
      for (let i = 0; i < months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const { data } = await supabase
          .from('items')
          .select('status, expiry_date')
          .gte('expiry_date', startOfMonth.toISOString().split('T')[0])
          .lte('expiry_date', endOfMonth.toISOString().split('T')[0]);
        
        const total = data?.length || 0;
        const late = data?.filter((i: any) => i.status === 'expired').length || 0;
        
        results.push({
          month: `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`,
          total,
          late
        });
      }
      
      return `📈 تحليل الاتجاه (آخر ${months} أشهر):
━━━━━━━━━━━━━━━━━━━━
${results.reverse().map(r => 
  `${r.month}: ${r.total} معاملة | ${r.total > 0 ? Math.round(((r.total - r.late) / r.total) * 100) : 0}% التزام`
).join('\n')}`;
    }
    
    case "get_top_performers": {
      const count = args.count || 5;
      
      const { data } = await supabase
        .from('items')
        .select('responsible_person, status, expiry_date');
      
      if (!data?.length) return "لا توجد بيانات كافية";
      
      const personStats: Record<string, { total: number, onTime: number }> = {};
      const today = new Date();
      
      for (const item of data) {
        const person = item.responsible_person || 'غير محدد';
        if (!personStats[person]) personStats[person] = { total: 0, onTime: 0 };
        personStats[person].total++;
        
        if (item.status !== 'expired' && new Date(item.expiry_date) >= today) {
          personStats[person].onTime++;
        }
      }
      
      const sorted = Object.entries(personStats)
        .filter(([_, s]) => s.total >= 3)
        .map(([person, stats]) => ({
          person,
          score: Math.round((stats.onTime / stats.total) * 100),
          ...stats
        }))
        .sort((a, b) => b.score - a.score);
      
      const best = sorted.slice(0, count);
      const worst = sorted.slice(-count).reverse();
      
      return `👥 أداء المسؤولين:
━━━━━━━━━━━━━━━━━━━━
🏆 الأفضل أداءً:
${best.map((p, i) => `${i + 1}. ${p.person}: ${p.score}% (${p.total} معاملة)`).join('\n')}

⚠️ يحتاجون تحسين:
${worst.map((p, i) => `${i + 1}. ${p.person}: ${p.score}% (${p.total} معاملة)`).join('\n')}`;
    }
    
    case "suggest_improvements": {
      // Analyze data and provide suggestions
      const { data: items } = await supabase
        .from('items')
        .select('status, expiry_date, category:categories(name, risk_level), owner_department');
      
      const { data: rules } = await supabase
        .from('reminder_rules')
        .select('*');
      
      const suggestions: string[] = [];
      
      // Check high-risk categories
      const highRiskLate = items?.filter((i: any) => 
        i.category?.risk_level === 'high' && i.status === 'expired'
      ).length || 0;
      
      if (highRiskLate > 0) {
        suggestions.push(`⚠️ يوجد ${highRiskLate} معاملة عالية الخطورة متأخرة - يُنصح بإضافة تذكير إضافي قبل 45 يوم للفئات عالية الخطورة`);
      }
      
      // Check departments with low performance
      const deptPerf: Record<string, number[]> = {};
      items?.forEach((i: any) => {
        const dept = i.owner_department || 'other';
        if (!deptPerf[dept]) deptPerf[dept] = [0, 0];
        deptPerf[dept][0]++;
        if (i.status === 'expired') deptPerf[dept][1]++;
      });
      
      const lowPerfDepts = Object.entries(deptPerf)
        .filter(([_, [total, late]]) => total > 5 && (late / total) > 0.3)
        .map(([dept]) => dept);
      
      if (lowPerfDepts.length > 0) {
        suggestions.push(`📉 الأقسام التالية تحتاج متابعة خاصة: ${lowPerfDepts.join(', ')}`);
      }
      
      // Check reminder rules
      if (!rules?.some((r: any) => r.days_before?.includes(45))) {
        suggestions.push(`💡 يُنصح بإضافة قاعدة تذكير قبل 45 يوم للمعاملات طويلة المدى`);
      }
      
      if (suggestions.length === 0) {
        suggestions.push('✅ النظام يعمل بشكل جيد - لا توجد اقتراحات عاجلة');
      }
      
      return `💡 اقتراحات التحسين:
━━━━━━━━━━━━━━━━━━━━
${suggestions.join('\n\n')}`;
    }
    
    default:
      return "أداة غير معروفة";
  }
}

async function callAI(messages: any[]): Promise<any> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
    // Verify JWT auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (!roleData || !['admin', 'system_admin'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { message, conversation_id } = await req.json();
    
    // Get conversation history
    const { data: history } = await supabase
      .from('admin_conversations')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(20);
    
    const messages = [
      ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];
    
    // Save user message
    await supabase.from('admin_conversations').insert({
      user_id: user.id,
      role: 'user',
      content: message
    });
    
    // Call AI
    let aiResponse = await callAI(messages);
    let assistantMessage = aiResponse.choices[0].message;
    
    // Process tool calls
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: any[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        const result = await executeTool(supabase, toolName, toolArgs);
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }
      
      messages.push(assistantMessage);
      messages.push(...toolResults);
      
      aiResponse = await callAI(messages);
      assistantMessage = aiResponse.choices[0].message;
    }
    
    const replyText = assistantMessage.content || 'عذراً، لم أتمكن من معالجة طلبك';
    
    // Save assistant response
    await supabase.from('admin_conversations').insert({
      user_id: user.id,
      role: 'assistant',
      content: replyText
    });
    
    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('AI Advisor error:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error',
      reply: 'عذراً، حدث خطأ في معالجة طلبك'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
