-- =============================================
-- 1. توسيع نموذج reminder_rules لدعم Multi-Entity
-- =============================================
ALTER TABLE public.reminder_rules 
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS target_entity_type TEXT NOT NULL DEFAULT 'item',
  ADD COLUMN IF NOT EXISTS target_field TEXT NOT NULL DEFAULT 'expiry_date',
  ADD COLUMN IF NOT EXISTS channels TEXT[] DEFAULT ARRAY['whatsapp', 'telegram'],
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Enable RLS (if not already)
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Reminder Rules: Tenant SELECT" ON public.reminder_rules;
DROP POLICY IF EXISTS "Reminder Rules: Tenant INSERT" ON public.reminder_rules;
DROP POLICY IF EXISTS "Reminder Rules: Tenant UPDATE" ON public.reminder_rules;
DROP POLICY IF EXISTS "Reminder Rules: Tenant DELETE" ON public.reminder_rules;

CREATE POLICY "Reminder Rules: Tenant SELECT"
  ON public.reminder_rules FOR SELECT
  USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Reminder Rules: Tenant INSERT"
  ON public.reminder_rules FOR INSERT
  WITH CHECK (is_admin_or_higher(auth.uid()));

CREATE POLICY "Reminder Rules: Tenant UPDATE"
  ON public.reminder_rules FOR UPDATE
  USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Reminder Rules: Tenant DELETE"
  ON public.reminder_rules FOR DELETE
  USING (is_admin_or_higher(auth.uid()));

-- =============================================
-- 2. إنشاء جدول الإشعارات الداخلية (In-App Notifications)
-- =============================================
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'normal',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "In-App Notifications: Users see own" ON public.in_app_notifications;
DROP POLICY IF EXISTS "In-App Notifications: System INSERT" ON public.in_app_notifications;
DROP POLICY IF EXISTS "In-App Notifications: Users update own" ON public.in_app_notifications;

CREATE POLICY "In-App Notifications: Users see own"
  ON public.in_app_notifications FOR SELECT
  USING (user_id = auth.uid() OR is_admin_or_higher(auth.uid()));

CREATE POLICY "In-App Notifications: System INSERT"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "In-App Notifications: Users update own"
  ON public.in_app_notifications FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================
-- 3. إضافة حقول notification_log للدعم الموحد
-- =============================================
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'item',
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES public.reminder_rules(id),
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id),
  ADD COLUMN IF NOT EXISTS message_preview TEXT;

-- =============================================
-- 4. جدول Feature Toggles لإدارة الميزات
-- =============================================
CREATE TABLE IF NOT EXISTS public.feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  feature_key TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_name_en TEXT,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  min_role TEXT DEFAULT 'admin',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Feature Toggles: Tenant SELECT" ON public.feature_toggles;
DROP POLICY IF EXISTS "Feature Toggles: Admin manage" ON public.feature_toggles;

CREATE POLICY "Feature Toggles: Tenant SELECT"
  ON public.feature_toggles FOR SELECT
  USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Feature Toggles: Admin manage"
  ON public.feature_toggles FOR ALL
  USING (is_admin_or_higher(auth.uid()));

-- =============================================
-- 5. دالة مساعدة للتحقق من تفعيل الميزات
-- =============================================
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.feature_toggles 
     WHERE feature_key = _feature_key 
     AND (tenant_id = get_current_tenant_id() OR tenant_id IS NULL)
     ORDER BY tenant_id NULLS LAST
     LIMIT 1),
    false
  )
$$;

-- =============================================
-- 6. إنشاء بيانات Feature Toggles الأولية
-- =============================================
INSERT INTO public.feature_toggles (tenant_id, feature_key, feature_name, feature_name_en, description, is_enabled, min_role)
VALUES
  (NULL, 'contracts', 'إدارة العقود', 'Contract Management', 'نظام إدارة العقود والتجديدات', false, 'admin'),
  (NULL, 'support_tickets', 'تذاكر الدعم', 'Support Tickets', 'نظام تذاكر الدعم الفني', false, 'employee'),
  (NULL, 'employee_portal', 'بوابة الموظف', 'Employee Portal', 'بوابة الخدمات الذاتية للموظفين', false, 'employee'),
  (NULL, 'document_signatures', 'التوقيع الإلكتروني', 'Digital Signatures', 'نظام التوقيع الإلكتروني على المستندات', false, 'admin'),
  (NULL, 'ai_risk', 'تحليل المخاطر بالذكاء الاصطناعي', 'AI Risk Analysis', 'تحليل المخاطر التنبؤي', false, 'admin'),
  (NULL, 'reminder_dashboard', 'لوحة التذكيرات', 'Reminder Dashboard', 'لوحة التحكم المركزية للتذكيرات', true, 'supervisor'),
  (NULL, 'email_notifications', 'إشعارات البريد الإلكتروني', 'Email Notifications', 'إرسال الإشعارات عبر البريد الإلكتروني', false, 'admin')
ON CONFLICT (tenant_id, feature_key) DO NOTHING;

-- =============================================
-- 7. فهارس للأداء
-- =============================================
CREATE INDEX IF NOT EXISTS idx_reminder_rules_tenant ON public.reminder_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_entity_type ON public.reminder_rules(target_entity_type);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON public.in_app_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread ON public.in_app_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notification_log_entity ON public.notification_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_tenant ON public.feature_toggles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_key ON public.feature_toggles(feature_key);