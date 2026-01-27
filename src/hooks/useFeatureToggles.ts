import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface FeatureToggle {
  id: string;
  tenant_id: string | null;
  feature_key: string;
  feature_name: string;
  feature_name_en: string | null;
  description: string | null;
  is_enabled: boolean;
  min_role: string;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useFeatureToggles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const togglesQuery = useQuery({
    queryKey: ['feature-toggles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_toggles')
        .select('*')
        .order('feature_name');

      if (error) throw error;
      return data as FeatureToggle[];
    },
  });

  const updateToggle = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('feature_toggles')
        .update({ is_enabled, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-toggles'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث حالة الميزة' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  return {
    toggles: togglesQuery.data || [],
    isLoading: togglesQuery.isLoading,
    error: togglesQuery.error,
    updateToggle,
  };
}

export function useIsFeatureEnabled(featureKey: string): boolean {
  const { data } = useQuery({
    queryKey: ['feature-enabled', featureKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_toggles')
        .select('is_enabled')
        .eq('feature_key', featureKey)
        .maybeSingle();

      if (error) throw error;
      return data?.is_enabled ?? false;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  return data ?? false;
}
