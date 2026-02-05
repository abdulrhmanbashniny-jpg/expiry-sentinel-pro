import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEscalations, getLevelName, EscalationLog } from '@/hooks/useEscalations';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Settings,
  Users,
  XCircle,
  TrendingUp,
  Bell,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'في الانتظار', color: 'bg-orange-500', icon: Clock },
  acknowledged: { label: 'تم الاستلام', color: 'bg-blue-500', icon: Eye },
  escalated: { label: 'تم التصعيد', color: 'bg-purple-500', icon: ArrowUp },
  resolved: { label: 'تم الحل', color: 'bg-green-500', icon: CheckCircle2 },
  expired: { label: 'منتهي', color: 'bg-gray-500', icon: XCircle },
};

const EscalationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationLog | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const {
    escalations,
    rules,
    stats,
    isLoading,
    acknowledgeEscalation,
    resolveEscalation,
    refetch,
  } = useEscalations({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    level: levelFilter !== 'all' ? parseInt(levelFilter) : undefined,
  });

  const handleAcknowledge = async (escalationId: string) => {
    await acknowledgeEscalation.mutateAsync(escalationId);
  };

  const handleResolve = async () => {
    if (!selectedEscalation) return;
    await resolveEscalation.mutateAsync({
      escalationId: selectedEscalation.id,
      notes: resolveNotes,
    });
    setResolveDialogOpen(false);
    setSelectedEscalation(null);
    setResolveNotes('');
  };

  const openResolveDialog = (escalation: EscalationLog) => {
    setSelectedEscalation(escalation);
    setResolveNotes('');
    setResolveDialogOpen(true);
  };

  const getTimeRemaining = (nextEscalationAt: string | null) => {
    if (!nextEscalationAt) return null;
    const next = new Date(nextEscalationAt);
    const now = new Date();
    if (next <= now) return 'متأخر';
    return formatDistanceToNow(next, { locale: ar, addSuffix: true });
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowUp className="h-6 w-6 text-primary" />
            لوحة تحكم التصعيدات
          </h1>
          <p className="text-muted-foreground">
            متابعة وإدارة التصعيدات التلقائية للإشعارات غير المستلمة
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي التصعيدات</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">في الانتظار</p>
                <p className="text-2xl font-bold text-orange-500">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تم الاستلام</p>
                <p className="text-2xl font-bold text-blue-500">{stats.acknowledged}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تم التصعيد</p>
                <p className="text-2xl font-bold text-purple-500">{stats.escalated}</p>
              </div>
              <ArrowUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تم الحل</p>
                <p className="text-2xl font-bold text-green-500">{stats.resolved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            التصعيدات حسب المستوى
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {stats.byLevel.map(({ level, name, count }) => (
              <div
                key={level}
                className="flex items-center gap-2 rounded-lg border p-3 min-w-[150px]"
              >
                <Badge variant={level === 0 ? 'secondary' : level >= 3 ? 'destructive' : 'default'}>
                  {level}
                </Badge>
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-muted-foreground">{count} تصعيد</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="escalations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="escalations" className="gap-2">
            <Bell className="h-4 w-4" />
            التصعيدات
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="h-4 w-4" />
            قواعد التصعيد
          </TabsTrigger>
        </TabsList>

        {/* Escalations Tab */}
        <TabsContent value="escalations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle>سجل التصعيدات</CardTitle>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="pending">في الانتظار</SelectItem>
                      <SelectItem value="acknowledged">تم الاستلام</SelectItem>
                      <SelectItem value="escalated">تم التصعيد</SelectItem>
                      <SelectItem value="resolved">تم الحل</SelectItem>
                      <SelectItem value="expired">منتهي</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="المستوى" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المستويات</SelectItem>
                      <SelectItem value="0">الموظف</SelectItem>
                      <SelectItem value="1">المشرف</SelectItem>
                      <SelectItem value="2">المدير</SelectItem>
                      <SelectItem value="3">المدير العام</SelectItem>
                      <SelectItem value="4">الموارد البشرية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : escalations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد تصعيدات</p>
                  <p className="text-sm mt-2">سيتم إنشاء تصعيدات تلقائياً عند عدم استجابة المستلمين للإشعارات</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المعاملة</TableHead>
                        <TableHead>الموظف الأصلي</TableHead>
                        <TableHead>المستوى الحالي</TableHead>
                        <TableHead>المستقبل الحالي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التصعيد القادم</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escalations.map((escalation) => {
                        const config = statusConfig[escalation.status];
                        const timeRemaining = getTimeRemaining(escalation.next_escalation_at);
                        const isMyEscalation = escalation.current_recipient_id === user?.id;

                        return (
                          <TableRow
                            key={escalation.id}
                            className={isMyEscalation ? 'bg-primary/5' : ''}
                          >
                            <TableCell>
                              <Button
                                variant="link"
                                className="p-0 h-auto"
                                onClick={() => navigate(`/items/${escalation.item_id}`)}
                              >
                                {escalation.item?.title || escalation.item_id.slice(0, 8)}
                              </Button>
                              {escalation.item?.ref_number && (
                                <p className="text-xs text-muted-foreground">
                                  {escalation.item.ref_number}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {escalation.original_recipient?.full_name || 'غير معروف'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  escalation.escalation_level >= 3
                                    ? 'destructive'
                                    : escalation.escalation_level >= 1
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {getLevelName(escalation.escalation_level)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {escalation.current_recipient?.full_name || 'غير معروف'}
                                {isMyEscalation && (
                                  <Badge variant="outline" className="text-xs">
                                    أنت
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${config?.color}`} />
                                <span>{config?.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {escalation.status === 'pending' && timeRemaining ? (
                                <span
                                  className={
                                    timeRemaining === 'متأخر'
                                      ? 'text-destructive font-medium'
                                      : 'text-muted-foreground'
                                  }
                                >
                                  {timeRemaining}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {escalation.status === 'pending' && isMyEscalation && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAcknowledge(escalation.id)}
                                      disabled={acknowledgeEscalation.isPending}
                                    >
                                      {acknowledgeEscalation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => openResolveDialog(escalation)}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {escalation.status === 'acknowledged' && isMyEscalation && (
                                  <Button
                                    size="sm"
                                    onClick={() => openResolveDialog(escalation)}
                                  >
                                    حل
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => navigate(`/items/${escalation.item_id}`)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>قواعد التصعيد</CardTitle>
              <CardDescription>
                إعدادات التصعيد التلقائي حسب المستوى الإداري
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستوى</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>وقت الانتظار</TableHead>
                    <TableHead>قنوات الإشعار</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        لا توجد قواعد تصعيد محددة
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <Badge>{rule.escalation_level}</Badge>
                        </TableCell>
                        <TableCell>{getLevelName(rule.escalation_level)}</TableCell>
                        <TableCell>{rule.delay_hours} ساعة</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {rule.notification_channels.map((channel) => (
                              <Badge key={channel} variant="outline" className="text-xs">
                                {channel === 'whatsapp'
                                  ? 'واتساب'
                                  : channel === 'telegram'
                                  ? 'تيليجرام'
                                  : channel === 'in_app'
                                  ? 'إشعار داخلي'
                                  : channel === 'email'
                                  ? 'بريد'
                                  : channel}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'فعّال' : 'معطّل'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حل التصعيد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ملاحظات الحل (اختياري)</Label>
              <Textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="اكتب ملاحظاتك حول كيفية حل هذا التصعيد..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolveEscalation.isPending}
            >
              {resolveEscalation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              تأكيد الحل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EscalationDashboard;
