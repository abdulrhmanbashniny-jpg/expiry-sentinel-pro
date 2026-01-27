import React, { useState } from 'react';
import { useServiceRequests, REQUEST_TYPES, ServiceRequestStatus } from '@/hooks/useServiceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Clock, CheckCircle2, XCircle, FileText, Download } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_CONFIG: Record<ServiceRequestStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'بانتظار الموافقة', variant: 'secondary' },
  approved: { label: 'تمت الموافقة', variant: 'default' },
  rejected: { label: 'مرفوض', variant: 'destructive' },
  processing: { label: 'قيد التنفيذ', variant: 'outline' },
  completed: { label: 'مكتمل', variant: 'default' },
};

export default function EmployeePortal() {
  const { myRequests, pendingApproval, isLoading, createRequest, approveRequest, rejectRequest, completeRequest } = useServiceRequests();
  const { hasRole } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [formData, setFormData] = useState({
    request_type: 'certificate',
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRequest.mutateAsync(formData);
    setIsDialogOpen(false);
    setFormData({ request_type: 'certificate', title: '', description: '', priority: 'medium', due_date: '' });
  };

  const handleReject = async (id: string) => {
    await rejectRequest.mutateAsync({ id, reason: rejectionReason });
    setRejectDialogOpen(null);
    setRejectionReason('');
  };

  const RequestCard = ({ request }: { request: typeof myRequests[0] }) => {
    const requestType = REQUEST_TYPES.find(t => t.value === request.request_type);
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{requestType?.icon}</span>
              <div>
                <CardTitle className="text-base">{request.title}</CardTitle>
                <CardDescription className="text-xs">
                  {request.request_number} • {requestType?.label}
                </CardDescription>
              </div>
            </div>
            <Badge variant={STATUS_CONFIG[request.status].variant}>
              {STATUS_CONFIG[request.status].label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {request.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{request.description}</p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(request.created_at), { locale: ar, addSuffix: true })}
            </span>
            {request.result_attachment_url && (
              <Button size="sm" variant="outline" className="gap-1" asChild>
                <a href={request.result_attachment_url} target="_blank" rel="noreferrer">
                  <Download className="h-3 w-3" /> تحميل النتيجة
                </a>
              </Button>
            )}
          </div>
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-600">
              <strong>سبب الرفض:</strong> {request.rejection_reason}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">بوابة الموظف</h1>
          <p className="text-muted-foreground">إدارة طلباتك ومتابعتها</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" /> طلب جديد</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تقديم طلب جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>نوع الطلب</Label>
                <Select
                  value={formData.request_type}
                  onValueChange={v => setFormData({ ...formData, request_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <span>{t.icon}</span> {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>عنوان الطلب *</Label>
                <Input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="وصف مختصر للطلب"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>التفاصيل</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اشرح تفاصيل طلبك..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الأولوية</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={v => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الاستحقاق</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createRequest.isPending}>
                  {createRequest.isPending ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* الخدمات السريعة */}
      <div className="grid gap-4 md:grid-cols-4">
        {REQUEST_TYPES.slice(0, 4).map(type => (
          <Card
            key={type.value}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
              setFormData({ ...formData, request_type: type.value });
              setIsDialogOpen(true);
            }}
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <span className="text-4xl mb-2">{type.icon}</span>
              <span className="font-medium">{type.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="my-requests">
        <TabsList>
          <TabsTrigger value="my-requests">طلباتي ({myRequests.length})</TabsTrigger>
          {(hasRole('admin') || hasRole('supervisor')) && (
            <TabsTrigger value="pending">بانتظار الموافقة ({pendingApproval.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-requests" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : myRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد طلبات</p>
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  تقديم طلب جديد
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </TabsContent>

        {(hasRole('admin') || hasRole('supervisor')) && (
          <TabsContent value="pending" className="mt-4">
            {pendingApproval.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-muted-foreground">لا توجد طلبات معلقة</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingApproval.map(request => {
                  const requestType = REQUEST_TYPES.find(t => t.value === request.request_type);
                  
                  return (
                    <Card key={request.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{requestType?.icon}</span>
                            <div>
                              <p className="font-medium">{request.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {request.request_number} • {requestType?.label}
                              </p>
                              {request.description && (
                                <p className="text-sm text-muted-foreground mt-1">{request.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approveRequest.mutate(request.id)}
                              disabled={approveRequest.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                            </Button>
                            <Dialog open={rejectDialogOpen === request.id} onOpenChange={(open) => setRejectDialogOpen(open ? request.id : null)}>
                              <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <XCircle className="h-4 w-4 ml-1" /> رفض
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>سبب الرفض</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <Textarea
                                    value={rejectionReason}
                                    onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="اكتب سبب الرفض..."
                                    rows={3}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setRejectDialogOpen(null)}>
                                      إلغاء
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleReject(request.id)}
                                      disabled={!rejectionReason || rejectRequest.isPending}
                                    >
                                      تأكيد الرفض
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
