import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Copy, Check, Key, Globe, Bot, Database, Shield, Users, FileText, Bell, Brain, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Helmet } from 'react-helmet';

interface ApiKeyItem {
  name: string;
  key: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}

interface SystemFeature {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'active' | 'configured' | 'pending';
}

const Settings: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState<boolean>(false);
  const [whatsappConfigured, setWhatsappConfigured] = useState<boolean>(false);
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);

  // Get values from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || '';

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const { data: integrations } = await supabase
          .from('integrations')
          .select('key, is_active, config');
        
        if (integrations) {
          const telegram = integrations.find(i => i.key === 'telegram');
          const whatsapp = integrations.find(i => i.key === 'whatsapp');
          const ai = integrations.find(i => i.key === 'ai_assistant');
          
          const telegramConfig = telegram?.config as Record<string, unknown> | null;
          const whatsappConfig = whatsapp?.config as Record<string, unknown> | null;
          
          setTelegramConfigured(telegram?.is_active && !!telegramConfig?.bot_token);
          setWhatsappConfigured(whatsapp?.is_active && !!whatsappConfig?.api_base_url);
          setAiConfigured(ai?.is_active || false);
        }
      } catch {
        console.error('Failed to check integrations');
      }
    };
    checkIntegrations();
  }, []);

  const apiKeys: ApiKeyItem[] = [
    {
      name: 'Backend URL',
      key: 'VITE_SUPABASE_URL',
      value: supabaseUrl,
      icon: <Globe className="h-4 w-4" />,
      description: 'رابط الخدمات السحابية'
    },
    {
      name: 'Public Key',
      key: 'VITE_SUPABASE_PUBLISHABLE_KEY',
      value: supabaseKey,
      icon: <Key className="h-4 w-4" />,
      description: 'المفتاح العام للتطبيق'
    },
    {
      name: 'Project ID',
      key: 'VITE_SUPABASE_PROJECT_ID',
      value: projectId,
      icon: <Database className="h-4 w-4" />,
      description: 'معرف المشروع'
    }
  ];

  const systemFeatures: SystemFeature[] = [
    {
      name: 'نظام التذكيرات',
      description: 'تنبيهات انتهاء العقود والرخص والوثائق',
      icon: <Bell className="h-5 w-5" />,
      status: 'active'
    },
    {
      name: 'نظام تقييم الأداء',
      description: 'تقييمات دورية مع دعم 360 درجة',
      icon: <Users className="h-5 w-5" />,
      status: 'active'
    },
    {
      name: 'مستشار الامتثال الذكي',
      description: 'تحليل وتوصيات بالذكاء الاصطناعي',
      icon: <Brain className="h-5 w-5" />,
      status: aiConfigured ? 'active' : 'configured'
    },
    {
      name: 'تكامل WhatsApp',
      description: 'إرسال تنبيهات عبر واتساب (AppsLink)',
      icon: <MessageSquare className="h-5 w-5" />,
      status: whatsappConfigured ? 'active' : 'pending'
    },
    {
      name: 'تكامل Telegram',
      description: 'بوت تيليجرام للتنبيهات والاستعلامات',
      icon: <Bot className="h-5 w-5" />,
      status: telegramConfigured ? 'active' : 'pending'
    },
    {
      name: 'تقارير الامتثال',
      description: 'تقارير دورية شاملة',
      icon: <FileText className="h-5 w-5" />,
      status: 'active'
    },
    {
      name: 'الأمان والصلاحيات',
      description: 'RLS وإدارة الأدوار متعددة المستويات',
      icon: <Shield className="h-5 w-5" />,
      status: 'active'
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
      name: 'get-due-items',
      method: 'POST',
      path: `/functions/v1/get-due-items`,
      description: 'جلب العناصر المستحقة للتنبيه'
    },
    {
      name: 'prepare-message',
      method: 'POST',
      path: `/functions/v1/prepare-message`,
      description: 'تحضير رسالة التذكير'
    },
    {
      name: 'send-telegram',
      method: 'POST',
      path: `/functions/v1/send-telegram`,
      description: 'إرسال رسالة تيليجرام'
    },
    {
      name: 'send-whatsapp',
      method: 'POST',
      path: `/functions/v1/send-whatsapp`,
      description: 'إرسال رسالة واتساب'
    },
    {
      name: 'ai-advisor',
      method: 'POST',
      path: `/functions/v1/ai-advisor`,
      description: 'استشارة الذكاء الاصطناعي'
    },
    {
      name: 'generate-compliance-report',
      method: 'POST',
      path: `/functions/v1/generate-compliance-report`,
      description: 'توليد تقرير الامتثال'
    },
    {
      name: 'automated-reminders',
      method: 'POST',
      path: `/functions/v1/automated-reminders`,
      description: 'تشغيل التذكيرات التلقائية'
    }
  ];

  const getStatusBadge = (status: SystemFeature['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">مفعّل</Badge>;
      case 'configured':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">جاهز</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">يحتاج إعداد</Badge>;
    }
  };

  return (
    <>
      <Helmet>
        <title>الإعدادات - HR Reminder</title>
      </Helmet>
      
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">معلومات النظام ومفاتيح API</p>
        </div>

        {/* System Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              ميزات النظام
            </CardTitle>
            <CardDescription>
              نظرة عامة على الوحدات والتكاملات المفعّلة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {systemFeatures.map((feature) => (
                <div 
                  key={feature.name} 
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{feature.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                  </div>
                  {getStatusBadge(feature.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              مفاتيح API
            </CardTitle>
            <CardDescription>
              مفاتيح الاتصال بالخدمات السحابية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {apiKeys.map((item) => (
              <div key={item.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-background">
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    <code className="text-xs bg-background px-2 py-0.5 rounded mt-1 inline-block truncate max-w-full">
                      {item.value ? (item.value.length > 60 ? item.value.substring(0, 60) + '...' : item.value) : 'غير متاح'}
                    </code>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(item.key, item.value)}
                  disabled={!item.value}
                >
                  {copiedKey === item.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Edge Functions Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              نقاط نهاية API
            </CardTitle>
            <CardDescription>
              الـ Edge Functions المتاحة للتكامل مع n8n والأنظمة الخارجية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Base URL:</span>
              <code className="text-sm font-mono flex-1" dir="ltr">{supabaseUrl}</code>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copyToClipboard('base-url', supabaseUrl)}
              >
                {copiedKey === 'base-url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="grid gap-2 sm:grid-cols-2">
              {edgeFunctionsEndpoints.map((endpoint) => (
                <div key={endpoint.name} className="p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">{endpoint.method}</Badge>
                    <code className="text-xs font-mono" dir="ltr">{endpoint.path}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">{endpoint.description}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>ملاحظة:</strong> للاطلاع على التفاصيل الكاملة وأمثلة الاستخدام، راجع صفحة{' '}
                <a href="/integration" className="underline hover:no-underline">التكامل</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>الإصدار: 2.0.0</span>
              <span>آخر تحديث: يناير 2026</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Settings;
