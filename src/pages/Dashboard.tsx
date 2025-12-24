import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle, 
  Clock, 
  FileText, 
  Plus, 
  XCircle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useExpiringItemsWithDept, WORKFLOW_STATUS_LABELS, WorkflowStatus } from '@/hooks/useDashboardData';
import { useRecentNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow, format } from 'date-fns';
import { ar } from 'date-fns/locale';

// Dashboard Components
import DepartmentFilter from '@/components/dashboard/DepartmentFilter';
import WorkflowStatusStats from '@/components/dashboard/WorkflowStatusStats';
import DepartmentPerformance from '@/components/dashboard/DepartmentPerformance';
import TimelineActivity from '@/components/dashboard/TimelineActivity';
import TransitionStats from '@/components/dashboard/TransitionStats';
import RecurringAndQuality from '@/components/dashboard/RecurringAndQuality';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  
  const { data: expiringData, isLoading } = useExpiringItemsWithDept({ 
    departmentId: selectedDepartment 
  });
  const { data: notifications } = useRecentNotifications();

  const stats = [
    { 
      label: 'منتهية', 
      count: expiringData?.expired.length ?? 0, 
      icon: XCircle, 
      color: 'text-destructive', 
      bg: 'bg-destructive/10' 
    },
    { 
      label: 'خلال 7 أيام', 
      count: expiringData?.expiring7.length ?? 0, 
      icon: AlertTriangle, 
      color: 'text-warning', 
      bg: 'bg-warning/10' 
    },
    { 
      label: 'خلال 14 يوم', 
      count: expiringData?.expiring14.length ?? 0, 
      icon: Clock, 
      color: 'text-primary', 
      bg: 'bg-primary/10' 
    },
    { 
      label: 'خلال 30 يوم', 
      count: expiringData?.expiring30.length ?? 0, 
      icon: Calendar, 
      color: 'text-success', 
      bg: 'bg-success/10' 
    },
  ];

  const getStatusBadge = (daysLeft: number) => {
    if (daysLeft < 0) return <Badge variant="destructive">منتهي</Badge>;
    if (daysLeft <= 7) return <Badge className="bg-warning text-warning-foreground">عاجل</Badge>;
    if (daysLeft <= 14) return <Badge variant="secondary">قريب</Badge>;
    return <Badge variant="outline">عادي</Badge>;
  };

  const getWorkflowBadge = (status: string) => {
    const workflowStatus = status as WorkflowStatus;
    const label = WORKFLOW_STATUS_LABELS[workflowStatus] || status;
    return <Badge variant="outline" className="text-xs">{label}</Badge>;
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground">نظرة عامة على العناصر والتنبيهات</p>
        </div>
        <div className="flex items-center gap-3">
          <DepartmentFilter 
            value={selectedDepartment} 
            onChange={setSelectedDepartment} 
          />
          <Button onClick={() => navigate('/items/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة عنصر
          </Button>
        </div>
      </div>

      {/* Workflow Status Stats (7 حالات) */}
      <div>
        <h2 className="text-lg font-semibold mb-3">حالات سير العمل</h2>
        <WorkflowStatusStats departmentId={selectedDepartment} />
      </div>

      {/* Expiry Stats Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">تواريخ الانتهاء</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="stat-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`rounded-xl p-3 ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stat.count}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recurring & Data Quality */}
      <RecurringAndQuality departmentId={selectedDepartment} />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Department Performance */}
        <DepartmentPerformance />

        {/* Column 2: Timeline Activity */}
        <TimelineActivity departmentId={selectedDepartment} />

        {/* Column 3: Transition Stats */}
        <TransitionStats departmentId={selectedDepartment} />
      </div>

      {/* Bottom Section: Expiring Items + Notifications */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expiring Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              العناصر القادمة على الانتهاء
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/items')}>
              عرض الكل
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : expiringData?.all.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="mx-auto h-12 w-12 text-success" />
                <p className="mt-2">لا توجد عناصر تنتهي قريباً</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringData?.all.slice(0, 5).map((item) => {
                  const daysLeft = Math.ceil(
                    (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/items/${item.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{item.category?.name}</span>
                          <span>•</span>
                          <span>{format(new Date(item.expiry_date), 'dd/MM/yyyy')}</span>
                          {item.department && (
                            <>
                              <span>•</span>
                              <span>{item.department.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getWorkflowBadge(item.workflow_status)}
                        {getStatusBadge(daysLeft)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              آخر الإشعارات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!notifications || notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>لا توجد إشعارات حديثة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <div 
                    key={notif.id} 
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{notif.item?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {notif.recipient?.name} •{' '}
                        {formatDistanceToNow(new Date(notif.created_at), { 
                          locale: ar, 
                          addSuffix: true 
                        })}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        notif.status === 'sent' 
                          ? 'default' 
                          : notif.status === 'failed' 
                            ? 'destructive' 
                            : 'secondary'
                      }
                    >
                      {notif.status === 'sent' 
                        ? 'تم الإرسال' 
                        : notif.status === 'failed' 
                          ? 'فشل' 
                          : 'قيد الانتظار'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
