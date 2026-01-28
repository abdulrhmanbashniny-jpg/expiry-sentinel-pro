-- Fix the prevent_tenant_id_change function to allow initial assignment (NULL -> value)
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow initial assignment (NULL -> value) but prevent changes (value -> different value)
  IF OLD.tenant_id IS NOT NULL AND OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cannot change tenant_id after creation';
  END IF;
  RETURN NEW;
END;
$$;

-- Fix the prevent_profile_tenant_change function as well
CREATE OR REPLACE FUNCTION public.prevent_profile_tenant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow initial assignment (NULL -> value) but prevent changes (value -> different value)
  IF OLD.tenant_id IS NOT NULL AND OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    IF NOT is_system_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot change tenant assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Now update all existing data to link to JPF tenant
UPDATE profiles SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE items SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE departments SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE categories SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE recipients SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE reminder_rules SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE notification_log SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;
UPDATE message_templates SET tenant_id = 'c77ee728-532a-47b2-a5a5-98236cff6801' WHERE tenant_id IS NULL;

-- Add receives_notifications column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS receives_notifications BOOLEAN DEFAULT true;

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  employee_number TEXT,
  phone TEXT,
  department_id UUID REFERENCES departments(id),
  role TEXT DEFAULT 'employee',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_pending_invitation UNIQUE (tenant_id, email)
);

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage invitations"
ON public.user_invitations FOR ALL
USING (is_tenant_admin(tenant_id) OR is_system_admin(auth.uid()));

CREATE POLICY "Users can view own tenant invitations"
ON public.user_invitations FOR SELECT
USING (is_user_in_tenant(tenant_id));

-- Create tenant_settings table
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
  allow_public_registration BOOLEAN DEFAULT false,
  invitation_validity_days INTEGER DEFAULT 7,
  who_can_invite TEXT[] DEFAULT ARRAY['system_admin', 'admin'],
  require_email_verification BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage settings"
ON public.tenant_settings FOR ALL
USING (is_tenant_admin(tenant_id) OR is_system_admin(auth.uid()));

CREATE POLICY "Users can view own tenant settings"
ON public.tenant_settings FOR SELECT
USING (is_user_in_tenant(tenant_id));

-- Create default settings for JPF
INSERT INTO tenant_settings (tenant_id, allow_public_registration, invitation_validity_days)
VALUES ('c77ee728-532a-47b2-a5a5-98236cff6801', false, 7)
ON CONFLICT (tenant_id) DO NOTHING;

-- Function to get tenant by code
CREATE OR REPLACE FUNCTION public.get_tenant_by_code(p_code TEXT)
RETURNS TABLE (id UUID, name TEXT, name_en TEXT, code TEXT, is_active BOOLEAN, logo_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, name_en, code, is_active, logo_url FROM tenants WHERE UPPER(code) = UPPER(p_code) LIMIT 1;
$$;

-- Function to validate user belongs to tenant
CREATE OR REPLACE FUNCTION public.validate_user_tenant(p_email TEXT, p_tenant_id UUID)
RETURNS TABLE (user_id UUID, profile_id UUID, is_valid BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.id, CASE WHEN p.tenant_id = p_tenant_id THEN true ELSE false END
  FROM profiles p WHERE LOWER(p.email) = LOWER(p_email) LIMIT 1;
$$;