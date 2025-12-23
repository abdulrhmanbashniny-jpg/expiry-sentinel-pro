-- Drop the current permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all items" ON public.items;

-- Create new policy: Users can only view their own items, admins can view all
CREATE POLICY "Users can view their own items or admins view all" 
ON public.items 
FOR SELECT 
USING (
  auth.uid() = created_by_user_id 
  OR is_admin(auth.uid())
);