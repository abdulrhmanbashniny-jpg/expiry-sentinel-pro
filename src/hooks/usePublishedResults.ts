import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface PublishedResult {
  id: string;
  evaluation_id: string;
  evaluatee_id: string;
  cycle_id: string;
  final_score: number;
  ai_summary: string | null;
  published_by: string;
  published_at: string;
  revision_number: number;
}

export interface EvaluationRevision {
  id: string;
  evaluation_id: string;
  revision_number: number;
  original_score: number | null;
  revised_score: number | null;
  original_ai_summary: string | null;
  revised_ai_summary: string | null;
  changes_summary: string | null;
  reason: string;
  created_by: string;
  created_at: string;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
}

export interface EvaluationAppeal {
  id: string;
  published_result_id: string;
  evaluatee_id: string;
  appeal_text: string;
  status: 'pending' | 'accepted' | 'rejected';
  response_text: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  deadline: string;
}

export const usePublishedResults = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // جلب النتائج المنشورة (الموظف يرى نتائجه فقط)
  const publishedResultsQuery = useQuery({
    queryKey: ['published-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('published_results')
        .select('*')
        .order('published_at', { ascending: false });

      if (error) throw error;
      return data as PublishedResult[];
    },
  });

  // جلب المراجعات (System Admin فقط)
  const revisionsQuery = useQuery({
    queryKey: ['evaluation-revisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_revisions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EvaluationRevision[];
    },
  });

  // جلب الاعتراضات
  const appealsQuery = useQuery({
    queryKey: ['evaluation-appeals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_appeals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EvaluationAppeal[];
    },
  });

  // نشر نتيجة التقييم
  const publishResult = useMutation({
    mutationFn: async ({
      evaluation_id,
      evaluatee_id,
      cycle_id,
      final_score,
      ai_summary,
      revision_number = 1,
    }: {
      evaluation_id: string;
      evaluatee_id: string;
      cycle_id: string;
      final_score: number;
      ai_summary?: string | null;
      revision_number?: number;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      // إدراج النتيجة المنشورة
      const { error: publishError } = await supabase
        .from('published_results')
        .insert([{
          evaluation_id,
          evaluatee_id,
          cycle_id,
          final_score,
          ai_summary,
          published_by: user.id,
          revision_number,
        }]);

      if (publishError) throw publishError;

      // تحديث حالة التقييم
      const { error: updateError } = await supabase
        .from('evaluations')
        .update({
          status: 'published',
          published_by: user.id,
          published_at: new Date().toISOString(),
        })
        .eq('id', evaluation_id);

      if (updateError) throw updateError;

      // تسجيل في Audit Log
      await supabase.from('evaluation_audit_log').insert([{
        evaluation_id,
        action: 'published',
        old_status: 'approved',
        new_status: 'published',
        details: { final_score, revision_number },
        performed_by: user.id,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-results'] });
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast({ title: 'تم النشر', description: 'تم نشر نتيجة التقييم بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // إنشاء مراجعة جديدة
  const createRevision = useMutation({
    mutationFn: async ({
      evaluation_id,
      original_score,
      revised_score,
      original_ai_summary,
      revised_ai_summary,
      changes_summary,
      reason,
    }: {
      evaluation_id: string;
      original_score: number | null;
      revised_score: number | null;
      original_ai_summary?: string | null;
      revised_ai_summary?: string | null;
      changes_summary?: string | null;
      reason: string;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      // جلب آخر رقم مراجعة
      const { data: existing } = await supabase
        .from('evaluation_revisions')
        .select('revision_number')
        .eq('evaluation_id', evaluation_id)
        .order('revision_number', { ascending: false })
        .limit(1);

      const nextRevision = (existing?.[0]?.revision_number || 0) + 1;

      const { error } = await supabase
        .from('evaluation_revisions')
        .insert([{
          evaluation_id,
          revision_number: nextRevision,
          original_score,
          revised_score,
          original_ai_summary,
          revised_ai_summary,
          changes_summary,
          reason,
          created_by: user.id,
        }]);

      if (error) throw error;

      // تحديث التقييم الأصلي
      const updates: Record<string, unknown> = {
        current_revision: nextRevision,
      };
      if (revised_score !== null) updates.total_score = revised_score;
      if (revised_ai_summary) updates.ai_summary = revised_ai_summary;

      await supabase
        .from('evaluations')
        .update(updates)
        .eq('id', evaluation_id);

      // Audit log
      await supabase.from('evaluation_audit_log').insert([{
        evaluation_id,
        action: 'revision_created',
        details: { revision_number: nextRevision, reason, changes_summary },
        performed_by: user.id,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-revisions'] });
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast({ title: 'تم الحفظ', description: 'تم إنشاء مراجعة جديدة' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تقديم اعتراض
  const submitAppeal = useMutation({
    mutationFn: async ({
      published_result_id,
      appeal_text,
      appeal_window_days = 5,
    }: {
      published_result_id: string;
      appeal_text: string;
      appeal_window_days?: number;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + appeal_window_days);

      const { error } = await supabase
        .from('evaluation_appeals')
        .insert([{
          published_result_id,
          evaluatee_id: user.id,
          appeal_text,
          deadline: deadline.toISOString(),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-appeals'] });
      toast({ title: 'تم الإرسال', description: 'تم تقديم الاعتراض بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // الرد على اعتراض (System Admin)
  const respondToAppeal = useMutation({
    mutationFn: async ({
      appeal_id,
      status,
      response_text,
    }: {
      appeal_id: string;
      status: 'accepted' | 'rejected';
      response_text: string;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { error } = await supabase
        .from('evaluation_appeals')
        .update({
          status,
          response_text,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', appeal_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-appeals'] });
      toast({ title: 'تم الحفظ', description: 'تم الرد على الاعتراض' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // اعتماد التقييم (approve)
  const approveEvaluation = useMutation({
    mutationFn: async (evaluation_id: string) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { error } = await supabase
        .from('evaluations')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', evaluation_id);

      if (error) throw error;

      await supabase.from('evaluation_audit_log').insert([{
        evaluation_id,
        action: 'approved',
        old_status: 'under_review',
        new_status: 'approved',
        performed_by: user.id,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast({ title: 'تم الاعتماد', description: 'تم اعتماد التقييم' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  return {
    publishedResults: publishedResultsQuery.data || [],
    revisions: revisionsQuery.data || [],
    appeals: appealsQuery.data || [],
    isLoading: publishedResultsQuery.isLoading || revisionsQuery.isLoading || appealsQuery.isLoading,
    publishResult,
    createRevision,
    submitAppeal,
    respondToAppeal,
    approveEvaluation,
    refetch: () => {
      publishedResultsQuery.refetch();
      revisionsQuery.refetch();
      appealsQuery.refetch();
    },
  };
};
