import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations, EvaluationType } from '@/hooks/useEvaluations';
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
import { Plus, Play, Eye, FileCheck, Calendar, Users, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  draft: 'مسودة',
  in_progress: 'قيد التنفيذ',
  submitted: 'تم الإرسال',
  reviewed: 'تمت المراجعة',
  completed: 'مكتمل',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  submitted: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  reviewed: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  completed: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const evaluationTypeLabels: Record<EvaluationType, string> = {
  supervisor_to_employee: 'مشرف ← موظف',
  manager_to_supervisor: 'مدير ← مشرف',
  admin_to_manager: 'مدير نظام ← مدير',
  self_assessment: 'تقييم ذاتي',
  peer_360: 'تقييم 360',
};

export default function Evaluations() {
  const { user, isAdmin, isSystemAdmin, isSupervisor } = useAuth();
  const { cycles, evaluations, createCycle, createEvaluation, isLoading } = useEvaluations();
  const { templates } = useKPITemplates();
  const { users, teamMembers } = useTeamManagement();
  const profiles = users.map(u => ({ user_id: u.profile.user_id, full_name: u.profile.full_name, email: u.profile.email }));
  const userRoles = users.map(u => ({ user_id: u.profile.user_id, role: u.role }));

  const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false);
  const [isEvalDialogOpen, setIsEvalDialogOpen] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const [cycleForm, setCycleForm] = useState({
    template_id: '',
    name: '',
    name_en: '',
    start_date: '',
    end_date: '',
    allow_self_assessment: true,
    allow_360: false,
  });

  const [evalForm, setEvalForm] = useState({
    evaluatee_id: '',
    evaluation_type: 'supervisor_to_employee' as EvaluationType,
    is_proxy: false,
  });

  const canManageCycles = isAdmin || isSystemAdmin;

  const getUserName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.full_name || profile?.email || 'غير معروف';
  };

  const getUserRole = (userId: string) => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || 'employee';
  };

  // جلب الموظفين الذين يمكن تقييمهم
  const getEvaluatees = () => {
    if (isSystemAdmin) {
      // مدير النظام يقيم المدراء
      return profiles.filter((p) => getUserRole(p.user_id) === 'admin');
    }
    if (isAdmin) {
      // المدير يقيم المشرفين
      return profiles.filter((p) => getUserRole(p.user_id) === 'supervisor');
    }
    if (isSupervisor) {
      // المشرف يقيم موظفيه
      const myTeam = teamMembers.filter((t) => t.supervisor_id === user?.id);
      return profiles.filter((p) => myTeam.some((t) => t.employee_id === p.user_id));
    }
    return [];
  };

  const getEvaluationType = (): EvaluationType => {
    if (isSystemAdmin) return 'admin_to_manager';
    if (isAdmin) return 'manager_to_supervisor';
    return 'supervisor_to_employee';
  };

  const myEvaluations = evaluations.filter((e) => e.evaluator_id === user?.id);
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

  const handleCreateEvaluation = () => {
    if (!selectedCycleId || !evalForm.evaluatee_id) return;
    createEvaluation.mutate({
      cycle_id: selectedCycleId,
      evaluatee_id: evalForm.evaluatee_id,
      evaluation_type: getEvaluationType(),
      is_proxy: evalForm.is_proxy,
    }, {
      onSuccess: () => {
        setIsEvalDialogOpen(false);
        setEvalForm({ evaluatee_id: '', evaluation_type: 'supervisor_to_employee', is_proxy: false });
      },
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تقييم الأداء</h1>
          <p className="text-muted-foreground">إدارة دورات التقييم والتقييمات الفردية</p>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تقييماتي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myEvaluations.length}</div>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بانتظار التقييم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myEvaluations.filter((e) => e.status === 'draft' || e.status === 'in_progress').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cycles" className="w-full">
        <TabsList>
          <TabsTrigger value="cycles" className="gap-2">
            <Calendar className="h-4 w-4" />
            دورات التقييم
          </TabsTrigger>
          <TabsTrigger value="my-evaluations" className="gap-2">
            <Users className="h-4 w-4" />
            تقييماتي
          </TabsTrigger>
          <TabsTrigger value="about-me" className="gap-2">
            <Eye className="h-4 w-4" />
            تقييمات عني
          </TabsTrigger>
        </TabsList>

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
                          {cycle.is_active && getEvaluatees().length > 0 && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedCycleId(cycle.id);
                                setIsEvalDialogOpen(true);
                              }}
                            >
                              <Play className="h-4 w-4 ml-1" />
                              بدء تقييم
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

        <TabsContent value="my-evaluations">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات التي قمت بها</CardTitle>
              <CardDescription>تقييمات أعضاء فريقك</CardDescription>
            </CardHeader>
            <CardContent>
              {myEvaluations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لم تقم بأي تقييم بعد</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>تحليل AI</TableHead>
                      <TableHead>الإجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myEvaluations.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{getUserName(ev.evaluatee_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{evaluationTypeLabels[ev.evaluation_type]}</Badge>
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
                          {ev.ai_summary ? (
                            <Badge variant="outline" className="gap-1">
                              <Brain className="h-3 w-3" />
                              متوفر
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 ml-1" />
                            عرض
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

        <TabsContent value="about-me">
          <Card>
            <CardHeader>
              <CardTitle>التقييمات عني</CardTitle>
              <CardDescription>التقييمات التي حصلت عليها</CardDescription>
            </CardHeader>
            <CardContent>
              {evaluationsAboutMe.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد تقييمات عنك</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المُقيِّم</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الدرجة</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluationsAboutMe.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{getUserName(ev.evaluator_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{evaluationTypeLabels[ev.evaluation_type]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[ev.status]}>{statusLabels[ev.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {ev.status === 'completed' && ev.total_score !== null
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCycleDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateCycle}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: تقييم جديد */}
      <Dialog open={isEvalDialogOpen} onOpenChange={setIsEvalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>بدء تقييم جديد</DialogTitle>
            <DialogDescription>اختر الموظف لتقييمه</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الموظف</Label>
              <Select
                value={evalForm.evaluatee_id}
                onValueChange={(v) => setEvalForm({ ...evalForm, evaluatee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {getEvaluatees().map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isSystemAdmin && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_proxy"
                  checked={evalForm.is_proxy}
                  onChange={(e) => setEvalForm({ ...evalForm, is_proxy: e.target.checked })}
                />
                <Label htmlFor="is_proxy">تقييم بالنيابة</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvalDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreateEvaluation}>بدء التقييم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
