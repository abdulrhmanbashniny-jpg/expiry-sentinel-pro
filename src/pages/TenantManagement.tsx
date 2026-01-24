import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenants, useTenantIntegrations, useTenantUsageStats } from '@/hooks/useTenants';
import { Tenant, TenantIntegrationConfig, SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/types/tenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  Users, 
  FileText, 
  MessageSquare, 
  Bot,
  BarChart3,
  Settings,
  Check,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';

const TenantManagement: React.FC = () => {
  const navigate = useNavigate();
  const { isSystemAdmin, loading: authLoading } = useAuth();
  const { tenants, isLoading, createTenant, updateTenant, deleteTenant } = useTenants();
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<Tenant>>({
    name: '',
    name_en: '',
    code: '',
    subscription_plan: 'basic',
    max_users: 50,
    max_items: 1000,
    is_active: true,
  });

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isSystemAdmin) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          هذه الصفحة متاحة فقط لمدير النظام.
        </AlertDescription>
      </Alert>
    );
  }

  const handleCreateTenant = async () => {
    if (!formData.name || !formData.code) return;
    
    await createTenant.mutateAsync(formData);
    setIsCreateDialogOpen(false);
    resetForm();
  };

  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;
    
    await updateTenant.mutateAsync({
      id: selectedTenant.id,
      ...formData,
    });
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    
    await deleteTenant.mutateAsync(tenantToDelete.id);
    setIsDeleteDialogOpen(false);
    setTenantToDelete(null);
    if (selectedTenant?.id === tenantToDelete.id) {
      setSelectedTenant(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_en: '',
      code: '',
      subscription_plan: 'basic',
      max_users: 50,
      max_items: 1000,
      is_active: true,
    });
  };

  const openEditMode = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      name_en: tenant.name_en || '',
      code: tenant.code,
      subscription_plan: tenant.subscription_plan as SubscriptionPlan,
      max_users: tenant.max_users,
      max_items: tenant.max_items,
      is_active: tenant.is_active,
      domain: tenant.domain || '',
      logo_url: tenant.logo_url || '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            إدارة الشركات
          </h1>
          <p className="text-muted-foreground">إدارة الشركات والمؤسسات في النظام</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); }}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة شركة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إنشاء شركة جديدة</DialogTitle>
              <DialogDescription>أدخل بيانات الشركة الجديدة</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم الشركة (عربي) *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: شركة التقنية المتقدمة"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم الشركة (إنجليزي)</Label>
                <Input
                  value={formData.name_en || ''}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder="e.g. Advanced Tech Company"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>رمز الشركة * (فريد)</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="مثال: ATC"
                  dir="ltr"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>خطة الاشتراك</Label>
                <Select
                  value={formData.subscription_plan}
                  onValueChange={(v) => {
                    const plan = SUBSCRIPTION_PLANS[v as SubscriptionPlan];
                    setFormData({ 
                      ...formData, 
                      subscription_plan: v as SubscriptionPlan,
                      max_users: plan.max_users === -1 ? 9999 : plan.max_users,
                      max_items: plan.max_items === -1 ? 99999 : plan.max_items,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        {plan.name} ({plan.name_en})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleCreateTenant}
                disabled={!formData.name || !formData.code || createTenant.isPending}
              >
                {createTenant.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenants List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">الشركات ({tenants.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد شركات بعد</p>
              </div>
            ) : (
              <div className="divide-y">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedTenant?.id === tenant.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => openEditMode(tenant)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{tenant.name}</span>
                          <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                            {tenant.is_active ? 'نشط' : 'معطل'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <code className="bg-muted px-1 rounded">{tenant.code}</code>
                          <span>•</span>
                          <span>{SUBSCRIPTION_PLANS[tenant.subscription_plan as SubscriptionPlan]?.name}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTenantToDelete(tenant);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant Details */}
        <Card className="lg:col-span-2">
          {selectedTenant ? (
            <TenantDetails 
              tenant={selectedTenant}
              formData={formData}
              setFormData={setFormData}
              onSave={handleUpdateTenant}
              isPending={updateTenant.isPending}
            />
          ) : (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              <div className="text-center">
                <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>اختر شركة لعرض التفاصيل</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الشركة "{tenantToDelete?.name}"؟ 
              سيتم حذف جميع البيانات المرتبطة بها بشكل نهائي.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteTenant}
              disabled={deleteTenant.isPending}
            >
              {deleteTenant.isPending ? 'جاري الحذف...' : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Tenant Details Component
interface TenantDetailsProps {
  tenant: Tenant;
  formData: Partial<Tenant>;
  setFormData: (data: Partial<Tenant>) => void;
  onSave: () => void;
  isPending: boolean;
}

const TenantDetails: React.FC<TenantDetailsProps> = ({ 
  tenant, 
  formData, 
  setFormData, 
  onSave,
  isPending 
}) => {
  const { integrations, isLoading: intLoading, upsertIntegration } = useTenantIntegrations(tenant.id);
  const { data: usageStats, isLoading: statsLoading } = useTenantUsageStats(tenant.id);
  
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getIntegration = (key: string) => {
    return integrations.find(i => i.integration_key === key);
  };

  return (
    <Tabs defaultValue="general" className="h-full">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {tenant.name}
              <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                {tenant.is_active ? 'نشط' : 'معطل'}
              </Badge>
            </CardTitle>
            <CardDescription>رمز: {tenant.code}</CardDescription>
          </div>
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
        <TabsList className="mt-4">
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 ml-2" />
            عام
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <MessageSquare className="h-4 w-4 ml-2" />
            التكاملات
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 ml-2" />
            الإحصائيات
          </TabsTrigger>
        </TabsList>
      </CardHeader>

      <CardContent className="pt-6">
        {/* General Tab */}
        <TabsContent value="general" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الشركة (عربي)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>اسم الشركة (إنجليزي)</Label>
              <Input
                value={formData.name_en || ''}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>رمز الشركة</Label>
              <Input value={formData.code} disabled dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>النطاق الفرعي</Label>
              <Input
                value={formData.domain || ''}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="company.example.com"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>خطة الاشتراك</Label>
              <Select
                value={formData.subscription_plan}
                onValueChange={(v) => setFormData({ ...formData, subscription_plan: v as SubscriptionPlan })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                    <SelectItem key={key} value={key}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحد الأقصى للمستخدمين</Label>
              <Input
                type="number"
                value={formData.max_users}
                onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>الحد الأقصى للعناصر</Label>
              <Input
                type="number"
                value={formData.max_items}
                onChange={(e) => setFormData({ ...formData, max_items: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label>حالة الشركة</Label>
              <p className="text-sm text-muted-foreground">
                {formData.is_active ? 'الشركة نشطة ويمكن للمستخدمين الوصول' : 'الشركة معطلة ولا يمكن الوصول'}
              </p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="mt-0">
          <IntegrationSettings 
            tenantId={tenant.id}
            integrations={integrations}
            isLoading={intLoading}
            upsertIntegration={upsertIntegration}
          />
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{usageStats?.users_count || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">المستخدمون</p>
                <p className="text-xs text-muted-foreground">الحد: {tenant.max_users}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{usageStats?.items_count || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">العناصر</p>
                <p className="text-xs text-muted-foreground">الحد: {tenant.max_items}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{usageStats?.notifications_sent || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">الإشعارات (هذا الشهر)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{usageStats?.ai_calls || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">استدعاءات AI</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">معلومات الشركة</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">تاريخ الإنشاء</TableCell>
                    <TableCell>{new Date(tenant.created_at).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">آخر تحديث</TableCell>
                    <TableCell>{new Date(tenant.updated_at).toLocaleDateString('ar-SA')}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">التخزين المستخدم</TableCell>
                    <TableCell>{usageStats?.storage_used_mb?.toFixed(2) || 0} MB</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </CardContent>
    </Tabs>
  );
};

// Integration Settings Component
interface IntegrationSettingsProps {
  tenantId: string;
  integrations: any[];
  isLoading: boolean;
  upsertIntegration: any;
}

const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({
  tenantId,
  integrations,
  isLoading,
  upsertIntegration,
}) => {
  const [telegramConfig, setTelegramConfig] = useState<TenantIntegrationConfig>({});
  const [whatsappConfig, setWhatsappConfig] = useState<TenantIntegrationConfig>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const telegram = integrations.find(i => i.integration_key === 'telegram');
    const whatsapp = integrations.find(i => i.integration_key === 'whatsapp');
    
    if (telegram) setTelegramConfig(telegram.config || {});
    if (whatsapp) setWhatsappConfig(whatsapp.config || {});
  }, [integrations]);

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const saveTelegram = () => {
    upsertIntegration.mutate({
      tenantId,
      integrationKey: 'telegram',
      config: telegramConfig,
      isActive: !!telegramConfig.bot_token,
    });
  };

  const saveWhatsapp = () => {
    upsertIntegration.mutate({
      tenantId,
      integrationKey: 'whatsapp',
      config: whatsappConfig,
      isActive: !!whatsappConfig.apikey,
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Telegram */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Telegram Bot
            </CardTitle>
            <Badge variant={telegramConfig.bot_token ? 'default' : 'secondary'}>
              {telegramConfig.bot_token ? 'مُعد' : 'غير مُعد'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Bot Token</Label>
            <div className="flex gap-2">
              <Input
                type={showSecrets.telegram ? 'text' : 'password'}
                value={telegramConfig.bot_token || ''}
                onChange={(e) => setTelegramConfig({ ...telegramConfig, bot_token: e.target.value })}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                dir="ltr"
              />
              <Button variant="outline" size="icon" onClick={() => toggleSecret('telegram')}>
                {showSecrets.telegram ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bot Username (اختياري)</Label>
            <Input
              value={telegramConfig.bot_username || ''}
              onChange={(e) => setTelegramConfig({ ...telegramConfig, bot_username: e.target.value })}
              placeholder="@mybot"
              dir="ltr"
            />
          </div>
          <Button onClick={saveTelegram} disabled={upsertIntegration.isPending}>
            حفظ إعدادات Telegram
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              WhatsApp API
            </CardTitle>
            <Badge variant={whatsappConfig.apikey ? 'default' : 'secondary'}>
              {whatsappConfig.apikey ? 'مُعد' : 'غير مُعد'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Base URL</Label>
            <Input
              value={whatsappConfig.api_base_url || ''}
              onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_base_url: e.target.value })}
              placeholder="https://api.appslink.sa"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showSecrets.whatsapp ? 'text' : 'password'}
                value={whatsappConfig.apikey || ''}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, apikey: e.target.value })}
                placeholder="your-api-key"
                dir="ltr"
              />
              <Button variant="outline" size="icon" onClick={() => toggleSecret('whatsapp')}>
                {showSecrets.whatsapp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Instance Name</Label>
            <Input
              value={whatsappConfig.instance_name || ''}
              onChange={(e) => setWhatsappConfig({ ...whatsappConfig, instance_name: e.target.value })}
              placeholder="my-instance"
              dir="ltr"
            />
          </div>
          <Button onClick={saveWhatsapp} disabled={upsertIntegration.isPending}>
            حفظ إعدادات WhatsApp
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantManagement;
