-- =============================================
-- (A) نظام التوكيل Delegation
-- =============================================

-- حالات التوكيل
CREATE TYPE public.delegation_status AS ENUM (
  'pending',      -- في انتظار قبول البديل
  'accepted',     -- تم القبول
  'rejected',     -- تم الرفض
  'active',       -- نشط حالياً
  'completed',    -- انتهى
  'cancelled'     -- ملغي
);

-- جدول التوكيلات
CREATE TABLE public.delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id UUID NOT NULL,           -- المفوِّض
  delegate_id UUID NOT NULL,            -- البديل
  status delegation_status NOT NULL DEFAULT 'pending',
  from_datetime TIMESTAMPTZ NOT NULL,
  to_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT,                           -- سبب التوكيل
  rejection_reason TEXT,                 -- سبب الرفض
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delegations_different_users CHECK (delegator_id != delegate_id),
  CONSTRAINT delegations_valid_dates CHECK (to_datetime > from_datetime)
);

-- فهرس للبحث السريع
CREATE INDEX idx_delegations_delegator ON public.delegations(delegator_id);
CREATE INDEX idx_delegations_delegate ON public.delegations(delegate_id);
CREATE INDEX idx_delegations_status ON public.delegations(status);
CREATE INDEX idx_delegations_dates ON public.delegations(from_datetime, to_datetime);

-- سجل تدقيق التوكيلات
CREATE TABLE public.delegation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL REFERENCES public.delegations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                  -- created, accepted, rejected, cancelled, activated, completed
  performed_by UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delegation_audit_delegation ON public.delegation_audit_log(delegation_id);

-- =============================================
-- (B) نظام KPI Templates + التقييم
-- =============================================

-- أنواع فترات التقييم
CREATE TYPE public.evaluation_period_type AS ENUM (
  'annual',       -- سنوي
  'semi_annual',  -- نصف سنوي
  'quarterly',    -- ربع سنوي
  'monthly'       -- شهري
);

-- أنواع التقييم
CREATE TYPE public.evaluation_type AS ENUM (
  'supervisor_to_employee',   -- المشرف يقيم الموظف
  'manager_to_supervisor',    -- المدير يقيم المشرف
  'admin_to_manager',         -- مدير النظام يقيم المدير
  'self_assessment',          -- تقييم ذاتي
  'peer_360'                  -- تقييم 360 من الزملاء
);

-- أنواع الإجابات
CREATE TYPE public.question_answer_type AS ENUM (
  'numeric',      -- رقم (1-5 أو 1-10)
  'choice',       -- اختيار من متعدد
  'text'          -- نص حر
);

-- قوالب التقييم
CREATE TABLE public.kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,                          -- للترجمة لاحقاً
  description TEXT,
  description_en TEXT,
  period_type evaluation_period_type NOT NULL DEFAULT 'annual',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- محاور التقييم
CREATE TABLE public.kpi_template_axes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.kpi_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  weight NUMERIC(5,2) NOT NULL DEFAULT 0,  -- الوزن (النسبة المئوية)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_axes_template ON public.kpi_template_axes(template_id);

-- أسئلة التقييم
CREATE TABLE public.kpi_template_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  axis_id UUID NOT NULL REFERENCES public.kpi_template_axes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_text_en TEXT,
  answer_type question_answer_type NOT NULL DEFAULT 'numeric',
  choices JSONB,                          -- للاختيار من متعدد
  min_value NUMERIC,                      -- للأرقام
  max_value NUMERIC,
  weight NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_questions_axis ON public.kpi_template_questions(axis_id);

-- دورات التقييم
CREATE TABLE public.evaluation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.kpi_templates(id),
  name TEXT NOT NULL,
  name_en TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allow_self_assessment BOOLEAN NOT NULL DEFAULT true,
  allow_360 BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- حالات التقييم الفردي
CREATE TYPE public.evaluation_status AS ENUM (
  'draft',        -- مسودة
  'in_progress',  -- قيد التنفيذ
  'submitted',    -- تم الإرسال
  'reviewed',     -- تمت المراجعة
  'completed'     -- مكتمل
);

