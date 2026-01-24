-- =============================================
-- Multi-Tenant Foundation - Phase 1
-- =============================================

-- 1. Create tenants table (الشركات/المؤسسات)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  code TEXT UNIQUE NOT NULL, -- رمز فريد للشركة (مثل: ACME, JED10)
  logo_url TEXT,
  domain TEXT UNIQUE, -- نطاق فرعي اختياري
  settings JSONB DEFAULT '{}'::jsonb, -- إعدادات خاصة بالشركة
  subscription_plan TEXT DEFAULT 'basic', -- خطة الاشتراك
  max_users INTEGER DEFAULT 50, -- الحد الأقصى للمستخدمين
  max_items INTEGER DEFAULT 1000, -- الحد الأقصى للعناصر
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create tenant_integrations table (تكاملات كل شركة)
CREATE TABLE public.tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_key TEXT NOT NULL, -- telegram, whatsapp, n8n, ai
  config JSONB DEFAULT '{}'::jsonb, -- bot_token, api_key, etc.
  is_active BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  test_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, integration_key)
);

-- 3. Create tenant_usage_stats table (إحصائيات الاستخدام)
CREATE TABLE public.tenant_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  users_count INTEGER DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  ai_calls INTEGER DEFAULT 0,
  storage_used_mb NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_start, period_end)
);

-- 4. Add tenant_id to profiles table (ربط المستخدمين بالشركات)
ALTER TABLE public.profiles 
ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- 5. Create index for faster queries
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX idx_tenant_integrations_tenant_id ON public.tenant_integrations(tenant_id);
CREATE INDEX idx_tenants_code ON public.tenants(code);
CREATE INDEX idx_tenants_is_active ON public.tenants(is_active);

-- 6. Enable RLS on new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage_stats ENABLE ROW LEVEL SECURITY;

-- 7. Create helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 8. Create helper function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.is_user_in_tenant(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  )
$$;

-- 9. Create helper function to check if user is tenant admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.user_id = auth.uid() 
      AND p.tenant_id = _tenant_id
      AND ur.role IN ('system_admin', 'admin')
  )
$$;

-- 10. RLS Policies for tenants table
-- System admin can see all tenants
CREATE POLICY "Tenants: System admin full access"
ON public.tenants
FOR ALL
USING (is_system_admin(auth.uid()));

-- Users can view their own tenant
CREATE POLICY "Tenants: Users can view own tenant"
ON public.tenants
FOR SELECT
USING (is_user_in_tenant(id));

-- 11. RLS Policies for tenant_integrations table
-- Only tenant admin can manage integrations
CREATE POLICY "Tenant Integrations: Tenant admin full access"
ON public.tenant_integrations
FOR ALL
USING (is_tenant_admin(tenant_id) OR is_system_admin(auth.uid()));

-- Users can view their tenant's integrations
CREATE POLICY "Tenant Integrations: Users can view own"
ON public.tenant_integrations
FOR SELECT
USING (is_user_in_tenant(tenant_id));

-- 12. RLS Policies for tenant_usage_stats
-- Only system admin and tenant admin can view stats
CREATE POLICY "Tenant Stats: Admin access"
ON public.tenant_usage_stats
FOR ALL
USING (is_tenant_admin(tenant_id) OR is_system_admin(auth.uid()));

-- 13. Create trigger to update updated_at
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_integrations_updated_at
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();