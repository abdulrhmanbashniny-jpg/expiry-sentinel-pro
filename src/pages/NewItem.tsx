import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useItems } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { useRecipients } from '@/hooks/useRecipients';
import { useReminderRules } from '@/hooks/useReminderRules';
import { useDepartments } from '@/hooks/useDepartments';
import { CalendarIcon, ArrowRight, Loader2, Clock, AlertTriangle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const NewItem: React.FC = () => {
  const navigate = useNavigate();
  const { createItem } = useItems();
  const { categories } = useCategories();
  const { recipients } = useRecipients();
  const { rules } = useReminderRules();
  const { departments, isLoading: departmentsLoading } = useDepartments();

  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    expiry_date: undefined as Date | undefined,
    expiry_time: '09:00',
    department_id: '', // Required field
    owner_department: '',
    responsible_person: '',
    notes: '',
    reminder_rule_id: '',
  });
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Data Quality Guard: Validate required fields
    if (!formData.title) {
      setValidationError('يجب إدخال عنوان المعاملة');
      return;
    }
    if (!formData.expiry_date) {
      setValidationError('يجب تحديد تاريخ الانتهاء');
      return;
    }
    if (!formData.department_id) {
      setValidationError('يجب تحديد القسم المالك للمعاملة');
      return;
    }

    try {
      await createItem.mutateAsync({
        title: formData.title,
        category_id: formData.category_id || null,
        expiry_date: format(formData.expiry_date, 'yyyy-MM-dd'),
        expiry_time: formData.expiry_time,
        department_id: formData.department_id,
        owner_department: formData.owner_department,
        responsible_person: formData.responsible_person,
        notes: formData.notes,
        reminder_rule_id: formData.reminder_rule_id,
        recipient_ids: selectedRecipients,
      });
      navigate('/items');
    } catch (error: any) {
      setValidationError(error.message || 'حدث خطأ أثناء إنشاء المعاملة');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/items')}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">إضافة عنصر جديد</h1>
          <p className="text-muted-foreground">أضف ترخيص أو عقد أو وثيقة جديدة</p>
        </div>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>المعلومات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">العنوان *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: رخصة عمل - شركة X"
                  required
                />
              </div>

              {/* Department Selection - Required with Data Quality Guard */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  القسم المالك *
                </Label>
                <Select 
                  value={formData.department_id} 
                  onValueChange={(v) => setFormData({ ...formData, department_id: v })}
                >
                  <SelectTrigger className={cn(!formData.department_id && "border-destructive")}>
                    <SelectValue placeholder={departmentsLoading ? "جاري التحميل..." : "اختر القسم"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} {dept.code && `(${dept.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {departments.length === 0 && !departmentsLoading && (
                  <p className="text-sm text-destructive">لا توجد أقسام. يرجى إنشاء قسم أولاً من صفحة إدارة الأقسام.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-right", !formData.expiry_date && "text-muted-foreground")}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {formData.expiry_date ? format(formData.expiry_date, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={formData.expiry_date} onSelect={(d) => setFormData({ ...formData, expiry_date: d })} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>وقت التنبيه</Label>
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="time"
                      value={formData.expiry_time}
                      onChange={(e) => setFormData({ ...formData, expiry_time: e.target.value })}
                      className="pr-10"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="department">اسم القسم (نص)</Label>
                  <Input id="department" value={formData.owner_department} onChange={(e) => setFormData({ ...formData, owner_department: e.target.value })} placeholder="اختياري - للتوافق مع النظام القديم" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsible">المسؤول</Label>
                  <Input id="responsible" value={formData.responsible_person} onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>قاعدة التذكير</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.reminder_rule_id} onValueChange={(v) => setFormData({ ...formData, reminder_rule_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر قاعدة التذكير" /></SelectTrigger>
                  <SelectContent>
                    {rules.filter(r => r.is_active).map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name} ({rule.days_before.join(', ')} يوم)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>المستلمون</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {recipients.filter(r => r.is_active).map((recipient) => (
                    <div key={recipient.id} className="flex items-center gap-3">
                      <Checkbox
                        id={recipient.id}
                        checked={selectedRecipients.includes(recipient.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRecipients(checked
                            ? [...selectedRecipients, recipient.id]
                            : selectedRecipients.filter(id => id !== recipient.id)
                          );
                        }}
                      />
                      <Label htmlFor={recipient.id} className="flex-1 cursor-pointer">
                        <span className="font-medium">{recipient.name}</span>
                        <span className="block text-sm text-muted-foreground">{recipient.whatsapp_number}</span>
                      </Label>
                    </div>
                  ))}
                  {recipients.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد مستلمون. أضف مستلمين أولاً.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={createItem.isPending || !formData.department_id}>
            {createItem.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            حفظ العنصر
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/items')}>إلغاء</Button>
        </div>
      </form>
    </div>
  );
};

export default NewItem;
