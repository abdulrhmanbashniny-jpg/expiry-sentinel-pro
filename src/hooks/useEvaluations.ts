import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type EvaluationType = 'supervisor_to_employee' | 'manager_to_supervisor' | 'admin_to_manager' | 'self_assessment' | 'peer_360';
export type EvaluationStatus = 'draft' | 'in_progress' | 'submitted' | 'under_review' | 'reviewed' | 'approved' | 'published' | 'appealed' | 'completed' | 'closed';

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

  // إنشاء تقييم
  const createEvaluation = useMutation({
    mutationFn: async (evaluation: {
      cycle_id: string;
      evaluatee_id: string;
      evaluation_type: EvaluationType;
      is_proxy?: boolean;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('evaluations')
        .insert({
          ...evaluation,
          evaluator_id: user.id,
          proxy_by: evaluation.is_proxy ? user.id : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast({ title: 'تم إنشاء التقييم بنجاح' });
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

  // إرسال التقييم
  const submitEvaluation = useMutation({
    mutationFn: async (evaluationId: string) => {
      const { data, error } = await supabase
        .from('evaluations')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', evaluationId)
        .select()
        .single();

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
      numeric_value?: number;
      choice_value?: string;
      text_value?: string;
      score?: number;
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
    calculateTotalScore,
    getEvaluationsByCycle,
    getAnswersByEvaluation,
    refetch: () => {
      cyclesQuery.refetch();
      evaluationsQuery.refetch();
      answersQuery.refetch();
    },
  };
};
