import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, Edit, Copy, Trash2, Download, Upload, FileText, 
  Send, MessageCircle, Eye, Code, CheckCircle2, XCircle,
  Info, Loader2
} from 'lucide-react';
import { useMessageTemplates, AVAILABLE_PLACEHOLDERS, REFERENCE_PAYLOAD, applyTemplate, MessageTemplate, TEMPLATE_TYPE_LABELS, ESCALATION_LEVEL_LABELS, TemplateType } from '@/hooks/useMessageTemplates';
import { useToast } from '@/hooks/use-toast';

const MessageTemplates: React.FC = () => {
  const { 
    templates, isLoading, 
    createTemplate, updateTemplate, deleteTemplate, 
    duplicateTemplate, toggleActive,
    exportTemplates, importTemplates 
  } = useMessageTemplates();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingTemplate, setEditingTemplate] = useState<Partial<MessageTemplate> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showImportResult, setShowImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // فلترة القوالب حسب القناة
  const filteredTemplates = templates.filter(t => {
    if (activeTab === 'all') return true;
    if (activeTab === 'reminder') return t.template_type === 'reminder';
    if (activeTab === 'escalation') return t.template_type === 'escalation';
    return t.channel === activeTab || t.channel === 'all';
  });

  const handleCreate = () => {
    setEditingTemplate({
      name: '',
      channel: 'all',
      template_type: 'reminder',
      escalation_level: null,
      template_text: '',
      placeholders: AVAILABLE_PLACEHOLDERS,
      required_fields: ['item_title', 'ref_number', 'expiry_date', 'days_left'],
      optional_fields: [],
      dynamic_field_keys: [],
      is_active: true,
    });
    setShowEditor(true);
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate({ ...template });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editingTemplate?.name || !editingTemplate?.template_text) {
      toast({ title: 'يرجى ملء الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    if (editingTemplate.id) {
      await updateTemplate.mutateAsync(editingTemplate as MessageTemplate);
    } else {
      await createTemplate.mutateAsync(editingTemplate);
    }
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا القالب؟')) {
      await deleteTemplate.mutateAsync(id);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = await importTemplates(e.target?.result as string);
        setShowImportResult(result);
        toast({ 
          title: 'تم الاستيراد', 
          description: `نجح: ${result.success} | فشل: ${result.failed}` 
        });
      } catch (error: any) {
        toast({ title: 'خطأ في الاستيراد', description: error.message, variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const getChannelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      telegram: 'bg-blue-500/10 text-blue-600',
      whatsapp: 'bg-green-500/10 text-green-600',
      email: 'bg-orange-500/10 text-orange-600',
      all: 'bg-purple-500/10 text-purple-600',
    };
    const labels: Record<string, string> = {
      telegram: 'تيليجرام',
      whatsapp: 'واتساب',
      email: 'بريد إلكتروني',
      all: 'الكل',
    };
    return <Badge className={colors[channel]}>{labels[channel]}</Badge>;
  };

  const getTypeBadge = (type: string, level: number | null) => {
    if (type === 'escalation' && level !== null) {
      const levelColors: Record<number, string> = {
        0: 'bg-yellow-500/10 text-yellow-700',
        1: 'bg-orange-500/10 text-orange-700',
        2: 'bg-red-500/10 text-red-700',
        3: 'bg-red-600/10 text-red-800',
        4: 'bg-red-700/10 text-red-900',
      };
      return <Badge className={levelColors[level] || 'bg-red-500/10 text-red-700'}>تصعيد L{level}</Badge>;
    }
    const typeColors: Record<string, string> = {
      reminder: 'bg-green-500/10 text-green-700',
      escalation: 'bg-red-500/10 text-red-700',
      invitation: 'bg-blue-500/10 text-blue-700',
      alert: 'bg-yellow-500/10 text-yellow-700',
      system: 'bg-gray-500/10 text-gray-700',
    };
    return <Badge className={typeColors[type] || ''}>{TEMPLATE_TYPE_LABELS[type as TemplateType] || type}</Badge>;
  };

  // معاينة القالب
  const previewMessage = editingTemplate?.template_text 
    ? applyTemplate(editingTemplate.template_text, REFERENCE_PAYLOAD)
    : '';

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قوالب الرسائل</h1>
          <p className="text-muted-foreground">إدارة قوالب الرسائل للتذكيرات والتصعيدات (تيليجرام، واتساب، بريد إلكتروني)</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 ml-2" />
            استيراد
          </Button>
          <Button variant="outline" onClick={() => exportTemplates()}>
            <Download className="h-4 w-4 ml-2" />
            تصدير الكل
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 ml-2" />
            قالب جديد
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>دليل المتغيرات:</strong> استخدم {'{{variable}}'} لإدراج القيم. 
          مثال: {'{{item_title}}'} لعنوان المعاملة، {'{{days_left}}'} للأيام المتبقية.
          <br />
          <strong>الشروط:</strong> استخدم {'{{#if field}}'}...{'{{/if}}'} لإظهار محتوى شرطي.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">الكل ({templates.length})</TabsTrigger>
          <TabsTrigger value="reminder">تذكيرات</TabsTrigger>
          <TabsTrigger value="escalation">تصعيدات</TabsTrigger>
          <TabsTrigger value="telegram">تيليجرام</TabsTrigger>
          <TabsTrigger value="whatsapp">واتساب</TabsTrigger>
          <TabsTrigger value="email">بريد إلكتروني</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">لا توجد قوالب</p>
              <p className="text-sm text-muted-foreground">ابدأ بإنشاء قالب جديد أو استيراد قوالب</p>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 ml-2" />
              إنشاء قالب
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className={`relative ${!template.is_active ? 'opacity-60' : ''}`}>
              {template.is_default && (
                <Badge className="absolute top-2 left-2 bg-primary">افتراضي</Badge>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.name_en && (
                      <p className="text-sm text-muted-foreground">{template.name_en}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {getChannelBadge(template.channel)}
                    {getTypeBadge(template.template_type, template.escalation_level)}
                  </div>
                </div>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {template.required_fields.slice(0, 4).map((field) => (
                    <Badge key={field} variant="outline" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                  {template.required_fields.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{template.required_fields.length - 4}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) => toggleActive.mutate({ id: template.id, is_active: checked })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {template.is_active ? 'مفعل' : 'معطل'}
                    </span>
                  </div>
                  <Badge variant="outline">v{template.version}</Badge>
                </div>

                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(template)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicateTemplate.mutate(template.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => exportTemplates([template.id])}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {!template.is_default && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id ? 'تعديل القالب' : 'قالب جديد'}
            </DialogTitle>
            <DialogDescription>
              قم بتعريف نص الرسالة والمتغيرات المستخدمة
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Left: Form */}
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>اسم القالب (عربي) *</Label>
                    <Input
                      value={editingTemplate?.name || ''}
                      onChange={(e) => setEditingTemplate(prev => ({ ...prev!, name: e.target.value }))}
                      placeholder="مثال: قالب التذكير الأساسي"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم (إنجليزي)</Label>
                    <Input
                      value={editingTemplate?.name_en || ''}
                      onChange={(e) => setEditingTemplate(prev => ({ ...prev!, name_en: e.target.value }))}
                      placeholder="e.g., Basic Reminder Template"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Input
                    value={editingTemplate?.description || ''}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, description: e.target.value }))}
                    placeholder="وصف مختصر للقالب"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>القناة</Label>
                    <Select
                      value={editingTemplate?.channel || 'all'}
                      onValueChange={(v) => setEditingTemplate(prev => ({ ...prev!, channel: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="telegram">تيليجرام</SelectItem>
                        <SelectItem value="whatsapp">واتساب</SelectItem>
                        <SelectItem value="email">بريد إلكتروني</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>نوع القالب</Label>
                    <Select
                      value={editingTemplate?.template_type || 'reminder'}
                      onValueChange={(v) => setEditingTemplate(prev => ({ 
                        ...prev!, 
                        template_type: v as TemplateType,
                        escalation_level: v === 'escalation' ? (prev?.escalation_level ?? 0) : null 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TEMPLATE_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editingTemplate?.template_type === 'escalation' && (
                  <div className="space-y-2">
                    <Label>مستوى التصعيد</Label>
                    <Select
                      value={String(editingTemplate?.escalation_level ?? 0)}
                      onValueChange={(v) => setEditingTemplate(prev => ({ ...prev!, escalation_level: parseInt(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ESCALATION_LEVEL_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>نص القالب *</Label>
                  <Textarea
                    value={editingTemplate?.template_text || ''}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev!, template_text: e.target.value }))}
                    placeholder="اكتب نص الرسالة هنا... استخدم {{variable}} للمتغيرات"
                    className="min-h-[200px] font-mono text-sm"
                    dir="auto"
                  />
                </div>

                {/* Available Placeholders */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    المتغيرات المتاحة
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_PLACEHOLDERS.map((p) => (
                      <Badge
                        key={p.key}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => {
                          const textarea = document.querySelector('textarea');
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const text = editingTemplate?.template_text || '';
                            const newText = text.substring(0, start) + `{{${p.key}}}` + text.substring(end);
                            setEditingTemplate(prev => ({ ...prev!, template_text: newText }));
                          }
                        }}
                      >
                        {`{{${p.key}}}`}
                        <span className="mr-1 text-muted-foreground">{p.label}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    معاينة الرسالة
                  </Label>
                  <Badge variant="outline">بيانات تجريبية</Badge>
                </div>
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <pre className="whitespace-pre-wrap text-sm font-sans" dir="auto">
                      {previewMessage || 'اكتب نص القالب لرؤية المعاينة...'}
                    </pre>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label>البيانات المرجعية (Reference Payload)</Label>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(REFERENCE_PAYLOAD, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditor(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {(createTemplate.isPending || updateTemplate.isPending) && (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              )}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog open={!!showImportResult} onOpenChange={() => setShowImportResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>نتيجة الاستيراد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span>نجح: {showImportResult?.success}</span>
              </div>
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>فشل: {showImportResult?.failed}</span>
              </div>
            </div>
            {showImportResult?.errors && showImportResult.errors.length > 0 && (
              <div className="space-y-2">
                <Label>الأخطاء:</Label>
                <ScrollArea className="max-h-[200px]">
                  <ul className="space-y-1 text-sm text-destructive">
                    {showImportResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowImportResult(null)}>حسناً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessageTemplates;
