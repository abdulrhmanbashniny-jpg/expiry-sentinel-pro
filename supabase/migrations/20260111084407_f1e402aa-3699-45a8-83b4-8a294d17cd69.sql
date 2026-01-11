-- ========================================
-- 1. Metadata Registry for AI-to-AI Context
-- ========================================
CREATE TABLE IF NOT EXISTS public.platform_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'module', 'edge_function', 'template', 'agent', 'schema'
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(category, key)
);

-- Enable RLS
ALTER TABLE public.platform_metadata ENABLE ROW LEVEL SECURITY;

-- Only admins can manage metadata
CREATE POLICY "Admins can manage metadata"
  ON public.platform_metadata
  FOR ALL
  USING (public.is_admin_or_higher(auth.uid()));

-- Public read for AI context
CREATE POLICY "Anyone can read metadata"
  ON public.platform_metadata
  FOR SELECT
  USING (true);

-- ========================================
-- 2. AI Agent Configurations
-- ========================================
CREATE TABLE IF NOT EXISTS public.ai_agent_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key TEXT UNIQUE NOT NULL, -- 'orchestrator', 'reminder', 'compliance', 'performance', 'integrations'
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  system_prompt TEXT,
  allowed_tools TEXT[] DEFAULT '{}',
  data_access_scope TEXT[] DEFAULT '{}', -- e.g., ['items', 'recipients', 'notification_log']
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;

-- Only system admins can manage agent configs
CREATE POLICY "System admins can manage agent configs"
  ON public.ai_agent_configs
  FOR ALL
  USING (public.is_system_admin(auth.uid()));

-- Read for internal use
CREATE POLICY "Admins can read agent configs"
  ON public.ai_agent_configs
  FOR SELECT
  USING (public.is_admin_or_higher(auth.uid()));

-- ========================================
-- 3. Automation Runs Log (for production monitoring)
-- ========================================
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'daily_reminders', 'compliance_report', 'escalation'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  results JSONB DEFAULT '{}',
  error_message TEXT,
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- Admins can view automation runs
CREATE POLICY "Admins can view automation runs"
  ON public.automation_runs
  FOR SELECT
  USING (public.is_admin_or_higher(auth.uid()));

-- Index for quick lookups
CREATE INDEX idx_automation_runs_job_type ON public.automation_runs(job_type);
CREATE INDEX idx_automation_runs_started_at ON public.automation_runs(started_at DESC);

