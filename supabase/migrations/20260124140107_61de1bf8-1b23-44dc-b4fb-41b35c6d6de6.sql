-- ============================================
-- Multi-Tenant RLS Fixes - Phase 2 Complete (Fixed)
-- ============================================

-- Part 1: Helper function to prevent tenant_id modification
CREATE OR REPLACE FUNCTION public.prevent_tenant_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cannot change tenant_id after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Part 2: Helper function to enforce tenant_id on insert
CREATE OR REPLACE FUNCTION public.enforce_tenant_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_current_tenant_id UUID;
BEGIN
  v_current_tenant_id := get_current_tenant_id();
  
  -- If user provides a tenant_id different from their own, reject it
  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id != v_current_tenant_id THEN
    -- Only system_admin can insert to different tenants
    IF NOT is_system_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot insert records for other tenants';
    END IF;
  END IF;
  
  -- Auto-set tenant_id if not provided
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_current_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Part 3: Create triggers for all tenant-scoped tables
-- Items table
DROP TRIGGER IF EXISTS enforce_tenant_items ON items;
CREATE TRIGGER enforce_tenant_items BEFORE INSERT ON items
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_items ON items;
CREATE TRIGGER prevent_tenant_change_items BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Departments table
DROP TRIGGER IF EXISTS enforce_tenant_departments ON departments;
CREATE TRIGGER enforce_tenant_departments BEFORE INSERT ON departments
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_departments ON departments;
CREATE TRIGGER prevent_tenant_change_departments BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Categories table
DROP TRIGGER IF EXISTS enforce_tenant_categories ON categories;
CREATE TRIGGER enforce_tenant_categories BEFORE INSERT ON categories
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_categories ON categories;
CREATE TRIGGER prevent_tenant_change_categories BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Recipients table
DROP TRIGGER IF EXISTS enforce_tenant_recipients ON recipients;
CREATE TRIGGER enforce_tenant_recipients BEFORE INSERT ON recipients
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_recipients ON recipients;
CREATE TRIGGER prevent_tenant_change_recipients BEFORE UPDATE ON recipients
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Reminder Rules table
DROP TRIGGER IF EXISTS enforce_tenant_reminder_rules ON reminder_rules;
CREATE TRIGGER enforce_tenant_reminder_rules BEFORE INSERT ON reminder_rules
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_reminder_rules ON reminder_rules;
CREATE TRIGGER prevent_tenant_change_reminder_rules BEFORE UPDATE ON reminder_rules
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Message Templates table
DROP TRIGGER IF EXISTS enforce_tenant_message_templates ON message_templates;
CREATE TRIGGER enforce_tenant_message_templates BEFORE INSERT ON message_templates
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_message_templates ON message_templates;
CREATE TRIGGER prevent_tenant_change_message_templates BEFORE UPDATE ON message_templates
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Notification Log table
DROP TRIGGER IF EXISTS enforce_tenant_notification_log ON notification_log;
CREATE TRIGGER enforce_tenant_notification_log BEFORE INSERT ON notification_log
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_notification_log ON notification_log;
CREATE TRIGGER prevent_tenant_change_notification_log BEFORE UPDATE ON notification_log
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Automation Runs table
DROP TRIGGER IF EXISTS enforce_tenant_automation_runs ON automation_runs;
CREATE TRIGGER enforce_tenant_automation_runs BEFORE INSERT ON automation_runs
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_automation_runs ON automation_runs;
CREATE TRIGGER prevent_tenant_change_automation_runs BEFORE UPDATE ON automation_runs
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- KPI Templates table
DROP TRIGGER IF EXISTS enforce_tenant_kpi_templates ON kpi_templates;
CREATE TRIGGER enforce_tenant_kpi_templates BEFORE INSERT ON kpi_templates
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_kpi_templates ON kpi_templates;
CREATE TRIGGER prevent_tenant_change_kpi_templates BEFORE UPDATE ON kpi_templates
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Evaluation Cycles table
DROP TRIGGER IF EXISTS enforce_tenant_evaluation_cycles ON evaluation_cycles;
CREATE TRIGGER enforce_tenant_evaluation_cycles BEFORE INSERT ON evaluation_cycles
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_evaluation_cycles ON evaluation_cycles;
CREATE TRIGGER prevent_tenant_change_evaluation_cycles BEFORE UPDATE ON evaluation_cycles
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Evaluations table
DROP TRIGGER IF EXISTS enforce_tenant_evaluations ON evaluations;
CREATE TRIGGER enforce_tenant_evaluations BEFORE INSERT ON evaluations
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_evaluations ON evaluations;
CREATE TRIGGER prevent_tenant_change_evaluations BEFORE UPDATE ON evaluations
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Team Members table
DROP TRIGGER IF EXISTS enforce_tenant_team_members ON team_members;
CREATE TRIGGER enforce_tenant_team_members BEFORE INSERT ON team_members
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_team_members ON team_members;
CREATE TRIGGER prevent_tenant_change_team_members BEFORE UPDATE ON team_members
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Dynamic Field Definitions table
DROP TRIGGER IF EXISTS enforce_tenant_dynamic_field_definitions ON dynamic_field_definitions;
CREATE TRIGGER enforce_tenant_dynamic_field_definitions BEFORE INSERT ON dynamic_field_definitions
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_dynamic_field_definitions ON dynamic_field_definitions;
CREATE TRIGGER prevent_tenant_change_dynamic_field_definitions BEFORE UPDATE ON dynamic_field_definitions
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Compliance Scores table
DROP TRIGGER IF EXISTS enforce_tenant_compliance_scores ON compliance_scores;
CREATE TRIGGER enforce_tenant_compliance_scores BEFORE INSERT ON compliance_scores
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_compliance_scores ON compliance_scores;
CREATE TRIGGER prevent_tenant_change_compliance_scores BEFORE UPDATE ON compliance_scores
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Compliance Reports table
DROP TRIGGER IF EXISTS enforce_tenant_compliance_reports ON compliance_reports;
CREATE TRIGGER enforce_tenant_compliance_reports BEFORE INSERT ON compliance_reports
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_compliance_reports ON compliance_reports;
CREATE TRIGGER prevent_tenant_change_compliance_reports BEFORE UPDATE ON compliance_reports
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Conversation Logs table
DROP TRIGGER IF EXISTS enforce_tenant_conversation_logs ON conversation_logs;
CREATE TRIGGER enforce_tenant_conversation_logs BEFORE INSERT ON conversation_logs
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_conversation_logs ON conversation_logs;
CREATE TRIGGER prevent_tenant_change_conversation_logs BEFORE UPDATE ON conversation_logs
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- AI Agent Configs table
DROP TRIGGER IF EXISTS enforce_tenant_ai_agent_configs ON ai_agent_configs;
CREATE TRIGGER enforce_tenant_ai_agent_configs BEFORE INSERT ON ai_agent_configs
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

