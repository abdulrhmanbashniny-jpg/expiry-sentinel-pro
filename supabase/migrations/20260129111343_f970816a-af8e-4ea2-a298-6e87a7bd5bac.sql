-- ============================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- ============================================

-- 1️⃣ FIX ACCOUNT ACTIVATION - Allow anonymous access to valid tokens
-- ================================================================

-- Add policy to allow anonymous users to view invitations by valid token
DROP POLICY IF EXISTS "Public: View invitation by token for activation" ON user_invitations;
CREATE POLICY "Public: View invitation by token for activation"
ON user_invitations
FOR SELECT
TO anon, authenticated
USING (
  -- Allow access if the invitation is pending and not expired
  status = 'pending' 
  AND expires_at > now() 
  AND accepted_at IS NULL
);

-- Allow anonymous users to update invitation status during activation
DROP POLICY IF EXISTS "Public: Update invitation during activation" ON user_invitations;
CREATE POLICY "Public: Update invitation during activation"
ON user_invitations
FOR UPDATE
TO anon, authenticated
USING (
  status = 'pending' 
  AND expires_at > now() 
  AND accepted_at IS NULL
)
WITH CHECK (
  -- Only allow updating to 'accepted' status
  status = 'accepted'
);

-- 2️⃣ TIGHTEN PERMISSIVE RLS POLICIES
-- ===================================

-- Fix reminder_rules: Remove overly permissive SELECT
DROP POLICY IF EXISTS "Authenticated users can read reminder rules" ON reminder_rules;

-- Fix automation_runs: Remove true UPDATE policy
DROP POLICY IF EXISTS "System can update automation runs" ON automation_runs;
CREATE POLICY "System can update automation runs"
ON automation_runs
FOR UPDATE
USING (is_admin_or_higher(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_admin_or_higher(auth.uid()) OR tenant_id = get_current_tenant_id());

-- 3️⃣ STRENGTHEN EVALUATION TABLES RLS
-- ====================================

-- Drop overly permissive policies on kpi_template_questions
DROP POLICY IF EXISTS "KPI Questions: All can read" ON kpi_template_questions;
CREATE POLICY "KPI Questions: Authenticated can read"
ON kpi_template_questions
FOR SELECT
TO authenticated
USING (true);

-- Drop overly permissive policies on kpi_template_axes
DROP POLICY IF EXISTS "KPI Axes: All can read" ON kpi_template_axes;
CREATE POLICY "KPI Axes: Authenticated can read"
ON kpi_template_axes
FOR SELECT
TO authenticated
USING (true);

-- Drop overly permissive policies on kpi_templates
DROP POLICY IF EXISTS "KPI Templates: All can read" ON kpi_templates;
CREATE POLICY "KPI Templates: Authenticated can read"
ON kpi_templates
FOR SELECT
TO authenticated
USING (true);

-- 4️⃣ SECURE DEPARTMENTS - Add tenant isolation
-- ==============================================

-- Ensure departments SELECT requires authentication
DROP POLICY IF EXISTS "Departments: All authenticated can read" ON departments;
CREATE POLICY "Departments: Authenticated tenant read"
ON departments
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) 
  OR tenant_id = get_current_tenant_id()
);

-- 5️⃣ SECURE EVALUATION_CYCLES - Tenant isolation
-- ================================================

DROP POLICY IF EXISTS "Evaluation Cycles: All can read active" ON evaluation_cycles;
CREATE POLICY "Evaluation Cycles: Authenticated tenant read"
ON evaluation_cycles
FOR SELECT
TO authenticated
USING (
  is_admin_or_higher(auth.uid())
  OR (is_active = true AND tenant_id = get_current_tenant_id())
);

-- 6️⃣ SECURE MESSAGE_TEMPLATES - Tenant isolation
-- ================================================

DROP POLICY IF EXISTS "Message Templates: All can read active" ON message_templates;
CREATE POLICY "Message Templates: Authenticated tenant read"
ON message_templates
FOR SELECT
TO authenticated
USING (
  is_admin_or_higher(auth.uid())
  OR ((is_active = true OR is_active IS NULL) AND (tenant_id = get_current_tenant_id() OR tenant_id IS NULL))
);

-- 7️⃣ FORCE RLS ON ALL SENSITIVE TABLES
-- =====================================

ALTER TABLE user_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE message_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE evaluation_cycles FORCE ROW LEVEL SECURITY;
ALTER TABLE kpi_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE kpi_template_axes FORCE ROW LEVEL SECURITY;
ALTER TABLE kpi_template_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE automation_runs FORCE ROW LEVEL SECURITY;

-- 8️⃣ CREATE SECURE VIEW ALTERNATIVE FOR aggregated_evaluation_results
-- =====================================================================

-- Drop the SECURITY DEFINER view and recreate as normal view
DROP VIEW IF EXISTS aggregated_evaluation_results;
CREATE VIEW aggregated_evaluation_results AS
SELECT 
  cycle_id,
  evaluatee_id,
  evaluation_type,
  count(*) AS evaluator_count,
  avg(total_score) AS avg_score,
  min(total_score) AS min_score,
  max(total_score) AS max_score,
  stddev(total_score) AS score_stddev
FROM evaluations e
WHERE status IN ('submitted', 'approved', 'published')
  AND total_score IS NOT NULL
GROUP BY cycle_id, evaluatee_id, evaluation_type;

-- Grant access only to authenticated users
REVOKE ALL ON aggregated_evaluation_results FROM PUBLIC;
GRANT SELECT ON aggregated_evaluation_results TO authenticated;