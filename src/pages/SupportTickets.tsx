import React, { useState } from 'react';
import { useSupportTickets, TicketPriority, TicketStatus } from '@/hooks/useSupportTickets';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Ticket, Clock, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const CATEGORIES = [
  { value: 'hr_request', label: 'طلب موارد بشرية' },
  { value: 'complaint', label: 'شكوى' },
  { value: 'inquiry', label: 'استفسار' },
  { value: 'technical', label: 'دعم فني' },
  { value: 'suggestion', label: 'اقتراح' },
  { value: 'other', label: 'أخرى' },
];

const PRIORITY_LABELS: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'منخفضة', color: 'bg-gray-100 text-gray-800' },
  medium: { label: 'متوسطة', color: 'bg-blue-100 text-blue-800' },
  high: { label: 'عالية', color: 'bg-amber-100 text-amber-800' },
  urgent: { label: 'عاجلة', color: 'bg-red-100 text-red-800' },
};

const STATUS_LABELS: Record<TicketStatus, { label: string; icon: React.ReactNode }> = {
  open: { label: 'مفتوحة', icon: <AlertCircle className="h-4 w-4 text-blue-500" /> },
  in_progress: { label: 'قيد المعالجة', icon: <Clock className="h-4 w-4 text-amber-500" /> },
  pending: { label: 'معلقة', icon: <Clock className="h-4 w-4 text-gray-500" /> },
  resolved: { label: 'تم الحل', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  closed: { label: 'مغلقة', icon: <CheckCircle2 className="h-4 w-4 text-gray-500" /> },
};

export default function SupportTickets() {
  const { tickets, isLoading, stats, createTicket, updateTicket } = useSupportTickets();
  const { departments } = useDepartments();
  const { hasRole } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'inquiry',
    priority: 'medium' as TicketPriority,
    department_id: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTicket.mutateAsync(formData);
    setIsDialogOpen(false);
    setFormData({ title: '', description: '', category: 'inquiry', priority: 'medium', department_id: '' });
  };

  const isSLABreached = (ticket: typeof tickets[0]) => {
    if (!ticket.sla_deadline) return false;
    return new Date(ticket.sla_deadline) < new Date() && !['resolved', 'closed'].includes(ticket.status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">تذاكر الدعم</h1>
          <p className="text-muted-foreground">إدارة طلبات واستفسارات الموظفين</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" /> تذكرة جديدة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء تذكرة دعم</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>العنوان *</Label>
                <Input
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="وصف مختصر للمشكلة أو الطلب"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select
                    value={formData.category}
                    onValueChange={v => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الأولوية</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={v => setFormData({ ...formData, priority: v as TicketPriority })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>القسم المعني</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={v => setFormData({ ...formData, department_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التفاصيل</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اشرح المشكلة أو الطلب بالتفصيل..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? 'جاري الإرسال...' : 'إرسال'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* إحصائيات */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ticket className="h-4 w-4" /> إجمالي التذاكر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">مفتوحة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">قيد المعالجة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">تم الحل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card className={stats.breachedSLA > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">تجاوزت SLA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.breachedSLA}</div>
          </CardContent>
        </Card>
      </div>

      {/* جدول التذاكر */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة التذاكر</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم التذكرة</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الأولوية</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>التاريخ</TableHead>
                {hasRole('admin') && <TableHead>إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    لا توجد تذاكر
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map(ticket => (
                  <TableRow key={ticket.id} className={isSLABreached(ticket) ? 'bg-red-50' : ''}>
                    <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{ticket.title}</TableCell>
                    <TableCell>
                      {CATEGORIES.find(c => c.value === ticket.category)?.label}
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_LABELS[ticket.priority].color}>
                        {PRIORITY_LABELS[ticket.priority].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {STATUS_LABELS[ticket.status].icon}
                        <span>{STATUS_LABELS[ticket.status].label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ticket.sla_deadline && (
                        <span className={isSLABreached(ticket) ? 'text-red-600 font-medium' : ''}>
                          {isSLABreached(ticket) ? 'متجاوز' : formatDistanceToNow(new Date(ticket.sla_deadline), { locale: ar, addSuffix: true })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(ticket.created_at), { locale: ar, addSuffix: true })}
                    </TableCell>
                    {hasRole('admin') && (
                      <TableCell>
                        <div className="flex gap-1">
                          {ticket.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicket.mutate({ id: ticket.id, status: 'in_progress' })}
                            >
                              بدء المعالجة
                            </Button>
                          )}
                          {ticket.status === 'in_progress' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateTicket.mutate({ id: ticket.id, status: 'resolved' })}
                            >
                              تم الحل
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
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
