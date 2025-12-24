-- 1) Create item_workflow_status enum with all states
CREATE TYPE public.item_workflow_status AS ENUM (
  'new',
  'acknowledged',
  'in_progress',
  'done_pending_supervisor',
  'returned',
  'escalated_to_manager',
  'finished'
);

-- 2) Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  manager_user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Create user_department_scopes table (user membership in departments)
CREATE TABLE public.user_department_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'primary' CHECK (scope_type IN ('primary', 'additional')),
  can_cross_view_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

-- 4) Create item_status_log table (timeline/audit)
CREATE TABLE public.item_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_user_id UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  channel TEXT DEFAULT 'web' CHECK (channel IN ('web', 'telegram', 'whatsapp', 'system')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 5) Add workflow_status and department_id to items table
ALTER TABLE public.items 
ADD COLUMN workflow_status public.item_workflow_status NOT NULL DEFAULT 'new',
ADD COLUMN department_id UUID REFERENCES public.departments(id);

-- 6) Add is_recurring flag to items
ALTER TABLE public.items 
ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN parent_item_id UUID REFERENCES public.items(id);

-- 7) Enable RLS on new tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_department_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_status_log ENABLE ROW LEVEL SECURITY;

-- 8) RLS Policies for departments
CREATE POLICY "Departments: All authenticated can read"
ON public.departments FOR SELECT
USING (true);

CREATE POLICY "Departments: Admin can manage"
ON public.departments FOR ALL
USING (is_admin_or_higher(auth.uid()));

-- 9) RLS Policies for user_department_scopes
CREATE POLICY "Scopes: System admin can manage"
ON public.user_department_scopes FOR ALL
USING (is_system_admin(auth.uid()));

CREATE POLICY "Scopes: Admin can view all"
ON public.user_department_scopes FOR SELECT
USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Scopes: Users can view own"
ON public.user_department_scopes FOR SELECT
USING (user_id = auth.uid());

-- 10) RLS Policies for item_status_log
CREATE POLICY "Status log: Admin can view all"
ON public.item_status_log FOR SELECT
USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Status log: Users can view own items"
ON public.item_status_log FOR SELECT
USING (
  item_id IN (
    SELECT id FROM public.items WHERE created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Status log: System can insert"
ON public.item_status_log FOR INSERT
WITH CHECK (true);

-- 11) Function to check if user is department manager
CREATE OR REPLACE FUNCTION public.is_department_manager(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.departments
    WHERE id = _department_id
      AND manager_user_id = _user_id
  )
$$;

-- 12) Function to get user's department IDs
CREATE OR REPLACE FUNCTION public.get_user_department_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id 
  FROM public.user_department_scopes 
  WHERE user_id = _user_id
$$;

-- 13) Function to check if user can view department (cross-view)
CREATE OR REPLACE FUNCTION public.can_view_department(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_department_scopes
    WHERE user_id = _user_id
      AND department_id = _department_id
  ) OR EXISTS (
    SELECT 1
    FROM public.user_department_scopes
    WHERE user_id = _user_id
      AND can_cross_view_only = true
  ) OR is_admin_or_higher(_user_id)
$$;

-- 14) Add trigger for updated_at on departments
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 15) Create index for performance
CREATE INDEX idx_items_workflow_status ON public.items(workflow_status);
CREATE INDEX idx_items_department_id ON public.items(department_id);
CREATE INDEX idx_item_status_log_item_id ON public.item_status_log(item_id);
CREATE INDEX idx_user_department_scopes_user_id ON public.user_department_scopes(user_id);