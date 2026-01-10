import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type EvaluationType = 
  | 'supervisor_to_employee' 
  | 'manager_to_supervisor' 
  | 'admin_to_manager' 
  | 'self_assessment' 
  | 'peer_360'
  | 'self'
  | 'employee_to_supervisor'
  | 'supervisor_to_manager';

export type EvaluationStatus = 'draft' | 'submitted' | 'approved' | 'published';

export interface EvaluationCycle {
  id: string;
  template_id: string;
  name: string;
  name_en: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  allow_self_assessment: boolean;
  allow_360: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  cycle_id: string;
  evaluator_id: string;
  evaluatee_id: string;
  evaluation_type: EvaluationType;
  status: EvaluationStatus;
  total_score: number | null;
  is_proxy: boolean;
  proxy_by: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  current_revision: number | null;
  ai_summary: string | null;
  ai_risks: string | null;
  ai_recommendations: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationAnswer {
  id: string;
  evaluation_id: string;
  question_id: string;
  numeric_value: number | null;
  choice_value: string | null;
  text_value: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
}

// Labels for evaluation types in Arabic
export const evaluationTypeLabels: Record<EvaluationType, string> = {
  self_assessment: 'تقييم ذاتي',
  self: 'تقييم ذاتي',
  supervisor_to_employee: 'مشرف ← موظف',
  manager_to_supervisor: 'مدير ← مشرف',
  admin_to_manager: 'مدير نظام ← مدير',
  employee_to_supervisor: 'موظف ← مشرف (تقييم صاعد)',
  supervisor_to_manager: 'مشرف ← مدير (تقييم صاعد)',
  peer_360: 'تقييم 360',
};

// Labels for status in Arabic
export const statusLabels: Record<EvaluationStatus | string, string> = {
  draft: 'مسودة',
  submitted: 'تم الإرسال',
  approved: 'معتمد',
  published: 'منشور',
  // Legacy statuses for backward compatibility
  in_progress: 'قيد التنفيذ',
  reviewed: 'تمت المراجعة',
  completed: 'مكتمل',
};

// Colors for status badges
export const statusColors: Record<EvaluationStatus | string, string> = {
  draft: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  submitted: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  published: 'bg-green-500/10 text-green-600 border-green-500/20',
  // Legacy
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-600 border-green-500/20',
};

export const useEvaluations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // جلب دورات التقييم
  const cyclesQuery = useQuery({
    queryKey: ['evaluation-cycles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_cycles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EvaluationCycle[];
    },
  });

