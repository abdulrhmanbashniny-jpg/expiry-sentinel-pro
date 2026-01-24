import React, { useState, useEffect } from 'react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Save, Eye, EyeOff, Check, AlertCircle, Phone, MessageSquare, Mail, KeyRound } from 'lucide-react';
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

// Phone validation for Saudi format
const validateSaudiPhone = (phone: string): { valid: boolean; message: string } => {
  if (!phone) return { valid: true, message: '' };
  
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  
  // Accept formats: 966XXXXXXXXX, 05XXXXXXXX, 5XXXXXXXX
  if (/^966\d{9}$/.test(cleaned)) return { valid: true, message: '' };
  if (/^05\d{8}$/.test(cleaned)) return { valid: true, message: '' };
  if (/^5\d{8}$/.test(cleaned)) return { valid: true, message: '' };
  
  return { valid: false, message: 'صيغة غير صحيحة. استخدم: 966XXXXXXXXX أو 05XXXXXXXX' };
};

// Telegram ID validation
const validateTelegramId = (id: string): { valid: boolean; message: string } => {
  if (!id) return { valid: true, message: '' }; // Optional field
  
  const cleaned = id.trim();
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: 'معرف تيليجرام يجب أن يكون رقمياً فقط' };
  }
  
  if (cleaned.length < 5 || cleaned.length > 15) {
    return { valid: false, message: 'معرف تيليجرام يجب أن يكون بين 5-15 رقم' };
  }
  
  return { valid: true, message: '' };
};

// Email validation
const validateEmail = (email: string): { valid: boolean; message: string } => {
  if (!email) return { valid: false, message: 'البريد الإلكتروني مطلوب' };
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, message: 'صيغة البريد الإلكتروني غير صحيحة' };
  }
  
  return { valid: true, message: '' };
};

// Password validation
const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (!password) return { valid: false, message: 'كلمة المرور مطلوبة' };
  
  if (password.length < 8) {
    return { valid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  }
  
  // Check for at least one number and one letter
  if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'كلمة المرور يجب أن تحتوي على أحرف وأرقام' };
  }
  
  return { valid: true, message: '' };
};

