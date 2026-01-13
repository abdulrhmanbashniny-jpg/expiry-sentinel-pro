
-- ========================================
-- 1. تحديث RLS policies للأمان
-- ========================================

-- إزالة السياسة العامة على platform_metadata
DROP POLICY IF EXISTS "Anyone can read metadata" ON public.platform_metadata;

-- سياسة جديدة: فقط المسؤولين يمكنهم قراءة metadata
CREATE POLICY "Only admins can read metadata" ON public.platform_metadata
  FOR SELECT USING (public.is_admin_or_higher(auth.uid()));

-- سياسة للتعديل: فقط system_admin
CREATE POLICY "Only system_admin can modify metadata" ON public.platform_metadata
  FOR ALL USING (public.is_system_admin(auth.uid()));

-- تحديث RLS على ai_agent_configs
DROP POLICY IF EXISTS "Anyone can read agent configs" ON public.ai_agent_configs;
CREATE POLICY "Only admins can read agent configs" ON public.ai_agent_configs
  FOR SELECT USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Only system_admin can modify agent configs" ON public.ai_agent_configs
  FOR ALL USING (public.is_system_admin(auth.uid()));

-- تحديث RLS على automation_runs
DROP POLICY IF EXISTS "Anyone can read automation runs" ON public.automation_runs;
CREATE POLICY "Only admins can read automation runs" ON public.automation_runs
  FOR SELECT USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "System can insert automation runs" ON public.automation_runs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update automation runs" ON public.automation_runs
  FOR UPDATE USING (true);

-- تحديث RLS على rate_limits
DROP POLICY IF EXISTS "Anyone can read rate limits" ON public.rate_limits;
CREATE POLICY "Only admins can read rate limits" ON public.rate_limits
  FOR SELECT USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "System can manage rate limits" ON public.rate_limits
  FOR ALL USING (true);

-- ========================================
-- 2. تحديث القوالب الرسمية
-- ========================================

-- قالب Telegram مع HTML
UPDATE public.message_templates
SET template_text = 'مرحبًا {{recipient_name}}،

🔔 تذكير: {{title}}

📋 الرقم/المرجع: {{item_code}}
🏢 القسم: {{department_name}}
📁 الفئة: {{category}}
📅 تاريخ الانتهاء: {{due_date}}
⏰ المتبقي: {{remaining_text}}