  // جلب التقييمات
  const evaluationsQuery = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Evaluation[];
    },
  });

  // جلب الإجابات
  const answersQuery = useQuery({
    queryKey: ['evaluation-answers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_answers')
        .select('*');

      if (error) throw error;
      return data as EvaluationAnswer[];
    },
  });

  // إنشاء دورة تقييم
  const createCycle = useMutation({
    mutationFn: async (cycle: {
      template_id: string;
      name: string;
      name_en?: string;
      start_date: string;
      end_date: string;
      allow_self_assessment?: boolean;
      allow_360?: boolean;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('evaluation_cycles')
        .insert({
          ...cycle,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-cycles'] });
      toast({ title: 'تم إنشاء دورة التقييم بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تحديث دورة تقييم
  const updateCycle = useMutation({
    mutationFn: async ({ id, ...cycle }: Partial<EvaluationCycle> & { id: string }) => {
      const { data, error } = await supabase
        .from('evaluation_cycles')
        .update(cycle)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-cycles'] });
      toast({ title: 'تم تحديث دورة التقييم بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // إنشاء تقييم (أو فتح موجود)
  const createEvaluation = useMutation({
    mutationFn: async (evaluation: {
      cycle_id: string;
      evaluatee_id: string;
      evaluation_type: EvaluationType;
      is_proxy?: boolean;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      // Check if evaluation already exists
      const { data: existing, error: checkError } = await supabase
        .from('evaluations')
        .select('*')
        .eq('cycle_id', evaluation.cycle_id)
        .eq('evaluator_id', user.id)
        .eq('evaluatee_id', evaluation.evaluatee_id)
        .eq('evaluation_type', evaluation.evaluation_type)
        .maybeSingle();

      if (checkError) throw checkError;

      // If exists and is draft, return it (resume)
      if (existing) {
        if (existing.status === 'draft') {
          return existing;
        } else {
          throw new Error('هذا التقييم قد تم إرساله بالفعل ولا يمكن إنشاء تقييم جديد');
        }
      }

      // Create new evaluation
      const { data, error } = await supabase
        .from('evaluations')
        .insert({
          ...evaluation,
          evaluator_id: user.id,
          proxy_by: evaluation.is_proxy ? user.id : null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('هذا التقييم موجود بالفعل');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تحديث تقييم
  const updateEvaluation = useMutation({
    mutationFn: async ({ id, ...evaluation }: Partial<Evaluation> & { id: string }) => {
      const { data, error } = await supabase
        .from('evaluations')
        .update(evaluation)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast({ title: 'تم تحديث التقييم بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // إرسال التقييم باستخدام الدالة المخصصة
  const submitEvaluation = useMutation({
    mutationFn: async (evaluationId: string) => {
      // Use the database function that calculates score and locks the evaluation
      const { data, error } = await supabase.rpc('submit_evaluation_with_score', {
        p_evaluation_id: evaluationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast({ title: 'تم إرسال التقييم بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // حفظ إجابة
  const saveAnswer = useMutation({
    mutationFn: async (answer: {
      evaluation_id: string;
      question_id: string;
      numeric_value?: number | null;
      choice_value?: string | null;
      text_value?: string | null;
      score?: number | null;
    }) => {
      const { data, error } = await supabase
        .from('evaluation_answers')
        .upsert(answer, { onConflict: 'evaluation_id,question_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-answers'] });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // توليد مهام التقييم 360
  const generate360Assignments = useMutation({
    mutationFn: async (cycleId: string) => {
      const { data, error } = await supabase.rpc('generate_360_assignments', {
        p_cycle_id: cycleId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      const result = data?.[0];
      toast({ 
        title: 'تم توليد مهام التقييم',
        description: `تم إنشاء ${result?.created_count || 0} مهمة جديدة، تخطي ${result?.skipped_count || 0} مهمة موجودة`
      });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // حساب الدرجة الإجمالية
  const calculateTotalScore = async (evaluationId: string) => {
    const answers = answersQuery.data?.filter((a) => a.evaluation_id === evaluationId) || [];
    if (answers.length === 0) return 0;

    const totalScore = answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const avgScore = totalScore / answers.length;

    await supabase
      .from('evaluations')
      .update({ total_score: avgScore })
      .eq('id', evaluationId);

    return avgScore;
  };

  // جلب تقييمات دورة معينة
  const getEvaluationsByCycle = (cycleId: string) => {
    return evaluationsQuery.data?.filter((e) => e.cycle_id === cycleId) || [];
  };

  // جلب إجابات تقييم معين
  const getAnswersByEvaluation = (evaluationId: string) => {
    return answersQuery.data?.filter((a) => a.evaluation_id === evaluationId) || [];
  };

  // جلب التقييمات المطلوبة مني (pending = draft)
  const getMyPendingEvaluations = () => {
    if (!user) return [];
    return evaluationsQuery.data?.filter(
      (e) => e.evaluator_id === user.id && e.status === 'draft'
    ) || [];
  };

  // جلب التقييمات التي أكملتها (submitted, approved, published)
  const getMyCompletedEvaluations = () => {
    if (!user) return [];
    return evaluationsQuery.data?.filter(
      (e) => e.evaluator_id === user.id && ['submitted', 'approved', 'published'].includes(e.status)
    ) || [];
  };

  return {
    cycles: cyclesQuery.data || [],
    evaluations: evaluationsQuery.data || [],
    answers: answersQuery.data || [],
    isLoading: cyclesQuery.isLoading || evaluationsQuery.isLoading,
    createCycle,
    updateCycle,
    createEvaluation,
    updateEvaluation,
    submitEvaluation,
    saveAnswer,
    generate360Assignments,
    calculateTotalScore,
    getEvaluationsByCycle,
    getAnswersByEvaluation,
    getMyPendingEvaluations,
    getMyCompletedEvaluations,
    refetch: () => {
      cyclesQuery.refetch();
      evaluationsQuery.refetch();
      answersQuery.refetch();
    },
  };
};
