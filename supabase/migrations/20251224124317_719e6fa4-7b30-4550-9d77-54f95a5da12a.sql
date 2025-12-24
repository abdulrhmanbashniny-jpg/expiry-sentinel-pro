-- Add risk_level to categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'medium' CHECK (risk_level IN ('high', 'medium', 'low'));

-- Add delay_reason to notification_log
ALTER TABLE public.notification_log 
ADD COLUMN IF NOT EXISTS delay_reason text;

-- Add telegram_user_id to profiles for linking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_user_id text;

-- Create compliance_scores table
CREATE TABLE public.compliance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type text NOT NULL CHECK (score_type IN ('user', 'department', 'category')),
  reference_id text NOT NULL,
  reference_name text,
  score numeric(5,2) NOT NULL DEFAULT 0,
  total_items integer DEFAULT 0,
  on_time_items integer DEFAULT 0,
  late_items integer DEFAULT 0,
  avg_delay_days numeric(5,2) DEFAULT 0,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create compliance_reports table
CREATE TABLE public.compliance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'yearly')),
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary_text text,
  ai_analysis text,
  report_data jsonb DEFAULT '{}'::jsonb,
  generated_by uuid,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create admin_conversations table for AI Advisor
CREATE TABLE public.admin_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compliance_scores
CREATE POLICY "Compliance scores: Admin plus read" ON public.compliance_scores
FOR SELECT USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Compliance scores: System insert" ON public.compliance_scores
FOR INSERT WITH CHECK (true);

-- RLS Policies for compliance_reports
CREATE POLICY "Compliance reports: Admin plus read" ON public.compliance_reports
FOR SELECT USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Compliance reports: System insert" ON public.compliance_reports
FOR INSERT WITH CHECK (true);

-- RLS Policies for admin_conversations
CREATE POLICY "Admin conversations: Own messages" ON public.admin_conversations
FOR ALL USING (user_id = auth.uid() AND is_admin_or_higher(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_compliance_scores_period ON public.compliance_scores(period_type, period_start);
CREATE INDEX idx_compliance_scores_type ON public.compliance_scores(score_type, reference_id);
CREATE INDEX idx_admin_conversations_user ON public.admin_conversations(user_id, created_at DESC);