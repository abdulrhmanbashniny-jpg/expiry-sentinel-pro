
-- ===================================================
-- 1. Add unique constraint to prevent duplicate evaluations
-- ===================================================

-- First, let's clean up any existing duplicates (keep the one with the most progress)
-- This is a safe operation as we only remove true duplicates

DO $$
DECLARE
  dup_record RECORD;
BEGIN
  -- Find and delete duplicates, keeping the one with the latest updated_at
  FOR dup_record IN (
    SELECT id FROM evaluations e1
    WHERE EXISTS (
      SELECT 1 FROM evaluations e2
      WHERE e2.cycle_id = e1.cycle_id
        AND e2.evaluator_id = e1.evaluator_id
        AND e2.evaluatee_id = e1.evaluatee_id
        AND e2.evaluation_type = e1.evaluation_type
        AND e2.id != e1.id
        AND (e2.updated_at > e1.updated_at OR (e2.updated_at = e1.updated_at AND e2.id > e1.id))
    )
  )
  LOOP
    DELETE FROM evaluation_answers WHERE evaluation_id = dup_record.id;
    DELETE FROM evaluations WHERE id = dup_record.id;
  END LOOP;
END $$;

-- Create unique constraint
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_unique_assignment;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_unique_assignment 
  UNIQUE (cycle_id, evaluator_id, evaluatee_id, evaluation_type);

-- ===================================================
-- 2. Update evaluation_type enum to include new types
-- ===================================================
DO $$
BEGIN
  -- Add new values to the enum if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'self' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'evaluation_type')) THEN
    ALTER TYPE evaluation_type ADD VALUE IF NOT EXISTS 'self';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'employee_to_supervisor' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'evaluation_type')) THEN
    ALTER TYPE evaluation_type ADD VALUE IF NOT EXISTS 'employee_to_supervisor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'supervisor_to_manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'evaluation_type')) THEN
    ALTER TYPE evaluation_type ADD VALUE IF NOT EXISTS 'supervisor_to_manager';
  END IF;
END $$;

-- ===================================================
-- 3. Update RLS policies for evaluations table
-- Lock evaluations after submission (only draft can be edited by evaluator)
-- ===================================================

-- Drop existing update policy
DROP POLICY IF EXISTS "Evaluations: Update own or admin" ON evaluations;

-- New update policy: Evaluator can only update if status is 'draft'
-- System admin can update any time (before published)
CREATE POLICY "Evaluations: Evaluator update draft only"
ON evaluations
FOR UPDATE
USING (
  (evaluator_id = auth.uid() AND status = 'draft')
  OR is_system_admin(auth.uid())
);