-- ========================================
-- 4. Rate Limiting Table
-- ========================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel TEXT NOT NULL, -- 'telegram', 'whatsapp'
  recipient_id UUID REFERENCES public.recipients(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(channel, recipient_id, date)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Admins can view rate limits
CREATE POLICY "Admins can view rate limits"
  ON public.rate_limits
  FOR ALL
  USING (public.is_admin_or_higher(auth.uid()));

-- ========================================
-- 5. Insert Default Platform Metadata
-- ========================================
INSERT INTO public.platform_metadata (category, key, name, name_en, description, config) VALUES
-- Modules
('module', 'reminders', 'نظام التذكيرات', 'Reminders System', 'إدارة التذكيرات التلقائية للعناصر المستحقة', '{"edge_functions": ["automated-reminders", "prepare-message", "send-telegram", "send-whatsapp"], "tables": ["items", "recipients", "notification_log", "reminder_rules"]}'),
('module', 'evaluations', 'تقييم الأداء', 'Performance Evaluation', 'نظام تقييم الموظفين والتقييم 360', '{"edge_functions": ["ai-analyze-evaluation"], "tables": ["evaluations", "evaluation_cycles", "evaluation_answers", "published_results"]}'),
('module', 'compliance', 'الامتثال', 'Compliance', 'تقارير الامتثال وحساب النتائج', '{"edge_functions": ["calculate-compliance-scores", "generate-compliance-report"], "tables": ["compliance_scores", "compliance_reports"]}'),
('module', 'integrations', 'التكاملات', 'Integrations', 'إدارة قنوات الإرسال والتكامل الخارجي', '{"edge_functions": ["test-integration", "appslink-webhook", "telegram-webhook"], "tables": ["integrations"]}'),
-- Edge Functions
('edge_function', 'automated-reminders', 'التذكيرات التلقائية', 'Automated Reminders', 'تشغيل التذكيرات اليومية', '{"schedule": "0 4 * * *", "timezone": "Asia/Riyadh", "http_method": "POST"}'),
('edge_function', 'prepare-message', 'تحضير الرسالة', 'Prepare Message', 'توليد نص الرسالة من القالب', '{"params": {"item_id": "uuid", "recipient_id": "uuid", "channel": "telegram|whatsapp"}}'),
('edge_function', 'send-telegram', 'إرسال تيليجرام', 'Send Telegram', 'إرسال رسالة عبر تيليجرام', '{"params": {"chat_id": "string", "message": "string", "parse_mode": "HTML"}}'),
('edge_function', 'send-whatsapp', 'إرسال واتساب', 'Send WhatsApp', 'إرسال رسالة عبر واتساب', '{"params": {"phone": "string", "message": "string"}}')
ON CONFLICT (category, key) DO NOTHING;

-- ========================================
-- 6. Insert Default AI Agent Configurations
-- ========================================
INSERT INTO public.ai_agent_configs (agent_key, name, name_en, description, system_prompt, allowed_tools, data_access_scope, priority) VALUES
('orchestrator', 'المنسق الرئيسي', 'Orchestrator', 'يحدد نية الطلب ويوجه للوكيل المناسب', 
'أنت المنسق الرئيسي لنظام إدارة انتهاء الصلاحية. مهمتك تحديد نية المستخدم وتوجيه الطلب للوكيل المتخصص المناسب. الوكلاء المتاحون: reminder (التذكيرات)، compliance (الامتثال)، performance (التقييمات)، integrations (التكاملات).', 
ARRAY['route_to_agent', 'get_user_context'], 
ARRAY['user_roles', 'platform_metadata'], 
100),

('reminder', 'وكيل التذكيرات', 'Reminder Agent', 'إدارة التذكيرات والقوالب والجدولة',
'أنت وكيل متخصص في نظام التذكيرات. يمكنك: البحث عن العناصر المستحقة، تعديل قواعد التذكير، مراجعة سجلات الإرسال، واقتراح تحسينات على القوالب.',
ARRAY['search_items', 'get_due_items', 'update_reminder_rule', 'preview_template', 'get_notification_logs'],
ARRAY['items', 'recipients', 'reminder_rules', 'notification_log', 'message_templates'],
10),

('compliance', 'وكيل الامتثال', 'Compliance Agent', 'تقارير الامتثال والمخاطر والتوصيات',
'أنت وكيل متخصص في تحليل الامتثال. يمكنك: حساب درجات الامتثال، تحليل المخاطر، توليد التقارير، واقتراح تحسينات.',
ARRAY['calculate_compliance', 'generate_report', 'analyze_risks', 'get_trends'],
ARRAY['compliance_scores', 'compliance_reports', 'items', 'departments', 'categories'],
10),

('performance', 'وكيل الأداء', 'Performance Agent', 'التقييمات والدورات و360 والتلخيصات',
'أنت وكيل متخصص في تقييم الأداء. يمكنك: مراجعة التقييمات، تحليل النتائج، توليد ملخصات AI، ومتابعة الدورات.',
ARRAY['get_evaluations', 'analyze_evaluation', 'get_cycle_stats', 'generate_summary'],
ARRAY['evaluations', 'evaluation_cycles', 'published_results', 'profiles'],
10),

('integrations', 'وكيل التكاملات', 'Integrations Agent', 'قنوات WhatsApp/Telegram والمراقبة',
'أنت وكيل متخصص في إدارة التكاملات. يمكنك: فحص حالة القنوات، مراجعة سجلات الإرسال، تحليل أخطاء التسليم، واقتراح حلول.',
ARRAY['check_integration_status', 'get_delivery_stats', 'test_channel', 'analyze_failures'],
ARRAY['integrations', 'notification_log', 'automation_runs'],
10)
ON CONFLICT (agent_key) DO NOTHING;

-- ========================================
-- 7. Update message_templates with official templates
-- ========================================
-- Update default Telegram template
UPDATE public.message_templates
SET template_text = 'مرحبًا {{recipient_name}}،

🔔 تذكير: {{title}}

📋 الرقم/المرجع: {{item_code}}
🏢 القسم: {{department_name}}
📁 الفئة: {{category}}
📅 تاريخ الانتهاء: {{due_date}}
⏰ المتبقي: {{remaining_text}}

{{#if creator_note}}📝 ملاحظة: {{creator_note}}
{{/if}}
🔗 <a href="{{item_url}}">عرض المعاملة</a>

━━━━━━━━━━━━━━━━
نظام تنبيهات انتهاء الصلاحية',
    required_fields = ARRAY['recipient_name', 'title', 'item_code', 'due_date', 'remaining_text', 'item_url'],
    optional_fields = ARRAY['department_name', 'category', 'creator_note']
WHERE channel = 'telegram' AND is_default = true;

-- Update WhatsApp template
UPDATE public.message_templates
SET template_text = 'مرحبًا {{recipient_name}}،

🔔 *تذكير:* {{title}}

📋 *الرقم/المرجع:* {{item_code}}
🏢 *القسم:* {{department_name}}
📁 *الفئة:* {{category}}
📅 *تاريخ الانتهاء:* {{due_date}}
⏰ *المتبقي:* {{remaining_text}}

{{#if creator_note}}📝 *ملاحظة:* {{creator_note}}
{{/if}}
🔗 {{item_url}}

━━━━━━━━━━━━━━━━
نظام تنبيهات انتهاء الصلاحية',
    required_fields = ARRAY['recipient_name', 'title', 'item_code', 'due_date', 'remaining_text', 'item_url'],
    optional_fields = ARRAY['department_name', 'category', 'creator_note'],
    is_default = true
WHERE channel = 'whatsapp';

-- ========================================
-- 8. Enable pg_cron and pg_net extensions
-- ========================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;