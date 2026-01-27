import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export interface ReminderItem {
  id: string;
  entity_type: 'item' | 'contract';
  entity_id: string;
  title: string;
  ref_number: string | null;
  due_date: string;
  days_left: number;
  status: string;
  workflow_status?: string;
  department_name: string | null;
  category_name: string | null;
  responsible_person: string | null;
  reminder_rule_name: string | null;
  last_notification_status: string | null;
  last_notification_channel: string | null;
  last_notification_at: string | null;
}

export function useUnifiedReminders(filters?: {
  entityType?: string;
  daysRange?: [number, number];
  departmentId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['unified-reminders', filters],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const results: ReminderItem[] = [];

      // 1. Fetch Items with upcoming expiry
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(`
          id, title, ref_number, expiry_date, status, workflow_status,
          responsible_person,
          department:departments(name),
          category:categories(name),
          reminder_rule:reminder_rules(name)
        `)
        .eq('status', 'active')
        .neq('workflow_status', 'finished')
        .order('expiry_date', { ascending: true });

      if (itemsError) throw itemsError;

      for (const item of items || []) {
        const daysLeft = differenceInDays(new Date(item.expiry_date), today);
        
        // Apply filters
        if (filters?.daysRange) {
          const [min, max] = filters.daysRange;
          if (daysLeft < min || daysLeft > max) continue;
        }

        // Get last notification
        const { data: lastNotification } = await supabase
          .from('notification_log')
          .select('status, channel, sent_at')
          .eq('item_id', item.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        results.push({
          id: `item-${item.id}`,
          entity_type: 'item',
          entity_id: item.id,
          title: item.title,
          ref_number: item.ref_number,
          due_date: item.expiry_date,
          days_left: daysLeft,
          status: item.status,
          workflow_status: item.workflow_status,
          department_name: (item.department as any)?.name || null,
          category_name: (item.category as any)?.name || null,
          responsible_person: item.responsible_person,
          reminder_rule_name: (item.reminder_rule as any)?.name || null,
          last_notification_status: lastNotification?.status || null,
          last_notification_channel: lastNotification?.channel || null,
          last_notification_at: lastNotification?.sent_at || null,
        });
      }

      // 2. Fetch Contracts with upcoming end date
      if (!filters?.entityType || filters.entityType === 'contract') {
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select(`
            id, title, contract_number, end_date, status,
            party_name,
            department:departments(name)
          `)
          .eq('status', 'active')
          .order('end_date', { ascending: true });

        if (contractsError) throw contractsError;

        for (const contract of contracts || []) {
          const daysLeft = differenceInDays(new Date(contract.end_date), today);
          
          if (filters?.daysRange) {
            const [min, max] = filters.daysRange;
            if (daysLeft < min || daysLeft > max) continue;
          }

          results.push({
            id: `contract-${contract.id}`,
            entity_type: 'contract',
            entity_id: contract.id,
            title: contract.title,
            ref_number: contract.contract_number,
            due_date: contract.end_date,
            days_left: daysLeft,
            status: contract.status || 'active',
            department_name: (contract.department as any)?.name || null,
            category_name: null,
            responsible_person: contract.party_name,
            reminder_rule_name: null,
            last_notification_status: null,
            last_notification_channel: null,
            last_notification_at: null,
          });
        }
      }

      // Sort by days_left
      results.sort((a, b) => a.days_left - b.days_left);

      return results;
    },
  });
}

// Statistics hook
export function useReminderStats() {
  return useQuery({
    queryKey: ['reminder-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get items stats
      const { data: items } = await supabase
        .from('items')
        .select('id, expiry_date')
        .eq('status', 'active')
        .neq('workflow_status', 'finished');

      const itemStats = {
        expired: 0,
        within7Days: 0,
        within30Days: 0,
        within90Days: 0,
      };

      for (const item of items || []) {
        const daysLeft = differenceInDays(new Date(item.expiry_date), today);
        if (daysLeft < 0) itemStats.expired++;
        else if (daysLeft <= 7) itemStats.within7Days++;
        else if (daysLeft <= 30) itemStats.within30Days++;
        else if (daysLeft <= 90) itemStats.within90Days++;
      }

      // Get contracts stats
      const { data: contracts } = await supabase
        .from('contracts')
        .select('id, end_date')
        .eq('status', 'active');

      const contractStats = {
        expired: 0,
        within7Days: 0,
        within30Days: 0,
        within90Days: 0,
      };

      for (const contract of contracts || []) {
        const daysLeft = differenceInDays(new Date(contract.end_date), today);
        if (daysLeft < 0) contractStats.expired++;
        else if (daysLeft <= 7) contractStats.within7Days++;
        else if (daysLeft <= 30) contractStats.within30Days++;
        else if (daysLeft <= 90) contractStats.within90Days++;
      }

      // Get notification stats for today
      const todayStr = today.toISOString().split('T')[0];
      const { data: notifications } = await supabase
        .from('notification_log')
        .select('status, channel')
        .gte('created_at', todayStr);

      const notificationStats = {
        sent: notifications?.filter(n => n.status === 'sent').length || 0,
        failed: notifications?.filter(n => n.status === 'failed').length || 0,
        whatsapp: notifications?.filter(n => n.channel === 'whatsapp' && n.status === 'sent').length || 0,
        telegram: notifications?.filter(n => n.channel === 'telegram' && n.status === 'sent').length || 0,
      };

      return {
        items: itemStats,
        contracts: contractStats,
        notifications: notificationStats,
        total: {
          expired: itemStats.expired + contractStats.expired,
          within7Days: itemStats.within7Days + contractStats.within7Days,
          within30Days: itemStats.within30Days + contractStats.within30Days,
          within90Days: itemStats.within90Days + contractStats.within90Days,
        },
      };
    },
  });
}
