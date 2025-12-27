-- =====================================================
-- تحديث نظام التقييم: السرية + Revision + Appeal + Publish
-- =====================================================

-- 1) تحديث enum لحالات التقييم
ALTER TYPE public.evaluation_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.evaluation_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.evaluation_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE public.evaluation_status ADD VALUE IF NOT EXISTS 'appealed';
ALTER TYPE public.evaluation_status ADD VALUE IF NOT EXISTS 'closed';

-- 2) جدول النتائج المنشورة (ما يراه الموظف فقط)
CREATE TABLE public.published_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  evaluatee_id UUID NOT NULL,
  cycle_id UUID NOT NULL REFERENCES public.evaluation_cycles(id),
  final_score NUMERIC NOT NULL,
  ai_summary TEXT,
  published_by UUID NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision_number INTEGER NOT NULL DEFAULT 1,
  UNIQUE(evaluation_id, revision_number)
);

-- 3) جدول مراجعات التقييم (Revisions)
CREATE TABLE public.evaluation_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  original_score NUMERIC,
  revised_score NUMERIC,
  original_ai_summary TEXT,
  revised_ai_summary TEXT,
  changes_summary TEXT,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  UNIQUE(evaluation_id, revision_number)
);

-- 4) جدول الاعتراضات
CREATE TABLE public.evaluation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_result_id UUID NOT NULL REFERENCES public.published_results(id) ON DELETE CASCADE,
  evaluatee_id UUID NOT NULL,
  appeal_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  response_text TEXT,
  responded_by UUID,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL
);

-- 5) إعدادات نافذة الاعتراض
INSERT INTO public.settings (key, value)
VALUES ('appeal_window_days', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 6) تفعيل RLS
ALTER TABLE public.published_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_appeals ENABLE ROW LEVEL SECURITY;

-- 7) سياسات published_results
-- الموظف يرى نتيجته المنشورة فقط
CREATE POLICY "Published Results: Evaluatee can view own"
ON public.published_results FOR SELECT
USING (evaluatee_id = auth.uid());

-- مدير النظام يرى ويدير الكل
CREATE POLICY "Published Results: System admin full access"
ON public.published_results FOR ALL
USING (is_system_admin(auth.uid()));

-- 8) سياسات evaluation_revisions - مدير النظام فقط
CREATE POLICY "Revisions: System admin only"
ON public.evaluation_revisions FOR ALL
USING (is_system_admin(auth.uid()));

-- 9) سياسات evaluation_appeals
-- الموظف يستطيع إنشاء اعتراض على نتيجته
CREATE POLICY "Appeals: Evaluatee can create"
ON public.evaluation_appeals FOR INSERT
WITH CHECK (evaluatee_id = auth.uid());

-- الموظف يرى اعتراضاته فقط
CREATE POLICY "Appeals: Evaluatee can view own"
ON public.evaluation_appeals FOR SELECT
USING (evaluatee_id = auth.uid());

-- مدير النظام يدير كل الاعتراضات
CREATE POLICY "Appeals: System admin full access"
ON public.evaluation_appeals FOR ALL
USING (is_system_admin(auth.uid()));

-- 10) تحديث سياسات evaluations - تشديد السرية
-- حذف السياسة القديمة التي تسمح للمقيَّم برؤية التفاصيل
DROP POLICY IF EXISTS "Evaluations: View own or admin" ON public.evaluations;

-- سياسة جديدة: المقيِّم يرى تقييماته التي أنشأها فقط
CREATE POLICY "Evaluations: Evaluator can view own created"
ON public.evaluations FOR SELECT
USING (evaluator_id = auth.uid());

-- المدير/المشرف يرى تقييمات فريقه (بدون التفاصيل - سيتم التحكم في الواجهة)
CREATE POLICY "Evaluations: Supervisor view team"
ON public.evaluations FOR SELECT
USING (
  is_supervisor_or_higher(auth.uid()) 
  AND evaluatee_id IN (SELECT get_team_member_ids(auth.uid()))
);

-- مدير النظام يرى الكل
CREATE POLICY "Evaluations: System admin full access"
ON public.evaluations FOR SELECT
USING (is_admin_or_higher(auth.uid()));

-- 11) تحديث سياسات evaluation_answers - مدير النظام فقط يرى التفاصيل
DROP POLICY IF EXISTS "Evaluation Answers: View own evaluation" ON public.evaluation_answers;

CREATE POLICY "Evaluation Answers: Evaluator can view own"
ON public.evaluation_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.id = evaluation_answers.evaluation_id
    AND e.evaluator_id = auth.uid()
  )
);

CREATE POLICY "Evaluation Answers: System admin can view all"
ON public.evaluation_answers FOR SELECT
USING (is_system_admin(auth.uid()));

-- 12) إضافة أعمدة للتقييم
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_by UUID,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_revision INTEGER DEFAULT 1;

-- 13) جدول سجل عمليات التقييم
CREATE TABLE IF NOT EXISTS public.evaluation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  details JSONB DEFAULT '{}',
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eval Audit: System admin only"
ON public.evaluation_audit_log FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Eval Audit: System insert"
ON public.evaluation_audit_log FOR INSERT
WITH CHECK (true);