export default function ProfileSettingsForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile validation errors
  const [phoneError, setPhoneError] = useState('');
  const [telegramError, setTelegramError] = useState('');

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
  useEffect(() => {
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

  // Real-time validation for phone
  const handlePhoneChange = (value: string) => {
    setFormData({ ...formData, phone: value });
    const validation = validateSaudiPhone(value);
    setPhoneError(validation.valid ? '' : validation.message);
  };

  // Real-time validation for telegram
  const handleTelegramChange = (value: string) => {
    setFormData({ ...formData, telegram_user_id: value });
    const validation = validateTelegramId(value);
    setTelegramError(validation.valid ? '' : validation.message);
  };

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      if (!user?.id) throw new Error('غير مسجل الدخول');
      
      // Validate phone format
      const phoneValidation = validateSaudiPhone(data.phone || '');
      if (!phoneValidation.valid) {
        throw new Error(phoneValidation.message);
      }

      // Validate telegram ID
      const telegramValidation = validateTelegramId(data.telegram_user_id || '');
      if (!telegramValidation.valid) {
        throw new Error(telegramValidation.message);
      }

      // Normalize phone to 966 format if provided
      let normalizedPhone = data.phone?.replace(/[\s\-\+]/g, '') || null;
      if (normalizedPhone) {
        if (normalizedPhone.startsWith('05')) {
          normalizedPhone = '966' + normalizedPhone.substring(1);
        } else if (normalizedPhone.startsWith('5')) {
          normalizedPhone = '966' + normalizedPhone;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          phone: normalizedPhone,
          telegram_user_id: data.telegram_user_id?.trim() || null,
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

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.message);
      return;
    }

    // Validate confirmation match
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة غير متطابقة مع التأكيد');
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        // Translate common Supabase errors
        if (error.message.includes('session')) {
          throw new Error('انتهت الجلسة. يرجى تسجيل الخروج وإعادة تسجيل الدخول');
        }
        if (error.message.includes('weak')) {
          throw new Error('كلمة المرور ضعيفة جداً');
        }
        throw error;
      }

      // Log password change
      await supabase.from('password_audit_log').insert({
        user_id: user?.id,
        action: 'password_changed_by_user',
        performed_by: user?.id,
      });

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      toast({ 
        title: 'تم تغيير كلمة المرور بنجاح',
        description: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة'
      });
    } catch (error: any) {
      setPasswordError(error.message || 'فشل تغيير كلمة المرور. تأكد من جلستك وحاول مرة أخرى');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle email change
  const handleEmailChange = async () => {
    setEmailError('');
    setEmailSuccess(false);

    const emailValidation = validateEmail(newEmail);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.message);
      return;
    }

    // Check if email is same as current
    if (newEmail === user?.email) {
      setEmailError('البريد الإلكتروني الجديد مطابق للحالي');
      return;
    }

    setIsChangingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('هذا البريد الإلكتروني مستخدم بالفعل');
        }
        throw error;
      }

      // Note: Don't update profiles table email here - it should be updated after confirmation
      setEmailSuccess(true);
      toast({
        title: 'تم إرسال رابط التأكيد',
        description: 'يرجى التحقق من بريدك الإلكتروني الجديد والقديم لتأكيد التغيير',
      });
    } catch (error: any) {
      setEmailError(error.message || 'فشل تغيير البريد الإلكتروني');
    } finally {
      setIsChangingEmail(false);
    }
  };

  // Check if form can be submitted
  const canSubmitProfile = !phoneError && !telegramError && !updateProfile.isPending;
  const canSubmitPassword = newPassword.length >= 8 && newPassword === confirmPassword && !isChangingPassword;

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
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            معلومات التواصل
          </CardTitle>
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
                placeholder="966XXXXXXXXX"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                dir="ltr"
                className={phoneError ? 'border-destructive' : ''}
              />
              {phoneError ? (
                <p className="text-xs text-destructive">{phoneError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  صيغة سعودية: 966XXXXXXXXX أو 05XXXXXXXX
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram_id">معرف تيليجرام (Chat ID)</Label>
              <Input
                id="telegram_id"
                type="text"
                placeholder="123456789"
                value={formData.telegram_user_id}
                onChange={(e) => handleTelegramChange(e.target.value)}
                dir="ltr"
                className={telegramError ? 'border-destructive' : ''}
              />
              {telegramError ? (
                <p className="text-xs text-destructive">{telegramError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  رقم معرف الدردشة من تيليجرام (اتركه فارغاً لتعطيل الإشعارات)
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              قنوات الإشعارات
            </h4>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600">📱</span>
                </div>
                <div>
                  <p className="font-medium">واتساب</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.allow_whatsapp 
                      ? 'سيتم إرسال التنبيهات عبر واتساب' 
                      : 'لن يتم إرسال أي رسائل واتساب'}
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
                    {formData.allow_telegram 
                      ? (formData.telegram_user_id 
                          ? 'سيتم إرسال التنبيهات عبر تيليجرام' 
                          : 'يجب إدخال معرف تيليجرام أولاً')
                      : 'لن يتم إرسال أي رسائل تيليجرام'}
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

            {formData.allow_telegram && !formData.telegram_user_id && (
              <Alert variant="default" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  تفعيل تيليجرام يتطلب إدخال معرف تيليجرام (Chat ID) أعلاه
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Button
            onClick={() => updateProfile.mutate(formData)}
            disabled={!canSubmitProfile}
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
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            تغيير كلمة المرور
          </CardTitle>
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
              <AlertDescription>
                تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الخروج وإعادة الدخول بكلمة المرور الجديدة.
              </AlertDescription>
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
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError('');
                  }}
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
                يجب أن تكون 8 أحرف على الأقل وتحتوي على أحرف وأرقام
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirm-password"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="أعد إدخال كلمة المرور الجديدة"
                dir="ltr"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  كلمة المرور غير متطابقة
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  كلمة المرور متطابقة
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={!canSubmitPassword}
            variant="secondary"
          >
            {isChangingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <KeyRound className="h-4 w-4 ml-2" />
            )}
            تغيير كلمة المرور
          </Button>
        </CardContent>
      </Card>

      {/* Email Change Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            تغيير البريد الإلكتروني
          </CardTitle>
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
                تم إرسال رابط التأكيد إلى بريدك الإلكتروني الجديد والقديم.
                يجب تأكيد التغيير من كلا البريدين.
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
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError('');
              }}
              placeholder="example@domain.com"
              dir="ltr"
            />
          </div>

          <Button
            onClick={handleEmailChange}
            disabled={isChangingEmail || !newEmail || newEmail === user?.email}
            variant="secondary"
          >
            {isChangingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Mail className="h-4 w-4 ml-2" />
            )}
            تغيير البريد الإلكتروني
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
