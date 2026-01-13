import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  BarChart3, 
  RefreshCw,
  MessageSquare,
  Send,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

type AutomationRun = {
  id: string;
  job_type: string;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  items_processed: number | null;
  items_success: number | null;
  items_failed: number | null;
  error_message: string | null;
  results: Record<string, any> | null;
  metadata: Record<string, any> | null;
};

const AutomationDashboard = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch automation runs
  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['automation-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AutomationRun[];
    },
  });

  // Fetch rate limits
  const { data: rateLimits } = useQuery({
    queryKey: ['rate-limits'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('rate_limits')
        .select('*, recipient:recipients(name)')
        .eq('date', today)
        .order('count', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  // Fetch notification stats for last 7 days
  const { data: notificationStats } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from('notification_log')
        .select('status, created_at')
        .gte('created_at', sevenDaysAgo);

      if (error) throw error;

      // Calculate stats
      const stats = {
        total: data?.length || 0,
        sent: data?.filter(n => n.status === 'sent').length || 0,
        failed: data?.filter(n => n.status === 'failed').length || 0,
        pending: data?.filter(n => n.status === 'pending').length || 0,
      };

      return stats;
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchRuns();
    setIsRefreshing(false);
    toast({ title: 'تم التحديث', description: 'تم تحديث البيانات بنجاح' });
  };

  const handleManualTrigger = async () => {
    try {
      const response = await supabase.functions.invoke('automated-reminders', {
        body: { triggered_by: 'manual', source: 'dashboard' }
      });

      if (response.error) throw response.error;

      toast({
        title: 'تم التشغيل',
        description: 'تم تشغيل التذكيرات التلقائية بنجاح',
      });
      await refetchRuns();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء التشغيل',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> مكتمل</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> فشل</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30"><Clock className="h-3 w-3 mr-1" /> جاري</Badge>;
      default:
        return <Badge variant="secondary">{status || 'غير معروف'}</Badge>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Calculate summary stats
  const last24hRuns = runs?.filter(r => {
    if (!r.started_at) return false;
    const runTime = new Date(r.started_at);
    const dayAgo = subDays(new Date(), 1);
    return runTime > dayAgo;
  }) || [];

  const successRate = last24hRuns.length > 0
    ? ((last24hRuns.filter(r => r.status === 'completed').length / last24hRuns.length) * 100).toFixed(0)
    : 0;

  const totalSent = last24hRuns.reduce((acc, r) => acc + (r.items_success || 0), 0);
  const totalFailed = last24hRuns.reduce((acc, r) => acc + (r.items_failed || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">لوحة مراقبة التشغيل</h1>
          <p className="text-muted-foreground mt-1">مراقبة التذكيرات التلقائية وحالة الإرسال</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button onClick={handleManualTrigger}>
            <Send className="h-4 w-4 ml-2" />
            تشغيل يدوي
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">التشغيلات (24 ساعة)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{last24hRuns.length}</div>
            <p className="text-xs text-muted-foreground">نسبة النجاح: {successRate}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الرسائل المرسلة</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalSent}</div>
            <p className="text-xs text-muted-foreground">خلال 24 ساعة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الرسائل الفاشلة</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalFailed}</div>
            <p className="text-xs text-muted-foreground">خلال 24 ساعة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إحصائيات الأسبوع</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notificationStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {notificationStats?.sent || 0} ناجح / {notificationStats?.failed || 0} فاشل
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cron Job Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            معلومات الجدولة التلقائية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">اسم المهمة</p>
              <p className="font-medium">daily-reminders-07am-riyadh</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">التوقيت</p>
              <p className="font-medium">07:00 صباحاً (Asia/Riyadh)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الوظيفة</p>
              <p className="font-medium">automated-reminders</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">لإيقاف أو تعديل الجدولة:</p>
            <code className="text-xs bg-muted p-2 rounded block">
              SELECT cron.unschedule('daily-reminders-07am-riyadh');
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">سجل التشغيل</TabsTrigger>
          <TabsTrigger value="rate-limits">حدود الإرسال</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>آخر التشغيلات</CardTitle>
              <CardDescription>سجل التشغيلات التلقائية للتذكيرات</CardDescription>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الوقت</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>المعالجة</TableHead>
                      <TableHead>النجاح</TableHead>
                      <TableHead>الفشل</TableHead>
                      <TableHead>المدة</TableHead>
                      <TableHead>الخطأ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs?.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="text-sm">
                          {run.started_at ? format(parseISO(run.started_at), 'dd/MM HH:mm', { locale: ar }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{run.job_type}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(run.status)}</TableCell>
                        <TableCell>{run.items_processed ?? '-'}</TableCell>
                        <TableCell className="text-green-600">{run.items_success ?? '-'}</TableCell>
                        <TableCell className="text-red-600">{run.items_failed ?? '-'}</TableCell>
                        <TableCell>{formatDuration(run.duration_ms)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-red-500">
                          {run.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!runs || runs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          لا توجد تشغيلات مسجلة
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>حدود الإرسال اليومية</CardTitle>
              <CardDescription>عدد الرسائل المرسلة لكل مستلم اليوم (الحد الأقصى: 5)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستلم</TableHead>
                    <TableHead>القناة</TableHead>
                    <TableHead>العدد</TableHead>
                    <TableHead>آخر إرسال</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateLimits?.map((limit: any) => (
                    <TableRow key={limit.id}>
                      <TableCell>{limit.recipient?.name || 'غير معروف'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{limit.channel}</Badge>
                      </TableCell>
                      <TableCell>{limit.count}</TableCell>
                      <TableCell className="text-sm">
                        {limit.last_sent_at ? format(parseISO(limit.last_sent_at), 'HH:mm', { locale: ar }) : '-'}
                      </TableCell>
                      <TableCell>
                        {limit.count >= 5 ? (
                          <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            محدود
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                            متاح
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!rateLimits || rateLimits.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد سجلات لليوم
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutomationDashboard;
