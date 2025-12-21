-- Add reference number to items table (auto-generated sequential)
ALTER TABLE public.items 
ADD COLUMN ref_number TEXT UNIQUE;

-- Create sequence for reference numbers
CREATE SEQUENCE IF NOT EXISTS items_ref_seq START 1;

-- Create function to generate reference number
CREATE OR REPLACE FUNCTION public.generate_item_ref_number()
RETURNS TRIGGER AS $$
DECLARE
  category_code TEXT;
  next_num INTEGER;
BEGIN
  -- Get category code if exists
  SELECT code INTO category_code 
  FROM public.categories 
  WHERE id = NEW.category_id;
  
  -- Get next sequence number
  next_num := nextval('items_ref_seq');
  
  -- Generate ref_number: CATEGORY_CODE-YEAR-SEQUENCE (e.g., LIC-2025-0001)
  IF category_code IS NOT NULL THEN
    NEW.ref_number := category_code || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');
  ELSE
    NEW.ref_number := 'REF-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-generating ref_number
CREATE TRIGGER set_item_ref_number
BEFORE INSERT ON public.items
FOR EACH ROW
WHEN (NEW.ref_number IS NULL)
EXECUTE FUNCTION public.generate_item_ref_number();

-- Add code column to categories table
ALTER TABLE public.categories 
ADD COLUMN code TEXT UNIQUE;

-- Update existing categories with default codes
UPDATE public.categories SET code = UPPER(SUBSTRING(name, 1, 3)) WHERE code IS NULL;