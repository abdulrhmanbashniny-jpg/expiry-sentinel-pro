-- Fix: allow system_admin (and admin) to view all profiles
-- Previously policy used is_admin(auth.uid()) which excluded system_admin.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admin plus can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_or_higher(auth.uid()));
