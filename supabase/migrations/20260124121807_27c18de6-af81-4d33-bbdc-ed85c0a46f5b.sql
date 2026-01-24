-- Add RLS policy to allow recipients to view items they are linked to
-- First, create a function to check if user is a recipient of an item

CREATE OR REPLACE FUNCTION public.is_item_recipient(item_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user's profile phone matches any recipient for this item
  RETURN EXISTS (
    SELECT 1
    FROM item_recipients ir
    JOIN recipients r ON r.id = ir.recipient_id
    JOIN profiles p ON p.user_id = user_uuid
    WHERE ir.item_id = item_uuid
    AND r.is_active = true
    AND p.phone IS NOT NULL
    AND (
      r.whatsapp_number LIKE '%' || p.phone || '%'
      OR p.phone LIKE '%' || r.whatsapp_number || '%'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add policy for recipients to view items
DROP POLICY IF EXISTS "Items: Recipients can view linked items" ON public.items;

CREATE POLICY "Items: Recipients can view linked items"
ON public.items
FOR SELECT
USING (
  public.is_item_recipient(id, auth.uid())
);

-- Ensure recipients table still allows read access but not modification by recipients
-- Keep existing policies but add clarity

COMMENT ON FUNCTION public.is_item_recipient IS 'Checks if a user is a recipient of a specific item by matching phone numbers';