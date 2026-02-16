import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, MessageSquare, Settings, FileSearch, Save, Loader2, AlertTriangle, Users } from 'lucide-react';

interface AIRolePermission {
  role: string;
  roleName: string;
  canAccessChat: boolean;
  canManageSettings: boolean;
  canViewAuditLogs: boolean;
}

const AI_PERMISSION_KEYS = [
  { key: 'canAccessChat', name: 'محادثة AI', description: 'التحدث مع Sentinel AI', icon: MessageSquare },
  { key: 'canManageSettings', name: 'إعدادات AI', description: 'تعديل إعدادات الوكلاء', icon: Settings },
  { key: 'canViewAuditLogs', name: 'سجل التدقيق', description: 'عرض سجل عمليات AI', icon: FileSearch },
];

const DEFAULT_PERMISSIONS: AIRolePermission[] = [
  { role: 'system_admin', roleName: 'مدير النظام', canAccessChat: true, canManageSettings: true, canViewAuditLogs: true },
  { role: 'admin', roleName: 'المدير', canAccessChat: true, canManageSettings: false, canViewAuditLogs: true },
  { role: 'supervisor', roleName: 'المشرف', canAccessChat: true, canManageSettings: false, canViewAuditLogs: false },
  { role: 'employee', roleName: 'موظف', canAccessChat: false, canManageSettings: false, canViewAuditLogs: false },
];

export default function AIPermissionsTab() {
  const [permissions, setPermissions] = useState<AIRolePermission[]>(DEFAULT_PERMISSIONS);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'ai_role_permissions')
        .maybeSingle();
      if (data?.value) {
        setPermissions(data.value as unknown as AIRolePermission[]);
      }
    } catch (e) {
      console.error('Failed to load AI permissions');
    }
  };

  const handleToggle = (roleIndex: number, key: keyof AIRolePermission) => {
    if (permissions[roleIndex].role === 'system_admin') return;
    const updated = [...permissions];
    (updated[roleIndex] as any)[key] = !(updated[roleIndex] as any)[key];
    setPermissions(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'ai_role_permissions',
          value: permissions as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
      if (error) throw error;
      toast.success('تم حفظ صلاحيات AI بنجاح');
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>لديك تغييرات غير محفوظة في صلاحيات AI.</AlertDescription>
        </Alert>
      )}

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
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {AI_PERMISSION_KEYS.map(permKey => (
                  <div key={permKey.key} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <permKey.icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm cursor-pointer">{permKey.name}</Label>
                        <p className="text-xs text-muted-foreground">{permKey.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={(perm as any)[permKey.key] || false}
                      onCheckedChange={() => handleToggle(roleIndex, permKey.key as keyof AIRolePermission)}
                      disabled={perm.role === 'system_admin'}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
        حفظ صلاحيات AI
      </Button>
    </div>
  );
}
