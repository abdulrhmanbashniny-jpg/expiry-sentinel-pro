import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePublishedResults, PublishedResult } from '@/hooks/usePublishedResults';
import { useEvaluations } from '@/hooks/useEvaluations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Brain, MessageSquare, CheckCircle, Clock, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function MyResults() {
  const { user } = useAuth();
  const { publishedResults, appeals, submitAppeal, isLoading } = usePublishedResults();
  const { cycles } = useEvaluations();

  const [isAppealDialogOpen, setIsAppealDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<PublishedResult | null>(null);
  const [appealText, setAppealText] = useState('');

  // نتائجي المنشورة فقط
  const myResults = publishedResults.filter((r) => r.evaluatee_id === user?.id);
  
  // اعتراضاتي
  const myAppeals = appeals.filter((a) => a.evaluatee_id === user?.id);

  const getCycleName = (cycleId: string) => {
    const cycle = cycles.find((c) => c.id === cycleId);
    return cycle?.name || 'غير معروف';
  };

  const canAppeal = (result: PublishedResult) => {
    // التحقق من عدم وجود اعتراض سابق
    const existingAppeal = myAppeals.find((a) => a.published_result_id === result.id);
    if (existingAppeal) return false;

    // التحقق من نافذة الاعتراض (افتراضي 5 أيام)
    const publishedDate = new Date(result.published_at);
    const daysSincePublish = differenceInDays(new Date(), publishedDate);
    return daysSincePublish <= 5;
  };

  const getDaysRemaining = (result: PublishedResult) => {
    const publishedDate = new Date(result.published_at);
    const remaining = 5 - differenceInDays(new Date(), publishedDate);
    return Math.max(0, remaining);
  };

  const openAppealDialog = (result: PublishedResult) => {
    setSelectedResult(result);
    setAppealText('');
    setIsAppealDialogOpen(true);
  };

  const handleSubmitAppeal = () => {
    if (!selectedResult || !appealText.trim()) return;
    submitAppeal.mutate({
      published_result_id: selectedResult.id,
      appeal_text: appealText,
    });
    setIsAppealDialogOpen(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-blue-600';
    if (score >= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4.5) return 'ممتاز';
    if (score >= 4) return 'جيد جداً';
    if (score >= 3) return 'جيد';
    if (score >= 2) return 'مقبول';
    return 'يحتاج تحسين';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">نتائج التقييم</h1>
        <p className="text-muted-foreground">عرض نتائج تقييماتك المنشورة</p>
      </div>

      {myResults.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">لا توجد نتائج منشورة</p>
            <p className="text-muted-foreground">ستظهر نتائجك هنا بعد نشرها من قبل مدير النظام</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {myResults.map((result) => {
            const existingAppeal = myAppeals.find((a) => a.published_result_id === result.id);
            const daysRemaining = getDaysRemaining(result);

            return (
              <Card key={result.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{getCycleName(result.cycle_id)}</CardTitle>
                      <CardDescription>
                        تاريخ النشر: {format(new Date(result.published_at), 'yyyy-MM-dd')}
                      </CardDescription>
                    </div>
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getScoreColor(result.final_score)}`}>
                        {result.final_score.toFixed(1)}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {getScoreLabel(result.final_score)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* شريط الدرجة */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>الدرجة</span>
                      <span>{result.final_score.toFixed(1)} / 5</span>
                    </div>
                    <Progress value={result.final_score * 20} className="h-3" />
                  </div>

                  {/* ملخص AI */}
                  {result.ai_summary && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <span className="font-medium">ملخص التقييم</span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {result.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* حالة الاعتراض */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    {existingAppeal ? (
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            existingAppeal.status === 'pending' ? 'outline' : 
                            existingAppeal.status === 'accepted' ? 'default' : 
                            'destructive'
                          }
                        >
                          {existingAppeal.status === 'pending' ? 'اعتراض قيد المراجعة' :
                           existingAppeal.status === 'accepted' ? 'تم قبول الاعتراض' :
                           'تم رفض الاعتراض'}
                        </Badge>
                        {existingAppeal.response_text && (
                          <span className="text-sm text-muted-foreground">
                            - {existingAppeal.response_text}
                          </span>
                        )}
                      </div>
                    ) : canAppeal(result) ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          متبقي {daysRemaining} يوم للاعتراض
                        </div>
                        <Button variant="outline" onClick={() => openAppealDialog(result)}>
                          <MessageSquare className="h-4 w-4 ml-2" />
                          تقديم اعتراض
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4" />
                        انتهت مهلة الاعتراض
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* تنبيه الخصوصية */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">ملاحظة حول الخصوصية</p>
              <p>
                لحماية سرية عملية التقييم، لا يتم عرض هوية المقيّمين أو تفاصيل الإجابات.
                يظهر لك فقط الدرجة النهائية وملخص التقييم.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: تقديم اعتراض */}
      <Dialog open={isAppealDialogOpen} onOpenChange={setIsAppealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تقديم اعتراض</DialogTitle>
            <DialogDescription>
              سيتم إرسال اعتراضك لمدير النظام للمراجعة. لن يتم كشف هوية المقيّمين.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>نص الاعتراض</Label>
              <Textarea
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                placeholder="اكتب اعتراضك هنا مع ذكر الأسباب..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAppealDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmitAppeal} disabled={!appealText.trim()}>
              <MessageSquare className="h-4 w-4 ml-2" />
              إرسال الاعتراض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
