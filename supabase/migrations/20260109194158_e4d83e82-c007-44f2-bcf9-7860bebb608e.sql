-- Ensure Row Level Security is enabled
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies (names may differ across iterations)
DROP POLICY IF EXISTS "Categories are readable by authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Admin can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admin can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admin can delete categories" ON public.categories;
DROP POLICY IF EXISTS "categories_select" ON public.categories;
DROP POLICY IF EXISTS "categories_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_update" ON public.categories;
DROP POLICY IF EXISTS "categories_delete" ON public.categories;

-- Read: keep categories visible to signed-in users (needed for items joins)
CREATE POLICY "categories_select_authenticated"
ON public.categories
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Write: admin or higher only (system_admin/admin)
CREATE POLICY "categories_insert_admin_or_higher"
ON public.categories
FOR INSERT
WITH CHECK (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "categories_update_admin_or_higher"
ON public.categories
FOR UPDATE
USING (public.is_admin_or_higher(auth.uid()))
WITH CHECK (public.is_admin_or_higher(auth.uid()));

CREATE POLICY "categories_delete_admin_or_higher"
ON public.categories
FOR DELETE
USING (public.is_admin_or_higher(auth.uid()));
