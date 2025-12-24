import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  FolderOpen,
  Bell,
  Settings,
  Link2,
  LogOut,
  ChevronLeft,
  Shield,
  UsersRound,
  Bot,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, AppRole } from '@/types/database';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  minRole?: AppRole;
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/items', icon: FileText, label: 'العناصر' },
  { to: '/recipients', icon: Users, label: 'المستلمون', minRole: 'supervisor' },
  { to: '/categories', icon: FolderOpen, label: 'الفئات', minRole: 'admin' },
  { to: '/reminder-rules', icon: Bell, label: 'قواعد التذكير', minRole: 'admin' },
  { to: '/ai-advisor', icon: Bot, label: 'مستشار الامتثال', minRole: 'admin' },
  { to: '/team-management', icon: UsersRound, label: 'إدارة الفريق', minRole: 'system_admin' },
  { to: '/integrations', icon: Link2, label: 'التكاملات', minRole: 'system_admin' },
  { to: '/security', icon: Shield, label: 'الأمان', minRole: 'system_admin' },
  { to: '/settings', icon: Settings, label: 'الإعدادات', minRole: 'admin' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { signOut, user, role, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredNavItems = navItems.filter(item => {
    if (!item.minRole) return true;
    return hasRole(item.minRole);
  });

  return (
    <aside
      className={cn(
        'fixed right-0 top-0 z-40 flex h-screen flex-col bg-sidebar transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
              <Bell className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground">HR Reminder</h1>
              <p className="text-xs text-sidebar-foreground/60">نظام التذكير</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronLeft
            className={cn('h-5 w-5 transition-transform', isCollapsed && 'rotate-180')}
          />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'sidebar-item',
                isActive && 'active',
                isCollapsed && 'justify-center px-2'
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        {!isCollapsed && (
          <div className="mb-3 rounded-lg bg-sidebar-accent/50 p-3">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user?.email}
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              {role ? ROLE_LABELS[role] : 'جاري التحميل...'}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            'w-full justify-start gap-2 text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>تسجيل الخروج</span>}
        </Button>
      </div>
    </aside>
  );
};
