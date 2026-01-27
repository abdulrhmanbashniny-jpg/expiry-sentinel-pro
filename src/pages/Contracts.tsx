import React, { useState } from 'react';
import { useContracts, Contract } from '@/hooks/useContracts';
import { useDepartments } from '@/hooks/useDepartments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, AlertTriangle, Calendar, Building2, RefreshCw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';

const CONTRACT_TYPES = [
  { value: 'employment', label: 'عقد توظيف' },
  { value: 'service', label: 'عقد خدمات' },
  { value: 'vendor', label: 'عقد مورد' },
  { value: 'lease', label: 'عقد إيجار' },
  { value: 'maintenance', label: 'عقد صيانة' },
];

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'مسودة', variant: 'secondary' },
  active: { label: 'نشط', variant: 'default' },
  expired: { label: 'منتهي', variant: 'destructive' },
  renewed: { label: 'مُجدد', variant: 'default' },
  terminated: { label: 'ملغي', variant: 'outline' },
};

export default function Contracts() {
  const { contracts, isLoading, expiringContracts, createContract, updateContract, deleteContract } = useContracts();
  const { departments } = useDepartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Contract>>({
    contract_type: 'employment',
    renewal_type: 'manual',
    currency: 'SAR',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createContract.mutateAsync(formData);
    setIsDialogOpen(false);
    setFormData({ contract_type: 'employment', renewal_type: 'manual', currency: 'SAR' });
  };

  const getDaysToExpiry = (endDate: string) => {
    return differenceInDays(new Date(endDate), new Date());
  };

  const getExpiryBadge = (days: number) => {
    if (days < 0) return <Badge variant="destructive">منتهي منذ {Math.abs(days)} يوم</Badge>;
    if (days <= 7) return <Badge variant="destructive">ينتهي خلال {days} أيام</Badge>;
    if (days <= 30) return <Badge variant="secondary">ينتهي خلال {days} يوم</Badge>;
    return <Badge variant="outline">{days} يوم متبقي</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة العقود</h1>
          <p className="text-muted-foreground">متابعة العقود والتجديدات</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-2 h-4 w-4" /> عقد جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إضافة عقد جديد</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>عنوان العقد *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>نوع العقد</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={v => setFormData({ ...formData, contract_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الطرف الآخر *</Label>
                  <Input
                    value={formData.party_name || ''}
                    onChange={e => setFormData({ ...formData, party_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>معلومات التواصل</Label>
                  <Input
                    value={formData.party_contact || ''}
                    onChange={e => setFormData({ ...formData, party_contact: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ البداية *</Label>
                  <Input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء *</Label>
                  <Input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>القسم</Label>
                  <Select
                    value={formData.department_id || ''}
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
                  <Label>نوع التجديد</Label>
                  <Select
                    value={formData.renewal_type}
                    onValueChange={v => setFormData({ ...formData, renewal_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">تجديد تلقائي</SelectItem>
                      <SelectItem value="manual">تجديد يدوي</SelectItem>
                      <SelectItem value="none">بدون تجديد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>قيمة العقد</Label>
                  <Input
                    type="number"
                    value={formData.value || ''}
                    onChange={e => setFormData({ ...formData, value: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>العملة</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={v => setFormData({ ...formData, currency: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">ريال سعودي</SelectItem>
                      <SelectItem value="USD">دولار أمريكي</SelectItem>
                      <SelectItem value="EUR">يورو</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={createContract.isPending}>
                  {createContract.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* تنبيهات العقود القريبة من الانتهاء */}
      {expiringContracts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              عقود تنتهي قريباً ({expiringContracts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {expiringContracts.map(contract => (
                <div key={contract.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{contract.title}</p>
                    <p className="text-sm text-muted-foreground">{contract.party_name}</p>
                  </div>
                  {getExpiryBadge(getDaysToExpiry(contract.end_date))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* إحصائيات */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العقود</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">العقود النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {contracts.filter(c => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">تنتهي خلال 30 يوم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{expiringContracts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">المنتهية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {contracts.filter(c => c.status === 'expired').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جدول العقود */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة العقود</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العقد</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الطرف الآخر</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التجديد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد عقود
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map(contract => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">{contract.contract_number}</TableCell>
                    <TableCell className="font-medium">{contract.title}</TableCell>
                    <TableCell>{contract.party_name}</TableCell>
                    <TableCell>
                      {CONTRACT_TYPES.find(t => t.value === contract.contract_type)?.label}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{format(new Date(contract.end_date), 'yyyy/MM/dd', { locale: ar })}</span>
                        {getExpiryBadge(getDaysToExpiry(contract.end_date))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[contract.status]?.variant || 'default'}>
                        {STATUS_LABELS[contract.status]?.label || contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contract.renewal_type === 'auto' && (
                        <Badge variant="outline" className="gap-1">
                          <RefreshCw className="h-3 w-3" /> تلقائي
                        </Badge>
                      )}
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
