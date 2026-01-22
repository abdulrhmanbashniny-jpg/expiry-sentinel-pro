import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useItems } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { useRecipients } from '@/hooks/useRecipients';
import { useReminderRules } from '@/hooks/useReminderRules';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useDynamicFields } from '@/hooks/useDynamicFields';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarIcon, ArrowRight, Loader2, Clock, AlertTriangle, Building2, User, Users, ListPlus, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const EditItem: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, isAdmin, isSystemAdmin, isSupervisor } = useAuth();
  const { items, isLoading: itemsLoading, updateItem } = useItems();
  const { categories } = useCategories();
  const { recipients } = useRecipients();
  const { rules } = useReminderRules();
  const { departments, isLoading: departmentsLoading } = useDepartments();
  const { users, departmentScopes } = useTeamManagement();

  const item = items.find(i => i.id === id);

  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    expiry_date: undefined as Date | undefined,
    expiry_time: '09:00',
    department_id: '',
    owner_department: '',
    responsible_person: '',
    notes: '',
    reminder_rule_id: '',
    dynamic_fields: {} as Record<string, string>,
  });
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Load initial data when item is available
  useEffect(() => {
    if (item && !initialLoadDone) {
      setFormData({
        title: item.title || '',
        category_id: item.category_id || '',
        expiry_date: item.expiry_date ? parseISO(item.expiry_date) : undefined,
        expiry_time: item.expiry_time || '09:00',
        department_id: item.department_id || '',
        owner_department: item.owner_department || '',
        responsible_person: item.responsible_person || '',
        notes: item.notes || '',
        reminder_rule_id: item.reminder_rule_id || '',
        dynamic_fields: (item.dynamic_fields as Record<string, string>) || {},
      });

      // Load item recipients
      loadItemRecipients();
      setInitialLoadDone(true);
    }
  }, [item, initialLoadDone]);

  const loadItemRecipients = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('item_recipients')
      .select('recipient_id')
      .eq('item_id', id);
    
    if (data) {
      setSelectedRecipients(data.map(r => r.recipient_id));
    }
  };

  // Dynamic fields based on selected department + category
  const { fields: dynamicFields, isLoading: dynamicFieldsLoading } = useDynamicFields(formData.department_id, formData.category_id);

  // Filter departments based on user's scope
  const userDepartments = useMemo(() => {
    if (!user) return departments;
    
    const userDeptIds = departmentScopes
      .filter(scope => scope.user_id === user.id)
      .map(scope => scope.department_id);
    
    if (userDeptIds.length === 0) {
      return departments;
    }
    
    return departments.filter(d => userDeptIds.includes(d.id));
  }, [user, departments, departmentScopes]);

  // Filter categories based on selected department
  const filteredCategories = formData.department_id 
    ? categories.filter(cat => {
        const catDeptId = (cat as any).department_id;
        return !catDeptId || catDeptId === formData.department_id;
      })
    : categories;

  // Filter recipients
  const filteredRecipients = recipients.filter(r => r.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

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

    setIsSubmitting(true);

    try {
      // Update item
      await updateItem.mutateAsync({
        id: id!,
        title: formData.title,
        category_id: formData.category_id || null,
        expiry_date: format(formData.expiry_date, 'yyyy-MM-dd'),
        expiry_time: formData.expiry_time,
        department_id: formData.department_id,
        owner_department: formData.owner_department,
        responsible_person: formData.responsible_person,
        notes: formData.notes,
        reminder_rule_id: formData.reminder_rule_id || null,
        dynamic_fields: formData.dynamic_fields,
      });

      // Update recipients - remove existing and add new
      await supabase
        .from('item_recipients')
        .delete()
        .eq('item_id', id);

      if (selectedRecipients.length > 0) {
        await supabase.from('item_recipients').insert(
          selectedRecipients.map(recipientId => ({
            item_id: id,
            recipient_id: recipientId,
          }))
        );
      }

      navigate(`/items/${id}`);
    } catch (error: any) {
      setValidationError(error.message || 'حدث خطأ أثناء تحديث المعاملة');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (itemsLoading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">العنصر غير موجود</p>
        <Button onClick={() => navigate('/items')}>
          <ArrowRight className="ml-2 h-4 w-4" />
          العودة للعناصر
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/items/${id}`)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">تعديل العنصر</h1>
          <p className="text-muted-foreground">{item.title}</p>
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
                    {userDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} {dept.code && `(${dept.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(v) => setFormData({ ...formData, category_id: v, dynamic_fields: {} })}
                  disabled={!formData.department_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.department_id ? "اختر الفئة" : "اختر القسم أولاً"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Fields */}
              {dynamicFields.length > 0 && (
                <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ListPlus className="h-4 w-4" />
                    حقول إضافية
                  </div>
                  {dynamicFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label>
                        {field.field_label}
                        {field.is_required && <span className="text-destructive mr-1">*</span>}
                      </Label>
                      {field.field_type === 'text' && (
                        <Input
                          value={formData.dynamic_fields[field.field_key] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            dynamic_fields: { ...formData.dynamic_fields, [field.field_key]: e.target.value }
                          })}
                          required={field.is_required}
                        />
                      )}
                      {field.field_type === 'number' && (
                        <Input
                          type="number"
                          value={formData.dynamic_fields[field.field_key] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            dynamic_fields: { ...formData.dynamic_fields, [field.field_key]: e.target.value }
                          })}
                          required={field.is_required}
                        />
                      )}
                      {field.field_type === 'date' && (
                        <Input
                          type="date"
                          value={formData.dynamic_fields[field.field_key] || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            dynamic_fields: { ...formData.dynamic_fields, [field.field_key]: e.target.value }
                          })}
                          required={field.is_required}
                        />
                      )}
                      {field.field_type === 'select' && field.field_options && (
                        <Select
                          value={formData.dynamic_fields[field.field_key] || ''}
                          onValueChange={(v) => setFormData({
                            ...formData,
                            dynamic_fields: { ...formData.dynamic_fields, [field.field_key]: v }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(field.field_options as string[]).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-right", !formData.expiry_date && "text-muted-foreground")}>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {formData.expiry_date ? format(formData.expiry_date, 'yyyy-MM-dd') : 'اختر التاريخ'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.expiry_date}
                        onSelect={(date) => setFormData({ ...formData, expiry_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    وقت الانتهاء
                  </Label>
                  <Input
                    type="time"
                    value={formData.expiry_time}
                    onChange={(e) => setFormData({ ...formData, expiry_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  المسؤول
                </Label>
                <Input
                  value={formData.responsible_person}
                  onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                  placeholder="اسم المسؤول"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الإعدادات والمستلمون</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>قاعدة التذكير</Label>
                <Select 
                  value={formData.reminder_rule_id} 
                  onValueChange={(v) => setFormData({ ...formData, reminder_rule_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر قاعدة التذكير" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.filter(r => r.is_active).map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name} ({rule.days_before?.join('، ')} يوم)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  المستلمون
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border p-3">
                  {filteredRecipients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا يوجد مستلمون متاحون</p>
                  ) : (
                    filteredRecipients.map((recipient) => (
                      <div key={recipient.id} className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id={`recipient-${recipient.id}`}
                          checked={selectedRecipients.includes(recipient.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRecipients(prev => [...prev, recipient.id]);
                            } else {
                              setSelectedRecipients(prev => prev.filter(id => id !== recipient.id));
                            }
                          }}
                        />
                        <label
                          htmlFor={`recipient-${recipient.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                          {recipient.name}
                          {recipient.telegram_id && <Badge variant="outline" className="text-xs">TG</Badge>}
                          {recipient.whatsapp_number && <Badge variant="outline" className="text-xs">WA</Badge>}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {selectedRecipients.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedRecipients.length} مستلم محدد
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full gap-2" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    حفظ التغييرات
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
};

export default EditItem;
