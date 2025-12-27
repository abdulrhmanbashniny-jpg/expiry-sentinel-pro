import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TeamMember, Profile, UserRole, AppRole } from '@/types/database';

interface TeamMemberWithDetails extends TeamMember {
  supervisor_profile?: Profile;
  employee_profile?: Profile;
}

interface UserWithRole {
  profile: Profile;
  role: AppRole | null;
}

export function useTeamManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all users with their roles
  const usersQuery = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
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

  // Add team member
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

  const refetch = () => {
    usersQuery.refetch();
    teamMembersQuery.refetch();
  };

  return {
    users: usersQuery.data || [],
    teamMembers: teamMembersQuery.data || [],
    isLoading: usersQuery.isLoading || teamMembersQuery.isLoading,
    error: usersQuery.error || teamMembersQuery.error,
    updateRole,
    addTeamMember,
    removeTeamMember,
    refetch,
  };
}
