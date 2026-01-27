import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type ServiceRequestStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';

export interface ServiceRequest {
  id: string;
  tenant_id: string | null;
  request_number: string | null;
  request_type: string;
  title: string;
  description: string | null;
  employee_id: string;
  status: ServiceRequestStatus;
  priority: string;
  approver_id: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  due_date: string | null;
  attachment_url: string | null;
  result_attachment_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const REQUEST_TYPES = [
  { value: 'vacation', label: 'طلب إجازة', icon: '🏖️' },
  { value: 'certificate', label: 'شهادة خبرة/تعريف', icon: '📄' },
  { value: 'letter', label: 'خطاب رسمي', icon: '✉️' },
  { value: 'advance', label: 'سلفة مالية', icon: '💰' },
  { value: 'training', label: 'طلب تدريب', icon: '📚' },
  { value: 'equipment', label: 'طلب معدات', icon: '💻' },
  { value: 'other', label: 'طلب آخر', icon: '📋' },
];

export function useServiceRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

  const requestsQuery = useQuery({
    queryKey: ['service-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ServiceRequest[];
    },
  });

  const createRequest = useMutation({
    mutationFn: async (request: Partial<ServiceRequest>) => {
      const { data, error } = await supabase
        .from('service_requests')
        .insert({
          request_type: request.request_type!,
          title: request.title!,
          description: request.description,
          employee_id: user?.id!,
          priority: request.priority || 'medium',
          due_date: request.due_date,
          attachment_url: request.attachment_url,
          metadata: request.metadata || {},
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      toast({ title: 'تم الإرسال', description: 'تم إرسال طلبك بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const approveRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'approved',
          approver_id: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      toast({ title: 'تمت الموافقة', description: 'تمت الموافقة على الطلب' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'rejected',
          approver_id: user?.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      toast({ title: 'تم الرفض', description: 'تم رفض الطلب' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const completeRequest = useMutation({
    mutationFn: async ({ id, resultUrl }: { id: string; resultUrl?: string }) => {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_attachment_url: resultUrl,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      toast({ title: 'تم الإنجاز', description: 'تم إنجاز الطلب بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  // الطلبات الخاصة بالمستخدم الحالي
  const myRequests = requestsQuery.data?.filter(r => r.employee_id === user?.id) || [];
  
  // الطلبات المعلقة للموافقة (للمدراء)
  const pendingApproval = hasRole('admin') || hasRole('supervisor')
    ? requestsQuery.data?.filter(r => r.status === 'pending') || []
    : [];

  return {
    requests: requestsQuery.data || [],
    myRequests,
    pendingApproval,
    isLoading: requestsQuery.isLoading,
    error: requestsQuery.error,
    createRequest,
    approveRequest,
    rejectRequest,
    completeRequest,
  };
}
