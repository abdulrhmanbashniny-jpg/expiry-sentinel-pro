-- Drop trigger first, then function with CASCADE
DROP TRIGGER IF EXISTS prevent_profile_tenant_change ON profiles;
DROP FUNCTION IF EXISTS prevent_profile_tenant_change() CASCADE;

-- Create updated function that allows setting tenant_id to NULL for platform admins
CREATE OR REPLACE FUNCTION prevent_profile_tenant_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if tenant_id was NULL before (initial assignment)
  IF OLD.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Allow if setting to NULL (for platform admin transition)
  IF NEW.tenant_id IS NULL AND is_system_admin(NEW.user_id) THEN
    RETURN NEW;
  END IF;
  
  -- Prevent changing from one tenant to another
  IF OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Cannot change tenant assignment';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER prevent_profile_tenant_change
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_profile_tenant_change();

-- Allow NULL tenant_id for super admins
ALTER TABLE profiles 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Now update the super admin account
UPDATE profiles 
SET tenant_id = NULL
WHERE email = 'abdulrhman.bashniny@gmail.com';

-- Create function to check if user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = user_uuid 
    AND ur.role = 'system_admin'
    AND p.tenant_id IS NULL
  );
$$;

-- Update validate_user_tenant function to handle super admin
CREATE OR REPLACE FUNCTION validate_user_tenant(p_email TEXT, p_company_code TEXT)
RETURNS TABLE(
  user_id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_code TEXT,
  is_platform_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_tenant_code TEXT;
  v_is_platform_admin BOOLEAN := FALSE;
BEGIN
  -- Special case: ADMIN code for platform admins
  IF UPPER(p_company_code) = 'ADMIN' THEN
    -- Find user by email with NULL tenant
    SELECT p.user_id INTO v_user_id
    FROM profiles p
    WHERE LOWER(p.email) = LOWER(p_email)
    AND p.tenant_id IS NULL;
    
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: Not a platform administrator';
    END IF;
    
    -- Check if user is system_admin
    IF NOT is_system_admin(v_user_id) THEN
      RAISE EXCEPTION 'Unauthorized: Not a platform administrator';
    END IF;
    
    v_is_platform_admin := TRUE;
    
    RETURN QUERY SELECT v_user_id, NULL::UUID, 'Platform Admin'::TEXT, 'ADMIN'::TEXT, v_is_platform_admin;
    RETURN;
  END IF;
  
  -- Regular tenant login
  SELECT t.id, t.name, t.code INTO v_tenant_id, v_tenant_name, v_tenant_code
  FROM tenants t
  WHERE UPPER(t.code) = UPPER(p_company_code)
  AND t.is_active = true;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Company not found or inactive';
  END IF;
  
  -- Find user in tenant
  SELECT p.user_id INTO v_user_id
  FROM profiles p
  WHERE LOWER(p.email) = LOWER(p_email)
  AND p.tenant_id = v_tenant_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found in this company';
  END IF;
  
  RETURN QUERY SELECT v_user_id, v_tenant_id, v_tenant_name, v_tenant_code, v_is_platform_admin;
END;
$$;

-- Add invitation status tracking
ALTER TABLE user_invitations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS resent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ;