import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Copy, Check, Key, Globe, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ApiKeyItem {
  name: string;
  key: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

const Settings: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [telegramToken, setTelegramToken] = useState<string>('');

  // Get values from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || '';

  useEffect(() => {
    // Try to get telegram token status (we can't read the actual value from client)
    const checkTelegramToken = async () => {
      try {
        const { data } = await supabase.functions.invoke('send-telegram', {
          body: { action: 'check' }
        });
        setTelegramToken(data?.configured ? '••••••••••' : 'غير مُعد');
      } catch {
        setTelegramToken('غير مُعد');
      }
    };
    checkTelegramToken();
  }, []);

  const apiKeys: ApiKeyItem[] = [
    {
      name: 'Supabase URL',
      key: 'VITE_SUPABASE_URL',
      value: supabaseUrl,
      icon: <Globe className="h-4 w-4" />,
      description: 'رابط مشروع Supabase'
    },
    {
      name: 'Supabase Anon Key',
      key: 'VITE_SUPABASE_PUBLISHABLE_KEY',
      value: supabaseKey,
      icon: <Key className="h-4 w-4" />,
      description: 'مفتاح Supabase العام'
    },
    {
      name: 'Project ID',
      key: 'VITE_SUPABASE_PROJECT_ID',
      value: projectId,
      icon: <Key className="h-4 w-4" />,
      description: 'معرف المشروع'
    },
    {
      name: 'Telegram Bot Token',
      key: 'TELEGRAM_BOT_TOKEN',
      value: telegramToken,
      icon: <Bot className="h-4 w-4" />,
      description: 'توكن بوت التيليجرام (محفوظ في Secrets)'
    }
  ];

  const copyToClipboard = async (key: string, value: string) => {
    if (!value || value === 'غير مُعد' || value.includes('••••')) {
      toast.error('هذه القيمة غير متاحة للنسخ');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success('تم النسخ!');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error('فشل النسخ');
    }
  };

  const edgeFunctionsEndpoints = [
    {
      name: 'prepare-message',
      method: 'POST',
      path: `/functions/v1/prepare-message`,
      body: '{ "item_id": "UUID", "recipient_id": "UUID" }',
      description: 'تحضير رسالة التذكير'
    },
    {
      name: 'get-recipient-by-id',
      method: 'POST', 
      path: `/functions/v1/get-recipient-by-id`,
      body: '{ "recipient_id": "UUID" }',
      description: 'استرجاع بيانات المستلم'
    },
    {
      name: 'send-telegram',
      method: 'POST',
      path: `/functions/v1/send-telegram`,
      body: '{ "chat_id": "123", "message": "نص" }',
      description: 'إرسال رسالة تيليجرام'
    }
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">مفاتيح API والتكامل مع n8n</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            مفاتيح API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeys.map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                {item.icon}
                <div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <code className="text-xs bg-background px-2 py-1 rounded mt-1 inline-block">
                    {item.value ? (item.value.length > 50 ? item.value.substring(0, 50) + '...' : item.value) : 'غير متاح'}
                  </code>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(item.key, item.value)}
                disabled={!item.value || item.value === 'غير مُعد' || item.value.includes('••••')}
              >
                {copiedKey === item.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            نقاط نهاية API (لـ n8n)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            الرابط الأساسي: <code className="bg-muted px-2 py-1 rounded">{supabaseUrl}</code>
          </p>
          {edgeFunctionsEndpoints.map((endpoint) => (
            <div key={endpoint.name} className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">{endpoint.method}</span>
                <code className="text-sm">{endpoint.path}</code>
              </div>
              <p className="text-xs text-muted-foreground">{endpoint.description}</p>
              <div className="bg-background p-2 rounded">
                <code className="text-xs whitespace-pre">{endpoint.body}</code>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
