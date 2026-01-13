import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ai-token',
};

// AI-to-AI API Endpoint
// Provides platform context for external AI agents with token verification
// This is the ONLY way to access platform_metadata and related tables from external AI agents

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== AI Context API Request ===');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify AI token (REQUIRED - no public access)
    const aiToken = req.headers.get('x-ai-token');
    
    if (!aiToken) {
      console.log('Missing AI token');
      return new Response(
        JSON.stringify({ error: 'Missing x-ai-token header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get expected token from integrations table
    const { data: tokenConfig, error: tokenError } = await supabase
      .from('integrations')
      .select('config')
      .eq('key', 'ai_context')
      .single();

    if (tokenError || !tokenConfig) {
      console.log('AI context integration not configured');
      return new Response(
        JSON.stringify({ error: 'AI context integration not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validToken = (tokenConfig.config as any)?.api_token;
    if (!validToken || aiToken !== validToken) {
      console.log('Invalid AI token');
      return new Response(
        JSON.stringify({ error: 'Invalid AI token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token verified successfully');

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1] || 'context';

    console.log('Endpoint:', endpoint);

    // Route based on endpoint
    switch (endpoint) {
      case 'context':
      case 'ai-context': {
        // Full platform context for AI - Source of Truth
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
          supabase.from('message_templates').select('id, name, name_en, channel, required_fields, optional_fields, is_active, is_default, version'),
          supabase.from('ai_agent_configs').select('agent_key, name, name_en, description, allowed_tools, data_access_scope, is_active, priority'),
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
              cron_schedule: '0 4 * * * (07:00 AM Riyadh)',
            },
            modules: modules || [],
            edge_functions: (functions || []).map(f => ({
              key: f.key,
              name: f.name,
              name_en: f.name_en,
              description: f.description,
              config: sanitizeConfig(f.config),
            })),
            message_templates: templates || [],
            ai_agents: (agents || []).map(a => ({
              ...a,
              // Never expose system_prompt via API
              system_prompt: undefined,
            })),
            recent_errors: (recentErrors || []).map(e => ({
              job_type: e.job_type,
              error: e.error_message?.substring(0, 100), // Truncate
              timestamp: e.started_at
            })),
            last_automation_runs: (lastRuns || []).map(r => ({
              job_type: r.job_type,
              status: r.status,
              success: r.items_success,
              failed: r.items_failed,
              duration_ms: r.duration_ms,
              timestamp: r.started_at
            })),
            available_placeholders: [
              { key: 'recipient_name', label: 'اسم المستلم', label_en: 'Recipient Name', required: true },
              { key: 'title', label: 'عنوان المعاملة', label_en: 'Item Title', required: true },
              { key: 'item_code', label: 'كود العنصر', label_en: 'Item Code', required: true },
              { key: 'due_date', label: 'تاريخ الاستحقاق', label_en: 'Due Date', required: true },
              { key: 'remaining_text', label: 'المتبقي', label_en: 'Remaining Time', required: true },
              { key: 'item_url', label: 'رابط المعاملة', label_en: 'Item URL', required: true },
              { key: 'department_name', label: 'القسم', label_en: 'Department', required: false },
              { key: 'category', label: 'الفئة', label_en: 'Category', required: false },
              { key: 'creator_note', label: 'ملاحظة', label_en: 'Creator Note', required: false },
            ],
            documentation: {
              api_endpoints: '/ai-context/context, /ai-context/tools, /ai-context/schema, /ai-context/runs',
              authentication: 'x-ai-token header required',
              rate_limit: '60 requests per minute',
            },
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
          ((agent.allowed_tools as string[]) || []).map(tool => ({
            name: tool,
            agent: agent.agent_key,
            agent_name: agent.name,
            description: getToolDescription(tool),
            parameters: getToolParameters(tool),
          }))
        );

        return new Response(
          JSON.stringify({ 
            tools,
            total: tools.length,
            agents: (agents || []).map(a => ({ key: a.agent_key, name: a.name, priority: a.priority }))
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'schema': {
        // Sanitized schema (no sensitive data, no actual values)
        const tables = [
          { 
            name: 'items', 
            description: 'العناصر المستحقة', 
            description_en: 'Due items for tracking',
            columns: ['id', 'title', 'ref_number', 'expiry_date', 'expiry_time', 'status', 'workflow_status', 'category_id', 'department_id', 'notes', 'dynamic_fields', 'is_recurring', 'created_at']
          },
          { 
            name: 'recipients', 
            description: 'المستلمين', 
            description_en: 'Notification recipients',
            columns: ['id', 'name', 'telegram_id', 'whatsapp_number', 'is_active']
          },
          { 
            name: 'notification_log', 
            description: 'سجل الإشعارات', 
            description_en: 'Notification history',
            columns: ['id', 'item_id', 'recipient_id', 'status', 'sent_at', 'error_message', 'reminder_day', 'provider_message_id']
          },
          { 
            name: 'message_templates', 
            description: 'قوالب الرسائل', 
            description_en: 'Message templates',
            columns: ['id', 'name', 'channel', 'template_text', 'is_active', 'is_default', 'required_fields', 'optional_fields']
          },
          { 
            name: 'reminder_rules', 
            description: 'قواعد التذكير', 
            description_en: 'Reminder rules',
            columns: ['id', 'name', 'days_before', 'is_active']
          },
          { 
            name: 'evaluations', 
            description: 'التقييمات', 
            description_en: 'Performance evaluations',
            columns: ['id', 'cycle_id', 'evaluator_id', 'evaluatee_id', 'evaluation_type', 'status', 'total_score', 'ai_summary']
          },
          { 
            name: 'compliance_scores', 
            description: 'درجات الامتثال', 
            description_en: 'Compliance scores',
            columns: ['id', 'score_type', 'reference_id', 'reference_name', 'score', 'period_type', 'period_start', 'period_end']
          },
          { 
            name: 'automation_runs', 
            description: 'سجل التشغيل التلقائي', 
            description_en: 'Automation run history',
            columns: ['id', 'job_type', 'status', 'started_at', 'completed_at', 'duration_ms', 'items_processed', 'items_success', 'items_failed', 'error_message']
          },
          { 
            name: 'departments', 
            description: 'الأقسام', 
            description_en: 'Departments',
            columns: ['id', 'name', 'code', 'manager_user_id', 'is_active']
          },
          { 
            name: 'categories', 
            description: 'الفئات', 
            description_en: 'Categories',
            columns: ['id', 'name', 'code', 'risk_level', 'department_id']
          },
        ];

        const enums = {
          item_status: ['active', 'expired', 'archived'],
          item_workflow_status: ['new', 'acknowledged', 'in_progress', 'done_pending_supervisor', 'returned', 'escalated_to_manager', 'finished'],
          notification_status: ['pending', 'sent', 'failed', 'skipped'],
          evaluation_status: ['draft', 'in_progress', 'submitted', 'reviewed', 'approved', 'published'],
          evaluation_type: ['supervisor_to_employee', 'manager_to_supervisor', 'admin_to_manager', 'self_assessment', 'peer_360'],
          app_role: ['admin', 'hr_user', 'system_admin', 'supervisor', 'employee'],
        };

        return new Response(
          JSON.stringify({ tables, enums }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'runs': {
        // Recent automation runs (sanitized)
        const { data: runs } = await supabase
          .from('automation_runs')
          .select('id, job_type, status, started_at, completed_at, duration_ms, items_processed, items_success, items_failed')
          .order('started_at', { ascending: false })
          .limit(20);

        return new Response(
          JSON.stringify({ 
            runs,
            total: runs?.length || 0,
            timestamp: new Date().toISOString()
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mcp': {
        // MCP Server endpoint - returns available resources and tools
        const { data: agents } = await supabase
          .from('ai_agent_configs')
          .select('agent_key, name, name_en, description, allowed_tools')
          .eq('is_active', true);

        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'expiry-sentinel-mcp',
                version: '1.0.0',
              },
              capabilities: {
                tools: {},
                resources: {},
              },
              tools: (agents || []).flatMap(a => 
                ((a.allowed_tools as string[]) || []).map(t => ({
                  name: `${a.agent_key}_${t}`,
                  description: getToolDescription(t),
                  inputSchema: {
                    type: 'object',
                    properties: getToolParameters(t),
                  },
                }))
              ),
              resources: [
                { uri: 'expiry-sentinel://metadata', name: 'Platform Metadata', mimeType: 'application/json' },
                { uri: 'expiry-sentinel://templates', name: 'Message Templates', mimeType: 'application/json' },
                { uri: 'expiry-sentinel://schema', name: 'Database Schema', mimeType: 'application/json' },
                { uri: 'expiry-sentinel://runs', name: 'Automation Runs', mimeType: 'application/json' },
              ],
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown endpoint',
            available_endpoints: ['/context', '/tools', '/schema', '/runs', '/mcp'],
            documentation: 'Use x-ai-token header for authentication'
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('Error in ai-context:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Remove sensitive data from config objects
function sanitizeConfig(config: any): any {
  if (!config) return {};
  const sanitized = { ...config };
  const sensitiveKeys = ['api_key', 'apikey', 'token', 'secret', 'password', 'credential'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

// Tool descriptions for AI
function getToolDescription(tool: string): string {
  const descriptions: Record<string, string> = {
    search_items: 'البحث في العناصر المستحقة / Search due items',
    get_due_items: 'جلب العناصر التي ستنتهي قريباً / Get items expiring soon',
    update_reminder_rule: 'تحديث قاعدة تذكير / Update reminder rule',
    preview_template: 'معاينة قالب رسالة / Preview message template',
    get_notification_logs: 'جلب سجلات الإشعارات / Get notification logs',
    calculate_compliance: 'حساب درجات الامتثال / Calculate compliance scores',
    generate_report: 'توليد تقرير امتثال / Generate compliance report',
    analyze_risks: 'تحليل المخاطر / Analyze risks',
    get_trends: 'جلب اتجاهات الامتثال / Get compliance trends',
    get_department_stats: 'إحصائيات الأقسام / Department statistics',
    get_evaluations: 'جلب التقييمات / Get evaluations',
    analyze_evaluation: 'تحليل تقييم بالذكاء الاصطناعي / AI analyze evaluation',
    get_cycle_stats: 'إحصائيات دورة التقييم / Evaluation cycle stats',
    generate_summary: 'توليد ملخص تقييم / Generate evaluation summary',
    get_team_performance: 'أداء الفريق / Team performance',
    check_integration_status: 'فحص حالة التكامل / Check integration status',
    get_delivery_stats: 'إحصائيات التسليم / Delivery statistics',
    test_channel: 'اختبار قناة إرسال / Test delivery channel',
    analyze_failures: 'تحليل أخطاء الإرسال / Analyze delivery failures',
    get_rate_limits: 'حدود الإرسال / Get rate limits',
    route_to_agent: 'توجيه للوكيل المناسب / Route to appropriate agent',
    get_user_context: 'جلب سياق المستخدم / Get user context',
    get_available_agents: 'الوكلاء المتاحين / Get available agents',
  };
  return descriptions[tool] || tool;
}

function getToolParameters(tool: string): Record<string, any> {
  const params: Record<string, Record<string, any>> = {
    search_items: { 
      query: { type: 'string', description: 'Search query' },
      status: { type: 'string', enum: ['active', 'expired', 'archived'] }
    },
    get_due_items: { 
      days: { type: 'number', description: 'Days ahead to check' }
    },
    update_reminder_rule: { 
      rule_id: { type: 'string', format: 'uuid' },
      days_before: { type: 'array', items: { type: 'number' } }
    },
    preview_template: { 
      template_id: { type: 'string', format: 'uuid' },
      sample_data: { type: 'object' }
    },
    calculate_compliance: { 
      department_id: { type: 'string', format: 'uuid' },
      category_id: { type: 'string', format: 'uuid' },
      period: { type: 'string' }
    },
    get_evaluations: { 
      cycle_id: { type: 'string', format: 'uuid' },
      status: { type: 'string' }
    },
    test_channel: { 
      channel: { type: 'string', enum: ['telegram', 'whatsapp'] },
      recipient_id: { type: 'string', format: 'uuid' }
    },
  };
  return params[tool] || {};
}