DROP TRIGGER IF EXISTS prevent_tenant_change_ai_agent_configs ON ai_agent_configs;
CREATE TRIGGER prevent_tenant_change_ai_agent_configs BEFORE UPDATE ON ai_agent_configs
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();

-- Part 4: Drop old FOR ALL policies and create granular policies with WITH CHECK

-- Categories - Drop old policies first
DROP POLICY IF EXISTS "Categories: Tenant isolation" ON categories;

-- Create new granular policies for Categories
CREATE POLICY "Categories: Tenant SELECT"
ON categories FOR SELECT
USING (
  is_system_admin(auth.uid()) 
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Categories: Tenant INSERT"
ON categories FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR (tenant_id IS NULL AND get_current_tenant_id() IS NOT NULL)
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Categories: Tenant UPDATE"
ON categories FOR UPDATE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Categories: Tenant DELETE"
ON categories FOR DELETE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

-- Reminder Rules - Drop old policies
DROP POLICY IF EXISTS "Reminder Rules: Tenant isolation" ON reminder_rules;

CREATE POLICY "Reminder Rules: Tenant SELECT"
ON reminder_rules FOR SELECT
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Reminder Rules: Tenant INSERT"
ON reminder_rules FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR (tenant_id IS NULL AND get_current_tenant_id() IS NOT NULL)
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Reminder Rules: Tenant UPDATE"
ON reminder_rules FOR UPDATE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Reminder Rules: Tenant DELETE"
ON reminder_rules FOR DELETE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

-- Message Templates - Drop old policies
DROP POLICY IF EXISTS "Message Templates: Tenant isolation" ON message_templates;

CREATE POLICY "Message Templates: Tenant SELECT"
ON message_templates FOR SELECT
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Message Templates: Tenant INSERT"
ON message_templates FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR (tenant_id IS NULL AND get_current_tenant_id() IS NOT NULL)
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Message Templates: Tenant UPDATE"
ON message_templates FOR UPDATE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Message Templates: Tenant DELETE"
ON message_templates FOR DELETE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

-- Items - Drop old policy
DROP POLICY IF EXISTS "Items: Tenant isolation" ON items;

CREATE POLICY "Items: Tenant SELECT"
ON items FOR SELECT
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Items: Tenant INSERT"
ON items FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR (tenant_id IS NULL AND get_current_tenant_id() IS NOT NULL)
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Items: Tenant UPDATE"
ON items FOR UPDATE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Items: Tenant DELETE"
ON items FOR DELETE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

-- Notification Log - Drop old policy
DROP POLICY IF EXISTS "Notification Log: Tenant isolation" ON notification_log;

CREATE POLICY "Notification Log: Tenant SELECT"
ON notification_log FOR SELECT
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Notification Log: Tenant INSERT"
ON notification_log FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR (tenant_id IS NULL AND get_current_tenant_id() IS NOT NULL)
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Notification Log: Tenant UPDATE"
ON notification_log FOR UPDATE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

-- Part 5: Fix Invitations Policy - use auth.jwt() instead of auth.users
DROP POLICY IF EXISTS "Invitations: Users can view pending by email" ON user_invitations;

CREATE POLICY "Invitations: View by token access"
ON user_invitations FOR SELECT
USING (
  -- Tenant admin can view all invitations for their tenant
  is_tenant_admin(tenant_id) 
  OR is_system_admin(auth.uid())
  -- Users can view their own pending invitations by matching JWT email
  OR (
    email = (auth.jwt() ->> 'email')
    AND accepted_at IS NULL 
    AND expires_at > now()
  )
);

-- Part 6: Drop existing and create new RLS for recipients
DROP POLICY IF EXISTS "Recipients: Tenant isolation" ON recipients;
DROP POLICY IF EXISTS "Recipients: Tenant SELECT" ON recipients;
DROP POLICY IF EXISTS "Recipients: Tenant INSERT" ON recipients;
DROP POLICY IF EXISTS "Recipients: Tenant UPDATE" ON recipients;
DROP POLICY IF EXISTS "Recipients: Tenant DELETE" ON recipients;

CREATE POLICY "Recipients: Tenant SELECT"
ON recipients FOR SELECT
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Recipients: Tenant INSERT"
ON recipients FOR INSERT
WITH CHECK (
  is_system_admin(auth.uid())
  OR (tenant_id IS NULL AND get_current_tenant_id() IS NOT NULL)
  OR tenant_id = get_current_tenant_id()
);

CREATE POLICY "Recipients: Tenant UPDATE"
ON recipients FOR UPDATE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id())
WITH CHECK (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

CREATE POLICY "Recipients: Tenant DELETE"
ON recipients FOR DELETE
USING (is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id());

-- Part 7: Update the existing recipient view policy to be more explicit
DROP POLICY IF EXISTS "Items: Recipients can view linked items" ON items;

CREATE POLICY "Items: Recipients can view linked items"
ON items FOR SELECT
USING (is_item_recipient(id, auth.uid()));

-- Part 8: Create a function to check if user is recipient (for blocking updates)
CREATE OR REPLACE FUNCTION public.is_only_recipient_not_creator(item_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_recipient BOOLEAN;
  v_is_creator BOOLEAN;
  v_creator_id UUID;
BEGIN
  -- Check if user is a recipient
  v_is_recipient := is_item_recipient(item_id, user_id);
  
  -- Get creator id
  SELECT created_by_user_id INTO v_creator_id FROM items WHERE id = item_id;
  
  -- Check if user is creator
  v_is_creator := (v_creator_id = user_id);
  
  -- Return true if user is recipient but NOT creator
  RETURN v_is_recipient AND NOT v_is_creator;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update Items UPDATE policy to block recipients who are not creators
DROP POLICY IF EXISTS "Items: Admin plus can update all supervisors update team items" ON items;

CREATE POLICY "Items: Admin plus can update"
ON items FOR UPDATE
USING (
  -- Block if user is only a recipient (not creator/admin/supervisor)
  NOT is_only_recipient_not_creator(id, auth.uid())
  AND (
    is_admin_or_higher(auth.uid()) 
    OR (has_role(auth.uid(), 'supervisor') AND created_by_user_id IN (SELECT get_team_member_ids(auth.uid())))
    OR created_by_user_id = auth.uid()
  )
)
WITH CHECK (
  is_system_admin(auth.uid()) OR tenant_id = get_current_tenant_id()
);

-- Part 9: Prevent profiles from changing their own tenant_id via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_tenant_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only system_admin can change tenant_id
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    IF NOT is_system_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot change tenant assignment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_profile_tenant_change ON profiles;
CREATE TRIGGER prevent_profile_tenant_change BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_profile_tenant_change();