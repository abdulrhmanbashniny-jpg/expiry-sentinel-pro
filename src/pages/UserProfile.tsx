import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User, Mail, Phone, Hash, CreditCard, Settings } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { ROLE_LABELS, AppRole } from '@/types/database';
import ProfileSettingsForm from '@/components/profile/ProfileSettingsForm';

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
          <p className="text-muted-foreground">عرض وتعديل بياناتك الشخصية</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              البيانات الشخصية
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              الإعدادات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
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
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <ProfileSettingsForm />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
