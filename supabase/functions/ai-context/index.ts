import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ai-token',
};

// AI-to-AI API Endpoint
// Provides platform context for external AI agents

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify AI token (read-only access)
    const aiToken = req.headers.get('x-ai-token');
    const { data: tokenConfig } = await supabase
      .from('integrations')
      .select('config')
      .eq('key', 'ai_context')
      .single();

    const validToken = (tokenConfig?.config as any)?.api_token;
    if (validToken && aiToken !== validToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid AI token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

    // Route based on endpoint
    switch (endpoint) {
      case 'context': {
        // Full platform context for AI
        const [
          { data: modules },
          { data: functions },
          { data: templates },
          { data: agents },
          { data: recentErrors },
          { data: lastRuns }
        ] = await Promise.all([
          supabase.from('platform_metadata').select('*').eq('category', 'module').eq('is_active', true),
          supabase.from('platform_metadata').select('*').eq('category', 'edge_function').eq('is_active', true),
          supabase.from('message_templates').select('id, name, channel, required_fields, optional_fields, is_active, is_default'),
          supabase.from('ai_agent_configs').select('agent_key, name, description, allowed_tools, data_access_scope, is_active'),
          supabase.from('automation_runs').select('*').eq('status', 'failed').order('started_at', { ascending: false }).limit(5),
          supabase.from('automation_runs').select('*').order('started_at', { ascending: false }).limit(10)
        ]);

        return new Response(
          JSON.stringify({
            platform: {
              name: 'نظام تنبيهات انتهاء الصلاحية',
              name_en: 'Expiry Sentinel Pro',
              version: '2.0.0',
              timezone: 'Asia/Riyadh',
            },
            modules: modules || [],
            edge_functions: functions || [],
            message_templates: templates || [],
            ai_agents: agents || [],
            recent_errors: recentErrors?.map(e => ({
              job_type: e.job_type,
              error: e.error_message,
              timestamp: e.started_at
            })) || [],
            last_automation_runs: lastRuns?.map(r => ({
              job_type: r.job_type,
              status: r.status,
              success: r.items_success,
              failed: r.items_failed,
              duration_ms: r.duration_ms,
              timestamp: r.started_at
            })) || [],
            available_placeholders: [
              { key: 'recipient_name', label: 'اسم المستلم', required: true },
              { key: 'title', label: 'عنوان المعاملة', required: true },
              { key: 'item_code', label: 'كود العنصر', required: true },
              { key: 'due_date', label: 'تاريخ الاستحقاق', required: true },
              { key: 'remaining_text', label: 'المتبقي', required: true },
              { key: 'item_url', label: 'رابط المعاملة', required: true },
              { key: 'department_name', label: 'القسم', required: false },
              { key: 'category', label: 'الفئة', required: false },
              { key: 'creator_note', label: 'ملاحظة', required: false },
            ],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'tools': {
        // Available tools for AI agents
        const { data: agents } = await supabase
          .from('ai_agent_configs')
          .select('*')
          .eq('is_active', true);

        const tools = (agents || []).flatMap(agent => 
          (agent.allowed_tools as string[]).map(tool => ({
            name: tool,
            agent: agent.agent_key,
            description: getToolDescription(tool),
            parameters: getToolParameters(tool),
          }))
        );

        return new Response(
          JSON.stringify({ tools }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schema': {
        // Sanitized schema (no sensitive data)
        const tables = [
          { name: 'items', description: 'العناصر المستحقة', columns: ['id', 'title', 'ref_number', 'expiry_date', 'status', 'workflow_status', 'category_id', 'department_id'] },
          { name: 'recipients', description: 'المستلمين', columns: ['id', 'name', 'telegram_id', 'whatsapp_number', 'is_active'] },
          { name: 'notification_log', description: 'سجل الإشعارات', columns: ['id', 'item_id', 'recipient_id', 'status', 'sent_at', 'error_message'] },
          { name: 'message_templates', description: 'قوالب الرسائل', columns: ['id', 'name', 'channel', 'template_text', 'is_active', 'is_default'] },
          { name: 'evaluations', description: 'التقييمات', columns: ['id', 'cycle_id', 'evaluator_id', 'evaluatee_id', 'evaluation_type', 'status', 'total_score'] },
          { name: 'compliance_scores', description: 'درجات الامتثال', columns: ['id', 'score_type', 'reference_id', 'score', 'period_type'] },
        ];

        return new Response(
          JSON.stringify({ tables }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'runs': {
        // Recent automation runs
        const { data: runs } = await supabase
          .from('automation_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(20);

        return new Response(
          JSON.stringify({ runs }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown endpoint',
            available_endpoints: ['/context', '/tools', '/schema', '/runs']
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Error in ai-context:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Tool descriptions for AI
function getToolDescription(tool: string): string {
  const descriptions: Record<string, string> = {
    search_items: 'البحث في العناصر المستحقة',
    get_due_items: 'جلب العناصر التي ستنتهي قريباً',
    update_reminder_rule: 'تحديث قاعدة تذكير',
    preview_template: 'معاينة قالب رسالة',
    get_notification_logs: 'جلب سجلات الإشعارات',
    calculate_compliance: 'حساب درجات الامتثال',
    generate_report: 'توليد تقرير امتثال',
    analyze_risks: 'تحليل المخاطر',
    get_trends: 'جلب اتجاهات الامتثال',
    get_evaluations: 'جلب التقييمات',
    analyze_evaluation: 'تحليل تقييم بالذكاء الاصطناعي',
    get_cycle_stats: 'إحصائيات دورة التقييم',
    generate_summary: 'توليد ملخص تقييم',
    check_integration_status: 'فحص حالة التكامل',
    get_delivery_stats: 'إحصائيات التسليم',
    test_channel: 'اختبار قناة إرسال',
    analyze_failures: 'تحليل أخطاء الإرسال',
    route_to_agent: 'توجيه للوكيل المناسب',
    get_user_context: 'جلب سياق المستخدم',
  };
  return descriptions[tool] || tool;
}

function getToolParameters(tool: string): Record<string, string> {
  const params: Record<string, Record<string, string>> = {
    search_items: { query: 'string', status: 'active|expired|archived' },
    get_due_items: { days: 'number' },
    update_reminder_rule: { rule_id: 'uuid', days_before: 'number[]' },
    preview_template: { template_id: 'uuid', sample_data: 'object' },
    calculate_compliance: { department_id: 'uuid?', category_id: 'uuid?', period: 'string' },
    get_evaluations: { cycle_id: 'uuid?', status: 'string?' },
    test_channel: { channel: 'telegram|whatsapp', recipient_id: 'uuid' },
  };
  return params[tool] || {};
}
