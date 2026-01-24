import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tenant, TenantIntegration, TenantUsageStats, TenantIntegrationConfig } from '@/types/tenant';

export function useTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all tenants (System Admin only)
  const tenantsQuery = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Tenant[];
    },
  });

  // Create new tenant
  const createTenant = useMutation({
    mutationFn: async (tenant: Partial<Tenant>) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert({
          name: tenant.name!,
          name_en: tenant.name_en,
          code: tenant.code?.toUpperCase()!,
          logo_url: tenant.logo_url,
          domain: tenant.domain,
          settings: tenant.settings || {},
          subscription_plan: tenant.subscription_plan || 'basic',
          max_users: tenant.max_users || 50,
          max_items: tenant.max_items || 1000,
          is_active: tenant.is_active ?? true,
          trial_ends_at: tenant.trial_ends_at,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: 'تم الإنشاء',
        description: 'تم إنشاء الشركة بنجاح',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error.message,
      });
    },
  });

  // Update tenant
  const updateTenant = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tenant> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.name_en !== undefined) updateData.name_en = updates.name_en;
      if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
      if (updates.domain !== undefined) updateData.domain = updates.domain;
      if (updates.settings !== undefined) updateData.settings = updates.settings;
      if (updates.subscription_plan !== undefined) updateData.subscription_plan = updates.subscription_plan;
      if (updates.max_users !== undefined) updateData.max_users = updates.max_users;
      if (updates.max_items !== undefined) updateData.max_items = updates.max_items;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      
      const { error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: 'تم التحديث',
        description: 'تم تحديث بيانات الشركة بنجاح',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error.message,
      });
    },
  });

  // Delete tenant
  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({
        title: 'تم الحذف',
        description: 'تم حذف الشركة بنجاح',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error.message,
      });
    },
  });

  return {
    tenants: tenantsQuery.data || [],
    isLoading: tenantsQuery.isLoading,
    error: tenantsQuery.error,
    createTenant,
    updateTenant,
    deleteTenant,
  };
}

export function useTenantIntegrations(tenantId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const integrationsQuery = useQuery({
    queryKey: ['tenant-integrations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      return data as TenantIntegration[];
    },
    enabled: !!tenantId,
  });

  const upsertIntegration = useMutation({
    mutationFn: async ({ 
      tenantId, 
      integrationKey, 
      config, 
      isActive 
    }: { 
      tenantId: string; 
      integrationKey: string; 
      config: TenantIntegrationConfig; 
      isActive: boolean;
    }) => {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .upsert({
          tenant_id: tenantId,
          integration_key: integrationKey,
          config: config as Record<string, any>,
          is_active: isActive,
        }, {
          onConflict: 'tenant_id,integration_key',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-integrations', tenantId] });
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات التكامل بنجاح',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'خطأ',
        description: error.message,
      });
    },
  });

  return {
    integrations: integrationsQuery.data || [],
    isLoading: integrationsQuery.isLoading,
    upsertIntegration,
  };
}

export function useTenantUsageStats(tenantId: string | null) {
  return useQuery({
    queryKey: ['tenant-usage-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      // Get current month stats
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('tenant_usage_stats')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle();
      
      if (error) throw error;
      return data as TenantUsageStats | null;
    },
    enabled: !!tenantId,
  });
}

export function useCurrentTenant() {
  return useQuery({
    queryKey: ['current-tenant'],
    queryFn: async () => {
      // Get current user's tenant_id from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) return null;

      // Get tenant details
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single();

      if (error) throw error;
      return tenant as Tenant;
    },
  });
}
