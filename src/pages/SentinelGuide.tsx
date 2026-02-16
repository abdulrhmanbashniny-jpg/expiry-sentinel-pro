import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Helmet } from 'react-helmet';
import { Brain, Shield, TrendingUp, MessageSquare, Wrench, ThumbsDown, AlertTriangle, CheckCircle2, BookOpen, Bot, Zap, Eye } from 'lucide-react';

const TOOLS_LIST = [
  { name: 'get_items_summary', desc: 'استعراض ملخص العناصر والوثائق', category: 'بيانات' },
  { name: 'get_expiring_items', desc: 'عرض العناصر التي ستنتهي قريباً', category: 'تذكيرات' },
  { name: 'audit_date_consistency', desc: 'فحص تناسق التواريخ', category: 'تدقيق' },
  { name: 'audit_missing_data', desc: 'كشف البيانات المفقودة', category: 'تدقيق' },
  { name: 'predict_expiry_risk', desc: 'تنبؤ بمخاطر الانتهاء الشهرية', category: 'تنبؤ' },
  { name: 'get_renewal_forecast', desc: 'توقعات التجديد المستقبلية', category: 'تنبؤ' },
  { name: 'analyze_risks', desc: 'تحليل شامل للمخاطر', category: 'تنبؤ' },
  { name: 'draft_reminder_message', desc: 'صياغة رسالة تذكير', category: 'تواصل' },
  { name: 'schedule_bulk_alerts', desc: 'جدولة تنبيهات جماعية', category: 'تواصل' },
  { name: 'get_contracts_summary', desc: 'ملخص العقود النشطة', category: 'عقود' },
  { name: 'get_evaluation_stats', desc: 'إحصائيات التقييمات', category: 'أداء' },
  { name: 'get_department_items', desc: 'عناصر حسب القسم', category: 'أقسام' },
  { name: 'get_compliance_score', desc: 'درجة الامتثال', category: 'امتثال' },
  { name: 'search_items', desc: 'بحث ذكي في العناصر', category: 'بيانات' },
  { name: 'get_notification_log', desc: 'سجل الإشعارات المرسلة', category: 'تذكيرات' },
  { name: 'create_reminder', desc: 'إنشاء تذكير جديد', category: 'تذكيرات' },
];

export default function SentinelGuide() {
  return (
    <>
      <Helmet>
        <title>دليل Sentinel AI - Expiry Sentinel Pro</title>
      </Helmet>

      <div className="animate-fade-in space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            دليل Sentinel AI
          </h1>
          <p className="text-muted-foreground">كل ما تحتاج معرفته للتعامل مع المساعد الذكي</p>
        </div>

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              ما هو Sentinel AI؟
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>
              <strong>Sentinel AI</strong> هو مساعد ذكاء اصطناعي مستقل مبني خصيصاً لإدارة الوثائق وتتبع تواريخ الانتهاء.
              يستخدم نظام <strong>ReAct</strong> (التفكير ثم التنفيذ) لتحويل أوامرك النصية إلى إجراءات فعلية في النظام.
            </p>
            <p>
              يعمل النظام بثلاثة وكلاء متخصصين يتعاونون لتوفير تجربة شاملة: التدقيق التلقائي، التنبؤ بالمخاطر، وصياغة الرسائل.
            </p>
          </CardContent>
        </Card>

        {/* Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              الوكلاء المتخصصون
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold">وكيل التدقيق (Auditor)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                يفحص جميع الوثائق والتواريخ المدخلة تلقائياً للكشف عن التناقضات مثل:
                "تاريخ الانتهاء قبل تاريخ الإصدار" أو "بيانات إلزامية مفقودة".
              </p>
              <p className="text-sm"><strong>مثال:</strong> "افحص كل العناصر المنتهية لهذا الشهر"</p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                <h4 className="font-semibold">وكيل التنبؤ (Predictor)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                يحلل "معدل استهلاك" الوثائق ويتنبأ بالشهور الأكثر خطورة من حيث الوثائق المنتهية.
              </p>
              <p className="text-sm"><strong>مثال:</strong> "ما هو الشهر الأكثر خطورة في الربع القادم؟"</p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold">وكيل التواصل (Communicator)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                يصيغ رسائل تذكير احترافية مخصصة حسب مستوى الإلحاح ويرسلها عبر WhatsApp أو Telegram أو البريد.
              </p>
              <p className="text-sm"><strong>مثال:</strong> "صِغ رسالة عاجلة لكل العقود التي تنتهي في مارس"</p>
            </div>
          </CardContent>
        </Card>

        {/* Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              الأدوات المتاحة ({TOOLS_LIST.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOOLS_LIST.map(tool => (
                <div key={tool.name} className="flex items-start gap-2 rounded border p-2.5">
                  <Zap className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-medium truncate">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">{tool.category}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Feedback Loop */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5" />
              حلقة التعلم (Learning Loop)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              عندما يقترح الذكاء الاصطناعي إجراءً ما وتقوم بتعديله، يحفظ النظام هذا التصحيح في ذاكرته
              لتجنب تكرار نفس الخطأ مستقبلاً.
            </p>
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <h5 className="text-sm font-semibold">كيف تعمل:</h5>
              <ol className="text-sm space-y-1.5 list-decimal list-inside text-muted-foreground">
                <li>AI يقترح إجراءً (مثل: جدولة تذكير بعد 30 يوم)</li>
                <li>تضغط زر <ThumbsDown className="inline h-3.5 w-3.5" /> على الرد</li>
                <li>تكتب التصحيح: "التذكير يجب أن يكون قبل 14 يوم وليس 30"</li>
                <li>AI يحفظ التصحيح ويستخدمه في المرات القادمة</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Risk Predictions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              تفسير تنبؤات المخاطر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3 text-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">منخفض</p>
                <p className="text-xs text-green-600 dark:text-green-400">لا يوجد إجراء فوري مطلوب</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3 text-center">
                <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">متوسط</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">يجب المراجعة خلال أسبوع</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-3 text-center">
                <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">عالي</p>
                <p className="text-xs text-red-600 dark:text-red-400">إجراء فوري مطلوب</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Human in the Loop */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              الإنسان في الحلقة (Human-in-the-Loop)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              العمليات عالية الخطورة (مثل جدولة تنبيهات جماعية أو تعديل العقود) لا تُنفَّذ تلقائياً.
              بدلاً من ذلك، يعرض النظام <strong>بطاقة عمل</strong> تحتاج موافقتك قبل التنفيذ.
            </p>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm">
                <strong>مثال:</strong> إذا طلبت "أرسل تذكيراً لكل العقود المنتهية في مارس"، سيعرض AI بطاقة تحتوي:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>عدد العقود المتأثرة</li>
                <li>قنوات الإرسال (WhatsApp/Telegram)</li>
                <li>زر "تأكيد" وزر "إلغاء"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
