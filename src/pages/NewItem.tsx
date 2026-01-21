import React, { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useItems } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { useRecipients } from '@/hooks/useRecipients';
import { useReminderRules } from '@/hooks/useReminderRules';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useDynamicFields } from '@/hooks/useDynamicFields';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarIcon, ArrowRight, Loader2, Clock, AlertTriangle, Building2, User, Users, ListPlus, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import VehicleImportDialogContent from '@/components/items/VehicleImportDialog';

const NewItem: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, isEmployee, isSupervisor, isAdmin, isSystemAdmin } = useAuth();
  const canImport = isAdmin || isSystemAdmin || role === 'supervisor';
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { createItem } = useItems();
  const { categories } = useCategories();
  const { recipients } = useRecipients();
  const { rules } = useReminderRules();
  const { departments, isLoading: departmentsLoading } = useDepartments();
  const { users, teamMembers, departmentScopes } = useTeamManagement();

  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    expiry_date: undefined as Date | undefined,
    expiry_time: '09:00',
    department_id: '',
    owner_department: '',
    responsible_person: '',
    responsible_user_id: '',
    notes: '',
    reminder_rule_id: '',
    dynamic_fields: {} as Record<string, string>,
  });
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Dynamic fields based on selected department + category
  const { fields: dynamicFields, isLoading: dynamicFieldsLoading } = useDynamicFields(formData.department_id, formData.category_id);

  // Filter departments based on user's scope (users only see their assigned departments)
  const userDepartments = useMemo(() => {
    if (!user) return departments;
    
    // Get department IDs the user has access to
    const userDeptIds = departmentScopes
      .filter(scope => scope.user_id === user.id)
      .map(scope => scope.department_id);
    
    // If user has no scopes, show all (for admins) or none
    if (userDeptIds.length === 0) {
      // Admins see all
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

  // Get users in the selected department
  const getDepartmentUsers = () => {
    if (!formData.department_id) return [];
    
    const deptUserIds = departmentScopes
      .filter(scope => scope.department_id === formData.department_id)
      .map(scope => scope.user_id);
    
    return users.filter(u => deptUserIds.includes(u.profile.user_id));
  };

  const departmentUsers = getDepartmentUsers();

  // Filter recipients based on selected department
  const filteredRecipients = recipients.filter(r => r.is_active);

  // Auto-assign responsible person based on user role
  const getAutoAssignedResponsible = () => {
    if (!user) return null;
    
    // If employee → assign to their supervisor
    if (isEmployee) {
      const teamRelation = teamMembers.find(tm => tm.employee_id === user.id);
      if (teamRelation) {
        const supervisor = users.find(u => u.profile.user_id === teamRelation.supervisor_id);
        return supervisor;
      }
    }
    
    // If supervisor → assign to department manager
    if (isSupervisor && formData.department_id) {
      const dept = departments.find(d => d.id === formData.department_id);
      if (dept?.manager_user_id) {
        const manager = users.find(u => u.profile.user_id === dept.manager_user_id);
        return manager;
      }
    }
    
    return null;
  };

  // Auto-set responsible when department changes or on initial load
  useEffect(() => {
    if (!formData.responsible_user_id) {
      const autoAssigned = getAutoAssignedResponsible();
      if (autoAssigned) {
        setFormData(prev => ({
          ...prev,
          responsible_user_id: autoAssigned.profile.user_id,
          responsible_person: (autoAssigned.profile as any).full_name || ''
        }));
      }
    }
  }, [formData.department_id, user, teamMembers, departments]);

  // When responsible person changes, auto-add them as recipient
  useEffect(() => {
    if (formData.responsible_user_id) {
      const user = users.find(u => u.profile.user_id === formData.responsible_user_id);
      if (user) {
        // Find matching recipient by phone or name
        const matchingRecipient = recipients.find(r => 
          r.whatsapp_number === (user.profile as any).phone ||
          r.name === (user.profile as any).full_name
        );
        
        if (matchingRecipient && !selectedRecipients.includes(matchingRecipient.id)) {
          setSelectedRecipients(prev => [...prev, matchingRecipient.id]);
        }
        
        // Update responsible_person text
        setFormData(prev => ({
          ...prev,
          responsible_person: (user.profile as any).full_name || ''
        }));
      }
    }
  }, [formData.responsible_user_id, users, recipients]);

  // Reset category when department changes
  useEffect(() => {
    if (formData.department_id) {
      const currentCategory = categories.find(c => c.id === formData.category_id);
      const catDeptId = (currentCategory as any)?.department_id;
      
      // If current category doesn't belong to new department, reset it
      if (catDeptId && catDeptId !== formData.department_id) {
        setFormData(prev => ({ ...prev, category_id: '' }));
      }
    }
  }, [formData.department_id, categories]);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/items')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">إضافة عنصر جديد</h1>
            <p className="text-muted-foreground">أضف ترخيص أو عقد أو وثيقة جديدة</p>
          </div>
        </div>
        
        {/* Excel Import Button - Only for admins and supervisors */}
        {canImport && (
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                استيراد من Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>استيراد مركبات من Excel</DialogTitle>
              </DialogHeader>
              <VehicleImportDialogContent 
                onSuccess={() => {
                  setImportDialogOpen(false);
                  navigate('/items');
                }}
                onCancel={() => setImportDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
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

              {/* Department Selection - Required (filtered by user scope) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  القسم المالك *
                </Label>
                <Select 
                  value={formData.department_id} 
                  onValueChange={(v) => setFormData({ ...formData, department_id: v, responsible_user_id: '', responsible_person: '' })}
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
                {userDepartments.length === 0 && !departmentsLoading && (
                  <p className="text-sm text-destructive">لا توجد أقسام ضمن نطاقك. تواصل مع المسؤول.</p>
                )}
              </div>

              {/* Category - Filtered by Department */}
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
                        {(cat as any).department_id && (
                          <Badge variant="outline" className="mr-2 text-xs">خاص بالقسم</Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.department_id && filteredCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">لا توجد فئات لهذا القسم</p>
                )}
              </div>

              {/* Dynamic Fields based on Department + Category */}
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
              {dynamicFieldsLoading && formData.department_id && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري تحميل الحقول الإضافية...
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

              {/* Responsible Person - Auto-assigned based on role, with manual override */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  المسؤول
                  {formData.responsible_user_id && getAutoAssignedResponsible()?.profile.user_id === formData.responsible_user_id && (
                    <Badge variant="secondary" className="text-xs">تعيين تلقائي</Badge>
                  )}
                </Label>
                {formData.department_id && departmentUsers.length > 0 ? (
                  <Select 
                    value={formData.responsible_user_id} 
                    onValueChange={(v) => {
                      const selectedUser = users.find(u => u.profile.user_id === v);
                      setFormData({ 
                        ...formData, 
                        responsible_user_id: v,
                        responsible_person: (selectedUser?.profile as any)?.full_name || ''
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المسؤول من القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentUsers.map((u) => (
                        <SelectItem key={u.profile.user_id} value={u.profile.user_id}>
                          {(u.profile as any).full_name || (u.profile as any).email}
                          {getAutoAssignedResponsible()?.profile.user_id === u.profile.user_id && (
                            <span className="text-muted-foreground mr-2">(مقترح)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    value={formData.responsible_person} 
                    onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })} 
                    placeholder={formData.department_id ? "لا يوجد مستخدمين في القسم" : "اختر القسم أولاً"}
                  />
                )}
                {isEmployee && (
                  <p className="text-xs text-muted-foreground">سيتم تعيين مشرفك المباشر تلقائياً</p>
                )}
                {isSupervisor && (
                  <p className="text-xs text-muted-foreground">سيتم تعيين مدير القسم تلقائياً</p>
                )}
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
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  المستلمون
                  {selectedRecipients.length > 0 && (
                    <Badge variant="secondary">{selectedRecipients.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {filteredRecipients.map((recipient) => {
                    const isAutoSelected = formData.responsible_user_id && 
                      users.find(u => 
                        u.profile.user_id === formData.responsible_user_id && 
                        ((u.profile as any).phone === recipient.whatsapp_number || 
                         (u.profile as any).full_name === recipient.name)
                      );
                    
                    return (
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
                        {isAutoSelected && (
                          <Badge variant="outline" className="text-xs">المسؤول</Badge>
                        )}
                      </div>
                    );
                  })}
                  {filteredRecipients.length === 0 && (
                    <p className="text-sm text-muted-foreground">لا يوجد مستلمون. أضف مستلمين أولاً.</p>
                  )}
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
