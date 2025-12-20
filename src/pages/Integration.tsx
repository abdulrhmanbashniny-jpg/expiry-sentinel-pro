import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, Copy, ExternalLink, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Integration: React.FC = () => {
  const { toast } = useToast();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const [testResults, setTestResults] = useState<Record<string, { status: 'idle' | 'loading' | 'success' | 'error', message?: string }>>({});

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ!' });
  };

  const testEndpoint = async (name: string, url: string, method: string = 'GET', body?: object) => {
    setTestResults(prev => ({ ...prev, [name]: { status: 'loading' } }));
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (data.success) {
        setTestResults(prev => ({ ...prev, [name]: { status: 'success', message: JSON.stringify(data, null, 2) } }));
      } else {
        setTestResults(prev => ({ ...prev, [name]: { status: 'error', message: data.error || 'فشل الاختبار' } }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [name]: { status: 'error', message: error instanceof Error ? error.message : 'خطأ في الاتصال' } }));
    }
  };

  const endpoints = [
    {
      name: 'get-due-items',
      title: 'جلب العناصر المستحقة',
      method: 'GET',
      path: `${supabaseUrl}/functions/v1/get-due-items`,
      description: 'يجلب جميع العناصر التي تحتاج إرسال تنبيهات اليوم مع المستلمين',
      params: '?date=YYYY-MM-DD (اختياري)',
      response: `{
  "success": true,
  "check_date": "2024-01-15",
  "total_due": 2,
  "items": [
    {
      "item": {
        "id": "uuid",
        "title": "عقد موظف",
        "expiry_date": "2024-01-20",
        "expiry_time": "09:00",
        "days_left": 5,
        "category": "عقود",
        "responsible_person": "أحمد",
        "notes": "ملاحظة"
      },
      "reminder_rule": {
        "id": "uuid",
        "name": "قاعدة افتراضية",
        "trigger_day": 5
      },
      "recipients": [
        {
          "id": "uuid",
          "name": "محمد",
          "whatsapp_number": "+966500000000"
        }
      ]
    }
  ]
}`,
    },
    {
      name: 'prepare-message',
      title: 'تحضير رسالة',
      method: 'POST',
      path: `${supabaseUrl}/functions/v1/prepare-message`,
      description: 'يحضر رسالة واتساب جاهزة للإرسال لعنصر ومستلم محدد',
      body: `{
  "item_id": "uuid",
  "recipient_id": "uuid"
}`,
      response: `{
  "success": true,
  "data": {
    "phone": "+966500000000",
    "recipient_name": "محمد",
    "message": "🔔 تنبيه: عقد موظف...",
    "item_id": "uuid",
    "recipient_id": "uuid",
    "days_left": 5
  }
}`,
    },
    {
      name: 'send-notification',
      title: 'تسجيل إشعار',
      method: 'POST',
      path: `${supabaseUrl}/functions/v1/send-notification`,
      description: 'يسجل الإشعار في قاعدة البيانات بعد الإرسال (أو الفشل)',
      body: `{
  "item_id": "uuid",
  "recipient_id": "uuid",
  "days_left": 5,
  "status": "sent",
  "provider_message_id": "whatsapp_msg_123",
  "error_message": null
}`,
      response: `{
  "success": true,
  "log_id": "uuid",
  "status": "sent"
}`,
    },
    {
      name: 'get-message-template',
      title: 'قالب الرسالة',
      method: 'GET',
      path: `${supabaseUrl}/functions/v1/get-message-template`,
      description: 'يجلب أو يحدث قالب رسالة الواتساب',
      response: `{
  "success": true,
  "template": "🔔 تنبيه: {{title}}...",
  "variables": [
    "{{title}}",
    "{{expiry_date}}",
    "{{expiry_time}}",
    "{{days_left}}",
    "{{category}}",
    "{{responsible_person}}",
    "{{notes}}"
  ]
}`,
    },
    {
      name: 'test-whatsapp',
      title: 'اختبار واتساب',
      method: 'POST',
      path: `${supabaseUrl}/functions/v1/test-whatsapp`,
      description: 'يختبر إرسال رسالة واتساب لعنصر ومستلم محدد',
      body: `{
  "item_id": "uuid",
  "recipient_id": "uuid"
}`,
      response: `{
  "success": true,
  "data": {
    "recipient": { "name": "محمد", "whatsapp_number": "+966500000000" },
    "item": { "id": "uuid", "title": "عقد موظف", ... },
    "message": "رسالة التنبيه...",
    "webhook_payload": { "phone": "...", "message": "..." }
  }
}`,
    },
  ];

  const n8nWorkflow = `{
  "name": "HR Reminder Daily Check",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": { "interval": [{ "field": "hours", "hoursInterval": 24 }] }
      },
      "position": [250, 300]
    },
    {
      "name": "Get Due Items",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "${supabaseUrl}/functions/v1/get-due-items"
      },
      "position": [450, 300]
    },
    {
      "name": "Loop Items",
      "type": "n8n-nodes-base.splitInBatches",
      "parameters": { "batchSize": 1 },
      "position": [650, 300]
    },
    {
      "name": "Loop Recipients",
      "type": "n8n-nodes-base.splitInBatches",
      "parameters": { "batchSize": 1, "options": {} },
      "position": [850, 300]
    },
    {
      "name": "Prepare Message",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "${supabaseUrl}/functions/v1/prepare-message",
        "body": "={{ JSON.stringify({ item_id: $json.item.id, recipient_id: $json.recipients[0].id }) }}"
      },
      "position": [1050, 300]
    },
    {
      "name": "Send WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "YOUR_WHATSAPP_API_URL",
        "body": "={{ JSON.stringify({ phone: $json.data.phone, message: $json.data.message }) }}"
      },
      "position": [1250, 300]
    },
    {
      "name": "Log Notification",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "${supabaseUrl}/functions/v1/send-notification",
        "body": "={{ JSON.stringify({ item_id: $json.data.item_id, recipient_id: $json.data.recipient_id, days_left: $json.data.days_left, status: 'sent' }) }}"
      },
      "position": [1450, 300]
    }
  ]
}`;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التكامل مع n8n</h1>
        <p className="text-muted-foreground">إعداد الأتمتة للتنبيهات التلقائية عبر واتساب</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>معلومات الاتصال</CardTitle>
          <CardDescription>استخدم هذه المعلومات لإعداد n8n</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm text-muted-foreground">Base URL</p>
              <code className="text-sm" dir="ltr">{supabaseUrl}</code>
            </div>
            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(supabaseUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-lg border p-3 bg-warning/10">
            <p className="text-sm font-medium text-warning">ملاحظة</p>
            <p className="text-sm text-muted-foreground">الـ APIs متاحة بدون مصادقة للاستخدام مع n8n. تأكد من حماية webhook URL.</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="endpoints">نقاط النهاية</TabsTrigger>
          <TabsTrigger value="workflow">Workflow جاهز</TabsTrigger>
          <TabsTrigger value="ai-workflow">AI WhatsApp Bot</TabsTrigger>
          <TabsTrigger value="steps">خطوات الإعداد</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4 mt-4">
          {endpoints.map((ep) => (
            <Card key={ep.name}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{ep.title}</CardTitle>
                    <Badge variant={ep.method === 'GET' ? 'default' : 'secondary'}>
                      {ep.method}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResults[ep.name]?.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    )}
                    {testResults[ep.name]?.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    {ep.method === 'GET' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testEndpoint(ep.name, ep.path)}
                        disabled={testResults[ep.name]?.status === 'loading'}
                      >
                        <Play className="h-4 w-4 ml-1" />
                        اختبار
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>{ep.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted p-2 text-xs overflow-x-auto" dir="ltr">
                    {ep.path}{ep.params || ''}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(ep.path)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                {ep.body && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Body:</p>
                    <pre className="rounded bg-muted p-2 text-xs overflow-x-auto" dir="ltr">{ep.body}</pre>
                  </div>
                )}
                
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Response:</p>
                  <pre className="rounded bg-muted p-2 text-xs overflow-x-auto max-h-40" dir="ltr">{ep.response}</pre>
                </div>

                {testResults[ep.name]?.message && (
                  <div className={`rounded p-2 text-xs ${testResults[ep.name]?.status === 'success' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                    <pre className="overflow-x-auto" dir="ltr">{testResults[ep.name]?.message}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="workflow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                n8n Workflow JSON
              </CardTitle>
              <CardDescription>حمّل ملف الـ JSON واستورده في n8n</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/n8n-workflow.json';
                    link.download = 'hr-reminder-n8n-workflow.json';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast({ title: 'جاري تحميل الملف...' });
                  }}
                >
                  <ExternalLink className="h-4 w-4 ml-2" />
                  تحميل ملف Workflow JSON
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => copyToClipboard(n8nWorkflow)}
                >
                  <Copy className="h-4 w-4 ml-2" />
                  نسخ الكود
                </Button>
              </div>
              
              <div className="relative">
                <pre className="rounded bg-muted p-4 text-xs overflow-x-auto max-h-96" dir="ltr">
                  {n8nWorkflow}
                </pre>
              </div>
              
              <div className="rounded-lg border p-3 bg-primary/5">
                <p className="text-sm font-medium">ملاحظة مهمة</p>
                <p className="text-sm text-muted-foreground">
                  1. استبدل YOUR_WHATSAPP_API_URL برابط API الواتساب الخاص بك (Twilio أو WhatsApp Business API)
                </p>
                <p className="text-sm text-muted-foreground">
                  2. أضف متغير SUPABASE_URL في إعدادات n8n بالقيمة: <code className="bg-background px-1 rounded">{supabaseUrl}</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-workflow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                🤖 WhatsApp AI Assistant Workflow
              </CardTitle>
              <CardDescription>
                Bot ذكي يستقبل رسائل WhatsApp ويرد عليها بذكاء اصطناعي مع إمكانية الاستعلام عن المعاملات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 bg-primary/5">
                <h4 className="font-semibold mb-2">📋 مميزات هذا الـ Workflow:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• يستقبل رسائل WhatsApp عبر Webhook من منصة appslink.io</li>
                  <li>• يعالج الرسالة بالذكاء الاصطناعي (OpenAI)</li>
                  <li>• لديه أدوات للبحث واستعلام المعاملات</li>
                  <li>• كل معاملة لها رقم تسلسلي مرجعي</li>
                  <li>• يرد على المستخدم عبر WhatsApp</li>
                  <li>• يسجل جميع المحادثات للمراجعة</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  className="flex-1"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = '/n8n-whatsapp-ai-workflow.json';
                    link.download = 'whatsapp-ai-assistant-workflow.json';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast({ title: 'جاري تحميل ملف AI Workflow...' });
                  }}
                >
                  <ExternalLink className="h-4 w-4 ml-2" />
                  تحميل AI Workflow JSON
                </Button>
              </div>

              <div className="rounded-lg border p-4 bg-warning/10">
                <h4 className="font-semibold text-warning mb-2">⚙️ إعداد مطلوب في n8n:</h4>
                <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
                  <li>أضف <code className="bg-background px-1 rounded">OpenAI API Credentials</code> في n8n</li>
                  <li>أضف <code className="bg-background px-1 rounded">Supabase Auth</code> (Header: apikey = SUPABASE_ANON_KEY)</li>
                  <li>أضف <code className="bg-background px-1 rounded">AppsLink API Key</code> للواتساب</li>
                  <li>أضف متغير بيئة <code className="bg-background px-1 rounded">SUPABASE_URL = {supabaseUrl}</code></li>
                  <li>عدّل رابط API الإرسال حسب توثيق appslink.io</li>
                </ol>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-semibold mb-2">🔗 نقاط النهاية الإضافية للـ AI:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">GET</Badge>
                    <code className="text-xs" dir="ltr">/functions/v1/search-items?query=...</code>
                    <span className="text-muted-foreground">- بحث عن معاملة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">GET</Badge>
                    <code className="text-xs" dir="ltr">/functions/v1/get-item-details?item_id=...</code>
                    <span className="text-muted-foreground">- تفاصيل معاملة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">POST</Badge>
                    <code className="text-xs" dir="ltr">/functions/v1/log-conversation</code>
                    <span className="text-muted-foreground">- تسجيل محادثة</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap p-4 bg-muted/30 rounded-lg" dir="ltr">
                <Badge variant="outline" className="py-2 bg-green-500/10">📱 WhatsApp Webhook</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Parse Message</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2 bg-purple-500/10">🤖 AI Agent</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Prepare Response</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2 bg-green-500/10">📤 Send WhatsApp</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Log Conversation</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>خطوات إعداد n8n</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-4 text-sm">
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">إنشاء Workflow جديد</span>
                  <p className="text-muted-foreground mt-1 mr-5">افتح n8n وأنشئ workflow جديد أو استورد الـ JSON أعلاه</p>
                </li>
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">إضافة Schedule Trigger</span>
                  <p className="text-muted-foreground mt-1 mr-5">اضبط التشغيل اليومي في الوقت المناسب (مثلاً 8:00 صباحاً)</p>
                </li>
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">استدعاء Get Due Items</span>
                  <p className="text-muted-foreground mt-1 mr-5">
                    <code className="bg-background px-1 rounded" dir="ltr">GET {supabaseUrl}/functions/v1/get-due-items</code>
                  </p>
                </li>
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">Loop على العناصر والمستلمين</span>
                  <p className="text-muted-foreground mt-1 mr-5">استخدم SplitInBatches للمرور على كل عنصر ومستلميه</p>
                </li>
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">تحضير الرسالة</span>
                  <p className="text-muted-foreground mt-1 mr-5">
                    <code className="bg-background px-1 rounded" dir="ltr">POST /prepare-message</code> مع item_id و recipient_id
                  </p>
                </li>
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">إرسال WhatsApp</span>
                  <p className="text-muted-foreground mt-1 mr-5">استخدم Twilio أو WhatsApp Business API لإرسال الرسالة</p>
                </li>
                <li className="p-3 rounded-lg bg-muted/50">
                  <span className="font-medium">تسجيل الإشعار</span>
                  <p className="text-muted-foreground mt-1 mr-5">
                    <code className="bg-background px-1 rounded" dir="ltr">POST /send-notification</code> لتسجيل النتيجة
                  </p>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>مخطط العمل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 flex-wrap p-4 bg-muted/30 rounded-lg" dir="ltr">
                <Badge variant="outline" className="py-2">Schedule</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Get Due Items</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Loop Items</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Loop Recipients</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Prepare Message</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Send WhatsApp</Badge>
                <span>→</span>
                <Badge variant="outline" className="py-2">Log Notification</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Integration;
