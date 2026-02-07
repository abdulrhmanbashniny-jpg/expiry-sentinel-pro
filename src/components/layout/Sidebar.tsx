import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  ChevronDown,
  Shield,
  UsersRound,
  Bot,
  BarChart3,
  Building2,
  UserCircle,
  UserCheck,
  ClipboardList,
  Target,
  Upload,
  FileCheck,
  MessageSquareText,
  ListPlus,
  Activity,
  FileSignature,
  Ticket,
  Briefcase,
  History,
  UserCircle2,
  AlertTriangle,
  Home,
  Layers,
  TrendingUp,
  Megaphone,
  Cog,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, AppRole } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onNavigate?: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  minRole?: AppRole;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: 'main',
    label: 'الرئيسية',
    icon: Home,
    items: [
      { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
      { to: '/employee-portal', icon: UserCircle2, label: 'بوابة الموظف' },
      { to: '/my-results', icon: BarChart3, label: 'نتائجي' },
    ],
  },
  {
    id: 'items',
    label: 'إدارة العناصر',
    icon: Layers,
    items: [
      { to: '/items', icon: FileText, label: 'العناصر' },
      { to: '/categories', icon: FolderOpen, label: 'الفئات', minRole: 'admin' },
      { to: '/dynamic-fields', icon: ListPlus, label: 'الحقول الديناميكية', minRole: 'admin' },
    ],
  },
  {
    id: 'reminders',
    label: 'التذكيرات والتصعيد',
    icon: Bell,
    items: [
      { to: '/reminders', icon: Bell, label: 'مركز التذكيرات', minRole: 'supervisor' },
      { to: '/reminder-rules', icon: Bell, label: 'قواعد التذكير', minRole: 'admin' },
      { to: '/escalation-dashboard', icon: AlertTriangle, label: 'لوحة التصعيد', minRole: 'admin' },
    ],
  },
  {
    id: 'performance',
    label: 'تقييم الأداء',
    icon: TrendingUp,
    items: [
      { to: '/kpi-templates', icon: ClipboardList, label: 'قوالب التقييم', minRole: 'admin' },
      { to: '/evaluations', icon: Target, label: 'التقييمات', minRole: 'supervisor' },
      { to: '/evaluation-review', icon: FileCheck, label: 'مراجعة التقييمات', minRole: 'system_admin' },
    ],
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    icon: Users,
    items: [
      { to: '/departments', icon: Building2, label: 'الأقسام', minRole: 'admin' },
      { to: '/user-management', icon: Users, label: 'إدارة المستخدمين', minRole: 'admin' },
      { to: '/team-management', icon: UsersRound, label: 'إدارة الفريق', minRole: 'system_admin' },
      { to: '/user-import', icon: Upload, label: 'استيراد المستخدمين', minRole: 'system_admin' },
      { to: '/import-templates', icon: FileText, label: 'قوالب الاستيراد', minRole: 'admin' },
      { to: '/delegations', icon: UserCheck, label: 'التوكيلات' },
    ],
  },
  {
    id: 'contracts',
    label: 'العقود والمستندات',
    icon: Briefcase,
    items: [
      { to: '/contracts', icon: Briefcase, label: 'إدارة العقود', minRole: 'admin' },
      { to: '/document-signatures', icon: FileSignature, label: 'التوقيع الإلكتروني', minRole: 'admin' },
    ],
  },
  {
    id: 'reports',
    label: 'التقارير والذكاء',
    icon: BarChart3,
    items: [
      { to: '/compliance-reports', icon: BarChart3, label: 'تقارير الالتزام', minRole: 'admin' },
      { to: '/ai-advisor', icon: Bot, label: 'مستشار الامتثال', minRole: 'admin' },
      { to: '/automation-dashboard', icon: Activity, label: 'لوحة التشغيل', minRole: 'admin' },
    ],
  },
  {
    id: 'comms',
    label: 'الاتصالات',
    icon: Megaphone,
    items: [
      { to: '/message-templates', icon: MessageSquareText, label: 'قوالب الرسائل', minRole: 'admin' },
      { to: '/support-tickets', icon: Ticket, label: 'تذاكر الدعم' },
    ],
  },
  {
    id: 'system',
    label: 'النظام والأمان',
    icon: Cog,
    items: [
      { to: '/tenant-management', icon: Building2, label: 'إدارة الشركات', minRole: 'system_admin' },
      { to: '/integrations', icon: Link2, label: 'التكاملات', minRole: 'system_admin' },
      { to: '/permission-management', icon: Shield, label: 'إدارة الصلاحيات', minRole: 'system_admin' },
      { to: '/audit-log', icon: History, label: 'سجل التدقيق', minRole: 'system_admin' },
      { to: '/security', icon: Shield, label: 'الأمان', minRole: 'system_admin' },
      { to: '/settings', icon: Settings, label: 'الإعدادات', minRole: 'admin' },
    ],
  },
];

