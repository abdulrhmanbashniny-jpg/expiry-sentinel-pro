import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { TeamMember, Profile, AppRole } from '@/types/database';

interface UserWithRole {
  profile: Profile;
  role: AppRole | null;
}

interface DepartmentScope {
  id: string;
  user_id: string;
  department_id: string;
  scope_type: string;
  can_cross_view_only: boolean;
  created_at: string;
}

export function useTeamManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentTenant, isPlatformAdmin } = useTenant();

  // Get all users with their roles - with tenant filtering
  const usersQuery = useQuery({
    queryKey: ['users-with-roles', currentTenant?.id],
    queryFn: async () => {
      let profilesQuery = supabase
        .from('profiles')
        .select('*')
        .neq('account_status', 'deleted')
        .order('full_name');
      
      // Apply tenant filter for non-platform admins or when a tenant is selected
      if (currentTenant?.id) {
        profilesQuery = profilesQuery.eq('tenant_id', currentTenant.id);
      } else if (!isPlatformAdmin) {
        // Regular users without tenant context shouldn't see any data
        return [];
      }
      
      const { data: profiles, error: profilesError } = await profilesQuery;
      
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      return profiles.map(profile => ({
        profile,
        role: roles.find(r => r.user_id === profile.user_id)?.role as AppRole || null,
      })) as UserWithRole[];
    },
    enabled: !!currentTenant || isPlatformAdmin,
  });

  // Get all team members
  const teamMembersQuery = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at');
      
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Get all departments
  const departmentsQuery = useQuery({
    queryKey: ['departments-management'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Get user department scopes
  const departmentScopesQuery = useQuery({
    queryKey: ['department-scopes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_department_scopes')
        .select('*')
        .order('created_at');
      
      if (error) throw error;
      return data as DepartmentScope[];
    },
  });

  // Update user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث دور المستخدم بنجاح',
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

  // Add team member (supervisor can be admin/supervisor, employee can be any lower role)
  const addTeamMember = useMutation({
    mutationFn: async ({ supervisorId, employeeId }: { supervisorId: string; employeeId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .insert({ supervisor_id: supervisorId, employee_id: employeeId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({
        title: 'تمت الإضافة',
        description: 'تم إضافة العضو للفريق بنجاح',
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

  // Remove team member
  const removeTeamMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({
        title: 'تم الحذف',
        description: 'تم إزالة العضو من الفريق',
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

  // Update department manager
  const updateDepartmentManager = useMutation({
    mutationFn: async ({ departmentId, managerId }: { departmentId: string; managerId: string | null }) => {
      const { error } = await supabase
        .from('departments')
        .update({ manager_user_id: managerId })
        .eq('id', departmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments-management'] });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث مدير القسم بنجاح',
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

  // Add user to department
  const addUserToDepartment = useMutation({
    mutationFn: async ({ 
      userId, 
      departmentId, 
      scopeType = 'primary' 
    }: { 
      userId: string; 
      departmentId: string; 
      scopeType?: string 
    }) => {
      const { error } = await supabase
        .from('user_department_scopes')
        .insert({ user_id: userId, department_id: departmentId, scope_type: scopeType });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-scopes'] });
      toast({
        title: 'تمت الإضافة',
        description: 'تم إضافة المستخدم للقسم بنجاح',
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

  // Remove user from department
  const removeUserFromDepartment = useMutation({
    mutationFn: async (scopeId: string) => {
      const { error } = await supabase
        .from('user_department_scopes')
        .delete()
        .eq('id', scopeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-scopes'] });
      toast({
        title: 'تم الحذف',
        description: 'تم إزالة المستخدم من القسم',
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

  const refetch = () => {
    usersQuery.refetch();
    teamMembersQuery.refetch();
    departmentsQuery.refetch();
    departmentScopesQuery.refetch();
  };

  return {
    users: usersQuery.data || [],
    teamMembers: teamMembersQuery.data || [],
    departments: departmentsQuery.data || [],
    departmentScopes: departmentScopesQuery.data || [],
    isLoading: usersQuery.isLoading || teamMembersQuery.isLoading || departmentsQuery.isLoading || departmentScopesQuery.isLoading,
    error: usersQuery.error || teamMembersQuery.error || departmentsQuery.error || departmentScopesQuery.error,
    updateRole,
    addTeamMember,
    removeTeamMember,
    updateDepartmentManager,
    addUserToDepartment,
    removeUserFromDepartment,
    refetch,
  };
}
