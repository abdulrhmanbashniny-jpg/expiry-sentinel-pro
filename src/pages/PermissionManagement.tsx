import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, Eye, EyeOff, Save, Loader2, AlertTriangle, Building2, Brain } from 'lucide-react';
import AIPermissionsTab from '@/components/permissions/AIPermissionsTab';

interface RolePermission {
  role: string;
  roleName: string;
  pages: Record<string, boolean>;
  dataScope: 'own' | 'department' | 'all';
}

const AVAILABLE_PAGES = [
  { key: 'dashboard', name: 'لوحة التحكم', description: 'عرض الإحصائيات والرسوم البيانية' },
  { key: 'items', name: 'العناصر', description: 'إدارة العناصر والمعاملات' },
  { key: 'recipients', name: 'المستلمين', description: 'إدارة قائمة المستلمين' },
  { key: 'categories', name: 'الفئات', description: 'إدارة فئات العناصر' },
  { key: 'departments', name: 'الأقسام', description: 'إدارة الأقسام' },
  { key: 'reminder-rules', name: 'قواعد التذكير', description: 'إدارة قواعد التذكير' },
  { key: 'message-templates', name: 'قوالب الرسائل', description: 'إدارة قوالب الرسائل' },
  { key: 'integrations', name: 'التكاملات', description: 'إعدادات التكاملات الخارجية' },
  { key: 'automation', name: 'لوحة التشغيل', description: 'مراقبة عمليات الأتمتة' },
  { key: 'user-management', name: 'إدارة المستخدمين', description: 'إدارة حسابات المستخدمين' },
  { key: 'team-management', name: 'إدارة الفريق', description: 'إدارة فرق العمل' },
  { key: 'security', name: 'الأمان', description: 'إعدادات الأمان' },
  { key: 'compliance', name: 'تقارير الامتثال', description: 'عرض تقارير الامتثال' },
  { key: 'kpi-templates', name: 'قوالب KPI', description: 'إدارة قوالب مؤشرات الأداء' },
  { key: 'evaluations', name: 'التقييمات', description: 'إدارة تقييمات الأداء' },
];

const ROLE_DEFAULTS: Record<string, { name: string; defaultPages: string[]; defaultScope: 'own' | 'department' | 'all' }> = {
  system_admin: {
    name: 'مدير النظام',
    defaultPages: AVAILABLE_PAGES.map(p => p.key),
    defaultScope: 'all',
  },
  admin: {
    name: 'المدير',
    defaultPages: ['dashboard', 'items', 'recipients', 'categories', 'departments', 'reminder-rules', 'message-templates', 'automation', 'compliance'],
    defaultScope: 'all',
  },
  supervisor: {
    name: 'المشرف',
    defaultPages: ['dashboard', 'items', 'recipients', 'team-management'],
    defaultScope: 'department',
  },
  employee: {
    name: 'موظف',
    defaultPages: ['dashboard', 'items'],
    defaultScope: 'own',
  },
};

