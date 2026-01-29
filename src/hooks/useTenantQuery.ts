import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Custom hook that automatically includes tenant filtering in queries.
 * This ensures data isolation between companies.
 */
export function useTenantQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: (tenantId: string | null) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>
) {
  const { currentTenant, isPlatformAdmin, isLoading: tenantLoading } = useTenant();
  
  // Include tenant in query key for proper caching
  const tenantAwareKey = [...(Array.isArray(queryKey) ? queryKey : [queryKey]), currentTenant?.id || 'all'];
  
  return useQuery({
    queryKey: tenantAwareKey,
    queryFn: () => queryFn(currentTenant?.id || null),
    enabled: !tenantLoading && (options?.enabled !== false),
    ...options,
  });
}

/**
 * Helper to build tenant-filtered supabase queries
 */
export function withTenantFilter<T extends { tenant_id?: string | null }>(
  query: any,
  tenantId: string | null,
  isPlatformAdmin: boolean = false
) {
  // System admins viewing all tenants don't need filtering
  if (isPlatformAdmin && !tenantId) {
    return query;
  }
  
  // Regular users or admins viewing specific tenant
  if (tenantId) {
    return query.eq('tenant_id', tenantId);
  }
  
  return query;
}

/**
 * Hook for fetching users/profiles with tenant filtering
 */
export function useTenantUsers() {
  const { currentTenant, isPlatformAdmin } = useTenant();
  
  return useQuery({
    queryKey: ['tenant-users', currentTenant?.id],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          user_roles:user_roles(role),
          departments:user_department_scopes(
            department:departments(id, name)
          )
        `)
        .neq('account_status', 'deleted')
        .order('full_name');
      
      // Apply tenant filter for non-platform admins
      if (!isPlatformAdmin || currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant || isPlatformAdmin,
  });
}

/**
 * Hook for fetching notification recipients (users who can receive notifications)
 */
export function useTenantRecipients() {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ['tenant-recipients', currentTenant?.id],
    queryFn: async () => {
      // First get profiles that can receive notifications
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, telegram_user_id, allow_whatsapp, allow_telegram, receives_notifications')
        .eq('tenant_id', currentTenant?.id)
        .eq('receives_notifications', true)
        .neq('account_status', 'deleted')
        .order('full_name');
      
      if (profilesError) throw profilesError;
      
      // Also get legacy recipients table
      const { data: recipients, error: recipientsError } = await supabase
        .from('recipients')
        .select('*')
        .or(`tenant_id.eq.${currentTenant?.id},tenant_id.is.null`)
        .eq('is_active', true)
        .order('name');
      
      if (recipientsError) throw recipientsError;
      
      // Merge both sources
      const merged = [
        ...(profiles || []).map(p => ({
          id: p.id,
          source: 'profile' as const,
          name: p.full_name || p.email || 'Unknown',
          phone: p.phone,
          whatsapp_number: p.phone,
          telegram_id: p.telegram_user_id,
          allow_whatsapp: p.allow_whatsapp,
          allow_telegram: p.allow_telegram,
          user_id: p.user_id,
        })),
        ...(recipients || []).map(r => ({
          id: r.id,
          source: 'recipient' as const,
          name: r.name,
          phone: r.whatsapp_number,
          whatsapp_number: r.whatsapp_number,
          telegram_id: r.telegram_id,
          allow_whatsapp: true,
          allow_telegram: !!r.telegram_id,
          user_id: null,
        })),
      ];
      
      return merged;
    },
    enabled: !!currentTenant?.id,
  });
}
