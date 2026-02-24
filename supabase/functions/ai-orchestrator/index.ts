import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =====================================================
// Sentinel AI - Multi-Agent ReAct Orchestrator with SSE
// Specialized Agents: Auditor, Predictor, Communicator
// =====================================================

interface ToolDefinition {
  tool_key: string;
  tool_name: string;
  description: string;
  input_schema: Record<string, any>;
  risk_level: string;
  function_name: string | null;
  category: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get user role and tenant
  const { data: userRole } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single();

  if (!userRole) {
    return new Response(JSON.stringify({ error: 'No role assigned' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get tenant_id
  const { data: profile } = await supabase
    .from('profiles').select('tenant_id').eq('user_id', user.id).single();
  const tenantId = profile?.tenant_id;

  const { message, page_context, conversation_id } = await req.json();
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. Load tools the user has permission for
        const { data: permissions } = await supabase
          .from('ai_tool_permissions')
          .select('tool_key, can_read, can_execute, can_write, requires_approval, tool_name')
          .eq('role', userRole.role)
          .eq('is_active', true);

        const permittedToolKeys = (permissions || []).map(p => p.tool_key);

        const { data: toolDefs } = await supabase
          .from('ai_tool_definitions')
          .select('*')
          .eq('is_active', true)
          .in('tool_key', permittedToolKeys.length > 0 ? permittedToolKeys : ['__none__']);

        // 2. Load conversation history
        const { data: history } = await supabase
          .from('admin_conversations')
          .select('role, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const conversationHistory = (history || []).reverse();

        // 3. Load few-shot corrections from feedback
        const { data: corrections } = await supabase
          .from('ai_feedback_log')
          .select('original_output, user_correction, correction_type')
          .eq('user_id', user.id)
          .eq('is_applied', true)
          .order('created_at', { ascending: false })
          .limit(5);

        // 4. Detect which specialized agent to activate
        const activeAgent = detectAgent(message, page_context);
        send('agent', { agent: activeAgent.key, name: activeAgent.name });

        // 4.5 Retrieve relevant knowledge base context (RAG)
        let knowledgeContext = '';
        try {
          // Simple keyword-based retrieval since we use pseudo-embeddings
          const searchTerms = message.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
          if (searchTerms.length > 0) {
            const { data: knowledgeChunks } = await supabase
              .from('knowledge_embeddings')
              .select('source_file, content')
              .or(searchTerms.map((t: string) => `content.ilike.%${t}%`).join(','))
              .limit(3);

            if (knowledgeChunks && knowledgeChunks.length > 0) {
              knowledgeContext = '\n## مرجع من قاعدة المعرفة (سياسات الشركة):\n' +
                knowledgeChunks.map((k: any) => `### 📄 ${k.source_file}\n${k.content.substring(0, 500)}`).join('\n\n');
              send('thinking', { step: `تم العثور على ${knowledgeChunks.length} مرجع من قاعدة المعرفة` });
            }
          }
        } catch (ragError) {
          console.error('RAG retrieval error (non-fatal):', ragError);
        }

        // 5. Build system prompt with agent specialization
        const systemPrompt = buildSystemPrompt(
          toolDefs || [],
          permissions || [],
          corrections || [],
          page_context,
          userRole.role,
          activeAgent,
          knowledgeContext
        );

        // 6. Save user message
        await supabase.from('admin_conversations').insert({
          user_id: user.id,
          role: 'user',
          content: message,
          metadata: { page_context, agent: activeAgent.key }
        });

        send('thinking', { step: `${activeAgent.name} يحلل طلبك...` });

        // 7. Build AI tools from definitions
        const aiTools = (toolDefs || []).map(t => ({
          type: 'function' as const,
          function: {
            name: t.tool_key,
            description: t.description || t.tool_name,
            parameters: t.input_schema || { type: 'object', properties: {} }
          }
        }));

        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: message }
        ];

        // ReAct Loop (max 5 iterations)
        let fullResponse = '';
        let pendingApprovals: any[] = [];
        let iterations = 0;
        const MAX_ITERATIONS = 5;

        while (iterations < MAX_ITERATIONS) {
          iterations++;
          const aiResult = await callAI(messages, aiTools.length > 0 ? aiTools : undefined);

          if (!aiResult) {
            send('error', { message: 'فشل في الاتصال بخدمة الذكاء الاصطناعي' });
            break;
          }

          const choice = aiResult.choices?.[0];
          if (!choice) break;

          // If AI wants to call a tool
          if (choice.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
            for (const toolCall of choice.message.tool_calls) {
              const toolKey = toolCall.function.name;
              let toolParams: Record<string, any>;
              try {
                toolParams = JSON.parse(toolCall.function.arguments || '{}');
              } catch {
                toolParams = {};
              }

              send('tool_call', { tool: toolKey, params: toolParams, agent: activeAgent.key });

              // Check permission
              const perm = (permissions || []).find(p => p.tool_key === toolKey);
              if (!perm) {
                const noPermMsg = `ليس لديك صلاحية لاستخدام أداة: ${toolKey}`;
                messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] });
                messages.push({ role: 'tool', content: noPermMsg, tool_call_id: toolCall.id });
                send('observation', { tool: toolKey, result: noPermMsg });
                continue;
              }

              // Check daily limit
              const { data: limitOk } = await supabase.rpc('check_ai_daily_limit', {
                _user_id: user.id, _tool_key: toolKey
              });

              if (!limitOk) {
                const limitMsg = `تم تجاوز الحد اليومي لأداة: ${toolKey}`;
                messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] });
                messages.push({ role: 'tool', content: limitMsg, tool_call_id: toolCall.id });
                send('observation', { tool: toolKey, result: limitMsg });
                continue;
              }

