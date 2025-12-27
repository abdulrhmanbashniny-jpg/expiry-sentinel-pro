import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Mail, Phone, Building2, Hash, CreditCard, MessageCircle, Send } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { ROLE_LABELS, AppRole } from '@/types/database';

export default function UserProfile() {
  const { user, role } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const profileFields = [
    { icon: User, label: 'الاسم الكامل', value: profile?.full_name },
    { icon: Mail, label: 'البريد الإلكتروني', value: profile?.email, dir: 'ltr' },
    { icon: Hash, label: 'رقم الموظف', value: profile?.employee_number },
    { icon: CreditCard, label: 'رقم الهوية', value: profile?.national_id },
    { icon: Phone, label: 'رقم الجوال', value: profile?.phone },
  ];

  return (
    <>
      <Helmet>
        <title>الملف الشخصي - HR Reminder</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">الملف الشخصي</h1>
          <p className="text-muted-foreground">عرض بياناتك الشخصية المسجلة في النظام</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{profile?.full_name || 'مستخدم'}</CardTitle>
                  <CardDescription>
                    {role && (
                      <Badge variant="secondary" className="mt-1">
                        {ROLE_LABELS[role as AppRole] || role}
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileFields.map((field, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <field.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{field.label}</p>
                    <p 
                      className="font-medium truncate" 
                      dir={field.dir || 'rtl'}
                    >
                      {field.value || 'غير محدد'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قنوات التواصل</CardTitle>
              <CardDescription>القنوات المفعلة لاستقبال الإشعارات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${profile?.allow_whatsapp ? 'border-green-500/50 bg-green-500/5' : 'border-muted'}`}>
                <MessageCircle className={`h-6 w-6 ${profile?.allow_whatsapp ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <p className="font-medium">واتساب</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.allow_whatsapp ? 'مفعّل' : 'غير مفعّل'}
                  </p>
                </div>
                <Badge variant={profile?.allow_whatsapp ? 'default' : 'secondary'}>
                  {profile?.allow_whatsapp ? 'نشط' : 'معطل'}
                </Badge>
              </div>

              <div className={`flex items-center gap-3 p-4 rounded-lg border ${profile?.allow_telegram ? 'border-blue-500/50 bg-blue-500/5' : 'border-muted'}`}>
                <Send className={`h-6 w-6 ${profile?.allow_telegram ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <p className="font-medium">تيليجرام</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.allow_telegram ? 'مفعّل' : 'غير مفعّل'}
                    {profile?.telegram_user_id && ` (${profile.telegram_user_id})`}
                  </p>
                </div>
                <Badge variant={profile?.allow_telegram ? 'default' : 'secondary'}>
                  {profile?.allow_telegram ? 'نشط' : 'معطل'}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                لتعديل هذه البيانات، يرجى التواصل مع مدير النظام.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
