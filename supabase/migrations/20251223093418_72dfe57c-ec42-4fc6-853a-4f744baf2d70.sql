-- Create conversation_logs table with proper RLS
CREATE TABLE public.conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number TEXT NOT NULL,
  platform TEXT NOT NULL,
  user_identifier TEXT,
  user_message TEXT,
  bot_response TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view conversation logs
CREATE POLICY "Admins can manage conversation logs"
  ON public.conversation_logs FOR ALL
  USING (is_admin(auth.uid()));

-- Update settings policy to exclude conversation data
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.settings;

CREATE POLICY "Authenticated users can read app settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (key NOT LIKE 'conversation_%' AND key NOT LIKE 'telegram_%');