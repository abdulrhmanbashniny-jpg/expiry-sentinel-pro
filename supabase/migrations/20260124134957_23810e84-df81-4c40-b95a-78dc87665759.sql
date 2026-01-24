-- Phase 2: Multi-Tenant - Add tenant_id to core tables and update RLS

-- 1. Add tenant_id column to core tables (with NULL allowed initially for migration)
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.reminder_rules ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.automation_runs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.kpi_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.evaluation_cycles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.compliance_scores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.compliance_reports ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.dynamic_field_definitions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.conversation_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.ai_agent_configs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 2. Add completion_description and completion_attachment_url for item completion proof
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS completion_description TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS completion_attachment_url TEXT;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS completion_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS completed_by_user_id UUID;

-- 3. Create user_invitations table for tenant-based invites
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- 4. Create indexes for tenant_id
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON public.departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON public.categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_items_tenant ON public.items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipients_tenant ON public.recipients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reminder_rules_tenant ON public.reminder_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant ON public.message_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON public.notification_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_tenant ON public.user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token);

-- 5. Update RLS policies for tenant isolation

-- Departments: Tenant isolation
DROP POLICY IF EXISTS "Departments: Tenant isolation" ON public.departments;
CREATE POLICY "Departments: Tenant isolation" ON public.departments
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id()
  );

-- Categories: Tenant isolation
DROP POLICY IF EXISTS "Categories: Tenant isolation" ON public.categories;
CREATE POLICY "Categories: Tenant isolation" ON public.categories
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id() OR
    tenant_id IS NULL
  );

-- Items: Tenant isolation
DROP POLICY IF EXISTS "Items: Tenant isolation" ON public.items;
CREATE POLICY "Items: Tenant isolation" ON public.items
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id()
  );

-- Recipients: Tenant isolation
DROP POLICY IF EXISTS "Recipients: Tenant isolation" ON public.recipients;
CREATE POLICY "Recipients: Tenant isolation" ON public.recipients
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id()
  );

-- Reminder Rules: Tenant isolation
DROP POLICY IF EXISTS "Reminder Rules: Tenant isolation" ON public.reminder_rules;
CREATE POLICY "Reminder Rules: Tenant isolation" ON public.reminder_rules
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id() OR
    tenant_id IS NULL
  );

-- Message Templates: Tenant isolation
DROP POLICY IF EXISTS "Message Templates: Tenant isolation" ON public.message_templates;
CREATE POLICY "Message Templates: Tenant isolation" ON public.message_templates
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id() OR
    tenant_id IS NULL
  );

-- Notification Log: Tenant isolation
DROP POLICY IF EXISTS "Notification Log: Tenant isolation" ON public.notification_log;
CREATE POLICY "Notification Log: Tenant isolation" ON public.notification_log
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    tenant_id = get_current_tenant_id()
  );

-- User Invitations: Policies
DROP POLICY IF EXISTS "Invitations: Tenant admin can manage" ON public.user_invitations;
CREATE POLICY "Invitations: Tenant admin can manage" ON public.user_invitations
  FOR ALL USING (
    is_system_admin(auth.uid()) OR
    (is_tenant_admin(tenant_id) AND tenant_id = get_current_tenant_id())
  );

DROP POLICY IF EXISTS "Invitations: Users can view pending by email" ON public.user_invitations;
CREATE POLICY "Invitations: Users can view pending by email" ON public.user_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND accepted_at IS NULL
    AND expires_at > now()
  );

-- 6. Update get_current_tenant_id to handle session context
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get tenant_id from user's profile
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  RETURN v_tenant_id;
END;
$$;

-- 7. Function to set tenant on insert (for automatic tenant assignment)
CREATE OR REPLACE FUNCTION public.set_tenant_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for automatic tenant assignment
DROP TRIGGER IF EXISTS set_tenant_items ON public.items;
CREATE TRIGGER set_tenant_items
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_on_insert();

DROP TRIGGER IF EXISTS set_tenant_departments ON public.departments;
CREATE TRIGGER set_tenant_departments
  BEFORE INSERT ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_on_insert();

DROP TRIGGER IF EXISTS set_tenant_categories ON public.categories;
CREATE TRIGGER set_tenant_categories
  BEFORE INSERT ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_on_insert();

DROP TRIGGER IF EXISTS set_tenant_recipients ON public.recipients;
CREATE TRIGGER set_tenant_recipients
  BEFORE INSERT ON public.recipients
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_on_insert();

DROP TRIGGER IF EXISTS set_tenant_reminder_rules ON public.reminder_rules;
CREATE TRIGGER set_tenant_reminder_rules
  BEFORE INSERT ON public.reminder_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_on_insert();

DROP TRIGGER IF EXISTS set_tenant_notification_log ON public.notification_log;
CREATE TRIGGER set_tenant_notification_log
  BEFORE INSERT ON public.notification_log
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_on_insert();