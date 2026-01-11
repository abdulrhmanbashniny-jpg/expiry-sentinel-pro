import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Multi-Agent Orchestrator for AI Advisor
// Routes requests to specialized agents based on intent

interface AgentConfig {
  agent_key: string;
  name: string;
  system_prompt: string;
  allowed_tools: string[];
  data_access_scope: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'system_admin'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, conversation_id, context } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load agent configurations
    const { data: agents } = await supabase
      .from('ai_agent_configs')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    const orchestrator = agents?.find(a => a.agent_key === 'orchestrator');
    const specializedAgents = agents?.filter(a => a.agent_key !== 'orchestrator') || [];

    // Determine intent and route to appropriate agent
    const intent = await determineIntent(message, specializedAgents);
    const selectedAgent = specializedAgents.find(a => a.agent_key === intent.agent) || specializedAgents[0];

    console.log('Intent:', intent, 'Selected agent:', selectedAgent?.agent_key);

    // Get conversation history
    const { data: history } = await supabase
      .from('admin_conversations')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (history || []).reverse();

    // Get relevant data based on agent's data access scope
    const agentContext = await getAgentContext(supabase, selectedAgent, message);

    // Build messages for AI
    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt(selectedAgent, agentContext)
      },
      ...conversationHistory.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Save user message
    await supabase.from('admin_conversations').insert({
      user_id: user.id,
      role: 'user',
      content: message,
      metadata: { agent: selectedAgent?.agent_key, intent }
    });

    // Call AI
    const aiResponse = await callAI(messages, selectedAgent);

    // Save assistant response
    await supabase.from('admin_conversations').insert({
      user_id: user.id,
      role: 'assistant',
      content: aiResponse.content,
      metadata: { agent: selectedAgent?.agent_key, tokens_used: aiResponse.tokens_used }
    });

    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse.content,
        agent: selectedAgent?.name,
        intent: intent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in ai-orchestrator:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Determine user intent based on message
async function determineIntent(message: string, agents: AgentConfig[]): Promise<{ agent: string; confidence: number }> {
  const lowerMessage = message.toLowerCase();
  
  const intentPatterns: Record<string, string[]> = {
    'reminder': ['تذكير', 'تنبيه', 'إرسال', 'رسالة', 'قالب', 'واتساب', 'تيليجرام', 'reminder', 'notification', 'template'],
    'compliance': ['امتثال', 'تقرير', 'مخاطر', 'تأخير', 'نسبة', 'إحصائيات', 'compliance', 'report', 'risk'],
    'performance': ['تقييم', 'أداء', 'درجة', 'موظف', 'دورة', '360', 'evaluation', 'performance', 'score'],
    'integrations': ['تكامل', 'اتصال', 'فشل', 'خطأ', 'قناة', 'integration', 'connection', 'channel', 'error'],
  };

  let bestMatch = { agent: 'reminder', confidence: 0.5 };

  for (const [agent, patterns] of Object.entries(intentPatterns)) {
    const matchCount = patterns.filter(p => lowerMessage.includes(p)).length;
    const confidence = matchCount / patterns.length;
    if (confidence > bestMatch.confidence) {
      bestMatch = { agent, confidence };
    }
  }

  return bestMatch;
}

// Get context data for the selected agent
async function getAgentContext(supabase: any, agent: AgentConfig, message: string): Promise<Record<string, any>> {
  const context: Record<string, any> = {};

  if (!agent) return context;

  const scope = agent.data_access_scope as string[];

  if (scope.includes('items')) {
    const { data: dueItems } = await supabase
      .from('items')
      .select('id, title, expiry_date, status, workflow_status')
      .eq('status', 'active')
      .lte('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(10);
    context.due_items = dueItems;
  }

  if (scope.includes('notification_log')) {
    const { data: recentLogs } = await supabase
      .from('notification_log')
      .select('id, item_id, status, sent_at, error_message')
      .order('created_at', { ascending: false })
      .limit(20);
    context.recent_notifications = recentLogs;
  }

  if (scope.includes('compliance_scores')) {
    const { data: scores } = await supabase
      .from('compliance_scores')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(10);
    context.compliance_scores = scores;
  }

  if (scope.includes('evaluations')) {
    const { data: evals } = await supabase
      .from('evaluations')
      .select('id, status, evaluation_type, total_score, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    context.recent_evaluations = evals;
  }

  if (scope.includes('automation_runs')) {
    const { data: runs } = await supabase
      .from('automation_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);
    context.automation_runs = runs;
  }

  return context;
}

// Build system prompt for the agent
function buildSystemPrompt(agent: AgentConfig, context: Record<string, any>): string {
  let prompt = agent?.system_prompt || 'أنت مساعد ذكي لنظام إدارة انتهاء الصلاحية.';
  
  prompt += '\n\n### السياق الحالي:\n';
  
  if (context.due_items?.length) {
    prompt += `\n**العناصر المستحقة قريباً:** ${context.due_items.length} عنصر`;
  }
  
  if (context.recent_notifications?.length) {
    const failed = context.recent_notifications.filter((n: any) => n.status === 'failed').length;
    prompt += `\n**الإشعارات الأخيرة:** ${context.recent_notifications.length} (${failed} فشلت)`;
  }
  
  if (context.compliance_scores?.length) {
    const avgScore = context.compliance_scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / context.compliance_scores.length;
    prompt += `\n**متوسط الامتثال:** ${avgScore.toFixed(1)}%`;
  }

  if (context.automation_runs?.length) {
    const lastRun = context.automation_runs[0];
    prompt += `\n**آخر تشغيل تلقائي:** ${lastRun.status} - ${lastRun.items_success || 0} ناجح / ${lastRun.items_failed || 0} فاشل`;
  }

  prompt += '\n\n### تعليمات:\n';
  prompt += '- أجب باللغة العربية دائماً\n';
  prompt += '- كن محدداً ومختصراً\n';
  prompt += '- قدم اقتراحات عملية عند الإمكان\n';
  prompt += '- لا تكشف أي مفاتيح أو أسرار\n';

  return prompt;
}

// Call AI API
async function callAI(messages: any[], agent: AgentConfig): Promise<{ content: string; tokens_used: number }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return { content: 'عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً.', tokens_used: 0 };
  }

  try {
    const response = await fetch('https://ai.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    
    if (data.choices?.[0]?.message?.content) {
      return {
        content: data.choices[0].message.content,
        tokens_used: data.usage?.total_tokens || 0,
      };
    }

    throw new Error('Invalid AI response');
  } catch (error: any) {
    console.error('AI API error:', error);
    return { content: 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.', tokens_used: 0 };
  }
}
