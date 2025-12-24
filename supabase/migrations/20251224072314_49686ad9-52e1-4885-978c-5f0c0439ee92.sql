-- Migration Part 2: Create tables, functions, and policies

-- 1. Create team_members table for supervisor-employee relationships
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, employee_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 2. Create helper functions for the new role hierarchy
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'system_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_higher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('system_admin', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor_or_higher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('system_admin', 'admin', 'supervisor')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to check if user is supervisor of another user
CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisor_id UUID, _employee_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE supervisor_id = _supervisor_id
      AND employee_id = _employee_id
  )
$$;

-- Function to get all employee IDs for a supervisor
CREATE OR REPLACE FUNCTION public.get_team_member_ids(_supervisor_id UUID)
RETURNS SETOF UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_id FROM public.team_members WHERE supervisor_id = _supervisor_id
$$;

-- 3. RLS policies for team_members table
CREATE POLICY "System admins can manage team members"
ON public.team_members
FOR ALL
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Admins can view team members"
ON public.team_members
FOR SELECT
USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Supervisors can view their team"
ON public.team_members
FOR SELECT
USING (supervisor_id = auth.uid());

-- 4. Update items table RLS policies for hierarchical access
DROP POLICY IF EXISTS "Users can view their own items or admins view all" ON public.items;
DROP POLICY IF EXISTS "Users can update their own items" ON public.items;
DROP POLICY IF EXISTS "Users can delete their own items" ON public.items;
DROP POLICY IF EXISTS "Users can manage their own items" ON public.items;

-- New hierarchical policies for items
CREATE POLICY "Items: System admin and admin see all"
ON public.items
FOR SELECT
USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Items: Supervisors see their team items"
ON public.items
FOR SELECT
USING (
  public.has_role(auth.uid(), 'supervisor') AND
  created_by_user_id IN (SELECT public.get_team_member_ids(auth.uid()))
);

CREATE POLICY "Items: Employees see only their own items"
ON public.items
FOR SELECT
USING (
  public.has_role(auth.uid(), 'employee') AND
  created_by_user_id = auth.uid()
);

CREATE POLICY "Items: Admin plus can insert"
ON public.items
FOR INSERT
WITH CHECK (public.is_admin_or_higher(auth.uid()) OR created_by_user_id = auth.uid());

CREATE POLICY "Items: Admin plus can update all supervisors update team items"
ON public.items
FOR UPDATE
USING (
  public.is_admin_or_higher(auth.uid()) OR
  (public.has_role(auth.uid(), 'supervisor') AND created_by_user_id IN (SELECT public.get_team_member_ids(auth.uid())))
);

CREATE POLICY "Items: Only admin plus can delete"
ON public.items
FOR DELETE
USING (public.is_admin_or_higher(auth.uid()));

-- 5. Update recipients RLS for hierarchical access
DROP POLICY IF EXISTS "Admins can manage recipients" ON public.recipients;
DROP POLICY IF EXISTS "Only admins can read recipients" ON public.recipients;

CREATE POLICY "Recipients: Admin plus full access"
ON public.recipients
FOR ALL
USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Recipients: Supervisors read access"
ON public.recipients
FOR SELECT
USING (public.is_supervisor_or_higher(auth.uid()));

-- 6. Update notification_log RLS
DROP POLICY IF EXISTS "Admins can manage notification logs" ON public.notification_log;
DROP POLICY IF EXISTS "Authenticated users can read notification logs" ON public.notification_log;

CREATE POLICY "Notification logs: Admin plus full access"
ON public.notification_log
FOR ALL
USING (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "Notification logs: Supervisors see team notifications"
ON public.notification_log
FOR SELECT
USING (
  public.has_role(auth.uid(), 'supervisor') AND
  item_id IN (
    SELECT id FROM public.items 
    WHERE created_by_user_id IN (SELECT public.get_team_member_ids(auth.uid()))
  )
);

CREATE POLICY "Notification logs: Employees see own notifications"
ON public.notification_log
FOR SELECT
USING (
  public.has_role(auth.uid(), 'employee') AND
  item_id IN (
    SELECT id FROM public.items WHERE created_by_user_id = auth.uid()
  )
);

-- 7. Update conversation_logs RLS (admin+ only)
DROP POLICY IF EXISTS "Admins can manage conversation logs" ON public.conversation_logs;

CREATE POLICY "Conversation logs: Admin plus access"
ON public.conversation_logs
FOR ALL
USING (public.is_admin_or_higher(auth.uid()));

-- 8. Update user_roles RLS
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "User roles: System admin can manage"
ON public.user_roles
FOR ALL
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "User roles: All authenticated can view own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "User roles: Admin can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin_or_higher(auth.uid()));

-- 9. Update settings RLS for system_admin only
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.settings;

CREATE POLICY "Settings: System admin full access"
ON public.settings
FOR ALL
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Settings: Admin read non-sensitive settings"
ON public.settings
FOR SELECT
USING (
  public.is_admin_or_higher(auth.uid()) AND
  key NOT LIKE 'integration_%' AND
  key NOT LIKE 'security_%'
);