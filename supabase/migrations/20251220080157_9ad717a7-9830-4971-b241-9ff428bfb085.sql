-- Create enum types
CREATE TYPE public.item_status AS ENUM ('active', 'expired', 'archived');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
CREATE TYPE public.app_role AS ENUM ('admin', 'hr_user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for RBAC
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recipients table
CREATE TABLE public.recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create reminder_rules table
CREATE TABLE public.reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  days_before INTEGER[] NOT NULL DEFAULT '{30,14,7,3,1,0}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  expiry_date DATE NOT NULL,
  owner_department TEXT,
  responsible_person TEXT,
  notes TEXT,
  attachment_url TEXT,
  status item_status NOT NULL DEFAULT 'active',
  reminder_rule_id UUID REFERENCES public.reminder_rules(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create item_recipients junction table
CREATE TABLE public.item_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, recipient_id)
);

-- Create notification_log table
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  reminder_day INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status notification_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create settings table for app configuration
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- RLS Policies for user_roles (admin only)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policies for categories (all authenticated users can read)
CREATE POLICY "Authenticated users can read categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for recipients
CREATE POLICY "Authenticated users can read recipients"
  ON public.recipients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage recipients"
  ON public.recipients FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for reminder_rules
CREATE POLICY "Authenticated users can read reminder rules"
  ON public.reminder_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage reminder rules"
  ON public.reminder_rules FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for items
CREATE POLICY "Users can view all items"
  ON public.items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own items"
  ON public.items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update their own items"
  ON public.items FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can delete their own items"
  ON public.items FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id OR public.is_admin(auth.uid()));

-- RLS Policies for item_recipients
CREATE POLICY "Authenticated users can read item recipients"
  ON public.item_recipients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage item recipients for their items"
  ON public.item_recipients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.items 
      WHERE id = item_id 
      AND (created_by_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "Users can delete item recipients for their items"
  ON public.item_recipients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.items 
      WHERE id = item_id 
      AND (created_by_user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

-- RLS Policies for notification_log
CREATE POLICY "Authenticated users can read notification logs"
  ON public.notification_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert notification logs"
  ON public.notification_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage notification logs"
  ON public.notification_log FOR ALL
  USING (public.is_admin(auth.uid()));

-- RLS Policies for settings
CREATE POLICY "Authenticated users can read settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage settings"
  ON public.settings FOR ALL
  USING (public.is_admin(auth.uid()));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email);
  
  -- First user gets admin role
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'hr_user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default data
INSERT INTO public.categories (name, description) VALUES
  ('عقود', 'عقود العمل والخدمات'),
  ('تراخيص', 'تراخيص العمل والتجارية'),
  ('سيارات', 'استمارات ورخص السيارات'),
  ('موارد بشرية', 'وثائق الموارد البشرية');

INSERT INTO public.reminder_rules (name, days_before) VALUES
  ('قياسي HR', '{30,14,7,3,1,0}'),
  ('تنبيه مبكر', '{60,30,14,7,3,1}'),
  ('تنبيه عاجل', '{7,3,1,0}');

INSERT INTO public.settings (key, value) VALUES
  ('timezone', '"Asia/Riyadh"'),
  ('daily_check_time', '"08:00"'),
  ('whatsapp_template', '{"template": "تذكير: {{title}} سينتهي خلال {{days_left}} يوم في تاريخ {{expiry_date}}"}');