const SidebarGroup: React.FC<{
  group: NavGroup;
  isCollapsed: boolean;
  isMobile?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  hasRole: (role: AppRole) => boolean;
  onNavigate?: () => void;
  location: ReturnType<typeof useLocation>;
}> = ({ group, isCollapsed, isMobile, isOpen, onToggle, hasRole, onNavigate, location }) => {
  const filteredItems = group.items.filter(item => !item.minRole || hasRole(item.minRole));
  if (filteredItems.length === 0) return null;

  const isGroupActive = filteredItems.some(item => {
    if (item.to === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.to);
  });

  const showFull = !isCollapsed || isMobile;

  if (!showFull) {
    // Collapsed: show only first icon of group
    const firstItem = filteredItems[0];
    return (
      <NavLink
        to={firstItem.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn('sidebar-item justify-center px-2', isActive && 'active')
        }
        title={group.label}
      >
        <group.icon className="h-5 w-5 shrink-0" />
      </NavLink>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground/80',
          isGroupActive && 'text-sidebar-primary'
        )}
      >
        <div className="flex items-center gap-2">
          <group.icon className="h-4 w-4" />
          <span>{group.label}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            !isOpen && '-rotate-90'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="mt-0.5 space-y-0.5 pr-2">
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'sidebar-item text-sm',
                  isActive && 'active'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, isMobile, onNavigate }) => {
  const { signOut, user, role, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-open groups that contain the active route
  const getInitialOpen = () => {
    const open: Record<string, boolean> = {};
    navGroups.forEach(group => {
      const hasActive = group.items.some(item => {
        if (item.to === '/') return location.pathname === '/';
        return location.pathname.startsWith(item.to);
      });
      open[group.id] = hasActive;
    });
    // Always open 'main'
    open['main'] = true;
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpen);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col bg-sidebar transition-all duration-300',
        isMobile ? 'w-full' : 'fixed right-0 top-0 z-40',
        !isMobile && (isCollapsed ? 'w-20' : 'w-64')
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 shrink-0">
        {(!isCollapsed || isMobile) && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
              <Bell className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground leading-tight">HR Reminder</h1>
              <p className="text-[10px] text-sidebar-foreground/50">نظام التذكير</p>
            </div>
          </div>
        )}
        {isCollapsed && !isMobile && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary mx-auto">
            <Bell className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')}
            />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="space-y-0.5 p-2">
          {navGroups.map((group) => (
            <SidebarGroup
              key={group.id}
              group={group}
              isCollapsed={isCollapsed}
              isMobile={isMobile}
              isOpen={!!openGroups[group.id]}
              onToggle={() => toggleGroup(group.id)}
              hasRole={hasRole}
              onNavigate={onNavigate}
              location={location}
            />
          ))}

          {/* Profile - standalone */}
          <NavLink
            to="/profile"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'sidebar-item',
                isActive && 'active',
                !isMobile && isCollapsed && 'justify-center px-2'
              )
            }
          >
            <UserCircle className="h-5 w-5 shrink-0" />
            {(!isCollapsed || isMobile) && <span>ملفي الشخصي</span>}
          </NavLink>
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        {(!isCollapsed || isMobile) && (
          <div className="mb-2 rounded-lg bg-sidebar-accent/50 p-2.5">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {user?.email}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50">
              {role ? ROLE_LABELS[role] : 'جاري التحميل...'}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            'w-full justify-start gap-2 text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive h-9 text-sm',
            !isMobile && isCollapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4" />
          {(!isCollapsed || isMobile) && <span>تسجيل الخروج</span>}
        </Button>
      </div>
    </aside>
  );
};
