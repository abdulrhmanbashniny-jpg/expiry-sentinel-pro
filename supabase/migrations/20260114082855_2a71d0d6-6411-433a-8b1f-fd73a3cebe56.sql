-- 1. إضافة حالة التقييم الجديدة "not_submitted" لغير المكتمل
ALTER TYPE evaluation_status ADD VALUE IF NOT EXISTS 'not_submitted';

-- 2. إنشاء دالة للتحقق من استخدام القالب في دورات
CREATE OR REPLACE FUNCTION public.check_template_usage(p_template_id uuid)
RETURNS TABLE(cycle_count integer, cycle_names text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*)::integer as cycle_count,
    ARRAY_AGG(name) as cycle_names
  FROM evaluation_cycles
  WHERE template_id = p_template_id;
$$;

-- 3. إنشاء دالة لإغلاق الدورات المنتهية
CREATE OR REPLACE FUNCTION public.close_expired_evaluation_cycles()
RETURNS TABLE(
  closed_cycles_count integer,
  updated_evaluations_count integer,
  cycle_details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed_cycles int := 0;
  v_updated_evals int := 0;
  v_cycle RECORD;
  v_details jsonb := '[]'::jsonb;
BEGIN
  -- البحث عن الدورات النشطة التي انتهت
  FOR v_cycle IN 
    SELECT id, name, end_date
    FROM evaluation_cycles
    WHERE is_active = true
      AND end_date < CURRENT_DATE
  LOOP
    -- تحويل التقييمات غير المكتملة (draft) إلى not_submitted
    UPDATE evaluations
    SET 
      status = 'not_submitted',
      updated_at = now()
    WHERE cycle_id = v_cycle.id
      AND status = 'draft';
    
    v_updated_evals := v_updated_evals + (SELECT COUNT(*) FROM evaluations WHERE cycle_id = v_cycle.id AND status = 'not_submitted');
    
    -- تعطيل الدورة
    UPDATE evaluation_cycles
    SET is_active = false, updated_at = now()
    WHERE id = v_cycle.id;
    
    v_closed_cycles := v_closed_cycles + 1;
    
    -- إضافة تفاصيل الدورة
    v_details := v_details || jsonb_build_object(
      'cycle_id', v_cycle.id,
      'cycle_name', v_cycle.name,
      'end_date', v_cycle.end_date
    );
  END LOOP;
  
  RETURN QUERY SELECT v_closed_cycles, v_updated_evals, v_details;
END;
$$;

-- 4. إنشاء دالة للتحقق مما إذا كانت الدورة لا تزال مفتوحة للتقييم
CREATE OR REPLACE FUNCTION public.is_cycle_open_for_evaluation(p_cycle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM evaluation_cycles
    WHERE id = p_cycle_id
      AND is_active = true
      AND end_date >= CURRENT_DATE
  );
$$;

-- 5. تحديث دالة إرسال التقييم للتحقق من صلاحية الدورة
CREATE OR REPLACE FUNCTION public.submit_evaluation_with_score(p_evaluation_id uuid)
RETURNS evaluations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluation evaluations%ROWTYPE;
  v_total_score numeric;
  v_user_id uuid;
  v_cycle_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Get the evaluation
  SELECT * INTO v_evaluation FROM evaluations WHERE id = p_evaluation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'لم يتم العثور على التقييم';
  END IF;
  
  -- Get cycle_id
  v_cycle_id := v_evaluation.cycle_id;
  
  -- Check if cycle is still open for evaluation
  IF NOT is_cycle_open_for_evaluation(v_cycle_id) THEN
    RAISE EXCEPTION 'انتهت فترة هذه الدورة ولا يمكن إرسال التقييم';
  END IF;
  
  -- Check if user can submit (evaluator and status is draft)
  IF v_evaluation.evaluator_id != v_user_id THEN
    RAISE EXCEPTION 'يمكن فقط للمقيّم إرسال هذا التقييم';
  END IF;
  
  IF v_evaluation.status != 'draft' THEN
    RAISE EXCEPTION 'يمكن فقط إرسال التقييمات في حالة المسودة';
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