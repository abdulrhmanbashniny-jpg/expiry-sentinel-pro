import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Edit, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDepartments } from '@/hooks/useDepartments';
import { AppRole } from '@/types/database';

interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  employee_number: string | null;
  role: string;
  department_id: string | null;
}

interface EditInvitationDialogProps {
  invitation: Invitation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditInvitationDialog({ invitation, open, onOpenChange, onSuccess }: EditInvitationDialogProps) {
  const { toast } = useToast();
  const { departments } = useDepartments();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  
  const [form, setForm] = useState({
    full_name: invitation.full_name || '',
    email: invitation.email || '',
    phone: invitation.phone || '',
    employee_number: invitation.employee_number || '',
    department_id: invitation.department_id || '',
    role: invitation.role as AppRole,
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'email' && value !== invitation.email) {
      setEmailChanged(true);
    } else if (field === 'email') {
      setEmailChanged(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) {
      toast({ 
        title: 'خطأ', 
        description: 'الاسم والبريد الإلكتروني مطلوبان', 
        variant: 'destructive' 
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          employee_number: form.employee_number || null,
          department_id: form.department_id || null,
          role: form.role,
        })
        .eq('id', invitation.id);

      if (error) throw error;

      toast({
        title: 'تم تحديث بيانات الدعوة',
        description: emailChanged 
          ? 'تم تغيير البريد الإلكتروني. قد تحتاج إلى إعادة إرسال الدعوة.'
          : 'تم حفظ التعديلات بنجاح',
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Update error:', err);
      toast({ 
        title: 'خطأ في التحديث', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            تعديل بيانات الدعوة
          </DialogTitle>
          <DialogDescription>
            تعديل بيانات الموظف قبل تفعيل حسابه
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {emailChanged && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                تغيير البريد الإلكتروني قد يتطلب إعادة إرسال رابط التفعيل.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">الاسم الكامل *</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="أحمد محمد"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_number">رقم الموظف</Label>
              <Input
                id="employee_number"
                value={form.employee_number}
                onChange={(e) => handleChange('employee_number', e.target.value)}
                placeholder="1001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="ahmed@company.com"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">رقم الجوال</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="966501234567"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select
                value={form.department_id || '__none__'}
                onValueChange={(v) => handleChange('department_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون قسم</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select
                value={form.role}
                onValueChange={(v) => handleChange('role', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                  <SelectItem value="admin">مدير</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الحفظ...
              </>
            ) : (
              'حفظ التعديلات'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
