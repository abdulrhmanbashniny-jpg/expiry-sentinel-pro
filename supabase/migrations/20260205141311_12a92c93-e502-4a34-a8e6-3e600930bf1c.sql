-- ==============================================
-- نظام التصعيد التسلسلي (Escalation System)
-- ==============================================

-- 1. جدول الهرمية الوظيفية (Organizational Hierarchy)
CREATE TABLE IF NOT EXISTS public.organizational_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  supervisor_id UUID,          -- المشرف المباشر
  manager_id UUID,             -- المدير
  director_id UUID,            -- المدير العام
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, employee_id)
);

-- 2. جدول سجلات التصعيد (Escalation Log)
CREATE TABLE IF NOT EXISTS public.escalation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES public.notification_log(id),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  original_recipient_id UUID NOT NULL,  -- المستقبل الأصلي (الموظف)
  escalation_level INTEGER NOT NULL DEFAULT 0,  -- 0=employee, 1=supervisor, 2=manager, 3=director, 4=hr
  current_recipient_id UUID NOT NULL,   -- المستقبل الحالي
  previous_recipient_id UUID,           -- المستقبل السابق
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'escalated', 'resolved', 'expired')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  escalated_at TIMESTAMP WITH TIME ZONE,
  next_escalation_at TIMESTAMP WITH TIME ZONE,
  escalation_reason TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. جدول قواعد التصعيد (Escalation Rules)
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  escalation_level INTEGER NOT NULL,    -- 1=supervisor, 2=manager, 3=director, 4=hr
  delay_hours INTEGER NOT NULL DEFAULT 24,
  recipient_role TEXT NOT NULL,         -- supervisor, manager, director, hr_admin
  notification_channels TEXT[] DEFAULT ARRAY['in_app', 'whatsapp', 'telegram'],
  message_template TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, escalation_level)
);

