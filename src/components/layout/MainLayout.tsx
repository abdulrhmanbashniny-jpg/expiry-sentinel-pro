import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
      <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 lg:hidden">
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
        <h1 className="text-lg font-semibold">HR Reminder</h1>
      </header>

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
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