-- التقييمات الفردية
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.evaluation_cycles(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL,            -- المقيِّم
  evaluatee_id UUID NOT NULL,            -- المُقيَّم
  evaluation_type evaluation_type NOT NULL,
  status evaluation_status NOT NULL DEFAULT 'draft',
  total_score NUMERIC(5,2),
  is_proxy BOOLEAN NOT NULL DEFAULT false,  -- هل تم بالنيابة
  proxy_by UUID,                            -- من قام بالتقييم بالنيابة
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  ai_summary TEXT,                       -- ملخص AI
  ai_risks TEXT,                         -- مخاطر AI
  ai_recommendations TEXT,               -- توصيات AI
  ai_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_cycle ON public.evaluations(cycle_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);
CREATE INDEX idx_evaluations_evaluatee ON public.evaluations(evaluatee_id);
CREATE INDEX idx_evaluations_status ON public.evaluations(status);

-- إجابات التقييم
CREATE TABLE public.evaluation_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.kpi_template_questions(id),
  numeric_value NUMERIC,
  choice_value TEXT,
  text_value TEXT,
  score NUMERIC(5,2),                    -- الدرجة المحسوبة
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluation_answers_evaluation ON public.evaluation_answers(evaluation_id);
CREATE UNIQUE INDEX idx_evaluation_answers_unique ON public.evaluation_answers(evaluation_id, question_id);

-- =============================================
-- (C) AI Analysis + Prompt Memory
-- =============================================

-- إصدارات البرومبت
CREATE TABLE public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT NOT NULL,              -- مفتاح فريد (مثل: kpi_analysis, risk_detection)
  prompt_text TEXT NOT NULL,
  system_memory TEXT,                    -- ذاكرة النظام الثابتة
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ai_prompts_key_version ON public.ai_prompts(prompt_key, version);
CREATE INDEX idx_ai_prompts_active ON public.ai_prompts(prompt_key, is_active) WHERE is_active = true;

-- إعدادات مزودي AI
CREATE TABLE public.ai_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,           -- lovable, openai, etc
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,   -- الأولوية (الأقل = الأعلى أولوية)
  config JSONB DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER,                   -- الحد الأقصى (null = غير محدود)
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- سجل استخدام AI
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  prompt_key TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_provider ON public.ai_usage_log(provider_name, created_at);

-- =============================================
-- (D) استيراد المستخدمين + Force Password Change
-- =============================================

-- إضافة حقل must_change_password للـ profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- سجل استيراد المستخدمين
CREATE TABLE public.user_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  error_details JSONB DEFAULT '[]',      -- تفاصيل الأخطاء لكل صف
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_import_logs_by ON public.user_import_logs(imported_by, created_at);

-- سجل تدقيق كلمات المرور
CREATE TABLE public.password_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,                  -- reset, changed, force_changed
  performed_by UUID,                     -- NULL إذا المستخدم نفسه
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_audit_user ON public.password_audit_log(user_id, created_at);

-- =============================================
-- تفعيل RLS
-- =============================================

ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_template_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- سياسات RLS
-- =============================================

-- التوكيلات: المفوض والبديل يشاهدون توكيلاتهم، المدير يشاهد الكل
CREATE POLICY "Delegations: Users see own delegations"
ON public.delegations FOR SELECT
USING (delegator_id = auth.uid() OR delegate_id = auth.uid() OR is_admin_or_higher(auth.uid()));

CREATE POLICY "Delegations: Users can create delegations"
ON public.delegations FOR INSERT
WITH CHECK (delegator_id = auth.uid() OR is_system_admin(auth.uid()));

CREATE POLICY "Delegations: Delegate can accept/reject"
ON public.delegations FOR UPDATE
USING (delegate_id = auth.uid() OR delegator_id = auth.uid() OR is_system_admin(auth.uid()));

CREATE POLICY "Delegations: System admin can delete"
ON public.delegations FOR DELETE
USING (is_system_admin(auth.uid()));

-- سجل تدقيق التوكيلات
CREATE POLICY "Delegation audit: View own or admin"
ON public.delegation_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.delegations d 
    WHERE d.id = delegation_id 
    AND (d.delegator_id = auth.uid() OR d.delegate_id = auth.uid())
  ) OR is_admin_or_higher(auth.uid())
);

CREATE POLICY "Delegation audit: System insert"
ON public.delegation_audit_log FOR INSERT
WITH CHECK (true);

-- قوالب KPI: المدير يدير، الكل يقرأ
CREATE POLICY "KPI Templates: All can read"
ON public.kpi_templates FOR SELECT
USING (true);

CREATE POLICY "KPI Templates: Admin can manage"
ON public.kpi_templates FOR ALL
USING (is_admin_or_higher(auth.uid()));

-- محاور KPI
CREATE POLICY "KPI Axes: All can read"
ON public.kpi_template_axes FOR SELECT
USING (true);

CREATE POLICY "KPI Axes: Admin can manage"
ON public.kpi_template_axes FOR ALL
USING (is_admin_or_higher(auth.uid()));

-- أسئلة KPI
CREATE POLICY "KPI Questions: All can read"
ON public.kpi_template_questions FOR SELECT
USING (true);

CREATE POLICY "KPI Questions: Admin can manage"
ON public.kpi_template_questions FOR ALL
USING (is_admin_or_higher(auth.uid()));

