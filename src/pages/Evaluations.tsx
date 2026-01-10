import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations, evaluationTypeLabels, statusLabels, statusColors } from '@/hooks/useEvaluations';
import { useKPITemplates } from '@/hooks/useKPITemplates';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Plus, Play, Eye, FileCheck, Calendar, Users, Brain, ClipboardList, CheckCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function Evaluations() {
  const navigate = useNavigate();
  const { user, isAdmin, isSystemAdmin } = useAuth();
  const { 
    cycles, 
    evaluations, 
    createCycle, 
    generate360Assignments,
    getMyPendingEvaluations,
    getMyCompletedEvaluations,
    isLoading 
  } = useEvaluations();
  const { templates } = useKPITemplates();
  const { users } = useTeamManagement();
  const profiles = users.map(u => ({ user_id: u.profile.user_id, full_name: u.profile.full_name, email: u.profile.email }));

  const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState({
    template_id: '',
    name: '',
    name_en: '',
    start_date: '',
    end_date: '',
    allow_self_assessment: true,
    allow_360: false,
  });

  const canManageCycles = isAdmin || isSystemAdmin;

  const getUserName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.full_name || profile?.email || 'غير معروف';
  };

  // التقييمات المطلوبة مني (مسودة)
  const myPendingEvaluations = getMyPendingEvaluations();
  
  // التقييمات التي أكملتها (تم الإرسال/معتمد/منشور)
  const myCompletedEvaluations = getMyCompletedEvaluations();
  
  // تقييمات عني
  const evaluationsAboutMe = evaluations.filter((e) => e.evaluatee_id === user?.id);
  
  const activeCycles = cycles.filter((c) => c.is_active);

  const handleCreateCycle = () => {
    if (!cycleForm.template_id || !cycleForm.name || !cycleForm.start_date || !cycleForm.end_date) return;
    createCycle.mutate(cycleForm, {
      onSuccess: () => {
        setIsCycleDialogOpen(false);
        setCycleForm({
          template_id: '',
          name: '',
          name_en: '',
          start_date: '',
          end_date: '',
          allow_self_assessment: true,
          allow_360: false,
        });
      },
    });
  };

  const handleGenerateAssignments = (cycleId: string) => {
    generate360Assignments.mutate(cycleId);
  };

  const handleStartEvaluation = (evaluationId: string) => {
    navigate(`/evaluation/${evaluationId}`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تقييم الأداء</h1>
          <p className="text-muted-foreground">إدارة دورات التقييم والتقييمات الموكلة إليك</p>
        </div>
        {canManageCycles && (
          <Button onClick={() => setIsCycleDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            دورة تقييم جديدة
          </Button>
        )}
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الدورات النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCycles.length}</div>
          </CardContent>
        </Card>
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">مطلوب مني</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{myPendingEvaluations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تم إكمالها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myCompletedEvaluations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تقييمات عني</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{evaluationsAboutMe.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            مطلوب مني ({myPendingEvaluations.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            تم الإكمال ({myCompletedEvaluations.length})
          </TabsTrigger>
          <TabsTrigger value="about-me" className="gap-2">
            <Eye className="h-4 w-4" />
            تقييمات عني
          </TabsTrigger>
          {canManageCycles && (
            <TabsTrigger value="cycles" className="gap-2">
              <Calendar className="h-4 w-4" />
              دورات التقييم
            </TabsTrigger>
          )}
        </TabsList>

        {/* التقييمات المطلوبة مني */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات المطلوبة مني</CardTitle>
              <CardDescription>التقييمات الموكلة إليك والتي لم يتم إرسالها بعد</CardDescription>
            </CardHeader>
            <CardContent>
              {myPendingEvaluations.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">لا توجد تقييمات معلقة</p>
                  <p className="text-muted-foreground">أكملت جميع التقييمات المطلوبة منك</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الشخص المُقيَّم</TableHead>
                      <TableHead>نوع التقييم</TableHead>
                      <TableHead>الدورة</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myPendingEvaluations.map((ev) => {
                      const cycle = cycles.find(c => c.id === ev.cycle_id);
                      return (
                        <TableRow key={ev.id}>
                          <TableCell className="font-medium">
                            {ev.evaluatee_id === user?.id ? (
                              <span className="text-primary">أنا (تقييم ذاتي)</span>
                            ) : (
                              getUserName(ev.evaluatee_id)
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {evaluationTypeLabels[ev.evaluation_type] || ev.evaluation_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{cycle?.name || '-'}</TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => handleStartEvaluation(ev.id)}>
                              <Play className="h-4 w-4 ml-1" />
                              بدء التقييم
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* التقييمات المكتملة */}
        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات المكتملة</CardTitle>
              <CardDescription>التقييمات التي قمت بإرسالها</CardDescription>
            </CardHeader>
            <CardContent>
              {myCompletedEvaluations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لم تكمل أي تقييم بعد</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الشخص المُقيَّم</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>تاريخ الإرسال</TableHead>
                      <TableHead>تحليل AI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myCompletedEvaluations.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">
                          {ev.evaluatee_id === user?.id ? (
                            <span className="text-primary">أنا (تقييم ذاتي)</span>
                          ) : (
                            getUserName(ev.evaluatee_id)
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {evaluationTypeLabels[ev.evaluation_type] || ev.evaluation_type}
                          </Badge>
                          {ev.is_proxy && <Badge className="mr-2">بالنيابة</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[ev.status]}>{statusLabels[ev.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {ev.total_score !== null ? (
                            <div className="flex items-center gap-2">
                              <span>{ev.total_score.toFixed(1)}</span>
                              <Progress value={ev.total_score * 20} className="w-16" />
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {ev.submitted_at
                            ? format(new Date(ev.submitted_at), 'yyyy-MM-dd')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {ev.ai_summary ? (
                            <Badge variant="outline" className="gap-1">
                              <Brain className="h-3 w-3" />
                              متوفر
                            </Badge>
                          ) : (
                            '-'
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

        {/* تقييمات عني */}
        <TabsContent value="about-me">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات عني</CardTitle>
              <CardDescription>التقييمات التي حصلت عليها (تظهر الملخصات فقط للحفاظ على السرية)</CardDescription>
            </CardHeader>
            <CardContent>
              {evaluationsAboutMe.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد تقييمات عنك</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نوع التقييم</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluationsAboutMe.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {evaluationTypeLabels[ev.evaluation_type] || ev.evaluation_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[ev.status]}>{statusLabels[ev.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {/* Only show score if published */}
                          {ev.status === 'published' && ev.total_score !== null
                            ? ev.total_score.toFixed(1)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {ev.submitted_at
                            ? format(new Date(ev.submitted_at), 'yyyy-MM-dd')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* دورات التقييم - للمدراء فقط */}
        {canManageCycles && (
          <TabsContent value="cycles">
            <Card>
              <CardHeader>
                <CardTitle>دورات التقييم</CardTitle>
                <CardDescription>الدورات النشطة والسابقة</CardDescription>
              </CardHeader>
              <CardContent>
                {cycles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">لا توجد دورات تقييم</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم الدورة</TableHead>
                        <TableHead>تاريخ البداية</TableHead>
                        <TableHead>تاريخ النهاية</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التقييم الذاتي</TableHead>
                        <TableHead>360</TableHead>
                        <TableHead>الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycles.map((cycle) => (
                        <TableRow key={cycle.id}>
                          <TableCell className="font-medium">{cycle.name}</TableCell>
                          <TableCell>{format(new Date(cycle.start_date), 'yyyy-MM-dd')}</TableCell>
                          <TableCell>{format(new Date(cycle.end_date), 'yyyy-MM-dd')}</TableCell>
                          <TableCell>
                            <Badge variant={cycle.is_active ? 'default' : 'secondary'}>
                              {cycle.is_active ? 'نشطة' : 'منتهية'}
                            </Badge>
                          </TableCell>
                          <TableCell>{cycle.allow_self_assessment ? '✓' : '-'}</TableCell>
                          <TableCell>{cycle.allow_360 ? '✓' : '-'}</TableCell>
                          <TableCell>
                            {cycle.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateAssignments(cycle.id)}
                                disabled={generate360Assignments.isPending}
                              >
                                <RefreshCw className={`h-4 w-4 ml-1 ${generate360Assignments.isPending ? 'animate-spin' : ''}`} />
                                توليد المهام
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
        )}
      </Tabs>

      {/* Dialog: دورة تقييم */}
      <Dialog open={isCycleDialogOpen} onOpenChange={setIsCycleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>دورة تقييم جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات دورة التقييم</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>القالب</Label>
              <Select
                value={cycleForm.template_id}
                onValueChange={(v) => setCycleForm({ ...cycleForm, template_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر قالب التقييم" />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>اسم الدورة</Label>
              <Input
                value={cycleForm.name}
                onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                placeholder="مثال: تقييم الأداء السنوي 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>تاريخ البداية</Label>
                <Input
                  type="date"
                  value={cycleForm.start_date}
                  onChange={(e) => setCycleForm({ ...cycleForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>تاريخ النهاية</Label>
                <Input
                  type="date"
                  value={cycleForm.end_date}
                  onChange={(e) => setCycleForm({ ...cycleForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="allow_self">السماح بالتقييم الذاتي</Label>
              <Switch
                id="allow_self"
                checked={cycleForm.allow_self_assessment}
                onCheckedChange={(checked) => setCycleForm({ ...cycleForm, allow_self_assessment: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="allow_360">تفعيل تقييم 360 (صاعد)</Label>
              <Switch
                id="allow_360"
                checked={cycleForm.allow_360}
                onCheckedChange={(checked) => setCycleForm({ ...cycleForm, allow_360: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCycleDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateCycle}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
