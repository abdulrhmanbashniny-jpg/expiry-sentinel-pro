import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  manager_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tenant_id?: string | null;
}

export const useDepartments = () => {
  const { currentTenant, isPlatformAdmin } = useTenant();

  const departmentsQuery = useQuery({
    queryKey: ['departments', currentTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      // Apply tenant filter
      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id);
      } else if (!isPlatformAdmin) {
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Department[];
    },
    enabled: !!currentTenant || isPlatformAdmin,
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
