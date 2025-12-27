-- Add department_id to categories table to link categories to departments
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_categories_department_id ON public.categories(department_id);

-- Update RLS to consider department visibility
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
CREATE POLICY "Authenticated users can read categories" 
ON public.categories 
FOR SELECT 
USING (
  department_id IS NULL 
  OR can_view_department(auth.uid(), department_id)
  OR is_admin_or_higher(auth.uid())
);