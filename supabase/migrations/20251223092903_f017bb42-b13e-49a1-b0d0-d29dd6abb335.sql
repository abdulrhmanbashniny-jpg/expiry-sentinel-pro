-- Drop the current permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read recipients" ON public.recipients;

-- Create new policy: Only admins can read recipients
CREATE POLICY "Only admins can read recipients" 
ON public.recipients 
FOR SELECT 
USING (is_admin(auth.uid()));