import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, MessageSquare, UserPlus, CheckCircle2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { AppRole, ROLE_LABELS } from '@/types/database';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: { id: string; name: string }[];
  onSuccess: () => void;
}

export const InviteUserDialog: React.FC<InviteUserDialogProps> = ({
  open,
  onOpenChange,
  departments,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    employee_number: '',
    department_id: '',
    role: 'employee' as AppRole,
    send_email: true,
    send_whatsapp: false,
  });

  const resetForm = () => {
    setForm({
      full_name: '',
      email: '',
      phone: '',
      employee_number: '',
      department_id: '',
      role: 'employee',
      send_email: true,
      send_whatsapp: false,
    });
    setInviteSuccess(false);
    setInviteLink('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const generateToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

    if (!currentTenant) {
      toast({ 
        title: 'خطأ', 
        description: 'يرجى تحديد شركة أولاً', 
        variant: 'destructive' 
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', form.email)
        .maybeSingle();

      if (existingUser) {
        toast({ 
          title: 'خطأ', 
          description: 'البريد الإلكتروني مسجل مسبقاً', 
          variant: 'destructive' 
        });
        setIsSubmitting(false);
        return;
      }

      // Check for existing pending invitation
      const { data: existingInvite } = await supabase
        .from('user_invitations')
        .select('id, status')
        .eq('email', form.email)
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        toast({ 
          title: 'تنبيه', 
          description: 'يوجد دعوة معلقة لهذا البريد. يمكنك إعادة إرسالها من قائمة الدعوات.', 
          variant: 'destructive' 
        });
        setIsSubmitting(false);
        return;
      }

      // Generate invitation token
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create invitation
      const { error: inviteError } = await supabase
        .from('user_invitations')
        .insert({
          tenant_id: currentTenant.id,
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || null,
          employee_number: form.employee_number || null,
          department_id: form.department_id || null,
          role: form.role,
          token,
          expires_at: expiresAt.toISOString(),
          invited_by: user?.id,
          status: 'pending',
        });

      if (inviteError) throw inviteError;

      // Generate activation link
      const baseUrl = window.location.origin;
      const activationLink = `${baseUrl}/activate?token=${token}&company=${currentTenant.code}`;
      setInviteLink(activationLink);

      // Email notification - currently disabled (no email service configured)
      // Invitation is available via activation link or WhatsApp
      if (form.send_email) {
        console.log('Email invitation requested but no email service configured. Use activation link or WhatsApp.');
      }

      // Send WhatsApp notification (if enabled and phone provided)
      if (form.send_whatsapp && form.phone) {
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: form.phone,
              message: `مرحباً ${form.full_name} 👋\n\nتم إنشاء حساب لك على HR Reminder\n\n🏢 ${currentTenant.name}\n🔑 كود الشركة: ${currentTenant.code}\n📧 بريدك: ${form.email}\n\nلتفعيل حسابك (صالح 7 أيام):\n🔗 ${activationLink}`,
            },
          });
        } catch (whatsappErr) {
          console.warn('WhatsApp sending failed:', whatsappErr);
        }
      }

      setInviteSuccess(true);
      toast({
        title: 'تم إرسال الدعوة بنجاح! 🎉',
        description: `تم إرسال دعوة إلى ${form.full_name}`,
      });
      
      onSuccess();

    } catch (err: any) {
      console.error('Invitation error:', err);
      toast({ 
        title: 'خطأ في إرسال الدعوة', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({ title: 'تم نسخ الرابط' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {inviteSuccess ? 'تم إرسال الدعوة' : 'دعوة موظف جديد'}
          </DialogTitle>
          <DialogDescription>
            {inviteSuccess 
              ? 'تم إرسال دعوة التفعيل بنجاح' 
              : 'أدخل بيانات الموظف لإرسال دعوة التسجيل'}
          </DialogDescription>
        </DialogHeader>

        {inviteSuccess ? (
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                تم إرسال الدعوة إلى <strong>{form.full_name}</strong> بنجاح!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>رابط التفعيل (للنسخ يدوياً)</Label>
              <div className="flex gap-2">
                <Input 
                  value={inviteLink} 
                  readOnly 
                  className="text-xs font-mono"
                  dir="ltr"
                />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                صالح لمدة 7 أيام
              </p>
            </div>

            <DialogFooter>
              <Button onClick={resetForm} variant="outline">
                دعوة موظف آخر
              </Button>
              <Button onClick={handleClose}>
                إغلاق
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">الاسم الكامل *</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="أحمد محمد"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee_number">رقم الموظف</Label>
                <Input
                  id="employee_number"
                  value={form.employee_number}
                  onChange={(e) => setForm({ ...form, employee_number: e.target.value })}
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
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ahmed@company.com"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="966501234567"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select
                  value={form.department_id}
                  onValueChange={(v) => setForm({ ...form, department_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
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
                  onValueChange={(v) => setForm({ ...form, role: v as AppRole })}
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

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm text-muted-foreground">إرسال الدعوة عبر:</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send_email"
                    checked={form.send_email}
                    onCheckedChange={(checked) => setForm({ ...form, send_email: !!checked })}
                  />
                  <Label htmlFor="send_email" className="flex items-center gap-1 cursor-pointer">
                    <Mail className="h-4 w-4" />
                    البريد الإلكتروني
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send_whatsapp"
                    checked={form.send_whatsapp}
                    onCheckedChange={(checked) => setForm({ ...form, send_whatsapp: !!checked })}
                    disabled={!form.phone}
                  />
                  <Label htmlFor="send_whatsapp" className="flex items-center gap-1 cursor-pointer">
                    <MessageSquare className="h-4 w-4" />
                    واتساب
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                إلغاء
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 ml-2" />
                    إرسال الدعوة
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
