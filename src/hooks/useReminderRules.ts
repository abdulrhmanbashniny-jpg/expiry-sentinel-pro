import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReminderRule } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export const useReminderRules = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rulesQuery = useQuery({
    queryKey: ['reminder-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_rules')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ReminderRule[];
    },
  });

  const createRule = useMutation({
    mutationFn: async (data: { name: string; days_before: number[]; is_active?: boolean }) => {
      const { data: rule, error } = await supabase
        .from('reminder_rules')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-rules'] });
      toast({ title: 'تم إضافة القاعدة بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في إضافة القاعدة',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ReminderRule> & { id: string }) => {
      const { data: rule, error } = await supabase
        .from('reminder_rules')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-rules'] });
      toast({ title: 'تم تحديث القاعدة بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في تحديث القاعدة',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminder_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-rules'] });
      toast({ title: 'تم حذف القاعدة بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في حذف القاعدة',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    rules: rulesQuery.data ?? [],
    isLoading: rulesQuery.isLoading,
    error: rulesQuery.error,
    createRule,
    updateRule,
    deleteRule,
  };
};