const PermissionManagement: React.FC = () => {
  const navigate = useNavigate();
  const { isSystemAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      // Load from settings table or use defaults
      const { data: savedSettings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'role_permissions')
        .maybeSingle();

      if (savedSettings?.value) {
        const saved = savedSettings.value as unknown as RolePermission[];
        setPermissions(saved);
      } else {
        // Initialize with defaults
        const defaultPermissions: RolePermission[] = Object.entries(ROLE_DEFAULTS).map(([role, config]) => ({
          role,
          roleName: config.name,
          pages: AVAILABLE_PAGES.reduce((acc, page) => ({
            ...acc,
            [page.key]: config.defaultPages.includes(page.key),
          }), {}),
          dataScope: config.defaultScope,
        }));
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: 'خطأ في تحميل الصلاحيات',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageToggle = (roleIndex: number, pageKey: string) => {
    const updated = [...permissions];
    updated[roleIndex].pages[pageKey] = !updated[roleIndex].pages[pageKey];
    setPermissions(updated);
    setHasChanges(true);
  };

  const handleScopeChange = (roleIndex: number, scope: 'own' | 'department' | 'all') => {
    const updated = [...permissions];
    updated[roleIndex].dataScope = scope;
    setPermissions(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Upsert to settings table
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'role_permissions',
          value: permissions as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      toast({
        title: 'تم حفظ الصلاحيات بنجاح',
        description: 'سيتم تطبيق التغييرات فوراً',
      });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: 'خطأ في حفظ الصلاحيات',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSystemAdmin) {
    return (
      <div className="animate-fade-in space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            هذه الصفحة متاحة فقط لمدير النظام (System Admin).
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/')}>العودة للرئيسية</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            إدارة الصلاحيات
          </h1>
          <p className="text-muted-foreground">
            تحكم في صلاحيات الأدوار على الصفحات والبيانات
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>

      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            لديك تغييرات غير محفوظة. اضغط على "حفظ التغييرات" لتطبيقها.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pages" className="gap-2">
            <Eye className="h-4 w-4" />
            صلاحيات الصفحات
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Building2 className="h-4 w-4" />
            نطاق البيانات
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="h-4 w-4" />
            صلاحيات AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <div className="grid gap-4">
            {permissions.map((perm, roleIndex) => (
              <Card key={perm.role}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{perm.roleName}</CardTitle>
                    </div>
                    <Badge variant={perm.role === 'system_admin' ? 'default' : 'secondary'}>
                      {perm.role}
                    </Badge>
                  </div>
                  <CardDescription>
                    {perm.role === 'system_admin' && 'صلاحيات كاملة على جميع الصفحات والبيانات'}
                    {perm.role === 'admin' && 'صلاحيات إدارية على معظم الصفحات'}
                    {perm.role === 'supervisor' && 'صلاحيات إشرافية على فريق العمل'}
                    {perm.role === 'employee' && 'صلاحيات محدودة على البيانات الخاصة'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {AVAILABLE_PAGES.map((page) => (
                      <div
                        key={page.key}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1">
                          <Label htmlFor={`${perm.role}-${page.key}`} className="text-sm font-medium cursor-pointer">
                            {page.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">{page.description}</p>
                        </div>
                        <Switch
                          id={`${perm.role}-${page.key}`}
                          checked={perm.pages[page.key] || false}
                          onCheckedChange={() => handlePageToggle(roleIndex, page.key)}
                          disabled={perm.role === 'system_admin'} // System admin always has all pages
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>نطاق الوصول للبيانات</CardTitle>
              <CardDescription>
                حدد نطاق البيانات التي يمكن لكل دور رؤيتها
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {permissions.map((perm, roleIndex) => (
                  <div
                    key={perm.role}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{perm.roleName}</p>
                        <p className="text-sm text-muted-foreground">
                          {perm.dataScope === 'own' && 'يرى بياناته الخاصة فقط'}
                          {perm.dataScope === 'department' && 'يرى بيانات قسمه فقط'}
                          {perm.dataScope === 'all' && 'يرى جميع البيانات'}
                        </p>
                      </div>
                    </div>
                    <Select
                      value={perm.dataScope}
                      onValueChange={(v) => handleScopeChange(roleIndex, v as 'own' | 'department' | 'all')}
                      disabled={perm.role === 'system_admin'}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="own">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4" />
                            بياناته فقط
                          </div>
                        </SelectItem>
                        <SelectItem value="department">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            قسمه فقط
                          </div>
                        </SelectItem>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            جميع البيانات
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>ملاحظة:</strong> نطاق البيانات يتحكم في ما يراه المستخدم من:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>بياناته فقط:</strong> العناصر التي أنشأها هو فقط</li>
                    <li><strong>قسمه فقط:</strong> العناصر المرتبطة بقسمه/أقسامه</li>
                    <li><strong>جميع البيانات:</strong> كل العناصر في النظام</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <AIPermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PermissionManagement;
