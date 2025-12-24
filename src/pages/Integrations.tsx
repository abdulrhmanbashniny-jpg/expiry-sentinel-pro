import React, { useState } from 'react';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Settings, TestTube, Check, X, Bot, MessageSquare, Workflow, Brain } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Helmet } from 'react-helmet';
import { Integration } from '@/types/database';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  n8n: Workflow,
  telegram: MessageSquare,
  whatsapp: MessageSquare,
  ai_assistant: Brain,
};

const AI_PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI (مجاني)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
];

const AI_MODELS: Record<string, { value: string; label: string }[]> = {
  lovable: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (افتراضي)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'openai/gpt-5', label: 'GPT-5' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
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
          <Label htmlFor="n8n-api-key">API Key</Label>
          <Input
            id="n8n-api-key"
            type="password"
            placeholder="n8n API Key"
            value={config.api_key || ''}
            onChange={(e) => handleConfigChange('n8n', 'api_key', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="n8n-internal-key">Internal Function Key</Label>
          <Input
            id="n8n-internal-key"
            type="password"
            placeholder="المفتاح الداخلي لاستدعاء Edge Functions"
            value={config.internal_key || ''}
            onChange={(e) => handleConfigChange('n8n', 'internal_key', e.target.value)}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">
            يُستخدم هذا المفتاح في هيدر x-internal-key للمصادقة بين n8n و Edge Functions
          </p>
        </div>
      </div>
    );
  };

  const renderTelegramConfig = (integration: Integration) => {
    const config = getConfig(integration);
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="telegram-token">Bot Token</Label>
          <Input
            id="telegram-token"
            type="password"
            placeholder="123456:ABC-DEF1234ghIkl..."
            value={config.bot_token || ''}
            onChange={(e) => handleConfigChange('telegram', 'bot_token', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-chat">Default Chat ID</Label>
          <Input
            id="telegram-chat"
            placeholder="-100123456789"
            value={config.default_chat_id || ''}
            onChange={(e) => handleConfigChange('telegram', 'default_chat_id', e.target.value)}
            dir="ltr"
          />
        </div>
      </div>
    );
  };

  const renderWhatsAppConfig = (integration: Integration) => {
    const config = getConfig(integration);
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatsapp-url">API Base URL</Label>
          <Input
            id="whatsapp-url"
            placeholder="https://graph.facebook.com/v18.0"
            value={config.api_base_url || ''}
            onChange={(e) => handleConfigChange('whatsapp', 'api_base_url', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp-token">Access Token</Label>
          <Input
            id="whatsapp-token"
            type="password"
            placeholder="WhatsApp Business API Token"
            value={config.access_token || ''}
            onChange={(e) => handleConfigChange('whatsapp', 'access_token', e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp-phone">Phone Number ID</Label>
          <Input
            id="whatsapp-phone"
            placeholder="123456789012345"
            value={config.phone_number_id || ''}
            onChange={(e) => handleConfigChange('whatsapp', 'phone_number_id', e.target.value)}
            dir="ltr"
          />
        </div>
      </div>
    );
  };

  const renderAIConfig = (integration: Integration) => {
    const config = getConfig(integration);
    const provider = config.provider || 'lovable';
    const models = AI_MODELS[provider] || AI_MODELS.lovable;

    return (
      <div className="space-y-4">
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
              placeholder="API Key"
              value={config.api_key || ''}
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

        <div className="space-y-2">
          <Label htmlFor="ai-prompt">System Prompt</Label>
          <Textarea
            id="ai-prompt"
            placeholder="أنت مساعد ذكي متخصص في إدارة التذكيرات..."
            value={config.system_prompt || ''}
            onChange={(e) => handleConfigChange('ai_assistant', 'system_prompt', e.target.value)}
            rows={4}
          />
        </div>
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

        <div className="grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => {
            const Icon = INTEGRATION_ICONS[integration.key] || Settings;
            const hasChanges = editingConfig[integration.key] !== undefined;

            return (
              <Card key={integration.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <CardDescription>
                          {integration.last_tested_at ? (
                            <span className="flex items-center gap-1">
                              {integration.test_result?.success ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              آخر اختبار: {format(new Date(integration.last_tested_at), 'PPp', { locale: ar })}
                            </span>
                          ) : (
                            'لم يتم الاختبار بعد'
                          )}
                        </CardDescription>
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

                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => handleSave(integration)}
                      disabled={updateIntegration.isPending}
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
                      اختبار الاتصال
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
