-- Migration Part 3: Create integrations, security_settings, login_history tables and escalation columns

-- 1. Create integrations table for storing integration configs
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Integrations: System admin only"
ON public.integrations
FOR ALL
USING (public.is_system_admin(auth.uid()));

-- Insert default integration entries
INSERT INTO public.integrations (key, name, config) VALUES
  ('n8n', 'n8n Workflow Automation', '{"base_url": "", "api_key": "", "workflows": {}}'::jsonb),
  ('telegram', 'Telegram Bot', '{"bot_token": "", "default_chat_id": ""}'::jsonb),
  ('whatsapp', 'WhatsApp Business', '{"api_base_url": "", "access_token": "", "phone_number_id": ""}'::jsonb),
  ('ai_assistant', 'AI Assistant', '{"provider": "lovable", "api_key": "", "model": "google/gemini-2.5-flash", "system_prompt": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Trigger to update updated_at
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add notification escalation columns
ALTER TABLE public.notification_log 
ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS seen_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS escalated_to_supervisor_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS escalated_to_admin_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS escalation_status TEXT DEFAULT 'none';

-- 3. Create security_settings table
CREATE TABLE IF NOT EXISTS public.security_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 1440,
  password_min_length INTEGER NOT NULL DEFAULT 8,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  max_login_attempts INTEGER NOT NULL DEFAULT 5,
  lockout_duration_minutes INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security settings: System admin only"
ON public.security_settings
FOR ALL
USING (public.is_system_admin(auth.uid()));

-- Insert default security settings
INSERT INTO public.security_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- 4. Create login_history table
CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Login history: System admin can view all"
ON public.login_history
FOR SELECT
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Login history: Users view own"
ON public.login_history
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Login history: System can insert"
ON public.login_history
FOR INSERT
WITH CHECK (true);

-- 5. Update handle_new_user to default to 'employee' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);
  
  -- First user gets system_admin role
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'system_admin');
  ELSE
    -- Default new users to employee role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;