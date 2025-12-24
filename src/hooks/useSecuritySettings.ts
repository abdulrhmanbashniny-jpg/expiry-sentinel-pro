import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SecuritySettings, LoginHistory } from '@/types/database';

export function useSecuritySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['security-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('security_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as SecuritySettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<SecuritySettings>) => {
      const { error } = await supabase
        .from('security_settings')
        .update(settings)
        .eq('id', settingsQuery.data?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات الأمان بنجاح',
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

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings,
  };
}

export function useLoginHistory() {
  const loginHistoryQuery = useQuery({
    queryKey: ['login-history'],
    queryFn: async () => {
      // Fetch login history
      const { data: loginData, error: loginError } = await supabase
        .from('login_history')
        .select('*')
        .order('logged_in_at', { ascending: false })
        .limit(100);
      
      if (loginError) throw loginError;

      // Fetch profiles separately
      const userIds = [...new Set(loginData.map(l => l.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Merge data
      return loginData.map(login => ({
        ...login,
        profile: profiles?.find(p => p.user_id === login.user_id) || null,
      }));
    },
  });

  return {
    loginHistory: loginHistoryQuery.data || [],
    isLoading: loginHistoryQuery.isLoading,
    error: loginHistoryQuery.error,
  };
}
