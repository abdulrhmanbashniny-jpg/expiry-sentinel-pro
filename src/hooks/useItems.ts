import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Item, ItemStatus } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface CreateItemData {
  title: string;
  category_id: string | null;
  expiry_date: string;
  expiry_time?: string;
  department_id: string; // Required - Data Quality Guard
  owner_department?: string;
  responsible_person?: string;
  notes?: string;
  attachment_url?: string;
  reminder_rule_id?: string;
  recipient_ids?: string[];
}

export const useItems = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const itemsQuery = useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          category:categories(*),
          reminder_rule:reminder_rules(*)
        `)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      return data as (Item & { category: any; reminder_rule: any })[];
    },
  });

  const createItem = useMutation({
    mutationFn: async (data: CreateItemData) => {
      // Data Quality Guard: Validate department_id
      if (!data.department_id) {
        throw new Error('يجب تحديد القسم المالك للمعاملة');
      }

      const { data: userData } = await supabase.auth.getUser();
      
      // Data Quality Guard: Check if user belongs to the department
      const { data: userScope } = await supabase
        .from('user_department_scopes')
        .select('id')
        .eq('user_id', userData.user?.id)
        .eq('department_id', data.department_id)
        .maybeSingle();
      
      // Check if user is admin (admins can create for any department)
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user?.id)
        .single();
      
      const isAdmin = userRole?.role === 'admin' || userRole?.role === 'system_admin';
      
      if (!userScope && !isAdmin) {
        console.warn('Data Quality Warning: User creating item for department they do not belong to', {
          user_id: userData.user?.id,
          department_id: data.department_id
        });
        // Log to item_status_log for audit
        await supabase.from('item_status_log').insert({
          item_id: '00000000-0000-0000-0000-000000000000', // Placeholder - will be updated
          old_status: null,
          new_status: 'new',
          reason: 'DATA_QUALITY_WARNING: User not linked to department',
          channel: 'web',
          metadata: { 
            user_id: userData.user?.id, 
            department_id: data.department_id,
            warning_type: 'department_mismatch'
          }
        });
      }
      
      const { data: item, error } = await supabase
        .from('items')
        .insert({
          title: data.title,
          category_id: data.category_id,
          expiry_date: data.expiry_date,
          expiry_time: data.expiry_time || '09:00',
          department_id: data.department_id,
          owner_department: data.owner_department || null,
          responsible_person: data.responsible_person || null,
          notes: data.notes || null,
          attachment_url: data.attachment_url || null,
          reminder_rule_id: data.reminder_rule_id || null,
          created_by_user_id: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add recipients if provided
      if (data.recipient_ids && data.recipient_ids.length > 0) {
        const recipientLinks = data.recipient_ids.map((recipientId) => ({
          item_id: item.id,
          recipient_id: recipientId,
        }));

        const { error: recipientError } = await supabase
          .from('item_recipients')
          .insert(recipientLinks);

        if (recipientError) throw recipientError;
      }

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({ title: 'تم إضافة العنصر بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في إضافة العنصر',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Item> & { id: string; recipient_ids?: string[] }) => {
      // Remove recipient_ids from data before update
      const { recipient_ids, ...updateData } = data as any;
      
      const { data: item, error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({ title: 'تم تحديث العنصر بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في تحديث العنصر',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({ title: 'تم حذف العنصر بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في حذف العنصر',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    items: itemsQuery.data ?? [],
    isLoading: itemsQuery.isLoading,
    error: itemsQuery.error,
    createItem,
    updateItem,
    deleteItem,
  };
};

export const useExpiringItems = () => {
  return useQuery({
    queryKey: ['expiring-items'],
    queryFn: async () => {
      const today = new Date();
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);
      const in14Days = new Date(today);
      in14Days.setDate(in14Days.getDate() + 14);
      const in30Days = new Date(today);
      in30Days.setDate(in30Days.getDate() + 30);

      const { data, error } = await supabase
        .from('items')
        .select(`*, category:categories(*)`)
        .eq('status', 'active')
        .lte('expiry_date', in30Days.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      const expired = data.filter((item) => new Date(item.expiry_date) < today);
      const expiring7 = data.filter((item) => {
        const date = new Date(item.expiry_date);
        return date >= today && date <= in7Days;
      });
      const expiring14 = data.filter((item) => {
        const date = new Date(item.expiry_date);
        return date > in7Days && date <= in14Days;
      });
      const expiring30 = data.filter((item) => {
        const date = new Date(item.expiry_date);
        return date > in14Days && date <= in30Days;
      });

      return {
        expired,
        expiring7,
        expiring14,
        expiring30,
        all: data,
      };
    },
  });
};