              // Determine if approval is needed
              const toolDef = (toolDefs || []).find(t => t.tool_key === toolKey);
              const isWriteOp = toolDef?.risk_level === 'high' || toolDef?.risk_level === 'critical';
              const needsApproval = perm.requires_approval || isWriteOp;

              if (needsApproval) {
                const { data: auditEntry } = await supabase.from('ai_audit_trail').insert({
                  user_id: user.id,
                  agent_key: activeAgent.key,
                  tool_used: toolKey,
                  action_type: 'execute',
                  input_params: toolParams,
                  status: 'pending_approval',
                  approval_required: true,
                  tenant_id: tenantId
                }).select('id').single();

                pendingApprovals.push({
                  audit_id: auditEntry?.id,
                  tool_key: toolKey,
                  tool_name: perm.tool_name || toolKey,
                  params: toolParams,
                  description: toolDef?.description,
                  agent: activeAgent.key
                });

                const approvalMsg = `تم إنشاء طلب موافقة للعملية: ${perm.tool_name || toolKey}`;
                messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] });
                messages.push({ role: 'tool', content: approvalMsg, tool_call_id: toolCall.id });
                send('approval_needed', {
                  audit_id: auditEntry?.id,
                  tool_key: toolKey,
                  tool_name: perm.tool_name || toolKey,
                  params: toolParams,
                  agent: activeAgent.key
                });
                continue;
              }

              // Execute tool directly
              const toolResult = await executeTool(supabase, toolKey, toolParams, user.id, tenantId);

              await supabase.from('ai_audit_trail').insert({
                user_id: user.id,
                agent_key: activeAgent.key,
                tool_used: toolKey,
                action_type: 'execute',
                input_params: toolParams,
                output_result: toolResult,
                status: 'executed',
                approval_required: false,
                tenant_id: tenantId
              });

              messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] });
              messages.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: toolCall.id });
              send('observation', { tool: toolKey, result: toolResult, agent: activeAgent.key });
            }
            continue;
          }

          // AI finished reasoning - stream the response
          fullResponse = choice.message?.content || '';
          
          const words = fullResponse.split(' ');
          let buffer = '';
          for (let i = 0; i < words.length; i++) {
            buffer += (i > 0 ? ' ' : '') + words[i];
            if (i % 3 === 2 || i === words.length - 1) {
              send('token', { text: buffer });
              buffer = '';
            }
          }
          break;
        }

        // Save assistant response
        if (fullResponse) {
          await supabase.from('admin_conversations').insert({
            user_id: user.id,
            role: 'assistant',
            content: fullResponse,
            metadata: {
              agent: activeAgent.key,
              pending_approvals: pendingApprovals.length > 0 ? pendingApprovals : undefined
            }
          });
        }

        send('done', { 
          pending_approvals: pendingApprovals,
          full_response: fullResponse,
          agent: activeAgent.key
        });

      } catch (error: any) {
        console.error('Orchestrator error:', error);
        send('error', { message: error.message || 'حدث خطأ غير متوقع' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
});

// =====================================================
// Agent Detection - Routes to specialized agent
// =====================================================

interface AgentInfo {
  key: string;
  name: string;
  description: string;
}

const AGENTS: Record<string, AgentInfo> = {
  auditor: {
    key: 'auditor',
    name: 'وكيل التدقيق',
    description: 'متخصص في فحص تناسق البيانات وكشف التناقضات في التواريخ والوثائق'
  },
  predictor: {
    key: 'predictor', 
    name: 'وكيل التنبؤ',
    description: 'متخصص في تحليل معدلات الانتهاء وتوقع الأشهر عالية المخاطر'
  },
  communicator: {
    key: 'communicator',
    name: 'وكيل التواصل',
    description: 'متخصص في صياغة وجدولة الرسائل التذكيرية عبر القنوات المختلفة'
  },
  sentinel: {
    key: 'sentinel',
    name: 'Sentinel AI',
    description: 'المستشار العام للنظام - يتعامل مع الاستعلامات العامة والتقارير'
  }
};

function detectAgent(message: string, pageContext?: string): AgentInfo {
  const lower = message.toLowerCase();
  
  // Auditor patterns
  if (/فحص|تدقيق|تناقض|خطأ|ناقص|مفقود|audit|check|inconsisten|missing|gap|verify/.test(lower)) {
    return AGENTS.auditor;
  }
  
  // Predictor patterns
  if (/توقع|تنبؤ|predict|forecast|خطر|risk|burn|معدل|trend|تحليل.*مستقبل/.test(lower)) {
    return AGENTS.predictor;
  }
  
  // Communicator patterns
  if (/رسالة|تذكير|إرسال|تنبيه|alert|remind|send|whatsapp|telegram|واتساب|تيليجرام|جدول|schedule|notify/.test(lower)) {
    return AGENTS.communicator;
  }
  
  // Page context routing
  if (pageContext) {
    if (/compliance|تقارير/.test(pageContext)) return AGENTS.auditor;
    if (/reminder|تذكير/.test(pageContext)) return AGENTS.communicator;
  }
  
  return AGENTS.sentinel;
}

// =====================================================
// System Prompt Builder with Agent Specialization
// =====================================================

function buildSystemPrompt(
  tools: ToolDefinition[],
  permissions: any[],
  corrections: any[],
  pageContext: string | undefined,
  userRole: string,
  agent: AgentInfo,
  knowledgeContext: string = ''
): string {
  const agentInstructions: Record<string, string> = {
    auditor: `
## تخصصك: وكيل التدقيق (Auditor Agent)
- أنت متخصص في **فحص البيانات وكشف التناقضات**
- افحص تواريخ الانتهاء والإصدار للتأكد من تناسقها (تاريخ الانتهاء يجب أن يكون بعد تاريخ الإصدار)
- اكشف العناصر التي تفتقر لبيانات أساسية (رقم مرجعي، قسم، مسؤول)
- قدم النتائج في جدول منظم مع مستوى الخطورة (🔴 حرج، 🟡 تحذير، 🟢 سليم)
- استخدم أدوات: audit_date_consistency, audit_missing_data, search_items`,
    
    predictor: `
## تخصصك: وكيل التنبؤ (Predictor Agent)
- أنت متخصص في **تحليل الاتجاهات وتوقع المخاطر**
- حلل "معدل حرق الوثائق" - كم وثيقة تنتهي شهرياً
- توقع الأشهر الأكثر خطورة من حيث عدد الانتهاءات
- قدم توصيات استباقية للإدارة للاستعداد
- استخدم أدوات: predict_expiry_risk, get_renewal_forecast, get_expiring_items, analyze_risks`,
    
    communicator: `
## تخصصك: وكيل التواصل (Communicator Agent)
- أنت متخصص في **صياغة وجدولة الرسائل التذكيرية**
- اصنع رسائل احترافية تناسب مستوى الإلحاح (عادي، متوسط، عالي، حرج)
- خصص الرسالة حسب قناة الإرسال (WhatsApp أقصر، Email أكثر تفصيلاً)
- عند جدولة تنبيهات جماعية، اطلب التأكيد دائماً
- استخدم أدوات: draft_reminder_message, schedule_bulk_alerts, get_expiring_items`,
    
    sentinel: `
## تخصصك: المستشار العام (Sentinel AI)
- أنت المستشار الشامل الذي يتعامل مع الاستعلامات العامة والتقارير
- قدم ملخصات شاملة وإحصائيات دقيقة
- وجّه المستخدم للوكيل المتخصص عند الحاجة
- استخدم جميع الأدوات المتاحة حسب السياق`
  };

  let prompt = `# أنت "Sentinel AI" - نظام ذكاء اصطناعي مستقل لإدارة انتهاء الوثائق

## الهوية:
- مستشار خبير في إدارة الوثائق ومتابعة انتهاء الصلاحية والعقود والتراخيص
- تتحدث باللغة العربية بأسلوب مهني ومختصر وإجرائي
- **نطاقك محدد بصرامة**: إدارة الوثائق، التذكيرات، العقود، التقييمات، والأقسام
- **لا تتعامل مع**: الرواتب، التوظيف، أو مهام HR العامة خارج نطاقك

${agentInstructions[agent.key] || agentInstructions.sentinel}

## الأمان الصارم:
- دور المستخدم: **${userRole}**
- لا تتجاوز سياسات RLS أبداً - كل استعلام يجب أن يحترم tenant_id
- لا تكشف أي معلومات أمنية أو مفاتيح API أو بنية النظام الداخلية
- العمليات الحرجة (حذف، إخطار جماعي) تتطلب تأكيداً صريحاً حتى لو كان المستخدم مصرحاً

## الأدوات المتاحة لك:
${tools.map(t => `- **${t.tool_key}** [${t.category}/${t.risk_level}]: ${t.description || t.tool_name}`).join('\n')}
`;

  if (pageContext) {
    prompt += `\n## سياق الصفحة الحالية:\nالمستخدم يتصفح: **${pageContext}**\nقدم اقتراحات ذات صلة مباشرة بهذه الصفحة.\n`;
  }

  if (knowledgeContext) {
    prompt += `\n${knowledgeContext}\n\n**تعليمات RAG:** عند الإجابة، استشهد بالملف المصدر (مثل: "وفقاً لـ docs/ESCALATION_SYSTEM.md"). هذا يعطي إجابتك مصداقية.\n`;
  }

  if (corrections && corrections.length > 0) {
    prompt += `\n## تصحيحات سابقة (تعلّم منها - لا تكرر نفس الأخطاء):\n`;
    corrections.forEach((c, i) => {
      prompt += `${i + 1}. ❌ أعطيت: "${c.original_output?.substring(0, 80)}..." → ✅ التصحيح: "${c.user_correction}"\n`;
    });
  }

  prompt += `\n## تعليمات الإجابة:
- استخدم Markdown للتنسيق (عناوين، قوائم، جداول)
- كن محدداً وقدم أرقاماً ونسباً عند وجود بيانات
- إذا طُلبت عملية تنفيذية، استخدم الأدوات المتاحة مباشرة
- إذا كانت العملية تحتاج موافقة، أوضح ذلك وانتظر قرار المستخدم
- لا تتحدث عن أدوات لا تملك صلاحية استخدامها
- أنهِ كل رد بسؤال استباقي واحد يساعد المستخدم
`;

  return prompt;
}

// =====================================================
// AI API Call
// =====================================================

async function callAI(messages: any[], tools?: any[]) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not found');
    return null;
  }

  try {
    const body: any = {
      model: 'google/gemini-2.5-flash',
      messages,
      max_tokens: 3000,
      temperature: 0.4,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('AI call error:', error);
    return null;
  }
}

