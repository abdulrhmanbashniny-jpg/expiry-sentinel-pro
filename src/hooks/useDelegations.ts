import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type DelegationStatus = 'pending' | 'accepted' | 'rejected' | 'active' | 'completed' | 'cancelled';

export interface Delegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  status: DelegationStatus;
  from_datetime: string;
  to_datetime: string;
  reason: string | null;
  rejection_reason: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DelegationAuditLog {
  id: string;
  delegation_id: string;
  action: string;
  performed_by: string;
  details: Record<string, unknown>;
  created_at: string;
}

export const useDelegations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // جلب التوكيلات
  const delegationsQuery = useQuery({
    queryKey: ['delegations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delegations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Delegation[];
    },
  });

  // جلب سجل التدقيق
  const auditLogsQuery = useQuery({
    queryKey: ['delegation-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delegation_audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DelegationAuditLog[];
    },
  });

  // إنشاء توكيل جديد
  const createDelegation = useMutation({
    mutationFn: async (delegation: {
      delegate_id: string;
      from_datetime: string;
      to_datetime: string;
      reason?: string;
    }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('delegations')
        .insert({
          delegator_id: user.id,
          delegate_id: delegation.delegate_id,
          from_datetime: delegation.from_datetime,
          to_datetime: delegation.to_datetime,
          reason: delegation.reason || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // تسجيل في سجل التدقيق
      await supabase.from('delegation_audit_log').insert({
        delegation_id: data.id,
        action: 'created',
        performed_by: user.id,
        details: { delegate_id: delegation.delegate_id },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      queryClient.invalidateQueries({ queryKey: ['delegation-audit-logs'] });
      toast({ title: 'تم إنشاء طلب التوكيل بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // قبول التوكيل
  const acceptDelegation = useMutation({
    mutationFn: async (delegationId: string) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('delegations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', delegationId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('delegation_audit_log').insert({
        delegation_id: delegationId,
        action: 'accepted',
        performed_by: user.id,
        details: {},
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      queryClient.invalidateQueries({ queryKey: ['delegation-audit-logs'] });
      toast({ title: 'تم قبول التوكيل بنجاح' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // رفض التوكيل
  const rejectDelegation = useMutation({
    mutationFn: async ({ delegationId, reason }: { delegationId: string; reason: string }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('delegations')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', delegationId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('delegation_audit_log').insert({
        delegation_id: delegationId,
        action: 'rejected',
        performed_by: user.id,
        details: { reason },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      queryClient.invalidateQueries({ queryKey: ['delegation-audit-logs'] });
      toast({ title: 'تم رفض التوكيل' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // إلغاء التوكيل
  const cancelDelegation = useMutation({
    mutationFn: async (delegationId: string) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const { data, error } = await supabase
        .from('delegations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
        })
        .eq('id', delegationId)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('delegation_audit_log').insert({
        delegation_id: delegationId,
        action: 'cancelled',
        performed_by: user.id,
        details: {},
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      queryClient.invalidateQueries({ queryKey: ['delegation-audit-logs'] });
      toast({ title: 'تم إلغاء التوكيل' });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // جلب التوكيل النشط للمستخدم (كبديل)
  const getActiveDelegationFor = (userId: string) => {
    const now = new Date().toISOString();
    return delegationsQuery.data?.find(
      (d) =>
        d.delegate_id === userId &&
        (d.status === 'active' || d.status === 'accepted') &&
        d.from_datetime <= now &&
        d.to_datetime >= now
    );
  };

  return {
    delegations: delegationsQuery.data || [],
    auditLogs: auditLogsQuery.data || [],
    isLoading: delegationsQuery.isLoading,
    createDelegation,
    acceptDelegation,
    rejectDelegation,
    cancelDelegation,
    getActiveDelegationFor,
    refetch: delegationsQuery.refetch,
  };
};