{{#if creator_note}}📝 ملاحظة: {{creator_note}}
{{/if}}🔗 <a href="{{item_url}}">عرض المعاملة</a>

━━━━━━━━━━━━━━━━
نظام تنبيهات انتهاء الصلاحية',
    required_fields = ARRAY['recipient_name', 'title', 'item_code', 'due_date', 'remaining_text', 'item_url'],
    optional_fields = ARRAY['department_name', 'category', 'creator_note'],
    is_default = true,
    updated_at = now()
WHERE channel = 'telegram' AND is_default = true;

-- قالب WhatsApp
UPDATE public.message_templates
SET template_text = 'مرحبًا {{recipient_name}}،

🔔 تذكير: {{title}}

📋 الرقم/المرجع: {{item_code}}
🏢 القسم: {{department_name}}
📁 الفئة: {{category}}
📅 تاريخ الانتهاء: {{due_date}}
⏰ المتبقي: {{remaining_text}}

{{#if creator_note}}📝 ملاحظة: {{creator_note}}
{{/if}}🔗 {{item_url}}

━━━━━━━━━━━━━━━━
نظام تنبيهات انتهاء الصلاحية',
    required_fields = ARRAY['recipient_name', 'title', 'item_code', 'due_date', 'remaining_text', 'item_url'],
    optional_fields = ARRAY['department_name', 'category', 'creator_note'],
    is_default = true,
    updated_at = now()
WHERE channel = 'whatsapp' AND is_default = true;

-- ========================================
-- 3. تحديث metadata للجدولة
-- ========================================

UPDATE public.platform_metadata
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{schedule}',
  '"0 4 * * *"'::jsonb
),
description = 'Daily reminders at 07:00 AM Asia/Riyadh (04:00 UTC)'
WHERE key = 'automated_reminders';

-- ========================================
-- 4. تحديث وكلاء AI
-- ========================================

-- Orchestrator Agent
UPDATE public.ai_agent_configs
SET system_prompt = 'أنت وكيل التنسيق الرئيسي. مهمتك فهم نية الطلب وتحديد الوكيل المناسب (reminder/compliance/performance/integrations). تتعامل فقط مع الأدوات عالية المستوى. لا تكشف أي أسرار أو مفاتيح.',
    allowed_tools = ARRAY['route_to_agent', 'get_user_context', 'get_available_agents'],
    data_access_scope = ARRAY['user_roles', 'profiles'],
    config = '{"max_routing_depth": 2, "default_agent": "reminder"}'::jsonb,
    priority = 0,
    updated_at = now()
WHERE agent_key = 'orchestrator';

-- Reminder Agent
UPDATE public.ai_agent_configs
SET system_prompt = 'أنت وكيل التذكيرات. مسؤول عن جلب العناصر المستحقة، معاينة القوالب، وإدارة جداول التذكير. تتحدث بالعربية بشكل مهني.',
    allowed_tools = ARRAY['get_due_items', 'search_items', 'preview_template', 'get_notification_logs', 'update_reminder_rule'],
    data_access_scope = ARRAY['items', 'notification_log', 'message_templates', 'reminder_rules', 'recipients'],
    config = '{"default_days_ahead": 30}'::jsonb,
    priority = 1,
    updated_at = now()
WHERE agent_key = 'reminder';

-- Compliance Agent
UPDATE public.ai_agent_configs
SET system_prompt = 'أنت وكيل الامتثال. مسؤول عن تحليل الالتزام بالمواعيد، توليد التقارير، وتحديد المخاطر. تقدم توصيات عملية.',
    allowed_tools = ARRAY['calculate_compliance', 'generate_report', 'analyze_risks', 'get_trends', 'get_department_stats'],
    data_access_scope = ARRAY['compliance_scores', 'compliance_reports', 'items', 'departments', 'categories'],
    config = '{"risk_threshold": 70}'::jsonb,
    priority = 2,
    updated_at = now()
WHERE agent_key = 'compliance';

-- Performance Agent
UPDATE public.ai_agent_configs
SET system_prompt = 'أنت وكيل الأداء. مسؤول عن التقييمات، دورات الأداء، تحليل 360، وتوليد الملخصات. تقدم تحليلات موضوعية.',
    allowed_tools = ARRAY['get_evaluations', 'analyze_evaluation', 'get_cycle_stats', 'generate_summary', 'get_team_performance'],
    data_access_scope = ARRAY['evaluations', 'evaluation_cycles', 'kpi_templates', 'published_results', 'profiles'],
    config = '{"include_ai_analysis": true}'::jsonb,
    priority = 3,
    updated_at = now()
WHERE agent_key = 'performance';

-- Integrations Agent
UPDATE public.ai_agent_configs
SET system_prompt = 'أنت وكيل التكاملات. مسؤول عن مراقبة قنوات WhatsApp/Telegram، تحليل أخطاء التسليم، وفحص حالة التكامل.',
    allowed_tools = ARRAY['check_integration_status', 'get_delivery_stats', 'test_channel', 'analyze_failures', 'get_rate_limits'],
    data_access_scope = ARRAY['integrations', 'notification_log', 'automation_runs', 'rate_limits'],
    config = '{"auto_retry_failed": true}'::jsonb,
    priority = 4,
    updated_at = now()
WHERE agent_key = 'integrations';

-- ========================================
-- 5. إضافة توكن AI-to-AI في integrations
-- ========================================

INSERT INTO public.integrations (key, name, is_active, config)
VALUES (
  'ai_context',
  'AI-to-AI Context API',
  true,
  jsonb_build_object(
    'api_token', encode(gen_random_bytes(32), 'hex'),
    'description', 'Token for AI-to-AI communication layer',
    'rate_limit_per_minute', 60,
    'allowed_endpoints', ARRAY['/context', '/tools', '/schema', '/runs']
  )
)
ON CONFLICT (key) DO UPDATE SET
  config = EXCLUDED.config,
  updated_at = now();
