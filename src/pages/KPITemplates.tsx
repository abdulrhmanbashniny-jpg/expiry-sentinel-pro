import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKPITemplates, EvaluationPeriodType, QuestionAnswerType, KPITemplateAxis, KPITemplateQuestion } from '@/hooks/useKPITemplates';
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
import { Plus, Edit, Trash2, FileText, Layers, HelpCircle, Upload, FileJson, Eye, Archive, Power } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ImportedTemplate {
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  period_type: EvaluationPeriodType;
  axes: Array<{
    name: string;
    name_en?: string;
    weight: number;
    sort_order: number;
    questions: Array<{
      question_text: string;
      question_text_en?: string;
      answer_type: QuestionAnswerType;
      choices?: string[];
      min_value?: number;
      max_value?: number;
      weight: number;
      sort_order: number;
    }>;
  }>;
}

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
    toggleTemplateActive,
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingAxis, setEditingAxis] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedTemplate | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  // Handle JSON file import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        validateAndSetPreview(json);
      } catch (err) {
        toast({
          title: 'خطأ في قراءة الملف',
          description: 'تأكد من أن الملف بصيغة JSON صحيحة',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  };

  const validateAndSetPreview = (json: unknown) => {
    if (typeof json !== 'object' || json === null) {
      throw new Error('Invalid JSON structure');
    }

    const template = json as ImportedTemplate;

    if (!template.name) {
      toast({ title: 'خطأ', description: 'اسم القالب مطلوب', variant: 'destructive' });
      return;
    }

    if (!template.axes || !Array.isArray(template.axes)) {
      toast({ title: 'خطأ', description: 'المحاور مطلوبة', variant: 'destructive' });
      return;
    }

    setImportPreview(template);
    setIsImportDialogOpen(true);
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setIsImporting(true);

    try {
      // Create template
      const templateResult = await createTemplate.mutateAsync({
        name: importPreview.name,
        name_en: importPreview.name_en,
        description: importPreview.description,
        description_en: importPreview.description_en,
        period_type: importPreview.period_type || 'annual',
      });

      const templateId = templateResult.id;

      // Create axes and questions
      for (const axis of importPreview.axes) {
        const axisResult = await createAxis.mutateAsync({
          template_id: templateId,
          name: axis.name,
          name_en: axis.name_en,
          weight: axis.weight,
          sort_order: axis.sort_order,
        });

        const axisId = axisResult.id;

        // Create questions for this axis
        for (const question of axis.questions || []) {
          await createQuestion.mutateAsync({
            axis_id: axisId,
            question_text: question.question_text,
            question_text_en: question.question_text_en,
            answer_type: question.answer_type || 'numeric',
            choices: question.choices,
            min_value: question.min_value,
            max_value: question.max_value,
            weight: question.weight,
            sort_order: question.sort_order,
          });
        }
      }

      toast({ title: 'تم الاستيراد بنجاح', description: `تم إنشاء القالب: ${importPreview.name}` });
      setIsImportDialogOpen(false);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'فشل في استيراد القالب';
      toast({ title: 'خطأ', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleTemplate: ImportedTemplate = {
      name: 'نموذج تقييم الأداء السنوي',
      name_en: 'Annual Performance Template',
      description: 'قالب نموذجي لتقييم الأداء السنوي',
      period_type: 'annual',
      axes: [
        {
          name: 'الإنتاجية والأداء',
          name_en: 'Productivity',
          weight: 40,
          sort_order: 1,
          questions: [
            { question_text: 'جودة العمل المنجز', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 30, sort_order: 1 },
            { question_text: 'الالتزام بالمواعيد النهائية', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 25, sort_order: 2 },
            { question_text: 'كمية العمل المنجز', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 25, sort_order: 3 },
            { question_text: 'الدقة في التنفيذ', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 20, sort_order: 4 },
          ],
        },
        {
          name: 'المهارات والكفاءات',
          name_en: 'Skills',
          weight: 35,
          sort_order: 2,
          questions: [
            { question_text: 'المعرفة الفنية', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 25, sort_order: 1 },
            { question_text: 'مهارات التواصل', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 25, sort_order: 2 },
            { question_text: 'العمل الجماعي', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 25, sort_order: 3 },
            { question_text: 'حل المشكلات', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 25, sort_order: 4 },
          ],
        },
        {
          name: 'السلوك والالتزام',
          name_en: 'Behavior',
          weight: 25,
          sort_order: 3,
          questions: [
            { question_text: 'الانضباط في العمل', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 35, sort_order: 1 },
            { question_text: 'المبادرة والإبداع', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 35, sort_order: 2 },
            { question_text: 'الالتزام بسياسات المنظمة', answer_type: 'numeric', min_value: 1, max_value: 5, weight: 30, sort_order: 3 },
          ],
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sampleTemplate, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kpi-template-sample.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
          <div className="flex gap-2">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" onClick={downloadSampleTemplate}>
              <FileJson className="h-4 w-4 ml-2" />
              تحميل نموذج
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 ml-2" />
              استيراد JSON
            </Button>
            <Button onClick={() => setIsTemplateDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              قالب جديد
            </Button>
          </div>
        )}
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              معاينة القالب المستورد
            </DialogTitle>
            <DialogDescription>راجع البيانات قبل الحفظ</DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="font-semibold text-lg">{importPreview.name}</p>
                {importPreview.description && <p className="text-muted-foreground">{importPreview.description}</p>}
                <Badge className="mt-2">{periodLabels[importPreview.period_type]}</Badge>
              </div>
              <div className="space-y-3">
                <p className="font-medium">المحاور ({importPreview.axes.length}):</p>
                {importPreview.axes.map((axis, i) => (
                  <Card key={i}>
                    <CardHeader className="py-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{axis.name}</span>
                        <Badge variant="outline">{axis.weight}%</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm text-muted-foreground">{axis.questions?.length || 0} أسئلة</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setImportPreview(null); }}>
              إلغاء
            </Button>
            <Button onClick={handleImportConfirm} disabled={isImporting}>
              {isImporting ? 'جاري الاستيراد...' : 'تأكيد الاستيراد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      <div className="flex gap-2 flex-wrap">
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
                          variant={template.is_active ? 'secondary' : 'default'}
                          onClick={() => toggleTemplateActive.mutate({ id: template.id, is_active: !template.is_active })}
                        >
                          {template.is_active ? (
                            <>
                              <Archive className="h-4 w-4 ml-1" />
                              أرشفة (تعطيل)
                            </>
                          ) : (
                            <>
                              <Power className="h-4 w-4 ml-1" />
                              تفعيل
                            </>
                          )}
                        </Button>
                        {!template.is_active && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteTemplate.mutate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 ml-1" />
                            حذف نهائي
                          </Button>
                        )}
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
