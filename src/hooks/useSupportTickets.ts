import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  tenant_id: string | null;
  ticket_number: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  requester_id: string;
  assigned_to: string | null;
  department_id: string | null;
  sla_hours: number;
  sla_deadline: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  satisfaction_rating: number | null;
  satisfaction_comment: string | null;
  attachment_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  attachment_url: string | null;
  created_at: string;
}

export function useSupportTickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();

  const ticketsQuery = useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, department:departments(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (SupportTicket & { department: { name: string } | null })[];
    },
  });

  const createTicket = useMutation({
    mutationFn: async (ticket: Partial<SupportTicket>) => {
      const slaHours = ticket.priority === 'urgent' ? 4 :
                       ticket.priority === 'high' ? 24 :
                       ticket.priority === 'medium' ? 48 : 72;
      
      const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          title: ticket.title!,
          description: ticket.description,
          category: ticket.category!,
          priority: ticket.priority || 'medium',
          requester_id: user?.id!,
          department_id: ticket.department_id,
          sla_hours: slaHours,
          sla_deadline: slaDeadline,
          attachment_url: ticket.attachment_url,
          metadata: ticket.metadata || {},
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({ title: 'تم الإنشاء', description: 'تم إنشاء التذكرة بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const updateTicket = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportTicket> & { id: string }) => {
      const updateData: Record<string, any> = { ...updates };
      
      // تحديث الأوقات حسب الحالة
      if (updates.status === 'resolved' && !updates.resolved_at) {
        updateData.resolved_at = new Date().toISOString();
      }
      if (updates.status === 'closed' && !updates.closed_at) {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث التذكرة بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const addReply = useMutation({
    mutationFn: async ({ ticketId, message, isInternal }: { ticketId: string; message: string; isInternal?: boolean }) => {
      const { data, error } = await supabase
        .from('ticket_replies')
        .insert({
          ticket_id: ticketId,
          user_id: user?.id,
          message,
          is_internal: isInternal || false,
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث first_response_at إن كان هذا أول رد
      const ticket = ticketsQuery.data?.find(t => t.id === ticketId);
      if (ticket && !ticket.first_response_at && hasRole('admin')) {
        await supabase
          .from('support_tickets')
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', ticketId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-replies'] });
      toast({ title: 'تم الإرسال', description: 'تم إضافة الرد بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  // إحصائيات التذاكر
  const stats = {
    total: ticketsQuery.data?.length || 0,
    open: ticketsQuery.data?.filter(t => t.status === 'open').length || 0,
    inProgress: ticketsQuery.data?.filter(t => t.status === 'in_progress').length || 0,
    resolved: ticketsQuery.data?.filter(t => t.status === 'resolved').length || 0,
    breachedSLA: ticketsQuery.data?.filter(t => 
      t.sla_deadline && new Date(t.sla_deadline) < new Date() && 
      !['resolved', 'closed'].includes(t.status)
    ).length || 0,
  };

  return {
    tickets: ticketsQuery.data || [],
    isLoading: ticketsQuery.isLoading,
    error: ticketsQuery.error,
    stats,
    createTicket,
    updateTicket,
    addReply,
  };
}

export function useTicketReplies(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-replies', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      
      const { data, error } = await supabase
        .from('ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TicketReply[];
    },
    enabled: !!ticketId,
  });
}
