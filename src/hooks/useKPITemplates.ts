import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type EvaluationPeriodType = 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
export type QuestionAnswerType = 'numeric' | 'choice' | 'text';

export interface KPITemplate {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  period_type: EvaluationPeriodType;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KPITemplateAxis {
  id: string;
  template_id: string;
  name: string;
  name_en: string | null;
  weight: number;
  sort_order: number;
  created_at: string;
}

export interface KPITemplateQuestion {
  id: string;
  axis_id: string;
  question_text: string;
  question_text_en: string | null;
  answer_type: QuestionAnswerType;
  choices: string[] | null;
  min_value: number | null;
  max_value: number | null;
  weight: number;
  sort_order: number;
  created_at: string;
}

export const useKPITemplates = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // جلب القوالب
  const templatesQuery = useQuery({
    queryKey: ['kpi-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as KPITemplate[];
    },
  });

  // جلب المحاور
  const axesQuery = useQuery({
    queryKey: ['kpi-template-axes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_template_axes')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as KPITemplateAxis[];
    },
  });

  // جلب الأسئلة
  const questionsQuery = useQuery({
    queryKey: ['kpi-template-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_template_questions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as KPITemplateQuestion[];
    },
  });

  // إنشاء قالب
  const createTemplate = useMutation({
    mutationFn: async (template: {
      name: string;
      name_en?: string;
      description?: string;
      description_en?: string;
      period_type: EvaluationPeriodType;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('kpi_templates')
        .insert({
          ...template,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-templates'] });
      toast({ title: 'تم إنشاء القالب بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تحديث قالب
  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...template }: Partial<KPITemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('kpi_templates')
        .update(template)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-templates'] });
      toast({ title: 'تم تحديث القالب بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // التحقق من استخدام القالب قبل الحذف
  const checkTemplateUsage = async (templateId: string): Promise<{ cycleCount: number; cycleNames: string[] }> => {
    const { data, error } = await supabase.rpc('check_template_usage', { p_template_id: templateId });
    if (error) throw error;
    const result = data?.[0] || { cycle_count: 0, cycle_names: [] };
    return { cycleCount: result.cycle_count, cycleNames: result.cycle_names || [] };
  };

  // حذف قالب (مع التحقق من الاستخدام)
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      // التحقق من الاستخدام أولاً
      const usage = await checkTemplateUsage(id);
      if (usage.cycleCount > 0) {
        throw new Error(`لا يمكن حذف هذا القالب لأنه مستخدم في ${usage.cycleCount} دورة/دورات تقييم. فضلاً قم بإنهاء أو تعديل الدورات المرتبطة به قبل الحذف، أو استخدم خيار "تعطيل القالب" بدلاً من الحذف.`);
      }

      const { error } = await supabase
        .from('kpi_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-templates'] });
      toast({ title: 'تم حذف القالب' });
    },
    onError: (error: Error) => {
      toast({ title: 'لا يمكن حذف القالب', description: error.message, variant: 'destructive' });
    },
  });

  // تعطيل / تفعيل قالب
  const toggleTemplateActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('kpi_templates')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kpi-templates'] });
      toast({ title: data.is_active ? 'تم تفعيل القالب' : 'تم تعطيل القالب (أرشفة)' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // إنشاء محور
  const createAxis = useMutation({
    mutationFn: async (axis: {
      template_id: string;
      name: string;
      name_en?: string;
      weight: number;
      sort_order: number;
    }) => {
      const { data, error } = await supabase
        .from('kpi_template_axes')
        .insert(axis)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-template-axes'] });
      toast({ title: 'تم إنشاء المحور بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تحديث محور
  const updateAxis = useMutation({
    mutationFn: async ({ id, ...axis }: Partial<KPITemplateAxis> & { id: string }) => {
      const { data, error } = await supabase
        .from('kpi_template_axes')
        .update(axis)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-template-axes'] });
      toast({ title: 'تم تحديث المحور بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // حذف محور
  const deleteAxis = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kpi_template_axes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-template-axes'] });
      toast({ title: 'تم حذف المحور' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // إنشاء سؤال
  const createQuestion = useMutation({
    mutationFn: async (question: {
      axis_id: string;
      question_text: string;
      question_text_en?: string;
      answer_type: QuestionAnswerType;
      choices?: string[];
      min_value?: number;
      max_value?: number;
      weight: number;
      sort_order: number;
    }) => {
      const { data, error } = await supabase
        .from('kpi_template_questions')
        .insert(question)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-template-questions'] });
      toast({ title: 'تم إنشاء السؤال بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تحديث سؤال
  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...question }: Partial<KPITemplateQuestion> & { id: string }) => {
      const { data, error } = await supabase
        .from('kpi_template_questions')
        .update(question)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-template-questions'] });
      toast({ title: 'تم تحديث السؤال بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // حذف سؤال
  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kpi_template_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-template-questions'] });
      toast({ title: 'تم حذف السؤال' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // جلب محاور قالب معين
  const getAxesByTemplate = (templateId: string) => {
    return axesQuery.data?.filter((a) => a.template_id === templateId) || [];
  };

  // جلب أسئلة محور معين
  const getQuestionsByAxis = (axisId: string) => {
    return questionsQuery.data?.filter((q) => q.axis_id === axisId) || [];
  };

  return {
    templates: templatesQuery.data || [],
    axes: axesQuery.data || [],
    questions: questionsQuery.data || [],
    isLoading: templatesQuery.isLoading || axesQuery.isLoading || questionsQuery.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleTemplateActive,
    createAxis,
    updateAxis,
    deleteAxis,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    getAxesByTemplate,
    getQuestionsByAxis,
    refetch: () => {
      templatesQuery.refetch();
      axesQuery.refetch();
      questionsQuery.refetch();
    },
  };
};
