import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Contract {
  id: string;
  tenant_id: string | null;
  title: string;
  contract_number: string | null;
  contract_type: string;
  party_name: string;
  party_contact: string | null;
  start_date: string;
  end_date: string;
  renewal_type: string;
  renewal_period_months: number | null;
  value: number | null;
  currency: string;
  status: string;
  department_id: string | null;
  responsible_user_id: string | null;
  attachment_url: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useContracts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, department:departments(name)')
        .order('end_date', { ascending: true });

      if (error) throw error;
      return data as (Contract & { department: { name: string } | null })[];
    },
  });

  const createContract = useMutation({
    mutationFn: async (contract: Partial<Contract>) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          title: contract.title!,
          contract_type: contract.contract_type || 'employment',
          party_name: contract.party_name!,
          party_contact: contract.party_contact,
          start_date: contract.start_date!,
          end_date: contract.end_date!,
          renewal_type: contract.renewal_type || 'manual',
          renewal_period_months: contract.renewal_period_months || 12,
          value: contract.value,
          currency: contract.currency || 'SAR',
          status: contract.status || 'active',
          department_id: contract.department_id,
          responsible_user_id: contract.responsible_user_id,
          attachment_url: contract.attachment_url,
          notes: contract.notes,
          metadata: contract.metadata || {},
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'تم الإنشاء', description: 'تم إنشاء العقد بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contract> & { id: string }) => {
      const { error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث العقد بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'تم الحذف', description: 'تم حذف العقد بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  // حساب العقود المنتهية قريباً
  const expiringContracts = contractsQuery.data?.filter(c => {
    const daysToExpiry = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return c.status === 'active' && daysToExpiry <= 30 && daysToExpiry >= 0;
  }) || [];

  return {
    contracts: contractsQuery.data || [],
    isLoading: contractsQuery.isLoading,
    error: contractsQuery.error,
    expiringContracts,
    createContract,
    updateContract,
    deleteContract,
  };
}
