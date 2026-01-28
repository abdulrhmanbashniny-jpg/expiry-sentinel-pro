import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationBell } from './NotificationBell';
import { TenantSwitcher } from './TenantSwitcher';

export const MainLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Mobile Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">فتح القائمة</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <Sidebar
                isCollapsed={false}
                onToggle={() => setIsMobileOpen(false)}
                isMobile
                onNavigate={() => setIsMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <TenantSwitcher />
        </div>
        <NotificationBell />
      </header>

      {/* Desktop Top Bar */}
      <div className={cn(
        'hidden lg:flex fixed top-0 right-0 z-40 h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6 transition-all duration-300',
        isSidebarCollapsed ? 'left-20' : 'left-64'
      )}>
        <TenantSwitcher />
        <NotificationBell />
      </div>

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300 pt-14 lg:pt-14',
          // Desktop margin
          'lg:mr-64',
          isSidebarCollapsed && 'lg:mr-20',
          // Mobile no margin
          'mr-0'
        )}
      >
        <div className="container py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
