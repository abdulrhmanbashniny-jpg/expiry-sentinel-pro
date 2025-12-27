import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDelegations } from '@/hooks/useDelegations';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Check, X, Clock, History, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  pending: 'في الانتظار',
  accepted: 'مقبول',
  rejected: 'مرفوض',
  active: 'نشط',
  completed: 'منتهي',
  cancelled: 'ملغي',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  accepted: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
  active: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  completed: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  cancelled: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

export default function Delegations() {
  const { user, isSystemAdmin } = useAuth();
  const { delegations, auditLogs, createDelegation, acceptDelegation, rejectDelegation, cancelDelegation, isLoading } = useDelegations();
  const { users } = useTeamManagement();
  const profiles = users.map(u => ({ user_id: u.profile.user_id, full_name: u.profile.full_name, email: u.profile.email }));

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedDelegation, setSelectedDelegation] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    delegate_id: '',
    from_datetime: '',
    to_datetime: '',
    reason: '',
  });
  const [rejectionReason, setRejectionReason] = useState('');

  const getUserName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.full_name || profile?.email || 'غير معروف';
  };

  const myDelegations = delegations.filter((d) => d.delegator_id === user?.id);
  const pendingRequests = delegations.filter((d) => d.delegate_id === user?.id && d.status === 'pending');
  const allDelegations = isSystemAdmin ? delegations : [];

  const handleCreate = () => {
    if (!formData.delegate_id || !formData.from_datetime || !formData.to_datetime) return;

    createDelegation.mutate({
      delegate_id: formData.delegate_id,
      from_datetime: formData.from_datetime,
      to_datetime: formData.to_datetime,
      reason: formData.reason || undefined,
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setFormData({ delegate_id: '', from_datetime: '', to_datetime: '', reason: '' });
      },
    });
  };

  const handleAccept = (id: string) => {
    acceptDelegation.mutate(id);
  };

  const handleReject = () => {
    if (!selectedDelegation || !rejectionReason) return;
    rejectDelegation.mutate({ delegationId: selectedDelegation, reason: rejectionReason }, {
      onSuccess: () => {
        setIsRejectOpen(false);
        setSelectedDelegation(null);
        setRejectionReason('');
      },
    });
  };

  const handleCancel = (id: string) => {
    cancelDelegation.mutate(id);
  };

  const renderDelegationRow = (delegation: typeof delegations[0], showActions = true) => (
    <TableRow key={delegation.id}>
      <TableCell>{getUserName(delegation.delegator_id)}</TableCell>
      <TableCell>{getUserName(delegation.delegate_id)}</TableCell>
      <TableCell>
        {format(new Date(delegation.from_datetime), 'yyyy-MM-dd HH:mm', { locale: ar })}
      </TableCell>
      <TableCell>
        {format(new Date(delegation.to_datetime), 'yyyy-MM-dd HH:mm', { locale: ar })}
      </TableCell>
      <TableCell>
        <Badge className={statusColors[delegation.status]}>
          {statusLabels[delegation.status]}
        </Badge>
      </TableCell>
      <TableCell>{delegation.reason || '-'}</TableCell>
      {showActions && (
        <TableCell>
          {delegation.status === 'pending' && delegation.delegate_id === user?.id && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleAccept(delegation.id)}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  setSelectedDelegation(delegation.id);
                  setIsRejectOpen(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {(delegation.status === 'pending' || delegation.status === 'accepted') &&
            delegation.delegator_id === user?.id && (
              <Button size="sm" variant="outline" onClick={() => handleCancel(delegation.id)}>
                إلغاء
              </Button>
            )}
          {isSystemAdmin && delegation.status !== 'cancelled' && delegation.status !== 'completed' && (
            <Button size="sm" variant="outline" onClick={() => handleCancel(delegation.id)}>
              إلغاء
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التوكيلات</h1>
          <p className="text-muted-foreground">إدارة التوكيلات وتفويض الصلاحيات</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          إنشاء توكيل
        </Button>
      </div>

      {pendingRequests.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              طلبات توكيل بانتظار موافقتك ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المفوِّض</TableHead>
                  <TableHead>من</TableHead>
                  <TableHead>إلى</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{getUserName(d.delegator_id)}</TableCell>
                    <TableCell>{format(new Date(d.from_datetime), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>{format(new Date(d.to_datetime), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>{d.reason || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAccept(d.id)}>
                          <Check className="h-4 w-4 ml-1" />
                          قبول
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedDelegation(d.id);
                            setIsRejectOpen(true);
                          }}
                        >
                          <X className="h-4 w-4 ml-1" />
                          رفض
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="my-delegations" className="w-full">
        <TabsList>
          <TabsTrigger value="my-delegations" className="gap-2">
            <Clock className="h-4 w-4" />
            توكيلاتي
          </TabsTrigger>
          {isSystemAdmin && (
            <TabsTrigger value="all-delegations" className="gap-2">
              جميع التوكيلات
            </TabsTrigger>
          )}
          <TabsTrigger value="audit-log" className="gap-2">
            <History className="h-4 w-4" />
            سجل التدقيق
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-delegations">
          <Card>
            <CardHeader>
              <CardTitle>توكيلاتي</CardTitle>
              <CardDescription>التوكيلات التي قمت بإنشائها</CardDescription>
            </CardHeader>
            <CardContent>
              {myDelegations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد توكيلات</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المفوِّض</TableHead>
                      <TableHead>البديل</TableHead>
                      <TableHead>من</TableHead>
                      <TableHead>إلى</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{myDelegations.map((d) => renderDelegationRow(d))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isSystemAdmin && (
          <TabsContent value="all-delegations">
            <Card>
              <CardHeader>
                <CardTitle>جميع التوكيلات</CardTitle>
                <CardDescription>إدارة جميع التوكيلات في النظام</CardDescription>
              </CardHeader>
              <CardContent>
                {allDelegations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">لا توجد توكيلات</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المفوِّض</TableHead>
                        <TableHead>البديل</TableHead>
                        <TableHead>من</TableHead>
                        <TableHead>إلى</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>السبب</TableHead>
                        <TableHead>الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>{allDelegations.map((d) => renderDelegationRow(d))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="audit-log">
          <Card>
            <CardHeader>
              <CardTitle>سجل التدقيق</CardTitle>
              <CardDescription>جميع الأحداث المتعلقة بالتوكيلات</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد سجلات</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراء</TableHead>
                      <TableHead>بواسطة</TableHead>
                      <TableHead>التفاصيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                        </TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>{getUserName(log.performed_by)}</TableCell>
                        <TableCell>
                          <code className="text-xs">{JSON.stringify(log.details)}</code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: إنشاء توكيل */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء توكيل جديد</DialogTitle>
            <DialogDescription>قم بتحديد البديل وفترة التوكيل</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>البديل</Label>
              <Select value={formData.delegate_id} onValueChange={(v) => setFormData({ ...formData, delegate_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر البديل" />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter((p) => p.user_id !== user?.id)
                    .map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>من</Label>
                <Input
                  type="datetime-local"
                  value={formData.from_datetime}
                  onChange={(e) => setFormData({ ...formData, from_datetime: e.target.value })}
                />
              </div>
              <div>
                <Label>إلى</Label>
                <Input
                  type="datetime-local"
                  value={formData.to_datetime}
                  onChange={(e) => setFormData({ ...formData, to_datetime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>السبب (اختياري)</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="سبب التوكيل..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate} disabled={createDelegation.isPending}>
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: رفض التوكيل */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض التوكيل</DialogTitle>
            <DialogDescription>يرجى كتابة سبب الرفض</DialogDescription>
          </DialogHeader>
          <div>
            <Label>سبب الرفض</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="اكتب سبب الرفض..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason || rejectDelegation.isPending}>
              رفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
