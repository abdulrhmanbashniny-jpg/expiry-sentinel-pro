import React, { useState } from 'react';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Settings, TestTube, Check, X, Bot, MessageSquare, Workflow, Brain, Info, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Helmet } from 'react-helmet';
import { Integration } from '@/types/database';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import WhatsAppTestSection from '@/components/integrations/WhatsAppTestSection';

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  n8n: Workflow,
  telegram: Bot,
  whatsapp: MessageSquare,
  ai_assistant: Brain,
};

const INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  n8n: 'أتمتة سير العمل والتذكيرات التلقائية عبر n8n',
  telegram: 'بوت تيليجرام للتنبيهات والاستعلام عن المعاملات',
  whatsapp: 'إرسال تنبيهات واتساب عبر AppsLink (Evolution API)',
  ai_assistant: 'مستشار ذكي لتحليل البيانات والتوصيات',
};

const AI_PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI (مجاني - موصى به)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
];

const AI_MODELS: Record<string, { value: string; label: string }[]> = {
  lovable: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (سريع)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (متقدم)' },
    { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro (أحدث)' },
    { value: 'openai/gpt-5', label: 'GPT-5' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (اقتصادي)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku' },
  ],
};

export default function Integrations() {
  const { integrations, isLoading, updateIntegration, testIntegration } = useIntegrations();
  const [editingConfig, setEditingConfig] = useState<Record<string, Record<string, any>>>({});

  const handleConfigChange = (key: string, field: string, value: any) => {
    setEditingConfig(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || integrations.find(i => i.key === key)?.config || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = (integration: Integration) => {
    const config = editingConfig[integration.key] || integration.config;
    updateIntegration.mutate({ key: integration.key, config });
  };

  const handleToggleActive = (integration: Integration) => {
    updateIntegration.mutate({ key: integration.key, is_active: !integration.is_active });
  };

  const handleTest = (key: string) => {
    testIntegration.mutate(key);
  };

  const getConfig = (integration: Integration) => {
    return editingConfig[integration.key] || integration.config;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderN8nConfig = (integration: Integration) => {
    const config = getConfig(integration);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              يُستخدم n8n لأتمتة سير العمل وإرسال التذكيرات التلقائية. 
              المفتاح الداخلي (Internal Key) مطلوب للمصادقة بين n8n و Edge Functions.
            </span>
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="n8n-base-url">Base URL</Label>
          <Input
            id="n8n-base-url"
            placeholder="https://your-n8n-instance.com"
            value={config.base_url || ''}
            onChange={(e) => handleConfigChange('n8n', 'base_url', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="n8n-api-key">API Key (اختياري)</Label>
          <Input
            id="n8n-api-key"
            type="password"
            placeholder={config.api_key ? '••••••••' + (config.api_key as string).slice(-4) : 'أدخل API Key'}
            onChange={(e) => handleConfigChange('n8n', 'api_key', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="n8n-internal-key">Internal Function Key (مطلوب)</Label>
          <Input
            id="n8n-internal-key"
            type="password"
            placeholder={config.internal_key ? '••••••••' + (config.internal_key as string).slice(-4) : 'أدخل المفتاح الداخلي'}
            onChange={(e) => handleConfigChange('n8n', 'internal_key', e.target.value)}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            يُستخدم في header: <code className="bg-muted px-1 rounded">x-internal-key</code>
          </p>
        </div>
      </div>
    );
  };

  const renderTelegramConfig = (integration: Integration) => {
    const config = getConfig(integration);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
    
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              أنشئ بوت جديد عبر <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">@BotFather</code> في Telegram 
              واحصل على Bot Token. يدعم البوت الأوامر: /search, /expiring, /help
            </span>
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="telegram-token">Bot Token</Label>
          <Input
            id="telegram-token"
            type="password"
            placeholder={config.bot_token ? '••••••••' + (config.bot_token as string).slice(-4) : 'أدخل Bot Token'}
            onChange={(e) => handleConfigChange('telegram', 'bot_token', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-chat">Default Chat ID (اختياري)</Label>
          <Input
            id="telegram-chat"
            placeholder="-100123456789"
            value={config.default_chat_id || ''}
            onChange={(e) => handleConfigChange('telegram', 'default_chat_id', e.target.value)}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            معرف المجموعة أو القناة الافتراضية للتنبيهات
          </p>
        </div>
        
        <Accordion type="single" collapsible>
          <AccordionItem value="webhook">
            <AccordionTrigger className="text-sm">إعداد Webhook</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly dir="ltr" className="bg-muted font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                  نسخ
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                اضبط Webhook عبر: <code className="bg-muted px-1 rounded text-xs">https://api.telegram.org/bot[TOKEN]/setWebhook?url=[URL]</code>
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  const renderWhatsAppConfig = (integration: Integration) => {
    const config = getConfig(integration);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const webhookUrl = `${supabaseUrl}/functions/v1/appslink-webhook`;
    
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
          <p className="text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              يتم استخدام <strong>AppsLink.io</strong> (Evolution API) كمزود WhatsApp Business API.
              تنسيق الأرقام: <code className="bg-green-100 dark:bg-green-900 px-1 rounded">966XXXXXXXXX</code>
            </span>
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="whatsapp-url">API Base URL</Label>
          <Input
            id="whatsapp-url"
            placeholder="https://app.appslink.io/api/v1"
            value={config.api_base_url || ''}
            onChange={(e) => handleConfigChange('whatsapp', 'api_base_url', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp-token">API Key / Access Token</Label>
          <Input
            id="whatsapp-token"
            type="password"
            placeholder={config.access_token ? '••••••••' + (config.access_token as string).slice(-4) : 'أدخل AppsLink API Key'}
            onChange={(e) => handleConfigChange('whatsapp', 'access_token', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp-instance">Instance Name</Label>
          <Input
            id="whatsapp-instance"
            placeholder="evolution أو main"
            value={config.instance_name || ''}
            onChange={(e) => handleConfigChange('whatsapp', 'instance_name', e.target.value)}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            اسم الـ Instance من AppsLink Dashboard
          </p>
        </div>
        
        <Accordion type="single" collapsible>
          <AccordionItem value="webhook">
            <AccordionTrigger className="text-sm">إعداد Webhook (لتتبع حالة الرسائل)</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly dir="ltr" className="bg-muted font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    نسخ
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ضع هذا الرابط في إعدادات AppsLink لاستقبال تحديثات حالة الرسائل
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="whatsapp-webhook-secret">Webhook Secret (اختياري)</Label>
                <Input
                  id="whatsapp-webhook-secret"
                  type="password"
                  placeholder={config.webhook_secret ? '••••••••' + (config.webhook_secret as string).slice(-4) : 'أدخل سر Webhook'}
                  onChange={(e) => handleConfigChange('whatsapp', 'webhook_secret', e.target.value)}
                  dir="ltr"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  const renderAIConfig = (integration: Integration) => {
    const config = getConfig(integration);
    const provider = config.provider || 'lovable';
    const models = AI_MODELS[provider] || AI_MODELS.lovable;

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950">
          <p className="text-xs text-purple-700 dark:text-purple-300 flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Lovable AI</strong> مجاني ولا يتطلب API Key. يدعم تحليل التقييمات، 
              مستشار الامتثال، وتوليد التقارير الذكية.
            </span>
          </p>
        </div>
        
        <div className="space-y-2">
          <Label>مزوّد الذكاء الاصطناعي</Label>
          <Select
            value={provider}
            onValueChange={(value) => handleConfigChange('ai_assistant', 'provider', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {provider !== 'lovable' && (
          <div className="space-y-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              placeholder={config.api_key ? '••••••••' + (config.api_key as string).slice(-4) : 'أدخل API Key'}
              onChange={(e) => handleConfigChange('ai_assistant', 'api_key', e.target.value)}
              dir="ltr"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>الموديل</Label>
          <Select
            value={config.model || models[0].value}
            onValueChange={(value) => handleConfigChange('ai_assistant', 'model', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="prompt">
            <AccordionTrigger className="text-sm">System Prompt (متقدم)</AccordionTrigger>
            <AccordionContent>
              <Textarea
                id="ai-prompt"
                placeholder="أنت مستشار ذكي متخصص في إدارة الموارد البشرية..."
                value={config.system_prompt || ''}
                onChange={(e) => handleConfigChange('ai_assistant', 'system_prompt', e.target.value)}
                rows={4}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  const renderConfigForm = (integration: Integration) => {
    switch (integration.key) {
      case 'n8n':
        return renderN8nConfig(integration);
      case 'telegram':
        return renderTelegramConfig(integration);
      case 'whatsapp':
        return renderWhatsAppConfig(integration);
      case 'ai_assistant':
        return renderAIConfig(integration);
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>التكاملات - HR Reminder</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">التكاملات</h1>
          <p className="text-muted-foreground">
            إدارة تكاملات النظام مع الخدمات الخارجية
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {integrations.map((integration) => {
            const Icon = INTEGRATION_ICONS[integration.key] || Settings;
            const description = INTEGRATION_DESCRIPTIONS[integration.key] || '';

            return (
              <Card key={integration.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {integration.name}
                          {integration.is_active && (
                            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                              مفعّل
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {description}
                        </CardDescription>
                        {integration.last_tested_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {integration.test_result?.success ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <X className="h-3 w-3 text-red-500" />
                            )}
                            آخر اختبار: {format(new Date(integration.last_tested_at), 'yyyy-MM-dd HH:mm')}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={integration.is_active}
                      onCheckedChange={() => handleToggleActive(integration)}
                    />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {renderConfigForm(integration)}

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      onClick={() => handleSave(integration)}
                      disabled={updateIntegration.isPending}
                      className="flex-1"
                    >
                      {updateIntegration.isPending && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      )}
                      حفظ
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleTest(integration.key)}
                      disabled={testIntegration.isPending}
                    >
                      {testIntegration.isPending ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="ml-2 h-4 w-4" />
                      )}
                      اختبار
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* WhatsApp Test Section */}
        <WhatsAppTestSection />

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">روابط مفيدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/integration" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  دليل التكامل مع n8n
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  الإعدادات العامة
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
