
-- Add template_type and escalation_level to message_templates
ALTER TABLE public.message_templates 
  ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'reminder',
  ADD COLUMN IF NOT EXISTS escalation_level integer DEFAULT NULL;

-- Add constraint for template_type
ALTER TABLE public.message_templates 
  ADD CONSTRAINT chk_template_type CHECK (template_type IN ('reminder', 'escalation', 'invitation', 'alert', 'system'));

-- Update channel to support email (it's a text column, just need to ensure 'email' is valid)
COMMENT ON COLUMN public.message_templates.template_type IS 'Template scenario: reminder, escalation, invitation, alert, system';
COMMENT ON COLUMN public.message_templates.escalation_level IS 'Escalation level (0=employee, 1=supervisor, 2=manager, 3=director, 4=HR). NULL for non-escalation templates.';
COMMENT ON COLUMN public.message_templates.channel IS 'Channel: telegram, whatsapp, email, all';

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_message_templates_type_level_channel 
  ON public.message_templates (template_type, escalation_level, channel) 
  WHERE is_active = true;
