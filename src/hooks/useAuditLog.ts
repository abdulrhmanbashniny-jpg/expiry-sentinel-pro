import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export const AUDIT_ACTIONS = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  export: 'تصدير',
  import: 'استيراد',
  approve: 'موافقة',
  reject: 'رفض',
  assign: 'تعيين',
  status_change: 'تغيير حالة',
  password_change: 'تغيير كلمة مرور',
  settings_change: 'تغيير إعدادات',
};

export const ENTITY_TYPES = {
  item: 'معاملة',
  contract: 'عقد',
  ticket: 'تذكرة',
  service_request: 'طلب خدمة',
  user: 'مستخدم',
  department: 'قسم',
  category: 'فئة',
  recipient: 'مستلم',
  evaluation: 'تقييم',
  integration: 'تكامل',
  document: 'مستند',
};

export function useAuditLog(filters?: {
  entityType?: string;
  action?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.action) {
        query = query.eq('action', filters.action);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.fromDate) {
        query = query.gte('created_at', filters.fromDate);
      }
      if (filters?.toDate) {
        query = query.lte('created_at', filters.toDate);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });
}

export function useLogAudit() {
  return useMutation({
    mutationFn: async (entry: {
      action: string;
      entityType: string;
      entityId?: string;
      entityName?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      metadata?: Record<string, any>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('audit_log').insert({
        user_id: userData.user?.id,
        user_email: userData.user?.email,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        entity_name: entry.entityName,
        old_values: entry.oldValues,
        new_values: entry.newValues,
        metadata: entry.metadata || {},
      });

      if (error) throw error;
    },
  });
}
