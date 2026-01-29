-- Fix remaining INSERT policies with true conditions

-- 1. Audit Log
DROP POLICY IF EXISTS "Audit Log: System INSERT" ON audit_log;
CREATE POLICY "Audit Log: System INSERT"
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  OR is_admin_or_higher(auth.uid())
  OR tenant_id = get_current_tenant_id()
);

-- 2. Automation runs
DROP POLICY IF EXISTS "System can insert automation runs" ON automation_runs;
CREATE POLICY "System can insert automation runs"
ON automation_runs
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_higher(auth.uid()) 
  OR tenant_id = get_current_tenant_id()
);

-- 3. Compliance reports
DROP POLICY IF EXISTS "Compliance reports: System insert" ON compliance_reports;
CREATE POLICY "Compliance reports: System insert"
ON compliance_reports
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_higher(auth.uid()) 
  OR (tenant_id = get_current_tenant_id() AND generated_by = auth.uid())
);

-- 4. Compliance scores
DROP POLICY IF EXISTS "Compliance scores: System insert" ON compliance_scores;
CREATE POLICY "Compliance scores: System insert"
ON compliance_scores
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_higher(auth.uid()) 
  OR tenant_id = get_current_tenant_id()
);

-- 5. Delegation audit log
DROP POLICY IF EXISTS "Delegation audit: System insert" ON delegation_audit_log;
CREATE POLICY "Delegation audit: System insert"
ON delegation_audit_log
FOR INSERT
TO authenticated
WITH CHECK (performed_by = auth.uid());

-- 6. In-App Notifications
DROP POLICY IF EXISTS "In-App Notifications: System INSERT" ON in_app_notifications;
CREATE POLICY "In-App Notifications: System INSERT"
ON in_app_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_or_higher(auth.uid()) 
  OR user_id = auth.uid()
  OR tenant_id = get_current_tenant_id()
);

-- 7. Item status log
DROP POLICY IF EXISTS "Status log: System can insert" ON item_status_log;
CREATE POLICY "Status log: System can insert"
ON item_status_log
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by_user_id = auth.uid() 
  OR is_admin_or_higher(auth.uid())
);

-- Force RLS on all these tables
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE automation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_scores FORCE ROW LEVEL SECURITY;
ALTER TABLE delegation_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE in_app_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE item_status_log FORCE ROW LEVEL SECURITY;