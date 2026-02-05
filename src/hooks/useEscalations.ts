import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

export interface EscalationLog {
  id: string;
  tenant_id: string;
  notification_id: string | null;
  item_id: string;
  original_recipient_id: string;
  escalation_level: number;
  current_recipient_id: string;
  previous_recipient_id: string | null;
  status: 'pending' | 'acknowledged' | 'escalated' | 'resolved' | 'expired';
  sent_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  escalated_at: string | null;
  next_escalation_at: string | null;
  escalation_reason: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  item?: {
    title: string;
    ref_number: string | null;
  };
  original_recipient?: {
    full_name: string | null;
  };
  current_recipient?: {
    full_name: string | null;
  };
}

export interface EscalationRule {
  id: string;
  tenant_id: string | null;
  escalation_level: number;
  delay_hours: number;
  recipient_role: string;
  notification_channels: string[];
  message_template: string | null;
  is_active: boolean;
}

export interface OrganizationalHierarchy {
  id: string;
  tenant_id: string;
  employee_id: string;
  supervisor_id: string | null;
  manager_id: string | null;
  director_id: string | null;
  department_id: string | null;
}

const LEVEL_NAMES = ['الموظف', 'المشرف', 'المدير', 'المدير العام', 'الموارد البشرية'];

export const getLevelName = (level: number): string => LEVEL_NAMES[level] || `المستوى ${level}`;

export const useEscalations = (filters?: {
  status?: string;
  level?: number;
}) => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch escalation logs
  const escalationsQuery = useQuery({
    queryKey: ['escalations', currentTenant?.id, filters],
    queryFn: async () => {
      // Simple query without joins (handle joins manually)
      let query = supabase
        .from('escalation_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.level !== undefined && filters.level >= 0) {
        query = query.eq('escalation_level', filters.level);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      // Fetch related data
      const escalations = data || [];
      const itemIds = [...new Set(escalations.map(e => e.item_id).filter(Boolean))];
      const userIds = [...new Set([
        ...escalations.map(e => e.original_recipient_id),
        ...escalations.map(e => e.current_recipient_id),
      ].filter(Boolean))];

      // Fetch items
      const { data: items } = await supabase
        .from('items')
        .select('id, title, ref_number')
        .in('id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      // Map data
      const itemMap = new Map(items?.map(i => [i.id, i]) || []);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return escalations.map(e => ({
        ...e,
        item: itemMap.get(e.item_id),
        original_recipient: profileMap.get(e.original_recipient_id),
        current_recipient: profileMap.get(e.current_recipient_id),
      })) as EscalationLog[];
    },
    enabled: !!currentTenant,
  });

  // Fetch escalation rules
  const rulesQuery = useQuery({
    queryKey: ['escalation-rules', currentTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('escalation_rules')
        .select('*')
        .order('escalation_level', { ascending: true });

      // Get tenant-specific or global rules
      if (currentTenant?.id) {
        query = query.or(`tenant_id.eq.${currentTenant.id},tenant_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EscalationRule[];
    },
    enabled: !!currentTenant,
  });

  // Fetch organizational hierarchy
  const hierarchyQuery = useQuery({
    queryKey: ['org-hierarchy', currentTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('organizational_hierarchy')
        .select('*');

      if (currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OrganizationalHierarchy[];
    },
    enabled: !!currentTenant,
  });

  // Acknowledge escalation
  const acknowledgeEscalation = useMutation({
    mutationFn: async (escalationId: string) => {
      const { data, error } = await supabase.rpc('acknowledge_escalation', {
        p_escalation_id: escalationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      toast({
        title: 'تم الاستلام',
        description: 'تم تسجيل استلامك للتصعيد بنجاح',
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

  // Resolve escalation
  const resolveEscalation = useMutation({
    mutationFn: async ({ escalationId, notes }: { escalationId: string; notes?: string }) => {
      const { data, error } = await supabase.rpc('resolve_escalation', {
        p_escalation_id: escalationId,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      toast({
        title: 'تم الحل',
        description: 'تم حل التصعيد بنجاح',
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

  // Update escalation rule
  const updateRule = useMutation({
    mutationFn: async ({ ruleId, updates }: { ruleId: string; updates: Partial<EscalationRule> }) => {
      const { error } = await supabase
        .from('escalation_rules')
        .update(updates)
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-rules'] });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث قاعدة التصعيد بنجاح',
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

  // Add/Update organizational hierarchy
  const updateHierarchy = useMutation({
    mutationFn: async (hierarchy: Omit<OrganizationalHierarchy, 'id'>) => {
      const { error } = await supabase
        .from('organizational_hierarchy')
        .upsert(hierarchy, { onConflict: 'tenant_id,employee_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-hierarchy'] });
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ الهرمية الوظيفية بنجاح',
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

  // Get statistics
  const stats = {
    total: escalationsQuery.data?.length || 0,
    pending: escalationsQuery.data?.filter(e => e.status === 'pending').length || 0,
    acknowledged: escalationsQuery.data?.filter(e => e.status === 'acknowledged').length || 0,
    escalated: escalationsQuery.data?.filter(e => e.status === 'escalated').length || 0,
    resolved: escalationsQuery.data?.filter(e => e.status === 'resolved').length || 0,
    expired: escalationsQuery.data?.filter(e => e.status === 'expired').length || 0,
    byLevel: LEVEL_NAMES.map((name, level) => ({
      level,
      name,
      count: escalationsQuery.data?.filter(e => e.escalation_level === level).length || 0,
    })),
  };

  return {
    escalations: escalationsQuery.data || [],
    rules: rulesQuery.data || [],
    hierarchy: hierarchyQuery.data || [],
    stats,
    isLoading: escalationsQuery.isLoading || rulesQuery.isLoading,
    error: escalationsQuery.error || rulesQuery.error,
    acknowledgeEscalation,
    resolveEscalation,
    updateRule,
    updateHierarchy,
    refetch: () => {
      escalationsQuery.refetch();
      rulesQuery.refetch();
      hierarchyQuery.refetch();
    },
  };
};
