import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type WorkflowStatus = 
  | 'new' 
  | 'acknowledged' 
  | 'in_progress' 
  | 'done_pending_supervisor' 
  | 'returned' 
  | 'escalated_to_manager' 
  | 'finished';

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  new: 'جديد',
  acknowledged: 'تم الاستلام',
  in_progress: 'قيد التنفيذ',
  done_pending_supervisor: 'بانتظار المشرف',
  returned: 'مُرجع',
  escalated_to_manager: 'مصعّد للمدير',
  finished: 'منتهي',
};

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  new: 'bg-muted text-muted-foreground',
  acknowledged: 'bg-primary/15 text-primary',
  in_progress: 'bg-warning/15 text-warning',
  done_pending_supervisor: 'bg-accent/15 text-accent',
  returned: 'bg-destructive/15 text-destructive',
  escalated_to_manager: 'bg-destructive/20 text-destructive',
  finished: 'bg-success/15 text-success',
};

interface DashboardFilters {
  departmentId?: string | null;
}

// Dashboard items by workflow status
export const useDashboardWorkflowStats = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ['dashboard-workflow-stats', filters.departmentId],
    queryFn: async () => {
      let query = supabase
        .from('items')
        .select('id, workflow_status, department_id');

      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats: Record<WorkflowStatus, number> = {
        new: 0,
        acknowledged: 0,
        in_progress: 0,
        done_pending_supervisor: 0,
        returned: 0,
        escalated_to_manager: 0,
        finished: 0,
      };

      data?.forEach((item) => {
        const status = item.workflow_status as WorkflowStatus;
        if (stats[status] !== undefined) {
          stats[status]++;
        }
      });

      return stats;
    },
  });
};

// Department performance stats
export const useDepartmentPerformance = () => {
  return useQuery({
    queryKey: ['department-performance'],
    queryFn: async () => {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, department_id, workflow_status, expiry_date, created_at');

      if (itemsError) throw itemsError;

      const { data: departments, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true);

      if (deptError) throw deptError;

      const deptStats = departments?.map((dept) => {
        const deptItems = items?.filter((i) => i.department_id === dept.id) || [];
        const finished = deptItems.filter((i) => i.workflow_status === 'finished').length;
        const total = deptItems.length;
        const delayed = deptItems.filter((i) => {
          const expiry = new Date(i.expiry_date);
          return expiry < new Date() && i.workflow_status !== 'finished';
        }).length;

        return {
          id: dept.id,
          name: dept.name,
          total,
          finished,
          delayed,
          completionRate: total > 0 ? Math.round((finished / total) * 100) : 0,
        };
      });

      return deptStats?.sort((a, b) => b.completionRate - a.completionRate) || [];
    },
  });
};

// Timeline: Latest status changes from item_status_log
export const useTimelineActivity = (filters: DashboardFilters = {}, limit = 20) => {
  return useQuery({
    queryKey: ['timeline-activity', filters.departmentId, limit],
    queryFn: async () => {
      // First get item IDs for the department filter
      let itemIds: string[] | null = null;
      
      if (filters.departmentId) {
        const { data: items } = await supabase
          .from('items')
          .select('id')
          .eq('department_id', filters.departmentId);
        itemIds = items?.map((i) => i.id) || [];
      }

      let query = supabase
        .from('item_status_log')
        .select(`
          id,
          item_id,
          old_status,
          new_status,
          reason,
          channel,
          changed_at,
          changed_by_user_id,
          metadata
        `)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (itemIds && itemIds.length > 0) {
        query = query.in('item_id', itemIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get item titles
      const uniqueItemIds = [...new Set(data?.map((d) => d.item_id) || [])];
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, title, ref_number')
        .in('id', uniqueItemIds);

      const itemsMap = new Map(itemsData?.map((i) => [i.id, i]) || []);

      return data?.map((log) => ({
        ...log,
        item: itemsMap.get(log.item_id),
      })) || [];
    },
  });
};

// Transition time stats
export const useTransitionTimeStats = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ['transition-time-stats', filters.departmentId],
    queryFn: async () => {
      let itemIds: string[] | null = null;
      
      if (filters.departmentId) {
        const { data: items } = await supabase
          .from('items')
          .select('id')
          .eq('department_id', filters.departmentId);
        itemIds = items?.map((i) => i.id) || [];
      }

      let query = supabase
        .from('item_status_log')
        .select('item_id, old_status, new_status, changed_at')
        .order('changed_at', { ascending: true });

      if (itemIds && itemIds.length > 0) {
        query = query.in('item_id', itemIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate average transition times
      const transitions: Record<string, number[]> = {
        'new_to_acknowledged': [],
        'acknowledged_to_in_progress': [],
        'in_progress_to_done': [],
        'done_to_finished': [],
      };

      // Group by item_id
      const itemLogs = new Map<string, typeof data>();
      data?.forEach((log) => {
        const logs = itemLogs.get(log.item_id) || [];
        logs.push(log);
        itemLogs.set(log.item_id, logs);
      });

      itemLogs.forEach((logs) => {
        for (let i = 1; i < logs.length; i++) {
          const prev = logs[i - 1];
          const curr = logs[i];
          const timeDiff = new Date(curr.changed_at).getTime() - new Date(prev.changed_at).getTime();
          const hours = timeDiff / (1000 * 60 * 60);

          if (prev.new_status === 'new' && curr.new_status === 'acknowledged') {
            transitions['new_to_acknowledged'].push(hours);
          } else if (prev.new_status === 'acknowledged' && curr.new_status === 'in_progress') {
            transitions['acknowledged_to_in_progress'].push(hours);
          } else if (prev.new_status === 'in_progress' && curr.new_status === 'done_pending_supervisor') {
            transitions['in_progress_to_done'].push(hours);
          } else if (prev.new_status === 'done_pending_supervisor' && curr.new_status === 'finished') {
            transitions['done_to_finished'].push(hours);
          }
        }
      });

      const avgTimes: Record<string, number | null> = {};
      Object.entries(transitions).forEach(([key, times]) => {
        avgTimes[key] = times.length > 0 
          ? Math.round(times.reduce((a, b) => a + b, 0) / times.length * 10) / 10 
          : null;
      });

      return avgTimes;
    },
  });
};

// Returns and escalations count
export const useReturnsAndEscalations = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ['returns-escalations', filters.departmentId],
    queryFn: async () => {
      let itemIds: string[] | null = null;
      
      if (filters.departmentId) {
        const { data: items } = await supabase
          .from('items')
          .select('id')
          .eq('department_id', filters.departmentId);
        itemIds = items?.map((i) => i.id) || [];
      }

      // Get last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('item_status_log')
        .select('new_status')
        .gte('changed_at', thirtyDaysAgo.toISOString());

      if (itemIds && itemIds.length > 0) {
        query = query.in('item_id', itemIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const returns = data?.filter((d) => d.new_status === 'returned').length || 0;
      const escalations = data?.filter((d) => d.new_status === 'escalated_to_manager').length || 0;

      return { returns, escalations };
    },
  });
};

