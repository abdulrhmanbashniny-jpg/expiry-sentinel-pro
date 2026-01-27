import React, { useState } from 'react';
import { useUnifiedReminders, useReminderStats } from '@/hooks/useUnifiedReminders';
import { useReminderRules } from '@/hooks/useReminderRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Bell, AlertTriangle, Clock, CheckCircle2, XCircle, 
  FileText, Briefcase, ExternalLink, Filter, RefreshCw,
  MessageSquare, Mail, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const DAYS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: '0-7', label: 'خلال 7 أيام' },
  { value: '0-14', label: 'خلال 14 يوم' },
  { value: '0-30', label: 'خلال 30 يوم' },
  { value: '0-60', label: 'خلال 60 يوم' },
  { value: '0-90', label: 'خلال 90 يوم' },
  { value: '-999-0', label: 'المنتهية' },
];

const ENTITY_TYPES = [
  { value: 'all', label: 'كل الأنواع' },
  { value: 'item', label: 'المعاملات' },
  { value: 'contract', label: 'العقود' },
];

export default function ReminderDashboard() {
  const [entityFilter, setEntityFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('0-30');
  
  const daysRange = daysFilter !== 'all' 
    ? daysFilter.split('-').map(Number) as [number, number]
    : undefined;

  const { data: reminders, isLoading, refetch } = useUnifiedReminders({
    entityType: entityFilter !== 'all' ? entityFilter : undefined,
    daysRange,
  });

  const { data: stats, isLoading: statsLoading } = useReminderStats();
  const { rules } = useReminderRules();

  const getDaysLeftBadge = (daysLeft: number) => {
    if (daysLeft < 0) {
      return <Badge variant="destructive">منتهي منذ {Math.abs(daysLeft)} يوم</Badge>;
    }
    if (daysLeft === 0) {
      return <Badge variant="destructive">ينتهي اليوم</Badge>;
    }
    if (daysLeft <= 7) {
      return <Badge variant="destructive">{daysLeft} أيام</Badge>;
    }
    if (daysLeft <= 30) {
      return <Badge variant="secondary">{daysLeft} يوم</Badge>;
    }
    return <Badge variant="outline">{daysLeft} يوم</Badge>;
  };

  const getNotificationStatus = (status: string | null, channel: string | null) => {
    if (!status) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    const channelIcon = channel === 'whatsapp' ? '📱' : channel === 'telegram' ? '✈️' : '📧';
    
    if (status === 'sent') {
      return (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" /> {channelIcon} مرسل
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="h-4 w-4" /> فشل
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-amber-600">
        <Clock className="h-4 w-4" /> معلق
      </span>
    );
  };

  const getEntityLink = (entityType: string, entityId: string) => {
    if (entityType === 'item') return `/items/${entityId}`;
    if (entityType === 'contract') return `/contracts`;
    return '#';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            مركز التذكيرات
          </h1>
          <p className="text-muted-foreground">متابعة جميع العناصر والعقود القريبة من الانتهاء</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={stats?.total.expired ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              منتهي الصلاحية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.total.expired || 0}</div>
          </CardContent>
        </Card>
        
        <Card className={stats?.total.within7Days ? 'border-amber-200 bg-amber-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">خلال 7 أيام</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.total.within7Days || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">خلال 30 يوم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total.within30Days || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              مرسل اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.notifications.sent || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              فشل اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.notifications.failed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* قواعد التذكير النشطة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">قواعد التذكير النشطة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {rules.filter(r => r.is_active).map(rule => (
              <Badge key={rule.id} variant="outline" className="gap-1">
                {rule.name}: {rule.days_before.sort((a, b) => b - a).join(', ')} يوم
              </Badge>
            ))}
            {rules.filter(r => r.is_active).length === 0 && (
              <span className="text-muted-foreground">لا توجد قواعد نشطة</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* الفلاتر */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            تصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">نوع العنصر</label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">المدة</label>
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_FILTERS.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>{filter.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* جدول التذكيرات */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة التذكيرات ({reminders?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الرقم المرجعي</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead>المتبقي</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>حالة الإشعار</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : reminders?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    لا توجد عناصر تتطابق مع الفلتر
                  </TableCell>
                </TableRow>
              ) : (
                reminders?.map(reminder => (
                  <TableRow key={reminder.id} className={reminder.days_left < 0 ? 'bg-red-50' : reminder.days_left <= 7 ? 'bg-amber-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {reminder.entity_type === 'item' ? (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs">
                          {reminder.entity_type === 'item' ? 'معاملة' : 'عقد'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                      {reminder.title}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {reminder.ref_number || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(reminder.due_date), 'yyyy/MM/dd', { locale: ar })}
                    </TableCell>
                    <TableCell>
                      {getDaysLeftBadge(reminder.days_left)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {reminder.department_name || '-'}
                    </TableCell>
                    <TableCell>
                      {getNotificationStatus(reminder.last_notification_status, reminder.last_notification_channel)}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={getEntityLink(reminder.entity_type, reminder.entity_id)}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
