import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  manager_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useDepartments = () => {
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Department[];
    },
  });

  return {
    departments: departmentsQuery.data ?? [],
    isLoading: departmentsQuery.isLoading,
    error: departmentsQuery.error,
  };
};

export const useUserDepartments = () => {
  return useQuery({
    queryKey: ['user-departments'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from('user_department_scopes')
        .select('department_id, scope_type, can_cross_view_only, department:departments(*)')
        .eq('user_id', userData.user.id);

      if (error) throw error;
      return data;
    },
  });
};