-- دورات التقييم
CREATE POLICY "Evaluation Cycles: All can read active"
ON public.evaluation_cycles FOR SELECT
USING (is_active = true OR is_admin_or_higher(auth.uid()));

CREATE POLICY "Evaluation Cycles: Admin can manage"
ON public.evaluation_cycles FOR ALL
USING (is_admin_or_higher(auth.uid()));

-- التقييمات
CREATE POLICY "Evaluations: View own or admin"
ON public.evaluations FOR SELECT
USING (
  evaluator_id = auth.uid() 
  OR evaluatee_id = auth.uid() 
  OR is_admin_or_higher(auth.uid())
  OR (is_supervisor_or_higher(auth.uid()) AND evaluatee_id IN (SELECT get_team_member_ids(auth.uid())))
);

CREATE POLICY "Evaluations: Create own or proxy"
ON public.evaluations FOR INSERT
WITH CHECK (
  evaluator_id = auth.uid() 
  OR (is_system_admin(auth.uid()) AND is_proxy = true)
);

CREATE POLICY "Evaluations: Update own or admin"
ON public.evaluations FOR UPDATE
USING (
  evaluator_id = auth.uid() 
  OR is_system_admin(auth.uid())
);

-- إجابات التقييم
CREATE POLICY "Evaluation Answers: View own evaluation"
ON public.evaluation_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e 
    WHERE e.id = evaluation_id 
    AND (e.evaluator_id = auth.uid() OR e.evaluatee_id = auth.uid() OR is_admin_or_higher(auth.uid()))
  )
);

CREATE POLICY "Evaluation Answers: Manage own evaluation"
ON public.evaluation_answers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.evaluations e 
    WHERE e.id = evaluation_id 
    AND (e.evaluator_id = auth.uid() OR is_system_admin(auth.uid()))
  )
);

-- AI Prompts: مدير النظام فقط
CREATE POLICY "AI Prompts: System admin only"
ON public.ai_prompts FOR ALL
USING (is_system_admin(auth.uid()));

-- AI Provider Settings: مدير النظام فقط
CREATE POLICY "AI Provider Settings: System admin only"
ON public.ai_provider_settings FOR ALL
USING (is_system_admin(auth.uid()));

-- AI Usage Log: مدير النظام فقط يقرأ
CREATE POLICY "AI Usage Log: System admin read"
ON public.ai_usage_log FOR SELECT
USING (is_system_admin(auth.uid()));

CREATE POLICY "AI Usage Log: System insert"
ON public.ai_usage_log FOR INSERT
WITH CHECK (true);

-- سجل استيراد المستخدمين: مدير النظام فقط
CREATE POLICY "User Import Logs: System admin only"
ON public.user_import_logs FOR ALL
USING (is_system_admin(auth.uid()));

-- سجل تدقيق كلمات المرور: مدير النظام يرى الكل، المستخدم يرى نفسه
CREATE POLICY "Password Audit: View own or admin"
ON public.password_audit_log FOR SELECT
USING (user_id = auth.uid() OR is_system_admin(auth.uid()));

CREATE POLICY "Password Audit: System insert"
ON public.password_audit_log FOR INSERT
WITH CHECK (true);

-- =============================================
-- Triggers
-- =============================================

-- تحديث updated_at
CREATE TRIGGER update_delegations_updated_at
  BEFORE UPDATE ON public.delegations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kpi_templates_updated_at
  BEFORE UPDATE ON public.kpi_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evaluation_cycles_updated_at
  BEFORE UPDATE ON public.evaluation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evaluation_answers_updated_at
  BEFORE UPDATE ON public.evaluation_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_provider_settings_updated_at
  BEFORE UPDATE ON public.ai_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- إدخال بيانات أولية
-- =============================================

-- مزود AI الأساسي (Lovable)
INSERT INTO public.ai_provider_settings (provider_name, is_primary, is_fallback, priority, is_active)
VALUES 
  ('lovable', true, false, 1, true),
  ('openai', false, true, 2, true);

-- برومبت تحليل KPI
INSERT INTO public.ai_prompts (prompt_key, prompt_text, system_memory, version, is_active, created_by)
VALUES (
  'kpi_analysis',
  'قم بتحليل نتائج التقييم التالية للموظف وقدم:
1. ملخص نقاط القوة
2. ملخص نقاط الضعف
3. توصيات للتطوير
4. إشارات المخاطر (إن وجدت)

بيانات التقييم:
{{evaluation_data}}',
  'أنت محلل موارد بشرية متخصص. قدم تحليلاً موضوعياً ومهنياً باللغة العربية. ركز على النتائج القابلة للقياس والتوصيات العملية.',
  1,
  true,
  '00000000-0000-0000-0000-000000000000'
);