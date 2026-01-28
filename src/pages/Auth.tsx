import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Loader2, Building2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  companyCode: z.string().min(2, 'كود الشركة مطلوب').max(10, 'كود الشركة طويل جداً'),
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signupSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z.string().optional(),
  allowWhatsapp: z.boolean(),
  allowTelegram: z.boolean(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

interface TenantInfo {
  id: string;
  name: string;
  name_en: string | null;
  code: string;
  is_active: boolean;
  logo_url: string | null;
}

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  
  // Login state with company code
  const [loginData, setLoginData] = useState({ 
    companyCode: '', 
    email: '', 
    password: '' 
  });
  
  // Tenant validation state
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    allowWhatsapp: false,
    allowTelegram: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check URL params for invitation
  useEffect(() => {
    const token = searchParams.get('token');
    const company = searchParams.get('company');
    if (token && company) {
      setActiveTab('activate');
      setLoginData(prev => ({ ...prev, companyCode: company }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Validate company code when it changes
  useEffect(() => {
    const validateTenant = async () => {
      if (loginData.companyCode.length < 2) {
        setTenantInfo(null);
        setTenantError(null);
        return;
      }

      setTenantLoading(true);
      setTenantError(null);

      try {
        const { data, error } = await supabase.rpc('get_tenant_by_code', { 
          p_code: loginData.companyCode 
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const tenant = data[0] as TenantInfo;
          if (!tenant.is_active) {
            setTenantError('هذه الشركة غير مفعّلة');
            setTenantInfo(null);
          } else {
            setTenantInfo(tenant);
            setTenantError(null);
          }
        } else {
          setTenantError('كود الشركة غير موجود');
          setTenantInfo(null);
        }
      } catch (error) {
        console.error('Error validating tenant:', error);
        setTenantError('حدث خطأ في التحقق من كود الشركة');
        setTenantInfo(null);
      } finally {
        setTenantLoading(false);
      }
    };

    const debounceTimer = setTimeout(validateTenant, 500);
    return () => clearTimeout(debounceTimer);
  }, [loginData.companyCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      loginSchema.parse(loginData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    // Check if tenant is valid
    if (!tenantInfo) {
      setErrors({ companyCode: 'يرجى إدخال كود شركة صحيح' });
      return;
    }

    setIsSubmitting(true);
    
    // First, validate user belongs to this tenant
    const { data: userTenantData, error: userTenantError } = await supabase.rpc(
      'validate_user_tenant',
      { p_email: loginData.email, p_tenant_id: tenantInfo.id }
    );

    if (userTenantError || !userTenantData || userTenantData.length === 0) {
      setIsSubmitting(false);
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: 'البريد الإلكتروني غير مسجل في هذه الشركة',
        variant: 'destructive',
      });
      return;
    }

    const userValidation = userTenantData[0];
    if (!userValidation.is_valid) {
      setIsSubmitting(false);
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: 'هذا الحساب لا ينتمي لهذه الشركة',
        variant: 'destructive',
      });
      return;
    }

    // Now attempt login
    const { error } = await signIn(loginData.email, loginData.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: error.message === 'Invalid login credentials'
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse(signupData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(
      signupData.email, 
      signupData.password, 
      signupData.fullName,
      {
        phone: signupData.phone,
        allow_whatsapp: signupData.allowWhatsapp,
        allow_telegram: signupData.allowTelegram,
      }
    );
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'خطأ في التسجيل',
          description: 'هذا البريد الإلكتروني مسجل مسبقاً',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'خطأ في التسجيل',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'تم التسجيل بنجاح',
        description: 'مرحباً بك في نظام التذكير',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <Bell className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">HR Expiry Reminder</h1>
          <p className="mt-1 text-muted-foreground">نظام تذكير الموارد البشرية</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle>مرحباً بك</CardTitle>
            <CardDescription>سجّل دخولك للوصول إلى النظام</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-1 mb-6">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Company Code Field */}
                  <div className="space-y-2">
                    <Label htmlFor="company-code" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      كود الشركة
                    </Label>
                    <div className="relative">
                      <Input
                        id="company-code"
                        type="text"
                        placeholder="مثال: JPF"
                        value={loginData.companyCode}
                        onChange={(e) => setLoginData({ ...loginData, companyCode: e.target.value.toUpperCase() })}
                        className={`uppercase ${errors.companyCode || tenantError ? 'border-destructive' : tenantInfo ? 'border-green-500' : ''}`}
                        dir="ltr"
                      />
                      {tenantLoading && (
                        <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                      {tenantInfo && !tenantLoading && (
                        <CheckCircle2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                      )}
                      {tenantError && !tenantLoading && (
                        <AlertCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
                      )}
                    </div>
                    {errors.companyCode && (
                      <p className="text-sm text-destructive">{errors.companyCode}</p>
                    )}
                    {tenantError && (
                      <p className="text-sm text-destructive">{tenantError}</p>
                    )}
                    {tenantInfo && (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          {tenantInfo.name}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-email">البريد الإلكتروني</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="example@company.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || !tenantInfo}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'تسجيل الدخول'
                    )}
                  </Button>
                  
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    للحصول على حساب، تواصل مع مدير الشركة
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
