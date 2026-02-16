
-- =============================================
-- المرحلة 1: أساس نظام الذكاء الاصطناعي المستقل
-- =============================================

-- 1. جدول صلاحيات أدوات الذكاء الاصطناعي
CREATE TABLE public.ai_tool_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  tool_key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_name_en TEXT,
  description TEXT,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_execute BOOLEAN NOT NULL DEFAULT false,
  can_write BOOLEAN NOT NULL DEFAULT false,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  max_daily_calls INTEGER DEFAULT 50,
  granted_by UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES public.tenants(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, tool_key, tenant_id)
);

-- 2. جدول سجل تدقيق عمليات الذكاء الاصطناعي
CREATE TABLE public.ai_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  agent_key TEXT NOT NULL,
  tool_used TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'read', 'execute', 'write'
  input_params JSONB DEFAULT '{}',
  output_result JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'executed', 'rejected', 'failed'
  approval_required BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  tokens_used INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  error_message TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. جدول ملاحظات وتصحيحات المستخدم (حلقة التعلم)
CREATE TABLE public.ai_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  audit_trail_id UUID REFERENCES public.ai_audit_trail(id) ON DELETE CASCADE,
  original_output TEXT,
  user_correction TEXT NOT NULL,
  correction_type TEXT NOT NULL DEFAULT 'style', -- 'factual', 'style', 'policy', 'format'
  is_applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. جدول تعريفات الأدوات المتاحة
CREATE TABLE public.ai_tool_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_key TEXT NOT NULL UNIQUE,
  tool_name TEXT NOT NULL,
  tool_name_en TEXT,
  description TEXT,
  description_en TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- 'query', 'action', 'report', 'notification'
  function_name TEXT, -- اسم الـ Edge Function
  input_schema JSONB DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- فهارس الأداء
-- =============================================
CREATE INDEX idx_ai_tool_permissions_role ON public.ai_tool_permissions(role);
CREATE INDEX idx_ai_tool_permissions_tenant ON public.ai_tool_permissions(tenant_id);
CREATE INDEX idx_ai_tool_permissions_tool ON public.ai_tool_permissions(tool_key);

CREATE INDEX idx_ai_audit_trail_user ON public.ai_audit_trail(user_id);
CREATE INDEX idx_ai_audit_trail_tenant ON public.ai_audit_trail(tenant_id);
CREATE INDEX idx_ai_audit_trail_status ON public.ai_audit_trail(status);
CREATE INDEX idx_ai_audit_trail_created ON public.ai_audit_trail(created_at DESC);

CREATE INDEX idx_ai_feedback_log_user ON public.ai_feedback_log(user_id);
CREATE INDEX idx_ai_feedback_log_audit ON public.ai_feedback_log(audit_trail_id);

-- =============================================
-- RLS Policies
-- =============================================

-- ai_tool_permissions: فقط system_admin يدير الصلاحيات
ALTER TABLE public.ai_tool_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai_tool_permissions"
  ON public.ai_tool_permissions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "System admins manage ai_tool_permissions"
  ON public.ai_tool_permissions FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- ai_audit_trail: المستخدم يرى عملياته، الأدمن يرى الكل
ALTER TABLE public.ai_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_audit_trail"
  ON public.ai_audit_trail FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_admin_or_higher(auth.uid())
  );

CREATE POLICY "System inserts ai_audit_trail"
  ON public.ai_audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update ai_audit_trail"
  ON public.ai_audit_trail FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_higher(auth.uid()));

-- ai_feedback_log: المستخدم يدير ملاحظاته
ALTER TABLE public.ai_feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai_feedback"
  ON public.ai_feedback_log FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all ai_feedback"
  ON public.ai_feedback_log FOR SELECT
  TO authenticated
  USING (public.is_admin_or_higher(auth.uid()));

-- ai_tool_definitions: الكل يقرأ، الأدمن يعدل
ALTER TABLE public.ai_tool_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view ai_tool_definitions"
  ON public.ai_tool_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System admins manage ai_tool_definitions"
  ON public.ai_tool_definitions FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- =============================================
-- دالة التحقق من صلاحية أداة AI
-- =============================================
CREATE OR REPLACE FUNCTION public.has_ai_permission(
  _user_id UUID, 
  _tool_key TEXT, 
  _action_type TEXT -- 'read', 'execute', 'write'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_tool_permissions atp
    JOIN public.user_roles ur ON ur.role = atp.role
    WHERE ur.user_id = _user_id
      AND atp.tool_key = _tool_key
      AND atp.is_active = true
      AND (
        (_action_type = 'read' AND atp.can_read = true) OR
        (_action_type = 'execute' AND atp.can_execute = true) OR
        (_action_type = 'write' AND atp.can_write = true)
      )
      AND (atp.tenant_id IS NULL OR atp.tenant_id = get_current_tenant_id())
  )
$$;

-- =============================================
-- دالة التحقق من الحد اليومي
-- =============================================
CREATE OR REPLACE FUNCTION public.check_ai_daily_limit(
  _user_id UUID,
  _tool_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT atp.max_daily_calls > (
      SELECT COUNT(*) FROM public.ai_audit_trail
      WHERE user_id = _user_id 
        AND tool_used = _tool_key
        AND created_at >= CURRENT_DATE
    )
    FROM public.ai_tool_permissions atp
    JOIN public.user_roles ur ON ur.role = atp.role
    WHERE ur.user_id = _user_id AND atp.tool_key = _tool_key
    LIMIT 1),
    false
  )
$$;

-- =============================================
-- Trigger لتحديث updated_at
-- =============================================
CREATE TRIGGER update_ai_tool_permissions_updated_at
  BEFORE UPDATE ON public.ai_tool_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_tool_definitions_updated_at
  BEFORE UPDATE ON public.ai_tool_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Triggers لعزل tenant_id
-- =============================================
CREATE TRIGGER set_tenant_ai_tool_permissions
  BEFORE INSERT ON public.ai_tool_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_on_insert();

CREATE TRIGGER set_tenant_ai_audit_trail
  BEFORE INSERT ON public.ai_audit_trail
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_on_insert();

CREATE TRIGGER set_tenant_ai_feedback_log
  BEFORE INSERT ON public.ai_feedback_log
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_on_insert();
