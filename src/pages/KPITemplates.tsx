import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKPITemplates, EvaluationPeriodType, QuestionAnswerType } from '@/hooks/useKPITemplates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, FileText, Layers, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

const periodLabels: Record<EvaluationPeriodType, string> = {
  annual: 'سنوي',
  semi_annual: 'نصف سنوي',
  quarterly: 'ربع سنوي',
  monthly: 'شهري',
};

const answerTypeLabels: Record<QuestionAnswerType, string> = {
  numeric: 'رقمي',
  choice: 'اختيار من متعدد',
  text: 'نص',
};

export default function KPITemplates() {
  const { isAdmin, isSystemAdmin } = useAuth();
  const {
    templates,
    getAxesByTemplate,
    getQuestionsByAxis,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createAxis,
    updateAxis,
    deleteAxis,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    isLoading,
  } = useKPITemplates();

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isAxisDialogOpen, setIsAxisDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingAxis, setEditingAxis] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: '',
    name_en: '',
    description: '',
    description_en: '',
    period_type: 'annual' as EvaluationPeriodType,
  });

  const [axisForm, setAxisForm] = useState({
    name: '',
    name_en: '',
    weight: 0,
    sort_order: 0,
  });

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    question_text_en: '',
    answer_type: 'numeric' as QuestionAnswerType,
    choices: '',
    min_value: 1,
    max_value: 5,
    weight: 0,
    sort_order: 0,
  });

  const canManage = isAdmin || isSystemAdmin;

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate, ...templateForm });
    } else {
      createTemplate.mutate(templateForm);
    }
    setIsTemplateDialogOpen(false);
    resetTemplateForm();
  };

  const handleSaveAxis = () => {
    if (!selectedTemplateId) return;
    if (editingAxis) {
      updateAxis.mutate({ id: editingAxis, ...axisForm });
    } else {
      createAxis.mutate({ template_id: selectedTemplateId, ...axisForm });
    }
    setIsAxisDialogOpen(false);
    resetAxisForm();
  };

  const handleSaveQuestion = () => {
    if (!selectedAxisId) return;
    const questionData = {
      ...questionForm,
      choices: questionForm.answer_type === 'choice' ? questionForm.choices.split(',').map((c) => c.trim()) : undefined,
      min_value: questionForm.answer_type === 'numeric' ? questionForm.min_value : undefined,
      max_value: questionForm.answer_type === 'numeric' ? questionForm.max_value : undefined,
    };

    if (editingQuestion) {
      updateQuestion.mutate({ id: editingQuestion, ...questionData });
    } else {
      createQuestion.mutate({ axis_id: selectedAxisId, ...questionData });
    }
    setIsQuestionDialogOpen(false);
    resetQuestionForm();
  };

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', name_en: '', description: '', description_en: '', period_type: 'annual' });
    setEditingTemplate(null);
  };

  const resetAxisForm = () => {
    setAxisForm({ name: '', name_en: '', weight: 0, sort_order: 0 });
    setEditingAxis(null);
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      question_text_en: '',
      answer_type: 'numeric',
      choices: '',
      min_value: 1,
      max_value: 5,
      weight: 0,
      sort_order: 0,
    });
    setEditingQuestion(null);
  };

  const openEditTemplate = (template: typeof templates[0]) => {
    setTemplateForm({
      name: template.name,
      name_en: template.name_en || '',
      description: template.description || '',
      description_en: template.description_en || '',
      period_type: template.period_type,
    });
    setEditingTemplate(template.id);
    setIsTemplateDialogOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قوالب تقييم الأداء (KPI)</h1>
          <p className="text-muted-foreground">إنشاء وإدارة قوالب التقييم والمحاور والأسئلة</p>
        </div>
        {canManage && (
          <Button onClick={() => setIsTemplateDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            قالب جديد
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد قوالب تقييم</p>
            {canManage && (
              <Button className="mt-4" onClick={() => setIsTemplateDialogOpen(true)}>
                إنشاء قالب جديد
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="single" collapsible className="space-y-4">
          {templates.map((template) => {
            const axes = getAxesByTemplate(template.id);
            return (
              <AccordionItem key={template.id} value={template.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-4 w-full">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1 text-right">
                      <span className="font-semibold">{template.name}</span>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                    <Badge variant="outline">{periodLabels[template.period_type]}</Badge>
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {canManage && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                          <Edit className="h-4 w-4 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTemplateId(template.id);
                            setIsAxisDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          إضافة محور
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteTemplate.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 ml-1" />
                          حذف
                        </Button>
                      </div>
                    )}

                    {axes.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">لا توجد محاور</p>
                    ) : (
                      <div className="space-y-4">
                        {axes.map((axis) => {
                          const questions = getQuestionsByAxis(axis.id);
                          return (
                            <Card key={axis.id}>
                              <CardHeader className="py-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    <CardTitle className="text-base">{axis.name}</CardTitle>
                                    <Badge variant="outline">{axis.weight}%</Badge>
                                  </div>
                                  {canManage && (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setSelectedAxisId(axis.id);
                                          setIsQuestionDialogOpen(true);
                                        }}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive"
                                        onClick={() => deleteAxis.mutate(axis.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </CardHeader>
                              {questions.length > 0 && (
                                <CardContent className="pt-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>السؤال</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>الوزن</TableHead>
                                        {canManage && <TableHead>إجراء</TableHead>}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {questions.map((q, idx) => (
                                        <TableRow key={q.id}>
                                          <TableCell>{idx + 1}</TableCell>
                                          <TableCell>{q.question_text}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline">
                                              {answerTypeLabels[q.answer_type]}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>{q.weight}%</TableCell>
                                          {canManage && (
                                            <TableCell>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive"
                                                onClick={() => deleteQuestion.mutate(q.id)}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Dialog: قالب */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'تعديل القالب' : 'قالب جديد'}</DialogTitle>
            <DialogDescription>أدخل بيانات قالب التقييم</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم القالب (عربي)</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>اسم القالب (إنجليزي - اختياري)</Label>
              <Input
                value={templateForm.name_en}
                onChange={(e) => setTemplateForm({ ...templateForm, name_en: e.target.value })}
              />
            </div>
            <div>
              <Label>الوصف (عربي)</Label>
              <Textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>نوع الفترة</Label>
              <Select
                value={templateForm.period_type}
                onValueChange={(v) => setTemplateForm({ ...templateForm, period_type: v as EvaluationPeriodType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">سنوي</SelectItem>
                  <SelectItem value="semi_annual">نصف سنوي</SelectItem>
                  <SelectItem value="quarterly">ربع سنوي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsTemplateDialogOpen(false); resetTemplateForm(); }}>
              إلغاء
            </Button>
            <Button onClick={handleSaveTemplate}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: محور */}
      <Dialog open={isAxisDialogOpen} onOpenChange={setIsAxisDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة محور</DialogTitle>
            <DialogDescription>أدخل بيانات المحور</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم المحور (عربي)</Label>
              <Input
                value={axisForm.name}
                onChange={(e) => setAxisForm({ ...axisForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>اسم المحور (إنجليزي - اختياري)</Label>
              <Input
                value={axisForm.name_en}
                onChange={(e) => setAxisForm({ ...axisForm, name_en: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الوزن (%)</Label>
                <Input
                  type="number"
                  value={axisForm.weight}
                  onChange={(e) => setAxisForm({ ...axisForm, weight: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>الترتيب</Label>
                <Input
                  type="number"
                  value={axisForm.sort_order}
                  onChange={(e) => setAxisForm({ ...axisForm, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAxisDialogOpen(false); resetAxisForm(); }}>
              إلغاء
            </Button>
            <Button onClick={handleSaveAxis}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: سؤال */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة سؤال</DialogTitle>
            <DialogDescription>أدخل بيانات السؤال</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>نص السؤال (عربي)</Label>
              <Textarea
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
              />
            </div>
            <div>
              <Label>نص السؤال (إنجليزي - اختياري)</Label>
              <Textarea
                value={questionForm.question_text_en}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text_en: e.target.value })}
              />
            </div>
            <div>
              <Label>نوع الإجابة</Label>
              <Select
                value={questionForm.answer_type}
                onValueChange={(v) => setQuestionForm({ ...questionForm, answer_type: v as QuestionAnswerType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">رقمي (مقياس)</SelectItem>
                  <SelectItem value="choice">اختيار من متعدد</SelectItem>
                  <SelectItem value="text">نص حر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {questionForm.answer_type === 'numeric' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الحد الأدنى</Label>
                  <Input
                    type="number"
                    value={questionForm.min_value}
                    onChange={(e) => setQuestionForm({ ...questionForm, min_value: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>الحد الأقصى</Label>
                  <Input
                    type="number"
                    value={questionForm.max_value}
                    onChange={(e) => setQuestionForm({ ...questionForm, max_value: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
            {questionForm.answer_type === 'choice' && (
              <div>
                <Label>الخيارات (مفصولة بفاصلة)</Label>
                <Input
                  value={questionForm.choices}
                  onChange={(e) => setQuestionForm({ ...questionForm, choices: e.target.value })}
                  placeholder="ممتاز, جيد جداً, جيد, مقبول, ضعيف"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>الوزن (%)</Label>
                <Input
                  type="number"
                  value={questionForm.weight}
                  onChange={(e) => setQuestionForm({ ...questionForm, weight: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>الترتيب</Label>
                <Input
                  type="number"
                  value={questionForm.sort_order}
                  onChange={(e) => setQuestionForm({ ...questionForm, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsQuestionDialogOpen(false); resetQuestionForm(); }}>
              إلغاء
            </Button>
            <Button onClick={handleSaveQuestion}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
