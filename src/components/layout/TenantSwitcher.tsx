import React from 'react';
import { Crown, Building2, ChevronDown, Users, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenant } from '@/contexts/TenantContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const TenantSwitcher: React.FC = () => {
  const { currentTenant, allTenants, isPlatformAdmin, isLoading, switchTenant } = useTenant();

  if (isLoading) {
    return <Skeleton className="h-8 w-40" />;
  }

  // Regular user - show simple badge
  if (!isPlatformAdmin) {
    if (!currentTenant) return null;
    
    return (
      <Badge 
        variant="outline" 
        className="gap-1.5 py-1.5 px-3 bg-primary/5 border-primary/20 text-primary font-medium"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{currentTenant.code}</span>
        <span className="text-muted-foreground mx-1 hidden sm:inline">|</span>
        <span className="truncate max-w-[120px]">{currentTenant.name}</span>
      </Badge>
    );
  }

  // Platform admin - show dropdown switcher
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "gap-2 py-1.5 px-3 font-medium h-auto",
            currentTenant 
              ? "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10" 
              : "bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
          )}
        >
          {currentTenant ? (
            <>
              <Building2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{currentTenant.code}</span>
              <span className="text-muted-foreground mx-1 hidden sm:inline">|</span>
              <span className="truncate max-w-[100px]">{currentTenant.name}</span>
            </>
          ) : (
            <>
              <Crown className="h-3.5 w-3.5" />
              <span>مدير النظام</span>
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          تبديل العرض
        </DropdownMenuLabel>
        
        <DropdownMenuItem 
          onClick={() => switchTenant(null)}
          className={cn(
            "gap-2 cursor-pointer",
            !currentTenant && "bg-yellow-50"
          )}
        >
          <Crown className="h-4 w-4 text-yellow-600" />
          <div className="flex-1">
            <div className="font-medium">عرض مدير النظام</div>
            <div className="text-xs text-muted-foreground">الوصول الكامل للمنصة</div>
          </div>
          {!currentTenant && <Check className="h-4 w-4 text-yellow-600" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          الشركات ({allTenants.length})
        </DropdownMenuLabel>
        
        {allTenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => switchTenant(tenant.id)}
            className={cn(
              "gap-2 cursor-pointer",
              currentTenant?.id === tenant.id && "bg-primary/5"
            )}
          >
            <Building2 className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {tenant.code}
                </span>
                <span className="truncate">{tenant.name}</span>
              </div>
              {tenant.name_en && (
                <div className="text-xs text-muted-foreground truncate">{tenant.name_en}</div>
              )}
            </div>
            {currentTenant?.id === tenant.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
