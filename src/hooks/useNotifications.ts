import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NotificationLog } from '@/types/database';

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
      return data as (NotificationLog & { item: any; recipient: any })[];
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
      return data as (NotificationLog & { item: any; recipient: any })[];
    },
  });
};
