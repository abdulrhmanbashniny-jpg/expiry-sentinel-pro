import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">إعدادات النظام والتنبيهات</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            الإعدادات العامة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">الإعدادات ستكون متاحة قريباً. يمكنك إدارة قواعد التذكير من صفحة "قواعد التذكير".</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