// =====================================================
// Tool Executor - All operational tools
// =====================================================

async function executeTool(
  supabase: any,
  toolKey: string,
  params: Record<string, any>,
  userId: string,
  tenantId?: string
): Promise<any> {
  try {
    switch (toolKey) {
      // ---- Existing Tools ----
      case 'search_items': {
        const query = supabase.from('items').select('id, title, ref_number, expiry_date, status, workflow_status, department_id');
        if (tenantId) query.eq('tenant_id', tenantId);
        if (params.status) query.eq('status', params.status);
        if (params.department_id) query.eq('department_id', params.department_id);
        if (params.search) query.ilike('title', `%${params.search}%`);
        const { data, error } = await query.order('expiry_date', { ascending: true }).limit(params.limit || 20);
        return error ? { error: error.message } : { items: data, count: data?.length };
      }

      case 'get_dashboard_stats': {
        const query = supabase.from('items').select('status, workflow_status, expiry_date');
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data: items } = await query;
        const total = items?.length || 0;
        const active = items?.filter((i: any) => i.status === 'active').length || 0;
        const expired = items?.filter((i: any) => i.status === 'expired').length || 0;
        const today = new Date().toISOString().split('T')[0];
        const next30 = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
        const dueSoon = items?.filter((i: any) => i.expiry_date >= today && i.expiry_date <= next30 && i.status === 'active').length || 0;
        
        // Contracts stats
        const cQuery = supabase.from('contracts').select('status, end_date');
        if (tenantId) cQuery.eq('tenant_id', tenantId);
        const { data: contracts } = await cQuery;
        const activeContracts = contracts?.filter((c: any) => c.status === 'active').length || 0;
        const expiredContracts = contracts?.filter((c: any) => c.status === 'expired').length || 0;
        
        return { 
          items: { total, active, expired, due_soon_30_days: dueSoon },
          contracts: { total: contracts?.length || 0, active: activeContracts, expired: expiredContracts }
        };
      }

      case 'get_department_performance': {
        const query = supabase.from('compliance_scores')
          .select('reference_name, score, score_type, period_start, period_end')
          .eq('score_type', 'department')
          .order('calculated_at', { ascending: false })
          .limit(20);
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data } = await query;
        return { departments: data };
      }

      case 'get_expiring_items': {
        const daysAhead = params.days || 30;
        const futureDate = new Date(Date.now() + daysAhead * 24*60*60*1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        const query = supabase.from('items')
          .select('id, title, ref_number, expiry_date, status, department_id')
          .eq('status', 'active')
          .gte('expiry_date', today)
          .lte('expiry_date', futureDate)
          .order('expiry_date', { ascending: true })
          .limit(50);
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data } = await query;
        return { items: data, count: data?.length, days_ahead: daysAhead };
      }

      case 'get_notification_stats': {
        const query = supabase.from('notification_log')
          .select('status')
          .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data } = await query;
        const total = data?.length || 0;
        const sent = data?.filter((n: any) => n.status === 'sent').length || 0;
        const failed = data?.filter((n: any) => n.status === 'failed').length || 0;
        return { total, sent, failed, success_rate: total > 0 ? ((sent/total)*100).toFixed(1) + '%' : 'N/A' };
      }

      case 'generate_report': {
        const query = supabase.from('compliance_scores')
          .select('*')
          .order('calculated_at', { ascending: false })
          .limit(10);
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data: scores } = await query;
        return { report_type: params.report_type || 'compliance', data: scores };
      }

      case 'analyze_risks': {
        const query = supabase.from('items')
          .select('id, title, expiry_date, status, category_id, department_id')
          .eq('status', 'active')
          .order('expiry_date', { ascending: true })
          .limit(100);
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data: items } = await query;
        
        const today = new Date();
        const overdue = items?.filter((i: any) => new Date(i.expiry_date) < today) || [];
        const critical = items?.filter((i: any) => {
          const diff = (new Date(i.expiry_date).getTime() - today.getTime()) / (1000*60*60*24);
          return diff >= 0 && diff <= 7;
        }) || [];
        const warning = items?.filter((i: any) => {
          const diff = (new Date(i.expiry_date).getTime() - today.getTime()) / (1000*60*60*24);
          return diff > 7 && diff <= 30;
        }) || [];
        
        return { overdue: overdue.length, critical_7_days: critical.length, warning_30_days: warning.length, total_active: items?.length };
      }

      // ---- Auditor Agent Tools ----
      case 'audit_date_consistency': {
        const entityType = params.entity_type || 'all';
        const issues: any[] = [];

        if (entityType === 'items' || entityType === 'all') {
          const query = supabase.from('items')
            .select('id, title, ref_number, expiry_date, created_at, status')
            .order('expiry_date', { ascending: true })
            .limit(200);
          if (tenantId) query.eq('tenant_id', tenantId);
          const { data: items } = await query;
          
          items?.forEach((item: any) => {
            // Check if expiry_date is before creation
            if (item.expiry_date && new Date(item.expiry_date) < new Date(item.created_at)) {
              issues.push({
                type: 'date_before_creation',
                severity: 'critical',
                entity: 'item',
                id: item.id,
                title: item.title,
                ref: item.ref_number,
                detail: `تاريخ الانتهاء (${item.expiry_date}) قبل تاريخ الإنشاء (${item.created_at.split('T')[0]})`
              });
            }
            // Check expired but still active
            if (item.status === 'active' && new Date(item.expiry_date) < new Date()) {
              issues.push({
                type: 'expired_still_active',
                severity: 'warning',
                entity: 'item',
                id: item.id,
                title: item.title,
                ref: item.ref_number,
                detail: `منتهي الصلاحية (${item.expiry_date}) لكن الحالة لا تزال "نشط"`
              });
            }
          });
        }

        if (entityType === 'contracts' || entityType === 'all') {
          const query = supabase.from('contracts')
            .select('id, title, contract_number, start_date, end_date, status')
            .order('end_date', { ascending: true })
            .limit(200);
          if (tenantId) query.eq('tenant_id', tenantId);
          const { data: contracts } = await query;
          
          contracts?.forEach((c: any) => {
            if (c.start_date && c.end_date && new Date(c.end_date) < new Date(c.start_date)) {
              issues.push({
                type: 'end_before_start',
                severity: 'critical',
                entity: 'contract',
                id: c.id,
                title: c.title,
                ref: c.contract_number,
                detail: `تاريخ الانتهاء (${c.end_date}) قبل تاريخ البداية (${c.start_date})`
              });
            }
            if (c.status === 'active' && new Date(c.end_date) < new Date()) {
              issues.push({
                type: 'expired_still_active',
                severity: 'warning',
                entity: 'contract',
                id: c.id,
                title: c.title,
                ref: c.contract_number,
                detail: `العقد منتهي (${c.end_date}) لكن لا يزال "نشط"`
              });
            }
          });
        }

        return {
          total_issues: issues.length,
          critical: issues.filter(i => i.severity === 'critical').length,
          warnings: issues.filter(i => i.severity === 'warning').length,
          issues: issues.slice(0, 30)
        };
      }

      case 'audit_missing_data': {
        const entityType = params.entity_type || 'items';
        const gaps: any[] = [];

        if (entityType === 'items' || entityType === 'all') {
          const query = supabase.from('items')
            .select('id, title, ref_number, department_id, responsible_person, category_id, expiry_date')
            .limit(200);
          if (tenantId) query.eq('tenant_id', tenantId);
          const { data: items } = await query;
          
          items?.forEach((item: any) => {
            const missing: string[] = [];
            if (!item.ref_number) missing.push('رقم مرجعي');
            if (!item.department_id) missing.push('قسم');
            if (!item.responsible_person) missing.push('مسؤول');
            if (!item.category_id) missing.push('تصنيف');
            if (missing.length > 0) {
              gaps.push({
                entity: 'item', id: item.id, title: item.title,
                missing_fields: missing, missing_count: missing.length
              });
            }
          });
        }

        if (entityType === 'contracts' || entityType === 'all') {
          const query = supabase.from('contracts')
            .select('id, title, contract_number, department_id, responsible_user_id, party_contact')
            .limit(200);
          if (tenantId) query.eq('tenant_id', tenantId);
          const { data: contracts } = await query;
          
          contracts?.forEach((c: any) => {
            const missing: string[] = [];
            if (!c.contract_number) missing.push('رقم العقد');
            if (!c.department_id) missing.push('قسم');
            if (!c.responsible_user_id) missing.push('مسؤول');
            if (!c.party_contact) missing.push('معلومات اتصال الطرف');
            if (missing.length > 0) {
              gaps.push({
                entity: 'contract', id: c.id, title: c.title,
                missing_fields: missing, missing_count: missing.length
              });
            }
          });
        }

        return {
          total_gaps: gaps.length,
          items_with_gaps: gaps.filter(g => g.entity === 'item').length,
          contracts_with_gaps: gaps.filter(g => g.entity === 'contract').length,
          details: gaps.sort((a, b) => b.missing_count - a.missing_count).slice(0, 25)
        };
      }

      // ---- Predictor Agent Tools ----
      case 'predict_expiry_risk': {
        const monthsAhead = params.months_ahead || 6;
        const query = supabase.from('items')
          .select('expiry_date, status, department_id')
          .eq('status', 'active');
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data: items } = await query;

        const cQuery = supabase.from('contracts')
          .select('end_date, status, department_id')
          .eq('status', 'active');
        if (tenantId) cQuery.eq('tenant_id', tenantId);
        const { data: contracts } = await cQuery;

        // Group by month
        const monthlyRisk: Record<string, { items: number; contracts: number; total: number }> = {};
        const now = new Date();
        
        for (let m = 0; m < monthsAhead; m++) {
          const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          monthlyRisk[key] = { items: 0, contracts: 0, total: 0 };
        }

        items?.forEach((item: any) => {
          const d = new Date(item.expiry_date);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (monthlyRisk[key]) {
            monthlyRisk[key].items++;
            monthlyRisk[key].total++;
          }
        });

        contracts?.forEach((c: any) => {
          const d = new Date(c.end_date);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (monthlyRisk[key]) {
            monthlyRisk[key].contracts++;
            monthlyRisk[key].total++;
          }
        });

        // Find peak month
        const sorted = Object.entries(monthlyRisk).sort((a, b) => b[1].total - a[1].total);
        const peakMonth = sorted[0];

        return {
          monthly_forecast: monthlyRisk,
          peak_risk_month: peakMonth ? { month: peakMonth[0], ...peakMonth[1] } : null,
          total_active_items: items?.length || 0,
          total_active_contracts: contracts?.length || 0
        };
      }

      case 'get_renewal_forecast': {
        const days = params.days || 90;
        const futureDate = new Date(Date.now() + days * 24*60*60*1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        const iQuery = supabase.from('items')
          .select('id, title, ref_number, expiry_date, department_id, status')
          .eq('status', 'active')
          .gte('expiry_date', today)
          .lte('expiry_date', futureDate)
          .order('expiry_date', { ascending: true });
        if (tenantId) iQuery.eq('tenant_id', tenantId);
        const { data: items } = await iQuery;

        const cQuery = supabase.from('contracts')
          .select('id, title, contract_number, end_date, department_id, status, renewal_type')
          .eq('status', 'active')
          .gte('end_date', today)
          .lte('end_date', futureDate)
          .order('end_date', { ascending: true });
        if (tenantId) cQuery.eq('tenant_id', tenantId);
        const { data: contracts } = await cQuery;

        return {
          items_due: items?.length || 0,
          contracts_due: contracts?.length || 0,
          items: items?.slice(0, 20),
          contracts: contracts?.slice(0, 20),
          period_days: days
        };
      }

      // ---- Communicator Agent Tools ----
      case 'draft_reminder_message': {
        const { item_id, channel, urgency } = params;
        
        const { data: item } = await supabase.from('items')
          .select('title, ref_number, expiry_date, responsible_person')
          .eq('id', item_id)
          .single();

        if (!item) return { error: 'العنصر غير موجود' };

        const daysLeft = Math.ceil((new Date(item.expiry_date).getTime() - Date.now()) / (1000*60*60*24));
        const urgencyEmoji = { low: '📋', medium: '⚠️', high: '🔴', critical: '🚨' }[urgency] || '📋';
        
        let messageTemplate = '';
        if (channel === 'whatsapp') {
          messageTemplate = `${urgencyEmoji} *تنبيه انتهاء صلاحية*\n\n📄 ${item.title}\n🔢 الرقم المرجعي: ${item.ref_number || 'غير محدد'}\n📅 تاريخ الانتهاء: ${item.expiry_date}\n⏳ المتبقي: ${daysLeft} يوم\n${item.responsible_person ? `👤 المسؤول: ${item.responsible_person}` : ''}\n\nيرجى اتخاذ الإجراء اللازم.`;
        } else if (channel === 'telegram') {
          messageTemplate = `${urgencyEmoji} <b>تنبيه انتهاء صلاحية</b>\n\n📄 ${item.title}\n🔢 ${item.ref_number || '-'}\n📅 ${item.expiry_date}\n⏳ ${daysLeft} يوم متبقي\n\nيرجى المتابعة.`;
        } else {
          messageTemplate = `تنبيه: ${item.title} (${item.ref_number || '-'}) ينتهي في ${item.expiry_date} - متبقي ${daysLeft} يوم. يرجى اتخاذ الإجراء اللازم.`;
        }

        return {
          message: messageTemplate,
          channel,
          urgency,
          item_title: item.title,
          days_remaining: daysLeft,
          note: 'هذه مسودة الرسالة. يمكنك تعديلها قبل الإرسال.'
        };
      }

      case 'schedule_bulk_alerts': {
        // This is a high-risk operation - should require approval
        const { days, channel, priority } = params;
        const futureDate = new Date(Date.now() + (days || 30) * 24*60*60*1000).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        
        const query = supabase.from('items')
          .select('id, title, ref_number, expiry_date')
          .eq('status', 'active')
          .gte('expiry_date', today)
          .lte('expiry_date', futureDate);
        if (tenantId) query.eq('tenant_id', tenantId);
        const { data: items } = await query;

        return {
          action: 'schedule_bulk_alerts',
          items_count: items?.length || 0,
          channel,
          priority: priority || 'normal',
          period_days: days,
          items_preview: items?.slice(0, 5).map((i: any) => `${i.title} (${i.expiry_date})`),
          note: 'سيتم جدولة التنبيهات بعد الموافقة'
        };
      }

      // ---- Expanded Data Tools ----
      case 'get_contracts_summary': {
        const query = supabase.from('contracts')
          .select('id, title, contract_number, start_date, end_date, status, contract_type, party_name, renewal_type, value, currency');
        if (tenantId) query.eq('tenant_id', tenantId);
        if (params.status && params.status !== 'all') query.eq('status', params.status);
        if (params.department_id) query.eq('department_id', params.department_id);
        const { data } = await query.order('end_date', { ascending: true }).limit(50);
        
        const active = data?.filter((c: any) => c.status === 'active').length || 0;
        const expired = data?.filter((c: any) => c.status === 'expired').length || 0;
        const totalValue = data?.reduce((sum: number, c: any) => sum + (c.value || 0), 0) || 0;

        return {
          total: data?.length || 0,
          active,
          expired,
          total_value: totalValue,
          contracts: data?.slice(0, 20)
        };
      }

      case 'get_evaluation_stats': {
        const cycleQuery = supabase.from('evaluation_cycles')
          .select('id, name, start_date, end_date, is_active')
          .eq('is_active', true);
        if (tenantId) cycleQuery.eq('tenant_id', tenantId);
        const { data: cycles } = await cycleQuery;

        const evalQuery = supabase.from('evaluations')
          .select('status, total_score, evaluation_type');
        if (tenantId) evalQuery.eq('tenant_id', tenantId);
        const { data: evals } = await evalQuery.limit(500);

        const draft = evals?.filter((e: any) => e.status === 'draft').length || 0;
        const submitted = evals?.filter((e: any) => e.status === 'submitted').length || 0;
        const completed = evals?.filter((e: any) => ['reviewed', 'published'].includes(e.status)).length || 0;
        const avgScore = evals?.filter((e: any) => e.total_score).reduce((sum: number, e: any, _, arr) => sum + e.total_score / arr.length, 0) || 0;

        return {
          active_cycles: cycles?.length || 0,
          cycles: cycles,
          evaluations: { total: evals?.length || 0, draft, submitted, completed },
          average_score: avgScore.toFixed(1)
        };
      }

      case 'get_department_items': {
        const { department_id } = params;
        
        const iQuery = supabase.from('items')
          .select('id, title, ref_number, expiry_date, status')
          .eq('department_id', department_id);
        if (tenantId) iQuery.eq('tenant_id', tenantId);
        const { data: items } = await iQuery.order('expiry_date', { ascending: true }).limit(50);

        const cQuery = supabase.from('contracts')
          .select('id, title, contract_number, end_date, status')
          .eq('department_id', department_id);
        if (tenantId) cQuery.eq('tenant_id', tenantId);
        const { data: contracts } = await cQuery.order('end_date', { ascending: true }).limit(50);

        const { data: dept } = await supabase.from('departments')
          .select('name, code').eq('id', department_id).single();

        return {
          department: dept?.name || department_id,
          items: { total: items?.length || 0, data: items?.slice(0, 15) },
          contracts: { total: contracts?.length || 0, data: contracts?.slice(0, 15) }
        };
      }

      default:
        return { error: `أداة غير معروفة: ${toolKey}` };
    }
  } catch (error: any) {
    console.error(`Tool ${toolKey} error:`, error);
    return { error: error.message };
  }
}