// Recurring items stats
export const useRecurringItemsStats = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ['recurring-items-stats', filters.departmentId],
    queryFn: async () => {
      let query = supabase
        .from('items')
        .select('id, is_recurring, parent_item_id, title');

      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const recurring = data?.filter((i) => i.is_recurring).length || 0;
      const nonRecurring = data?.filter((i) => !i.is_recurring).length || 0;
      
      // Count items with children (most recurring parent items)
      const parentCounts = new Map<string, number>();
      data?.forEach((item) => {
        if (item.parent_item_id) {
          parentCounts.set(item.parent_item_id, (parentCounts.get(item.parent_item_id) || 0) + 1);
        }
      });

      const topRecurring = Array.from(parentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([parentId, count]) => {
          const parent = data?.find((i) => i.id === parentId);
          return { parentId, title: parent?.title || 'غير معروف', count };
        });

      return { recurring, nonRecurring, topRecurring };
    },
  });
};

// Data quality warnings
export const useDataQualityWarnings = () => {
  return useQuery({
    queryKey: ['data-quality-warnings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_status_log')
        .select(`
          id,
          item_id,
          reason,
          changed_at,
          metadata
        `)
        .eq('reason', 'DATA_QUALITY_WARNING: User not linked to department')
        .order('changed_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get item titles
      const itemIds = [...new Set(data?.map((d) => d.item_id) || [])];
      const { data: items } = await supabase
        .from('items')
        .select('id, title, ref_number')
        .in('id', itemIds.length > 0 ? itemIds : ['00000000-0000-0000-0000-000000000000']);

      const itemsMap = new Map(items?.map((i) => [i.id, i]) || []);

      return {
        count: data?.length || 0,
        warnings: data?.map((w) => ({
          ...w,
          item: itemsMap.get(w.item_id),
        })) || [],
      };
    },
  });
};

// Expiring items with department filter
export const useExpiringItemsWithDept = (filters: DashboardFilters = {}) => {
  return useQuery({
    queryKey: ['expiring-items-dept', filters.departmentId],
    queryFn: async () => {
      const today = new Date();
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);
      const in14Days = new Date(today);
      in14Days.setDate(in14Days.getDate() + 14);
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);

      let query = supabase
        .from('items')
        .select(`*, category:categories(*), department:departments(name)`)
        .eq('status', 'active')
        .lte('expiry_date', in30Days.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });

      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const expired = data?.filter((item) => new Date(item.expiry_date) < today) || [];
      const expiring7 = data?.filter((item) => {
        const date = new Date(item.expiry_date);
        return date >= today && date <= in7Days;
      }) || [];
      const expiring14 = data?.filter((item) => {
        const date = new Date(item.expiry_date);
        return date > in7Days && date <= in14Days;
      }) || [];
      const expiring30 = data?.filter((item) => {
        const date = new Date(item.expiry_date);
        return date > in14Days && date <= in30Days;
      }) || [];

      return {
        expired,
        expiring7,
        expiring14,
        expiring30,
        all: data || [],
      };
    },
  });
};
