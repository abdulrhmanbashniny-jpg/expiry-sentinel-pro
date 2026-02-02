import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Loader2, CheckCircle2, AlertCircle, Building2, User, Briefcase, Hash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface InvitationData {
  id: string;
  email: string;
  full_name: string;
  employee_number: string | null;
  role: string;
  phone: string | null;
  tenant: {
    name: string;
    name_en: string | null;
    code: string;
  };
  department?: {
    name: string;
  };
  expires_at: string;
}

export default function ActivateAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const token = searchParams.get('token');
  const companyCode = searchParams.get('company');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const validateInvitation = async () => {
      if (!token || !companyCode) {
        setError('رابط التفعيل غير صالح');
        setIsLoading(false);
        return;
      }

      try {
        // Use secure RPC function to get invitation by token
        const { data: invitationData, error: invError } = await supabase
          .rpc('get_invitation_by_token', { p_token: token });

        if (invError) throw invError;

        if (!invitationData || invitationData.length === 0) {
          setError('رابط التفعيل غير موجود أو منتهي الصلاحية');
          setIsLoading(false);
          return;
        }

        const invData = invitationData[0];

        // Check invitation status
        if (invData.status === 'accepted') {
          setError('تم استخدام هذا الرابط مسبقاً. يمكنك تسجيل الدخول مباشرة.');
          setIsLoading(false);
          return;
        }

        if (invData.status === 'revoked') {
          setError('تم إلغاء هذه الدعوة من قبل الإدارة. يرجى التواصل مع مدير النظام للحصول على دعوة جديدة.');
          setIsLoading(false);
          return;
        }

        // Check expiration
        const expiresAt = new Date(invData.expires_at);
        if (new Date() > expiresAt) {
          setError('انتهت صلاحية هذه الدعوة. يرجى طلب دعوة جديدة من الإدارة.');
          setIsLoading(false);
          return;
        }

        // Only pending invitations can be activated
        if (invData.status !== 'pending') {
          setError('حالة الدعوة غير صالحة للتفعيل. يرجى التواصل مع الإدارة.');
          setIsLoading(false);
          return;
        }

        // Fetch tenant info separately using RPC or public data
        let tenantData = null;
        if (invData.tenant_id) {
          // Try to get tenant info - this may fail for anon users, which is fine
          const { data: tData } = await supabase
            .from('tenants')
            .select('name, name_en, code')
            .eq('id', invData.tenant_id)
            .maybeSingle();
          tenantData = tData;
        }

        setInvitation({
          id: invData.id,
          email: invData.email,
          full_name: invData.full_name || 'موظف جديد',
          employee_number: invData.employee_number,
          role: invData.role,
          phone: invData.phone,
          tenant: tenantData || { name: companyCode, name_en: null, code: companyCode },
          department: undefined,
          expires_at: invData.expires_at,
        });
      } catch (err: any) {
        console.error('Error validating invitation:', err);
        setError('حدث خطأ في التحقق من الدعوة');
      } finally {
        setIsLoading(false);
      }
    };

    validateInvitation();
  }, [token, companyCode]);

  const handleActivate = async () => {
    setPasswordError(null);

    if (password.length < 8) {
      setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('كلمات المرور غير متطابقة');
      return;
    }

    if (!invitation || !token) return;

    setIsActivating(true);

    try {
      // Create auth user via signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: {
            full_name: invitation.full_name,
            employee_number: invitation.employee_number,
            phone: invitation.phone,
          },
        },
      });

      if (authError) throw authError;

      // Use secure RPC function to activate invitation
      const { data: activated, error: activateError } = await supabase
        .rpc('activate_invitation', { p_token: token });

      if (activateError) {
        console.error('Failed to update invitation status:', activateError);
        // Don't throw - the user was created successfully
      }

      toast({
        title: 'تم تفعيل الحساب بنجاح! 🎉',
        description: 'يمكنك الآن تسجيل الدخول باستخدام بريدك وكلمة المرور الجديدة',
      });

      // Redirect to login
      setTimeout(() => {
        navigate('/auth');
      }, 2000);

    } catch (err: any) {
      console.error('Activation error:', err);
      
      if (err.message?.includes('already registered')) {
        setPasswordError('هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة.');
      } else {
        setPasswordError(err.message || 'حدث خطأ في تفعيل الحساب');
      }
    } finally {
      setIsActivating(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'employee': 'موظف',
      'supervisor': 'مشرف',
      'admin': 'مدير',
      'system_admin': 'مدير النظام',
    };
    return labels[role] || role;
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) return `${diffDays} يوم${diffDays > 1 ? '' : ''}`;
    if (diffHours > 0) return `${diffHours} ساعة`;
    return 'أقل من ساعة';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">جاري التحقق من الدعوة...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>خطأ في التفعيل</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              الذهاب لتسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <Bell className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">HR Expiry Reminder</h1>
          <p className="mt-1 text-muted-foreground">تفعيل الحساب</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Building2 className="h-5 w-5" />
              <span className="font-bold">{invitation.tenant.code}</span>
            </div>
            <CardTitle>{invitation.tenant.name}</CardTitle>
            {invitation.tenant.name_en && (
              <CardDescription>{invitation.tenant.name_en}</CardDescription>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Welcome message */}
            <Alert className="bg-primary/5 border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                مرحباً <strong>{invitation.full_name}</strong>، تم إنشاء حساب لك.
                <br />
                أدخل كلمة مرور جديدة لتفعيل حسابك.
              </AlertDescription>
            </Alert>

            {/* User info */}
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">الاسم:</span>
                <span className="font-medium">{invitation.full_name}</span>
              </div>
              {invitation.employee_number && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">رقم الموظف:</span>
                  <span className="font-medium">{invitation.employee_number}</span>
                </div>
              )}
              {invitation.department && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">القسم:</span>
                  <span className="font-medium">{invitation.department.name}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">الدور:</span>
                <span className="font-medium">{getRoleLabel(invitation.role)}</span>
              </div>
            </div>

            {/* Password form */}
            <form onSubmit={(e) => { e.preventDefault(); handleActivate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور الجديدة</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="8 أحرف على الأقل"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={passwordError ? 'border-destructive' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="أعد إدخال كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={passwordError ? 'border-destructive' : ''}
                />
              </div>

              {passwordError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isActivating}
              >
                {isActivating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'تفعيل الحساب'
                )}
              </Button>
            </form>

            {/* Expiration notice */}
            <p className="text-center text-xs text-muted-foreground">
              ⏰ صلاحية هذا الرابط: {formatTimeRemaining(invitation.expires_at)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
