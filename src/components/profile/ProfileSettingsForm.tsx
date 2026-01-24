import React, { useState } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Save, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProfileData {
  phone: string;
  telegram_user_id: string;
  allow_whatsapp: boolean;
  allow_telegram: boolean;
  email: string;
}

export default function ProfileSettingsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile state
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('phone, telegram_user_id, allow_whatsapp, allow_telegram, email')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState<ProfileData>({
    phone: '',
    telegram_user_id: '',
    allow_whatsapp: false,
    allow_telegram: false,
    email: '',
  });

  // Update form when profile loads
  React.useEffect(() => {
    if (profile) {
      setFormData({
        phone: profile.phone || '',
        telegram_user_id: profile.telegram_user_id || '',
        allow_whatsapp: profile.allow_whatsapp || false,
        allow_telegram: profile.allow_telegram || false,
        email: profile.email || '',
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      if (!user?.id) throw new Error('غير مسجل الدخول');
      
      // Validate phone format
      if (data.phone && !/^(\+?966)?[0-9]{9,10}$/.test(data.phone.replace(/\s/g, ''))) {
        throw new Error('صيغة رقم الجوال غير صحيحة');
      }

      // Validate telegram ID (should be numeric)
      if (data.telegram_user_id && !/^\d+$/.test(data.telegram_user_id)) {
        throw new Error('معرف تيليجرام يجب أن يكون رقمياً');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          phone: data.phone,
          telegram_user_id: data.telegram_user_id || null,
          allow_whatsapp: data.allow_whatsapp,
          allow_telegram: data.allow_telegram,
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile-settings'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      setProfileSuccess(true);
      setProfileError('');
      toast({ title: 'تم حفظ التغييرات بنجاح' });
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (error: Error) => {
      setProfileError(error.message);
      setProfileSuccess(false);
    },
  });

  // Handle password change
  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة غير متطابقة');
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Log password change
      await supabase.from('password_audit_log').insert({
        user_id: user?.id,
        action: 'password_changed_by_user',
        performed_by: user?.id,
      });

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'تم تغيير كلمة المرور بنجاح' });
    } catch (error: any) {
      setPasswordError(error.message || 'فشل تغيير كلمة المرور');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle email change
  const handleEmailChange = async () => {
    setEmailError('');
    setEmailSuccess(false);

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError('صيغة البريد الإلكتروني غير صحيحة');
      return;
    }

    setIsChangingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      // Update email in profiles table too
      await supabase
        .from('profiles')
        .update({ email: newEmail })
        .eq('user_id', user?.id);

      setEmailSuccess(true);
      toast({
        title: 'تم إرسال رابط التأكيد',
        description: 'يرجى التحقق من بريدك الإلكتروني الجديد لتأكيد التغيير',
      });
    } catch (error: any) {
      setEmailError(error.message || 'فشل تغيير البريد الإلكتروني');
    } finally {
      setIsChangingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات التواصل</CardTitle>
          <CardDescription>تعديل رقم الجوال ومعرف تيليجرام</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          )}
          
          {profileSuccess && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <Check className="h-4 w-4" />
              <AlertDescription>تم حفظ التغييرات بنجاح</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+966XXXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                صيغة سعودية: 966XXXXXXXXX
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram_id">معرف تيليجرام (Chat ID)</Label>
              <Input
                id="telegram_id"
                type="text"
                placeholder="123456789"
                value={formData.telegram_user_id}
                onChange={(e) => setFormData({ ...formData, telegram_user_id: e.target.value })}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                رقم معرف الدردشة من تيليجرام
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">قنوات الإشعارات</h4>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600">📱</span>
                </div>
                <div>
                  <p className="font-medium">واتساب</p>
                  <p className="text-sm text-muted-foreground">
                    استقبال التنبيهات عبر واتساب
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.allow_whatsapp}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, allow_whatsapp: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600">✈️</span>
                </div>
                <div>
                  <p className="font-medium">تيليجرام</p>
                  <p className="text-sm text-muted-foreground">
                    استقبال التنبيهات عبر تيليجرام
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.allow_telegram}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, allow_telegram: checked })
                }
              />
            </div>
          </div>

          <Button
            onClick={() => updateProfile.mutate(formData)}
            disabled={updateProfile.isPending}
            className="w-full sm:w-auto"
          >
            {updateProfile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Save className="h-4 w-4 ml-2" />
            )}
            حفظ التغييرات
          </Button>
        </CardContent>
      </Card>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle>تغيير كلمة المرور</CardTitle>
          <CardDescription>تحديث كلمة المرور الخاصة بحسابك</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}
          
          {passwordSuccess && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <Check className="h-4 w-4" />
              <AlertDescription>تم تغيير كلمة المرور بنجاح</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة"
                  dir="ltr"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                يجب أن تكون 8 أحرف على الأقل
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirm-password"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة المرور الجديدة"
                dir="ltr"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">
                  كلمة المرور غير متطابقة
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={isChangingPassword || !newPassword || !confirmPassword}
            variant="secondary"
          >
            {isChangingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : null}
            تغيير كلمة المرور
          </Button>
        </CardContent>
      </Card>

      {/* Email Change Card */}
      <Card>
        <CardHeader>
          <CardTitle>تغيير البريد الإلكتروني</CardTitle>
          <CardDescription>
            تحديث البريد الإلكتروني المستخدم لتسجيل الدخول
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{emailError}</AlertDescription>
            </Alert>
          )}
          
          {emailSuccess && (
            <Alert className="border-green-500 bg-green-50 text-green-700">
              <Check className="h-4 w-4" />
              <AlertDescription>
                تم إرسال رابط التأكيد إلى بريدك الإلكتروني الجديد
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>البريد الإلكتروني الحالي</Label>
            <Input
              value={user?.email || ''}
              disabled
              dir="ltr"
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-email">البريد الإلكتروني الجديد</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="example@domain.com"
              dir="ltr"
            />
          </div>

          <Button
            onClick={handleEmailChange}
            disabled={isChangingEmail || !newEmail}
            variant="secondary"
          >
            {isChangingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : null}
            تغيير البريد الإلكتروني
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
