-- Update score_type check constraint to include 'global' and 'person'
ALTER TABLE public.compliance_scores DROP CONSTRAINT IF EXISTS compliance_scores_score_type_check;

ALTER TABLE public.compliance_scores 
ADD CONSTRAINT compliance_scores_score_type_check 
CHECK (score_type = ANY (ARRAY['user'::text, 'department'::text, 'category'::text, 'global'::text, 'person'::text]));