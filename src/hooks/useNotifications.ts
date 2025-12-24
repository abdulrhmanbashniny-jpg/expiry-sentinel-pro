import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NotificationWithRelations {
  id: string;
  item_id: string;
  recipient_id: string;
  reminder_day: number;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  provider_message_id: string | null;
  seen_at: string | null;
  seen_by_user_id: string | null;
  escalation_status: string | null;
  escalated_to_supervisor_at: string | null;
  escalated_to_admin_at: string | null;
  delay_reason: string | null;
  item: { title: string } | null;
  recipient: { name: string; whatsapp_number?: string } | null;
}

export const useNotifications = (itemId?: string) => {
  return useQuery({
    queryKey: ['notifications', itemId],
    queryFn: async () => {
      let query = supabase
        .from('notification_log')
        .select(`
          *,
          item:items(title),
          recipient:recipients(name, whatsapp_number)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as NotificationWithRelations[];
    },
  });
};

export const useRecentNotifications = () => {
  return useQuery({
    queryKey: ['recent-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_log')
        .select(`
          *,
          item:items(title),
          recipient:recipients(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as unknown as NotificationWithRelations[];
    },
  });
};
