import React from 'react';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCurrentTenant } from '@/hooks/useTenants';
import { Skeleton } from '@/components/ui/skeleton';

export const TenantDisplay: React.FC = () => {
  const { data: tenant, isLoading } = useCurrentTenant();

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  if (!tenant) {
    return null;
  }

  return (
    <Badge 
      variant="outline" 
      className="gap-1.5 py-1.5 px-3 bg-primary/5 border-primary/20 text-primary font-medium"
    >
      <Building2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{tenant.code}</span>
      <span className="text-muted-foreground mx-1 hidden sm:inline">|</span>
      <span className="truncate max-w-[120px]">{tenant.name}</span>
    </Badge>
  );
};
