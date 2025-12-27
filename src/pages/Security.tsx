import React, { useState } from 'react';
import { useSecuritySettings, useLoginHistory } from '@/hooks/useSecuritySettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Shield, Clock, Key, Users, Check, X } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function Security() {
  const { settings, isLoading, updateSettings } = useSecuritySettings();
  const { loginHistory, isLoading: isLoadingHistory } = useLoginHistory();
  const [formData, setFormData] = useState<{
    session_timeout_minutes?: number;
    password_min_length?: number;
    require_2fa?: boolean;
    max_login_attempts?: number;
    lockout_duration_minutes?: number;
  }>({});

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateSettings.mutate(formData);
    setFormData({});
  };

  const getFieldValue = (field: keyof typeof formData) => {
    return formData[field] !== undefined ? formData[field] : settings?.[field];
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إعدادات الأمان - HR Reminder</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">إعدادات الأمان</h1>
          <p className="text-muted-foreground">
            إدارة سياسات الأمان والجلسات
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Session Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>إعدادات الجلسة</CardTitle>
                  <CardDescription>تحكم في مدة جلسات المستخدمين</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">مدة انتهاء الجلسة (بالدقائق)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  min={5}
                  max={10080}
                  value={formData.session_timeout_minutes ?? settings?.session_timeout_minutes ?? ''}
                  onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  1440 دقيقة = 24 ساعة
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Password Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>سياسة كلمة المرور</CardTitle>
                  <CardDescription>متطلبات كلمة المرور للمستخدمين</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password-min">الحد الأدنى لطول كلمة المرور</Label>
                <Input
                  id="password-min"
                  type="number"
                  min={6}
                  max={32}
                  value={formData.password_min_length ?? settings?.password_min_length ?? ''}
                  onChange={(e) => handleChange('password_min_length', parseInt(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>المصادقة الثنائية (2FA)</Label>
                  <p className="text-sm text-muted-foreground">
                    إلزام المستخدمين بتفعيل المصادقة الثنائية
                  </p>
                </div>
                <Switch
                  checked={formData.require_2fa ?? settings?.require_2fa ?? false}
                  onCheckedChange={(checked) => handleChange('require_2fa', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lockout Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>حماية تسجيل الدخول</CardTitle>
                  <CardDescription>إعدادات القفل عند المحاولات الفاشلة</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-attempts">الحد الأقصى لمحاولات تسجيل الدخول</Label>
                <Input
                  id="max-attempts"
                  type="number"
                  min={3}
                  max={10}
                  value={formData.max_login_attempts ?? settings?.max_login_attempts ?? ''}
                  onChange={(e) => handleChange('max_login_attempts', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lockout-duration">مدة القفل (بالدقائق)</Label>
                <Input
                  id="lockout-duration"
                  type="number"
                  min={5}
                  max={1440}
                  value={formData.lockout_duration_minutes ?? settings?.lockout_duration_minutes ?? ''}
                  onChange={(e) => handleChange('lockout_duration_minutes', parseInt(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button Card */}
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={updateSettings.isPending || Object.keys(formData).length === 0}
              >
                {updateSettings.isPending && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                حفظ الإعدادات
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Login History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>سجل تسجيل الدخول</CardTitle>
                <CardDescription>آخر 100 عملية تسجيل دخول</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : loginHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا يوجد سجل تسجيل دخول حتى الآن
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>التاريخ والوقت</TableHead>
                      <TableHead>عنوان IP</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.profile?.full_name || entry.profile?.email || 'غير معروف'}
                        </TableCell>
                        <TableCell dir="ltr" className="text-right">
                          {format(new Date(entry.logged_in_at), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell dir="ltr">{entry.ip_address || '-'}</TableCell>
                        <TableCell>
                          {entry.success ? (
                            <Badge className="gap-1" variant="default">
                              <Check className="h-3 w-3" />
                              نجح
                            </Badge>
                          ) : (
                            <Badge className="gap-1" variant="destructive">
                              <X className="h-3 w-3" />
                              فشل
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