-- ===================================================
-- 4. Create function to generate 360 evaluation assignments
-- ===================================================
CREATE OR REPLACE FUNCTION generate_360_assignments(p_cycle_id uuid)
RETURNS TABLE(created_count int, skipped_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created int := 0;
  v_skipped int := 0;
  v_cycle RECORD;
  v_employee RECORD;
  v_team_member RECORD;
  v_dept RECORD;
BEGIN
  -- Get cycle info
  SELECT * INTO v_cycle FROM evaluation_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found';
  END IF;

  -- For each employee in the system
  FOR v_employee IN 
    SELECT DISTINCT p.user_id 
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.user_id IS NOT NULL
  LOOP
    -- 1. Self assessment (if enabled)
    IF v_cycle.allow_self_assessment THEN
      BEGIN
        INSERT INTO evaluations (cycle_id, evaluator_id, evaluatee_id, evaluation_type, status)
        VALUES (p_cycle_id, v_employee.user_id, v_employee.user_id, 'self_assessment', 'draft');
        v_created := v_created + 1;
      EXCEPTION WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
      END;
    END IF;

    -- 2. Supervisor to Employee (find who supervises this employee)
    FOR v_team_member IN 
      SELECT tm.supervisor_id 
      FROM team_members tm 
      WHERE tm.employee_id = v_employee.user_id
    LOOP
      BEGIN
        INSERT INTO evaluations (cycle_id, evaluator_id, evaluatee_id, evaluation_type, status)
        VALUES (p_cycle_id, v_team_member.supervisor_id, v_employee.user_id, 'supervisor_to_employee', 'draft');
        v_created := v_created + 1;
      EXCEPTION WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
      END;
    END LOOP;

    -- If 360 is enabled, also create upward evaluations
    IF v_cycle.allow_360 THEN
      -- 3. Employee to Supervisor (employee evaluates their supervisor)
      FOR v_team_member IN 
        SELECT tm.supervisor_id 
        FROM team_members tm 
        WHERE tm.employee_id = v_employee.user_id
      LOOP
        BEGIN
          INSERT INTO evaluations (cycle_id, evaluator_id, evaluatee_id, evaluation_type, status)
          VALUES (p_cycle_id, v_employee.user_id, v_team_member.supervisor_id, 'peer_360', 'draft');
          v_created := v_created + 1;
        EXCEPTION WHEN unique_violation THEN
          v_skipped := v_skipped + 1;
        END;
      END LOOP;

      -- 4. Manager to Supervisor evaluations
      FOR v_dept IN 
        SELECT d.id, d.manager_user_id 
        FROM departments d 
        WHERE d.manager_user_id IS NOT NULL
      LOOP
        -- Find supervisors in this department
        FOR v_team_member IN 
          SELECT DISTINCT tm.supervisor_id
          FROM team_members tm
          JOIN user_department_scopes uds ON uds.user_id = tm.supervisor_id
          WHERE uds.department_id = v_dept.id
            AND tm.supervisor_id != v_dept.manager_user_id
        LOOP
          BEGIN
            INSERT INTO evaluations (cycle_id, evaluator_id, evaluatee_id, evaluation_type, status)
            VALUES (p_cycle_id, v_dept.manager_user_id, v_team_member.supervisor_id, 'manager_to_supervisor', 'draft');
            v_created := v_created + 1;
          EXCEPTION WHEN unique_violation THEN
            v_skipped := v_skipped + 1;
          END;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_created, v_skipped;
END;
$$;

-- Grant execute to authenticated users (will be restricted by RLS)
GRANT EXECUTE ON FUNCTION generate_360_assignments(uuid) TO authenticated;

-- ===================================================
-- 5. Create function to calculate and finalize total score on submit
-- ===================================================
CREATE OR REPLACE FUNCTION submit_evaluation_with_score(p_evaluation_id uuid)
RETURNS evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation evaluations%ROWTYPE;
  v_total_score numeric;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Get the evaluation
  SELECT * INTO v_evaluation FROM evaluations WHERE id = p_evaluation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluation not found';
  END IF;
  
  -- Check if user can submit (evaluator and status is draft)
  IF v_evaluation.evaluator_id != v_user_id THEN
    RAISE EXCEPTION 'Only the evaluator can submit this evaluation';
  END IF;
  
  IF v_evaluation.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft evaluations can be submitted';
  END IF;
  
  -- Calculate total score from answers
  SELECT COALESCE(AVG(score), 0) INTO v_total_score
  FROM evaluation_answers
  WHERE evaluation_id = p_evaluation_id AND score IS NOT NULL;
  
  -- Update the evaluation
  UPDATE evaluations
  SET 
    status = 'submitted',
    total_score = v_total_score,
    submitted_at = now(),
    updated_at = now()
  WHERE id = p_evaluation_id
  RETURNING * INTO v_evaluation;
  
  RETURN v_evaluation;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_evaluation_with_score(uuid) TO authenticated;

-- ===================================================
-- 6. Create a view for aggregated 360 results (hides evaluator names)
-- ===================================================
CREATE OR REPLACE VIEW public.aggregated_evaluation_results AS
SELECT 
  e.cycle_id,
  e.evaluatee_id,
  e.evaluation_type,
  COUNT(*) as evaluator_count,
  AVG(e.total_score) as avg_score,
  MIN(e.total_score) as min_score,
  MAX(e.total_score) as max_score,
  STDDEV(e.total_score) as score_stddev
FROM evaluations e
WHERE e.status IN ('submitted', 'approved', 'published')
  AND e.total_score IS NOT NULL
GROUP BY e.cycle_id, e.evaluatee_id, e.evaluation_type;

-- Grant select on the view
GRANT SELECT ON public.aggregated_evaluation_results TO authenticated;

-- ===================================================
-- 7. Add index for faster duplicate checking
-- ===================================================
CREATE INDEX IF NOT EXISTS idx_evaluations_assignment_lookup 
ON evaluations(cycle_id, evaluator_id, evaluatee_id, evaluation_type);

CREATE INDEX IF NOT EXISTS idx_evaluations_status 
ON evaluations(status);

CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_status 
ON evaluations(evaluator_id, status);
