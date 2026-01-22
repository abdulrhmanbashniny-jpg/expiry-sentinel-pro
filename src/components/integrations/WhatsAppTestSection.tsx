import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare,
  Calendar,
  Info
} from 'lucide-react';
import { format } from 'date-fns';

interface TestResult {
  success: boolean;
  message_id?: string;
  error?: string;
  raw_response?: any;
}

interface ScheduledTest {
  id: string;
  phone: string;
  message: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed';
}

const WhatsAppTestSection: React.FC = () => {
  const { toast } = useToast();
  
  // Manual test state
  const [manualPhone, setManualPhone] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [isManualTesting, setIsManualTesting] = useState(false);
  const [manualResult, setManualResult] = useState<TestResult | null>(null);
  
  // Scheduled test state
  const [scheduledPhone, setScheduledPhone] = useState('');
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTests, setScheduledTests] = useState<ScheduledTest[]>([]);

  const handleManualTest = async () => {
    if (!manualPhone || !manualMessage) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رقم الهاتف والرسالة',
        variant: 'destructive',
      });
      return;
    }

    // Validate phone format
    const cleanPhone = manualPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('966') || cleanPhone.length !== 12) {
      toast({
        title: 'صيغة الرقم غير صحيحة',
        description: 'استخدم الصيغة: 966XXXXXXXXX (12 رقم)',
        variant: 'destructive',
      });
      return;
    }

    setIsManualTesting(true);
    setManualResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: cleanPhone,
          message: manualMessage,
        },
      });

      if (error) {
        setManualResult({
          success: false,
          error: error.message,
        });
      } else {
        setManualResult({
          success: data.success,
          message_id: data.message_id,
          error: data.error,
          raw_response: data.raw_response,
        });
      }

      if (data?.success) {
        toast({
          title: 'تم الإرسال بنجاح',
          description: `Message ID: ${data.message_id || 'N/A'}`,
        });
      } else {
        toast({
          title: 'فشل الإرسال',
          description: data?.error || error?.message || 'خطأ غير معروف',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setManualResult({
        success: false,
        error: err.message,
      });
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsManualTesting(false);
    }
  };

  const handleScheduleTest = async () => {
    if (!scheduledPhone || !scheduledMessage || !scheduledDate || !scheduledTime) {
      toast({
        title: 'خطأ',
        description: 'يرجى تعبئة جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    // Validate phone format
    const cleanPhone = scheduledPhone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('966') || cleanPhone.length !== 12) {
      toast({
        title: 'صيغة الرقم غير صحيحة',
        description: 'استخدم الصيغة: 966XXXXXXXXX (12 رقم)',
        variant: 'destructive',
      });
      return;
    }

    setIsScheduling(true);

    try {
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`);
      
      // Store scheduled test in database
      const { data, error } = await supabase
        .from('automation_runs')
        .insert({
          job_type: 'scheduled_whatsapp_test',
          status: 'pending',
          metadata: {
            phone: cleanPhone,
            message: scheduledMessage,
            scheduled_for: scheduledFor.toISOString(),
          },
        })
        .select()
        .single();

      if (error) throw error;

      setScheduledTests(prev => [...prev, {
        id: data.id,
        phone: cleanPhone,
        message: scheduledMessage,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending',
      }]);

      toast({
        title: 'تم الجدولة بنجاح',
        description: `سيتم الإرسال في ${format(scheduledFor, 'yyyy-MM-dd HH:mm')}`,
      });

      // Clear form
      setScheduledPhone('');
      setScheduledMessage('');
      setScheduledDate('');
      setScheduledTime('');
    } catch (err: any) {
      toast({
        title: 'خطأ في الجدولة',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <Card className="border-green-200 dark:border-green-900">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
            <MessageSquare className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg">اختبار WhatsApp</CardTitle>
            <CardDescription>اختبار إرسال رسائل واتساب يدوياً أو مجدولاً</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="gap-2">
              <Send className="h-4 w-4" />
              إرسال فوري
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <Clock className="h-4 w-4" />
              إرسال مجدول
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  أدخل رقم واتساب بالصيغة الدولية: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">966XXXXXXXXX</code>
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-phone">رقم الواتساب</Label>
              <Input
                id="manual-phone"
                placeholder="966537375580"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-message">نص الرسالة</Label>
              <Textarea
                id="manual-message"
                placeholder="اكتب رسالة الاختبار هنا..."
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                rows={4}
              />
            </div>

            <Button 
              onClick={handleManualTest} 
              disabled={isManualTesting}
              className="w-full gap-2"
            >
              {isManualTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  إرسال اختبار
                </>
              )}
            </Button>

            {manualResult && (
              <Alert variant={manualResult.success ? 'default' : 'destructive'}>
                <div className="flex items-start gap-2">
                  {manualResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">
                          {manualResult.success ? 'تم الإرسال بنجاح' : 'فشل الإرسال'}
                        </p>
                        {manualResult.message_id && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Message ID:</span>{' '}
                            <code className="bg-muted px-1 rounded text-xs">{manualResult.message_id}</code>
                          </p>
                        )}
                        {manualResult.error && (
                          <p className="text-sm text-destructive">{manualResult.error}</p>
                        )}
                      </div>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4 mt-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  الرسائل المجدولة ستُرسل تلقائياً في الوقت المحدد (بتوقيت الرياض).
                  تأكد من أن التذكيرات التلقائية مفعّلة.
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-phone">رقم الواتساب</Label>
              <Input
                id="scheduled-phone"
                placeholder="966537375580"
                value={scheduledPhone}
                onChange={(e) => setScheduledPhone(e.target.value)}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-message">نص الرسالة</Label>
              <Textarea
                id="scheduled-message"
                placeholder="اكتب رسالة الاختبار المجدولة هنا..."
                value={scheduledMessage}
                onChange={(e) => setScheduledMessage(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">التاريخ</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled-time">الوقت</Label>
                <Input
                  id="scheduled-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            <Button 
              onClick={handleScheduleTest} 
              disabled={isScheduling}
              className="w-full gap-2"
              variant="secondary"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الجدولة...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  جدولة الإرسال
                </>
              )}
            </Button>

            {scheduledTests.length > 0 && (
              <div className="space-y-2">
                <Label>الرسائل المجدولة</Label>
                <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                  {scheduledTests.map((test) => (
                    <div key={test.id} className="p-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-mono">{test.phone}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(test.scheduled_for), 'yyyy-MM-dd HH:mm')}
                        </p>
                      </div>
                      <Badge 
                        variant={
                          test.status === 'sent' ? 'default' : 
                          test.status === 'failed' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        {test.status === 'sent' ? 'تم الإرسال' : 
                         test.status === 'failed' ? 'فشل' : 'قيد الانتظار'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default WhatsAppTestSection;
