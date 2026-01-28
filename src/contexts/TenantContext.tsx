import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const fetchTenantData = async () => {
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
  };

  useEffect(() => {
    fetchTenantData();
  }, [user, isSystemAdmin, selectedTenantId]);

  const switchTenant = (tenantId: string | null) => {
    if (!isPlatformAdmin) return;
    setSelectedTenantId(tenantId);
  };

  const refreshTenants = async () => {
    await fetchTenantData();
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        allTenants,
        isPlatformAdmin,
        isLoading,
        switchTenant,
        refreshTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
