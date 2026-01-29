import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Tenant } from '@/types/tenant';

interface TenantContextType {
  currentTenant: Tenant | null;
  allTenants: Tenant[];
  isPlatformAdmin: boolean;
  isLoading: boolean;
  switchTenant: (tenantId: string | null) => void;
  refreshTenants: () => Promise<void>;
  // New helper for queries
  getTenantFilter: () => { tenant_id?: string };
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isSystemAdmin } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(() => {
    // Restore from localStorage for platform admins
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_tenant_id');
    }
    return null;
  });

  const fetchTenantData = useCallback(async () => {
    if (!user) {
      setCurrentTenant(null);
      setAllTenants([]);
      setIsPlatformAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      // First check if user is platform admin (system_admin with NULL tenant)
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      const userTenantId = profile?.tenant_id;

      // If system_admin with NULL tenant_id, they're a platform admin
      if (isSystemAdmin && userTenantId === null) {
        setIsPlatformAdmin(true);
        
        // Fetch all tenants for platform admin
        const { data: tenants } = await supabase
          .from('tenants')
          .select('*')
          .eq('is_active', true)
          .order('name');

        setAllTenants((tenants as Tenant[]) || []);
        
        // If a tenant is selected, use that; otherwise show platform view
        if (selectedTenantId) {
          const selectedTenant = tenants?.find(t => t.id === selectedTenantId);
          setCurrentTenant(selectedTenant as Tenant || null);
        } else {
          setCurrentTenant(null);
        }
      } else {
        // Regular user - get their tenant
        setIsPlatformAdmin(false);
        
        if (userTenantId) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userTenantId)
            .single();

          setCurrentTenant(tenant as Tenant || null);
        }
        setAllTenants([]);
      }
    } catch (error) {
      console.error('Error fetching tenant data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isSystemAdmin, selectedTenantId]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  const switchTenant = useCallback((tenantId: string | null) => {
    if (!isPlatformAdmin) return;
    setSelectedTenantId(tenantId);
    // Persist selection
    if (tenantId) {
      localStorage.setItem('selected_tenant_id', tenantId);
    } else {
      localStorage.removeItem('selected_tenant_id');
    }
  }, [isPlatformAdmin]);

  const refreshTenants = async () => {
    await fetchTenantData();
  };

  // Helper function for building tenant-filtered queries
  const getTenantFilter = useCallback(() => {
    if (isPlatformAdmin && !currentTenant) {
      // Platform admin viewing all - no filter
      return {};
    }
    if (currentTenant?.id) {
      return { tenant_id: currentTenant.id };
    }
    return {};
  }, [isPlatformAdmin, currentTenant]);

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        allTenants,
        isPlatformAdmin,
        isLoading,
        switchTenant,
        refreshTenants,
        getTenantFilter,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
