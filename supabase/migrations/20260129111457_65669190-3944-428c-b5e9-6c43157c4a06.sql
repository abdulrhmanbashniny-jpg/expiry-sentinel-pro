-- Fix the Security Definer View issue
-- Drop and recreate the view without SECURITY DEFINER

DROP VIEW IF EXISTS aggregated_evaluation_results;

-- Recreate as a normal view (not security definer)
CREATE OR REPLACE VIEW aggregated_evaluation_results 
WITH (security_invoker = true)
AS
SELECT 
  e.cycle_id,
  e.evaluatee_id,
  e.evaluation_type,
  count(*) AS evaluator_count,
  avg(e.total_score) AS avg_score,
  min(e.total_score) AS min_score,
  max(e.total_score) AS max_score,
  stddev(e.total_score) AS score_stddev
FROM evaluations e
WHERE e.status IN ('submitted', 'approved', 'published')
  AND e.total_score IS NOT NULL
GROUP BY e.cycle_id, e.evaluatee_id, e.evaluation_type;

-- Grant access only to authenticated users
REVOKE ALL ON aggregated_evaluation_results FROM PUBLIC;
GRANT SELECT ON aggregated_evaluation_results TO authenticated;