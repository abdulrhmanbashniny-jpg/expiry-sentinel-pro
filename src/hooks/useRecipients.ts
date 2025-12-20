import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Recipient } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export const useRecipients = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const recipientsQuery = useQuery({
    queryKey: ['recipients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Recipient[];
    },
  });

  const createRecipient = useMutation({
    mutationFn: async (data: { name: string; whatsapp_number: string; is_active?: boolean }) => {
      const { data: recipient, error } = await supabase
        .from('recipients')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return recipient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      toast({ title: 'تم إضافة المستلم بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في إضافة المستلم',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateRecipient = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Recipient> & { id: string }) => {
      const { data: recipient, error } = await supabase
        .from('recipients')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return recipient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      toast({ title: 'تم تحديث المستلم بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في تحديث المستلم',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteRecipient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      toast({ title: 'تم حذف المستلم بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في حذف المستلم',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    recipients: recipientsQuery.data ?? [],
    isLoading: recipientsQuery.isLoading,
    error: recipientsQuery.error,
    createRecipient,
    updateRecipient,
    deleteRecipient,
  };
};
