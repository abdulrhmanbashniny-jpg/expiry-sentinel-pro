import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =====================================================
// Sentinel AI - ReAct Orchestrator with SSE Streaming
// =====================================================

interface ToolDefinition {
  tool_key: string;
  tool_name: string;
  description: string;
  input_schema: Record<string, any>;
  risk_level: string;
  function_name: string | null;
}

interface ReActStep {
  type: 'thought' | 'action' | 'observation' | 'answer' | 'approval_needed';
  content: string;
  tool?: string;
  params?: Record<string, any>;
  result?: any;
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

  // Get user role
  const { data: userRole } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).single();

  if (!userRole) {
    return new Response(JSON.stringify({ error: 'No role assigned' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { message, page_context } = await req.json();
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

        // 4. Load agent config
        const { data: agents } = await supabase
          .from('ai_agent_configs')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: false });

        // 5. Build system prompt
        const systemPrompt = buildSystemPrompt(
          toolDefs || [],
          permissions || [],
          corrections || [],
          page_context,
          userRole.role
        );

        // 6. Save user message
        await supabase.from('admin_conversations').insert({
          user_id: user.id,
          role: 'user',
          content: message,
          metadata: { page_context }
        });

        send('thinking', { step: 'تحليل الطلب...' });

        // 7. Call AI with tool definitions
        const aiTools = (toolDefs || []).map(t => ({
          type: 'function',
          function: {
            name: t.tool_key,
            description: t.description || t.tool_name,
            parameters: t.input_schema || { type: 'object', properties: {} }
          }
        }));

        const messages = [
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
              const toolParams = JSON.parse(toolCall.function.arguments || '{}');
              
              send('tool_call', { tool: toolKey, params: toolParams });

              // Check permission
              const perm = (permissions || []).find(p => p.tool_key === toolKey);
              if (!perm) {
                const noPermMsg = `ليس لديك صلاحية لاستخدام أداة: ${toolKey}`;
                messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] } as any);
                messages.push({ role: 'tool', content: noPermMsg, tool_call_id: toolCall.id } as any);
                send('observation', { tool: toolKey, result: noPermMsg });
                continue;
              }

              // Check daily limit
              const { data: limitOk } = await supabase.rpc('check_ai_daily_limit', {
                _user_id: user.id, _tool_key: toolKey
              });

              if (!limitOk) {
                const limitMsg = `تم تجاوز الحد اليومي لأداة: ${toolKey}`;
                messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] } as any);
                messages.push({ role: 'tool', content: limitMsg, tool_call_id: toolCall.id } as any);
                send('observation', { tool: toolKey, result: limitMsg });
                continue;
              }

              // Determine if approval is needed
              const toolDef = (toolDefs || []).find(t => t.tool_key === toolKey);
              const isWriteOp = toolDef?.risk_level === 'high' || toolDef?.risk_level === 'critical';
              const needsApproval = perm.requires_approval || isWriteOp;

              if (needsApproval) {
                // Create pending audit trail entry
                const { data: auditEntry } = await supabase.from('ai_audit_trail').insert({
                  user_id: user.id,
                  agent_key: 'sentinel',
                  tool_used: toolKey,
                  action_type: 'execute',
                  input_params: toolParams,
                  status: 'pending_approval',
                  approval_required: true,
                  tenant_id: null // will be set by trigger
                }).select('id').single();

                pendingApprovals.push({
                  audit_id: auditEntry?.id,
                  tool_key: toolKey,
                  tool_name: perm.tool_name || toolKey,
                  params: toolParams,
                  description: toolDef?.description
                });

                const approvalMsg = `تم إنشاء طلب موافقة للعملية: ${perm.tool_name || toolKey}`;
                messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] } as any);
                messages.push({ role: 'tool', content: approvalMsg, tool_call_id: toolCall.id } as any);
                send('approval_needed', {
                  audit_id: auditEntry?.id,
                  tool_key: toolKey,
                  tool_name: perm.tool_name || toolKey,
                  params: toolParams
                });
                continue;
              }

              // Execute tool directly (read-only or low-risk)
              const toolResult = await executeTool(supabase, toolKey, toolParams, user.id);

              // Log to audit trail
              await supabase.from('ai_audit_trail').insert({
                user_id: user.id,
                agent_key: 'sentinel',
                tool_used: toolKey,
                action_type: 'execute',
                input_params: toolParams,
                output_result: toolResult,
                status: 'executed',
                approval_required: false,
              });

              messages.push({ role: 'assistant', content: '', tool_calls: [toolCall] } as any);
              messages.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: toolCall.id } as any);
              send('observation', { tool: toolKey, result: toolResult });
            }
            // Continue the loop for AI to process tool results
            continue;
          }

          // AI finished reasoning - stream the response
          fullResponse = choice.message?.content || '';
          
          // Stream response in chunks for SSE effect
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
            metadata: { pending_approvals: pendingApprovals.length > 0 ? pendingApprovals : undefined }
          });
        }

        send('done', { 
          pending_approvals: pendingApprovals,
          full_response: fullResponse 
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

// Build system prompt with tools, corrections, and context
function buildSystemPrompt(
  tools: ToolDefinition[],
  permissions: any[],
  corrections: any[],
  pageContext: string | undefined,
  userRole: string
): string {
  let prompt = `# أنت "Sentinel AI" - مستشار موارد بشرية ذكي ومحترف

## الهوية والسلوك:
- أنت مساعد خبير في إدارة الموارد البشرية ومتابعة انتهاء الصلاحية
- تتحدث باللغة العربية بأسلوب مهني ومختصر
- لا تكشف أي معلومات أمنية أو مفاتيح API أبداً
- تحقق دائماً من tenant_id ولا تتجاوز سياسات RLS

## الأمان:
- دورك الحالي: ${userRole}
- لا تنفذ عمليات الحذف أو الإخطار الجماعي دون تأكيد صريح
- العمليات عالية الخطورة تتطلب موافقة المستخدم عبر Action Cards

## الأدوات المتاحة:
${tools.map(t => `- **${t.tool_key}**: ${t.description || t.tool_name} [مستوى الخطورة: ${t.risk_level}]`).join('\n')}
`;

  if (pageContext) {
    prompt += `\n## السياق الحالي:\nالمستخدم يتصفح صفحة: ${pageContext}\nقدم اقتراحات ذات صلة بهذه الصفحة عند الإمكان.\n`;
  }

  if (corrections && corrections.length > 0) {
    prompt += `\n## تعليمات مستفادة من تصحيحات سابقة:\n`;
    corrections.forEach((c, i) => {
      prompt += `${i + 1}. عندما أعطيت: "${c.original_output?.substring(0, 100)}..." → التصحيح: "${c.user_correction}"\n`;
    });
  }

  prompt += `\n## تعليمات الإجابة:
- استخدم Markdown للتنسيق (عناوين، قوائم، جداول)
- كن محدداً وقدم أرقاماً عند وجود بيانات
- إذا طُلبت عملية تنفيذية، استخدم الأدوات المتاحة
- إذا كانت العملية تحتاج موافقة، أخبر المستخدم بذلك بوضوح
`;

  return prompt;
}

// Call AI API
async function callAI(messages: any[], tools?: any[]) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  try {
    const body: any = {
      model: 'google/gemini-2.5-flash',
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await fetch('https://ai.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    return await response.json();
  } catch (error) {
    console.error('AI call error:', error);
    return null;
  }
}

// Execute a tool
async function executeTool(
  supabase: any,
  toolKey: string,
  params: Record<string, any>,
  userId: string
): Promise<any> {
  try {
    switch (toolKey) {
      case 'search_items': {
        const query = supabase.from('items').select('id, title, ref_number, expiry_date, status, workflow_status');
        if (params.status) query.eq('status', params.status);
        if (params.department_id) query.eq('department_id', params.department_id);
        if (params.search) query.ilike('title', `%${params.search}%`);
        const { data, error } = await query.limit(params.limit || 20);
        return error ? { error: error.message } : { items: data, count: data?.length };
      }

      case 'get_dashboard_stats': {
        const { data: items } = await supabase.from('items').select('status, workflow_status, expiry_date');
        const total = items?.length || 0;
        const active = items?.filter((i: any) => i.status === 'active').length || 0;
        const expired = items?.filter((i: any) => i.status === 'expired').length || 0;
        const today = new Date().toISOString().split('T')[0];
        const dueSoon = items?.filter((i: any) => i.expiry_date <= new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] && i.status === 'active').length || 0;
        return { total, active, expired, due_soon_30_days: dueSoon };
      }

      case 'get_department_performance': {
        const { data } = await supabase.from('compliance_scores')
          .select('reference_name, score, score_type, period_start, period_end')
          .eq('score_type', 'department')
          .order('calculated_at', { ascending: false })
          .limit(20);
        return { departments: data };
      }

      case 'get_expiring_items': {
        const daysAhead = params.days || 30;
        const futureDate = new Date(Date.now() + daysAhead * 24*60*60*1000).toISOString().split('T')[0];
        const { data } = await supabase.from('items')
          .select('id, title, ref_number, expiry_date, status, department_id')
          .eq('status', 'active')
          .lte('expiry_date', futureDate)
          .order('expiry_date', { ascending: true })
          .limit(50);
        return { items: data, count: data?.length, days_ahead: daysAhead };
      }

      case 'get_notification_stats': {
        const { data } = await supabase.from('notification_log')
          .select('status')
          .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
        const total = data?.length || 0;
        const sent = data?.filter((n: any) => n.status === 'sent').length || 0;
        const failed = data?.filter((n: any) => n.status === 'failed').length || 0;
        return { total, sent, failed, success_rate: total > 0 ? ((sent/total)*100).toFixed(1) + '%' : 'N/A' };
      }

      case 'generate_report': {
        // Read-only report generation
        const { data: scores } = await supabase.from('compliance_scores')
          .select('*')
          .order('calculated_at', { ascending: false })
          .limit(10);
        return { report_type: params.report_type || 'compliance', data: scores };
      }

      case 'analyze_risks': {
        const { data: items } = await supabase.from('items')
          .select('id, title, expiry_date, status, category_id, department_id')
          .eq('status', 'active')
          .order('expiry_date', { ascending: true })
          .limit(100);
        
        const today = new Date();
        const overdue = items?.filter((i: any) => new Date(i.expiry_date) < today) || [];
        const critical = items?.filter((i: any) => {
          const diff = (new Date(i.expiry_date).getTime() - today.getTime()) / (1000*60*60*24);
          return diff >= 0 && diff <= 7;
        }) || [];
        
        return { overdue: overdue.length, critical_7_days: critical.length, total_active: items?.length };
      }

      default:
        return { error: `أداة غير معروفة: ${toolKey}` };
    }
  } catch (error: any) {
    return { error: error.message };
  }
}
