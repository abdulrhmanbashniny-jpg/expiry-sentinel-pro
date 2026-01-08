-- Fix categories RLS: Add INSERT/UPDATE/DELETE policies for admin
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

CREATE POLICY "Admins can manage categories" 
ON public.categories 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Add job_title and direct_manager to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_title text,
ADD COLUMN IF NOT EXISTS direct_manager text,
ADD COLUMN IF NOT EXISTS hire_date date;