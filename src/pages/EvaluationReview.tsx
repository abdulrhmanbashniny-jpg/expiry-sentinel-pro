import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations } from '@/hooks/useEvaluations';
import { usePublishedResults } from '@/hooks/usePublishedResults';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Edit, 
  Send, 
  AlertTriangle,
  FileCheck,
  MessageSquare,
  History
} from 'lucide-react';
import { format } from 'date-fns';

import { statusLabels, statusColors, evaluationTypeLabels } from '@/hooks/useEvaluations';

export default function EvaluationReview() {
  const { isSystemAdmin } = useAuth();
  const { evaluations } = useEvaluations();
  const { 
    appeals, 
    revisions, 
    publishResult, 
    createRevision, 
    respondToAppeal,
    approveEvaluation 
  } = usePublishedResults();
  const { users } = useTeamManagement();

  const [selectedEvaluation, setSelectedEvaluation] = useState<string | null>(null);
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [isAppealDialogOpen, setIsAppealDialogOpen] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<string | null>(null);

  const [revisionForm, setRevisionForm] = useState({
    revised_score: 0,
    revised_ai_summary: '',
    changes_summary: '',
    reason: '',
  });

  const [appealResponse, setAppealResponse] = useState({
    status: 'rejected' as 'accepted' | 'rejected',
    response_text: '',
  });

  if (!isSystemAdmin) {
    return (
      <div className="flex items-center justify-center h-96" dir="rtl">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <p className="text-lg font-semibold">صلاحية محظورة</p>
            <p className="text-muted-foreground">هذه الصفحة متاحة لمدير النظام فقط</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.profile.user_id === userId);
    return user?.profile.full_name || user?.profile.email || 'غير معروف';
  };

  // التقييمات بانتظار المراجعة
  const pendingReview = evaluations.filter(
    (e) => e.status === 'submitted'
  );

  // التقييمات المعتمدة بانتظار النشر
  const pendingPublish = evaluations.filter((e) => e.status === 'approved');

  // الاعتراضات المعلقة
  const pendingAppeals = appeals.filter((a) => a.status === 'pending');

  const handleApprove = (evaluationId: string) => {
    approveEvaluation.mutate(evaluationId);
  };

  const handlePublish = (evaluation: typeof evaluations[0]) => {
    publishResult.mutate({
      evaluation_id: evaluation.id,
      evaluatee_id: evaluation.evaluatee_id,
      cycle_id: evaluation.cycle_id,
      final_score: evaluation.total_score || 0,
      ai_summary: evaluation.ai_summary,
    });
  };

  const openRevisionDialog = (evaluation: typeof evaluations[0]) => {
    setSelectedEvaluation(evaluation.id);
    setRevisionForm({
      revised_score: evaluation.total_score || 0,
      revised_ai_summary: evaluation.ai_summary || '',
      changes_summary: '',
      reason: '',
    });
    setIsRevisionDialogOpen(true);
  };

  const handleCreateRevision = () => {
    if (!selectedEvaluation || !revisionForm.reason) return;
    const evaluation = evaluations.find((e) => e.id === selectedEvaluation);
    if (!evaluation) return;

    createRevision.mutate({
      evaluation_id: selectedEvaluation,
      original_score: evaluation.total_score,
      revised_score: revisionForm.revised_score,
      original_ai_summary: evaluation.ai_summary,
      revised_ai_summary: revisionForm.revised_ai_summary || null,
      changes_summary: revisionForm.changes_summary || null,
      reason: revisionForm.reason,
    });
    setIsRevisionDialogOpen(false);
  };

  const handleRespondToAppeal = () => {
    if (!selectedAppeal || !appealResponse.response_text) return;
    respondToAppeal.mutate({
      appeal_id: selectedAppeal,
      status: appealResponse.status,
      response_text: appealResponse.response_text,
    });
    setIsAppealDialogOpen(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">مراجعة التقييمات</h1>
        <p className="text-muted-foreground">اعتماد ونشر وإدارة التقييمات والاعتراضات</p>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بانتظار المراجعة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingReview.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بانتظار النشر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{pendingPublish.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الاعتراضات المعلقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{pendingAppeals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المراجعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revisions.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <FileCheck className="h-4 w-4" />
            بانتظار المراجعة ({pendingReview.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            بانتظار النشر ({pendingPublish.length})
          </TabsTrigger>
          <TabsTrigger value="appeals" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            الاعتراضات ({pendingAppeals.length})
          </TabsTrigger>
          <TabsTrigger value="revisions" className="gap-2">
            <History className="h-4 w-4" />
            سجل المراجعات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات بانتظار المراجعة</CardTitle>
              <CardDescription>راجع واعتمد التقييمات قبل النشر</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingReview.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد تقييمات بانتظار المراجعة</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>المُقيِّم</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingReview.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{getUserName(ev.evaluatee_id)}</TableCell>
                        <TableCell>{getUserName(ev.evaluator_id)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[ev.status]}>{statusLabels[ev.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {ev.total_score !== null ? (
                            <div className="flex items-center gap-2">
                              <span>{ev.total_score.toFixed(1)}</span>
                              <Progress value={ev.total_score * 20} className="w-16" />
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openRevisionDialog(ev)}>
                              <Edit className="h-4 w-4 ml-1" />
                              تعديل
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(ev.id)}>
                              <CheckCircle className="h-4 w-4 ml-1" />
                              اعتماد
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات المعتمدة</CardTitle>
              <CardDescription>انشر النتائج للموظفين</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingPublish.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد تقييمات بانتظار النشر</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>الدرجة النهائية</TableHead>
                      <TableHead>ملخص AI</TableHead>
                      <TableHead>تاريخ الاعتماد</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPublish.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{getUserName(ev.evaluatee_id)}</TableCell>
                        <TableCell>
                          <span className="font-bold text-lg">{ev.total_score?.toFixed(1) || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {ev.ai_summary ? (
                            <span className="text-sm text-muted-foreground line-clamp-2">{ev.ai_summary}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {ev.reviewed_at ? format(new Date(ev.reviewed_at), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handlePublish(ev)}>
                            <Send className="h-4 w-4 ml-1" />
                            نشر
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appeals">
          <Card>
            <CardHeader>
              <CardTitle>الاعتراضات</CardTitle>
              <CardDescription>راجع اعتراضات الموظفين على التقييمات</CardDescription>
            </CardHeader>
            <CardContent>
              {appeals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد اعتراضات</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>نص الاعتراض</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الموعد النهائي</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appeals.map((appeal) => (
                      <TableRow key={appeal.id}>
                        <TableCell className="font-medium">{getUserName(appeal.evaluatee_id)}</TableCell>
                        <TableCell>
                          <span className="text-sm line-clamp-2">{appeal.appeal_text}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={appeal.status === 'pending' ? 'outline' : appeal.status === 'accepted' ? 'default' : 'destructive'}>
                            {appeal.status === 'pending' ? 'معلق' : appeal.status === 'accepted' ? 'مقبول' : 'مرفوض'}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(appeal.deadline), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>
                          {appeal.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedAppeal(appeal.id);
                                setIsAppealDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 ml-1" />
                              الرد
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revisions">
          <Card>
            <CardHeader>
              <CardTitle>سجل المراجعات</CardTitle>
              <CardDescription>جميع التعديلات التي تمت على التقييمات</CardDescription>
            </CardHeader>
            <CardContent>
              {revisions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد مراجعات</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>الدرجة الأصلية</TableHead>
                      <TableHead>الدرجة المعدلة</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisions.map((rev) => (
                      <TableRow key={rev.id}>
                        <TableCell>{rev.revision_number}</TableCell>
                        <TableCell>{rev.original_score?.toFixed(1) || '-'}</TableCell>
                        <TableCell>{rev.revised_score?.toFixed(1) || '-'}</TableCell>
                        <TableCell>
                          <span className="text-sm line-clamp-2">{rev.reason}</span>
                        </TableCell>
                        <TableCell>{format(new Date(rev.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: إنشاء مراجعة */}
      <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل التقييم (إنشاء مراجعة)</DialogTitle>
            <DialogDescription>سيتم حفظ التعديل كمراجعة جديدة مع الاحتفاظ بالأصل</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الدرجة المعدلة</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={revisionForm.revised_score}
                onChange={(e) => setRevisionForm({ ...revisionForm, revised_score: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>ملخص AI المعدل (اختياري)</Label>
              <Textarea
                value={revisionForm.revised_ai_summary}
                onChange={(e) => setRevisionForm({ ...revisionForm, revised_ai_summary: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>ملخص التغييرات</Label>
              <Textarea
                value={revisionForm.changes_summary}
                onChange={(e) => setRevisionForm({ ...revisionForm, changes_summary: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>سبب التعديل (إجباري)</Label>
              <Textarea
                value={revisionForm.reason}
                onChange={(e) => setRevisionForm({ ...revisionForm, reason: e.target.value })}
                placeholder="يجب ذكر سبب التعديل للتوثيق القانوني"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevisionDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateRevision} disabled={!revisionForm.reason}>حفظ المراجعة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: الرد على اعتراض */}
      <Dialog open={isAppealDialogOpen} onOpenChange={setIsAppealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>الرد على الاعتراض</DialogTitle>
            <DialogDescription>اختر قبول أو رفض الاعتراض مع ذكر السبب</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={appealResponse.status === 'accepted' ? 'default' : 'outline'}
                onClick={() => setAppealResponse({ ...appealResponse, status: 'accepted' })}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 ml-2" />
                قبول
              </Button>
              <Button
                variant={appealResponse.status === 'rejected' ? 'destructive' : 'outline'}
                onClick={() => setAppealResponse({ ...appealResponse, status: 'rejected' })}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 ml-2" />
                رفض
              </Button>
            </div>
            <div>
              <Label>الرد</Label>
              <Textarea
                value={appealResponse.response_text}
                onChange={(e) => setAppealResponse({ ...appealResponse, response_text: e.target.value })}
                placeholder="اكتب ردك على الاعتراض..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAppealDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleRespondToAppeal} disabled={!appealResponse.response_text}>إرسال الرد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
