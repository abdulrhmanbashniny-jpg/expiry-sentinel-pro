import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Code, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Integration: React.FC = () => {
  const { toast } = useToast();
  const baseUrl = `${window.location.origin}`;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ!' });
  };

  const endpoints = [
    {
      name: 'جلب العناصر القادمة على الانتهاء',
      method: 'GET',
      path: '/rest/v1/items?status=eq.active&select=*,category:categories(*),reminder_rule:reminder_rules(*)',
      description: 'يجلب جميع العناصر النشطة مع الفئات وقواعد التذكير',
    },
    {
      name: 'جلب مستلمي عنصر معين',
      method: 'GET',
      path: '/rest/v1/item_recipients?item_id=eq.{ITEM_ID}&select=*,recipient:recipients(*)',
      description: 'يجلب المستلمين المرتبطين بعنصر معين',
    },
    {
      name: 'إضافة سجل إشعار',
      method: 'POST',
      path: '/rest/v1/notification_log',
      description: 'يضيف سجل إشعار جديد عند الإرسال أو الفشل',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التكامل مع n8n</h1>
        <p className="text-muted-foreground">إعداد الأتمتة للتنبيهات التلقائية</p>
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
            <p className="text-sm font-medium text-warning">ملاحظة أمنية</p>
            <p className="text-sm text-muted-foreground">استخدم Service Role Key في n8n للوصول الكامل للبيانات. لا تشارك هذا المفتاح علنياً.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5" /> نقاط النهاية (Endpoints)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {endpoints.map((ep, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{ep.name}</p>
                  <p className="text-sm text-muted-foreground">{ep.description}</p>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-mono ${ep.method === 'GET' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'}`}>
                  {ep.method}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted p-2 text-xs overflow-x-auto" dir="ltr">{ep.path}</code>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(ep.path)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>منطق الفحص اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>جلب العناصر النشطة التي لم تنته بعد</li>
            <li>لكل عنصر، حساب الأيام المتبقية حتى تاريخ الانتهاء</li>
            <li>مقارنة الأيام المتبقية مع قيم days_before في قاعدة التذكير</li>
            <li>إذا تطابقت، جلب المستلمين المرتبطين</li>
            <li>التحقق من notification_log لمنع التكرار</li>
            <li>إرسال رسالة واتساب وتسجيل النتيجة</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default Integration;
