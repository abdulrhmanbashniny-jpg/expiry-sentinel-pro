-- ============================================
-- PHASE 1: CREATE NEW TABLES AND INDEXES ONLY
-- ============================================

-- جدول لتخزين إعدادات الإشعارات لكل شركة
CREATE TABLE IF NOT EXISTS public.tenant_notification_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT false,
    email_provider TEXT DEFAULT 'resend',
    email_from_address TEXT,
    email_from_name TEXT,
    whatsapp_enabled BOOLEAN DEFAULT true,
    telegram_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id)
);

-- تفعيل RLS
ALTER TABLE tenant_notification_settings ENABLE ROW LEVEL SECURITY;

-- سياسات RLS للإعدادات
DROP POLICY IF EXISTS "TNS: Tenant admin can manage" ON tenant_notification_settings;
CREATE POLICY "TNS: Tenant admin can manage"
ON tenant_notification_settings FOR ALL
USING (is_tenant_admin(tenant_id) OR is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "TNS: Users can view own tenant" ON tenant_notification_settings;
CREATE POLICY "TNS: Users can view own tenant"
ON tenant_notification_settings FOR SELECT
USING (is_user_in_tenant(tenant_id));

-- إدراج إعدادات افتراضية للشركات الموجودة
INSERT INTO tenant_notification_settings (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_notification_settings)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- PHASE 2: IN-APP NOTIFICATIONS ENHANCEMENTS
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'in_app_notifications' AND column_name = 'notification_type') THEN
        ALTER TABLE in_app_notifications ADD COLUMN notification_type TEXT DEFAULT 'reminder';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'in_app_notifications' AND column_name = 'source_channel') THEN
        ALTER TABLE in_app_notifications ADD COLUMN source_channel TEXT DEFAULT 'system';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_unread 
ON in_app_notifications(user_id, is_read) 
WHERE is_read = false;

-- إضافة indexes للأداء
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_items_tenant_status ON items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON notification_log(tenant_id);

-- ============================================
-- PHASE 3: FORCE RLS ON ALL CRITICAL TABLES
-- ============================================

ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE items FORCE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE recipients FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_log FORCE ROW LEVEL SECURITY;