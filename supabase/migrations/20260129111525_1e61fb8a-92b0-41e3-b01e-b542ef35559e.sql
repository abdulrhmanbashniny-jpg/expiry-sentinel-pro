-- Fix the activation RLS to be more secure
-- The policy should allow access ONLY with a valid token, not expose all pending invitations

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public: View invitation by token for activation" ON user_invitations;
DROP POLICY IF EXISTS "Public: Update invitation during activation" ON user_invitations;

-- Note: For anonymous access with token verification, we need a different approach
-- We'll use a security definer function to safely validate and return invitation data

-- Create a function to get invitation by token (safe, no RLS bypass needed)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  employee_number TEXT,
  role TEXT,
  phone TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT,
  tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ui.id,
    ui.email,
    ui.full_name,
    ui.employee_number,
    ui.role,
    ui.phone,
    ui.expires_at,
    ui.status,
    ui.tenant_id
  FROM user_invitations ui
  WHERE ui.token = p_token
    AND ui.status = 'pending'
    AND ui.expires_at > now()
    AND ui.accepted_at IS NULL
  LIMIT 1;
END;
$$;

-- Create a function to activate invitation (safe, validates token)
CREATE OR REPLACE FUNCTION public.activate_invitation(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
BEGIN
  -- Find the invitation
  SELECT id INTO v_invitation_id
  FROM user_invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now()
    AND accepted_at IS NULL;
  
  IF v_invitation_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the invitation
  UPDATE user_invitations
  SET status = 'accepted',
      activated_at = now(),
      accepted_at = now()
  WHERE id = v_invitation_id;
  
  RETURN TRUE;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_invitation(TEXT) TO anon, authenticated;