-- 4. فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_escalation_log_tenant ON escalation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_status ON escalation_log(status);
CREATE INDEX IF NOT EXISTS idx_escalation_log_item ON escalation_log(item_id);
CREATE INDEX IF NOT EXISTS idx_escalation_log_next_escalation ON escalation_log(next_escalation_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_org_hierarchy_tenant ON organizational_hierarchy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_hierarchy_employee ON organizational_hierarchy(employee_id);

-- 5. تفعيل RLS
ALTER TABLE public.organizational_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

-- 6. سياسات RLS للهرمية الوظيفية
CREATE POLICY "Org Hierarchy: Tenant SELECT" ON public.organizational_hierarchy
  FOR SELECT USING (
    is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Org Hierarchy: Admin manage" ON public.organizational_hierarchy
  FOR ALL USING (is_admin_or_higher(auth.uid()));

-- 7. سياسات RLS لسجل التصعيد
CREATE POLICY "Escalation Log: Tenant SELECT" ON public.escalation_log
  FOR SELECT USING (
    is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Escalation Log: View own escalations" ON public.escalation_log
  FOR SELECT USING (
    current_recipient_id = auth.uid() OR 
    original_recipient_id = auth.uid()
  );

CREATE POLICY "Escalation Log: Admin manage" ON public.escalation_log
  FOR ALL USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Escalation Log: System INSERT" ON public.escalation_log
  FOR INSERT WITH CHECK (
    is_admin_or_higher(auth.uid()) OR tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Escalation Log: Recipient can acknowledge" ON public.escalation_log
  FOR UPDATE USING (
    current_recipient_id = auth.uid() AND status = 'pending'
  );

-- 8. سياسات RLS لقواعد التصعيد
CREATE POLICY "Escalation Rules: Tenant SELECT" ON public.escalation_rules
  FOR SELECT USING (
    is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id() OR tenant_id IS NULL
  );

CREATE POLICY "Escalation Rules: Admin manage" ON public.escalation_rules
  FOR ALL USING (is_admin_or_higher(auth.uid()));

-- 9. إدخال قواعد التصعيد الافتراضية (عامة لجميع الشركات)
INSERT INTO public.escalation_rules (tenant_id, escalation_level, delay_hours, recipient_role, notification_channels, message_template, is_active)
VALUES 
  (NULL, 1, 24, 'supervisor', ARRAY['in_app', 'whatsapp', 'telegram'], 'الموظف {employee_name} لم يستجب للمعاملة [{item_title}] خلال 24 ساعة. المعاملة مصعّدة إليك للمتابعة.', true),
  (NULL, 2, 24, 'manager', ARRAY['in_app', 'whatsapp', 'telegram'], 'الموظف {employee_name} والمشرف {supervisor_name} لم يستجيبا للمعاملة [{item_title}]. المعاملة مصعّدة إليك كمدير للمتابعة العاجلة.', true),
  (NULL, 3, 24, 'director', ARRAY['in_app', 'whatsapp', 'telegram'], 'تصعيد حرج: المعاملة [{item_title}] لم تُعالج من 3 مستويات. مطلوب تدخل المدير العام.', true),
  (NULL, 4, 24, 'hr_admin', ARRAY['in_app', 'whatsapp', 'telegram', 'email'], 'تصعيد نهائي لإدارة الموارد البشرية: المعاملة [{item_title}] لم تُعالج من جميع المستويات الإدارية.', true)
ON CONFLICT DO NOTHING;

-- 10. دالة للحصول على المستقبل التالي في سلسلة التصعيد
CREATE OR REPLACE FUNCTION get_next_escalation_recipient(
  p_tenant_id UUID,
  p_employee_id UUID,
  p_current_level INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_recipient UUID;
  v_hierarchy RECORD;
BEGIN
  -- البحث في الهرمية الوظيفية
  SELECT * INTO v_hierarchy
  FROM organizational_hierarchy
  WHERE tenant_id = p_tenant_id AND employee_id = p_employee_id;
  
  IF NOT FOUND THEN
    -- إذا لم توجد هرمية، نحاول البحث في team_members
    CASE p_current_level
      WHEN 0 THEN -- التصعيد للمشرف
        SELECT supervisor_id INTO v_next_recipient
        FROM team_members
        WHERE employee_id = p_employee_id
        LIMIT 1;
      WHEN 1 THEN -- التصعيد للمدير (مدير القسم)
        SELECT d.manager_user_id INTO v_next_recipient
        FROM user_department_scopes uds
        JOIN departments d ON d.id = uds.department_id
        WHERE uds.user_id = p_employee_id AND d.manager_user_id IS NOT NULL
        LIMIT 1;
      ELSE
        v_next_recipient := NULL;
    END CASE;
    RETURN v_next_recipient;
  END IF;
  
  -- استخدام الهرمية الموجودة
  CASE p_current_level
    WHEN 0 THEN v_next_recipient := v_hierarchy.supervisor_id;
    WHEN 1 THEN v_next_recipient := v_hierarchy.manager_id;
    WHEN 2 THEN v_next_recipient := v_hierarchy.director_id;
    WHEN 3 THEN 
      -- البحث عن HR admin
      SELECT p.user_id INTO v_next_recipient
      FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.tenant_id = p_tenant_id AND ur.role = 'admin'
      LIMIT 1;
    ELSE v_next_recipient := NULL;
  END CASE;
  
  RETURN v_next_recipient;
END;
$$;

-- 11. دالة لإنشاء سجل تصعيد جديد عند إرسال إشعار
CREATE OR REPLACE FUNCTION create_escalation_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- إنشاء سجل تصعيد للإشعارات الجديدة فقط
  IF NEW.status = 'pending' AND NEW.item_id IS NOT NULL THEN
    INSERT INTO escalation_log (
      tenant_id,
      notification_id,
      item_id,
      original_recipient_id,
      current_recipient_id,
      escalation_level,
      status,
      next_escalation_at
    )
    VALUES (
      NEW.tenant_id,
      NEW.id,
      NEW.item_id,
      NEW.recipient_id,
      NEW.recipient_id,
      0,  -- المستوى 0 = الموظف الأصلي
      'pending',
      now() + interval '24 hours'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 12. ربط الـ Trigger بجدول الإشعارات
DROP TRIGGER IF EXISTS trigger_create_escalation ON notification_log;
CREATE TRIGGER trigger_create_escalation
  AFTER INSERT ON notification_log
  FOR EACH ROW
  EXECUTE FUNCTION create_escalation_on_notification();

-- 13. دالة لتحديث حالة التصعيد عند استلام الإشعار
CREATE OR REPLACE FUNCTION acknowledge_escalation(
  p_escalation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE escalation_log
  SET 
    status = 'acknowledged',
    acknowledged_at = now(),
    acknowledged_by = auth.uid(),
    updated_at = now()
  WHERE id = p_escalation_id
    AND current_recipient_id = auth.uid()
    AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- 14. دالة لحل التصعيد نهائياً
CREATE OR REPLACE FUNCTION resolve_escalation(
  p_escalation_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE escalation_log
  SET 
    status = 'resolved',
    resolution_notes = p_notes,
    updated_at = now()
  WHERE id = p_escalation_id
    AND (current_recipient_id = auth.uid() OR is_admin_or_higher(auth.uid()))
    AND status IN ('pending', 'acknowledged');
  
  RETURN FOUND;
END;
$$;