-- Create dynamic field definitions table
CREATE TABLE public.dynamic_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, date, select
  field_options JSONB, -- for select type: ["option1", "option2"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_id, category_id, field_key)
);

-- Enable RLS
ALTER TABLE public.dynamic_field_definitions ENABLE ROW LEVEL SECURITY;

-- Admin/System Admin can manage
CREATE POLICY "Admins can manage dynamic fields"
ON public.dynamic_field_definitions
FOR ALL
USING (public.is_admin_or_higher(auth.uid()));

-- All authenticated users can view
CREATE POLICY "Authenticated users can view dynamic fields"
ON public.dynamic_field_definitions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX idx_dynamic_fields_dept_cat ON public.dynamic_field_definitions(department_id, category_id);