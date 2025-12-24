import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Integration } from '@/types/database';

export function useIntegrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Integration[];
    },
  });

  const updateIntegration = useMutation({
    mutationFn: async ({ key, config, is_active }: { key: string; config?: Record<string, any>; is_active?: boolean }) => {
      const updateData: Record<string, any> = {};
      if (config !== undefined) updateData.config = config;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { error } = await supabase
        .from('integrations')
        .update(updateData)
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات التكامل بنجاح',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error.message,
      });
    },
  });

  const testIntegration = useMutation({
    mutationFn: async (key: string) => {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { integration_key: key },
      });
      
      if (error) throw error;
      
      // Update the test result in the database
      await supabase
        .from('integrations')
        .update({
          last_tested_at: new Date().toISOString(),
          test_result: data,
        })
        .eq('key', key);

      return data;
    },
    onSuccess: (data, key) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast({
        title: data.success ? 'نجح الاختبار' : 'فشل الاختبار',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'خطأ في الاختبار',
        description: error.message,
      });
    },
  });

  return {
    integrations: integrationsQuery.data || [],
    isLoading: integrationsQuery.isLoading,
    error: integrationsQuery.error,
    updateIntegration,
    testIntegration,
  };
}
