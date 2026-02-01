-- ========================================
-- RLS Policies for Escalation System
-- ========================================

-- 1. Policy: Users can view escalations where they are current recipient
CREATE POLICY escalation_log_current_recipient ON escalation_log
  FOR SELECT
  USING (
    auth.uid() = current_recipient_id
  );

-- 2. Policy: Users can view escalations where they are original recipient
CREATE POLICY escalation_log_original_recipient ON escalation_log
  FOR SELECT
  USING (
    auth.uid() = original_recipient_id
  );

-- 3. Policy: HR and Directors can view all escalations
CREATE POLICY escalation_log_admin_access ON escalation_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('hr_admin', 'director')
      AND tenant_id = escalation_log.tenant_id
    )
  );

-- 4. Policy: Managers can view escalations in their department
CREATE POLICY escalation_log_manager_access ON escalation_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'manager'
      AND p.tenant_id = escalation_log.tenant_id
    )
  );

-- 5. Policy: Tenant isolation
CREATE POLICY escalation_log_tenant_isolation ON escalation_log
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- 6. Policy: Users can update escalations they own
CREATE POLICY escalation_log_update_own ON escalation_log
  FOR UPDATE
  USING (
    auth.uid() = current_recipient_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = current_recipient_id
    AND status IN ('acknowledged', 'resolved')
  );

-- 7. Policy: organizational_hierarchy - Users see their own hierarchy
CREATE POLICY organizational_hierarchy_access ON organizational_hierarchy
  FOR SELECT
  USING (
    auth.uid() = employee_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('hr_admin', 'director')
      AND tenant_id = organizational_hierarchy.tenant_id
    )
  );

-- 8. Policy: escalation_rules - Everyone can view active rules
CREATE POLICY escalation_rules_read ON escalation_rules
  FOR SELECT
  USING (
    is_active = true
    AND tenant_id = (
      SELECT tenant_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- 9. Policy: escalation_rules - Only HR can update
CREATE POLICY escalation_rules_update ON escalation_rules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'hr_admin'
      AND tenant_id = escalation_rules.tenant_id
    )
  );

-- Enable RLS on all escalation tables
ALTER TABLE escalation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizational_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_escalation_log_current_recipient ON escalation_log(current_recipient_id);
CREATE INDEX idx_escalation_log_original_recipient ON escalation_log(original_recipient_id);
CREATE INDEX idx_escalation_log_status ON escalation_log(status);
CREATE INDEX idx_escalation_log_next_escalation ON escalation_log(next_escalation_at);
CREATE INDEX idx_escalation_log_tenant ON escalation_log(tenant_id);
CREATE INDEX idx_organizational_hierarchy_employee ON organizational_hierarchy(employee_id);
CREATE INDEX idx_organizational_hierarchy_tenant ON organizational_hierarchy(tenant_id);
CREATE INDEX idx_escalation_rules_tenant ON escalation_rules(tenant_id);
CREATE INDEX idx_escalation_rules_level ON escalation_rules(escalation_level);
