-- Fix remaining permissive policies

-- 1. Rate limits - restrict to system admin only
DROP POLICY IF EXISTS "System can manage rate limits" ON rate_limits;
CREATE POLICY "System admin can manage rate limits"
ON rate_limits
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY;

-- 2. Fix any remaining INSERT policies with true conditions
-- Password audit log
DROP POLICY IF EXISTS "Password Audit: System insert" ON password_audit_log;
CREATE POLICY "Password Audit: System insert"
ON password_audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR is_admin_or_higher(auth.uid()));

-- Evaluation audit log
DROP POLICY IF EXISTS "Eval Audit: System insert" ON evaluation_audit_log;
CREATE POLICY "Eval Audit: System insert"
ON evaluation_audit_log
FOR INSERT
TO authenticated
WITH CHECK (performed_by = auth.uid() OR is_admin_or_higher(auth.uid()));

-- AI Usage Log
DROP POLICY IF EXISTS "AI Usage Log: System insert" ON ai_usage_log;
CREATE POLICY "AI Usage Log: System insert"
ON ai_usage_log
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_higher(auth.uid()));

-- AI Predictions
DROP POLICY IF EXISTS "AI Predictions: System INSERT" ON ai_risk_predictions;
CREATE POLICY "AI Predictions: System INSERT"
ON ai_risk_predictions
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_higher(auth.uid()) AND (tenant_id = get_current_tenant_id() OR is_system_admin(auth.uid())));

-- Login history
DROP POLICY IF EXISTS "Login history: System can insert" ON login_history;
CREATE POLICY "Login history: System can insert"
ON login_history
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id IS NOT NULL);

-- Notification log
DROP POLICY IF EXISTS "System can insert notification logs" ON notification_log;
CREATE POLICY "System can insert notification logs"
ON notification_log
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_higher(auth.uid()) OR tenant_id = get_current_tenant_id());