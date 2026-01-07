import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDynamicFields, DynamicFieldDefinition } from '@/hooks/useDynamicFields';
import { useDepartments } from '@/hooks/useDepartments';
import { useCategories } from '@/hooks/useCategories';
import { Plus, Pencil, Trash2, Download, Upload, ListPlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const FIELD_TYPES = [
  { value: 'text', label: 'نص' },
  { value: 'number', label: 'رقم' },
  { value: 'date', label: 'تاريخ' },
  { value: 'select', label: 'قائمة اختيار' },
];

const DynamicFields: React.FC = () => {
  const { toast } = useToast();
  const { allFields, allLoading, createField, updateField, deleteField, importFields, exportFields } = useDynamicFields();
  const { departments } = useDepartments();
  const { categories } = useCategories();
  
  const [editingField, setEditingField] = useState<Partial<DynamicFieldDefinition> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    setEditingField({
      field_key: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      sort_order: 0,
      department_id: null,
      category_id: null,
    });
    setOptionsText('');
    setIsDialogOpen(true);
  };

  const handleEdit = (field: DynamicFieldDefinition) => {
    setEditingField(field);
    setOptionsText((field.field_options || []).join('\n'));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingField?.field_key || !editingField?.field_label) {
      toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
      return;
    }

    const fieldData = {
      ...editingField,
      field_options: editingField.field_type === 'select' && optionsText.trim() 
        ? optionsText.split('\n').filter(o => o.trim()) 
        : null,
    };

    if (editingField.id) {
      await updateField.mutateAsync({ id: editingField.id, ...fieldData });
    } else {
      await createField.mutateAsync(fieldData as any);
    }
    setIsDialogOpen(false);
    setEditingField(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الحقل؟')) {
      await deleteField.mutateAsync(id);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = await importFields(event.target?.result as string);
        setImportResult(result);
        toast({
          title: 'تم الاستيراد',
          description: `نجح: ${result.success}, فشل: ${result.failed}`,
        });
      } catch (error: any) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getDepartmentName = (id: string | null) => {
    if (!id) return 'الكل';
    return departments.find(d => d.id === id)?.name || 'غير معروف';
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return 'الكل';
    return categories.find(c => c.id === id)?.name || 'غير معروف';
  };

  const getFieldTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-100 text-blue-800',
      number: 'bg-green-100 text-green-800',
      date: 'bg-purple-100 text-purple-800',
      select: 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, string> = {
      text: 'نص',
      number: 'رقم',
      date: 'تاريخ',
      select: 'قائمة',
    };
    return <Badge className={colors[type]}>{labels[type]}</Badge>;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListPlus className="h-6 w-6" />
            الحقول الديناميكية
          </h1>
          <p className="text-muted-foreground">إدارة الحقول الإضافية حسب القسم والفئة</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 ml-2" />
            استيراد
          </Button>
          <Button variant="outline" onClick={exportFields}>
            <Download className="h-4 w-4 ml-2" />
            تصدير
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة حقل
          </Button>
        </div>
      </div>

      {importResult && importResult.errors.length > 0 && (
        <Alert>
          <AlertDescription>
            <p className="font-medium mb-2">نتائج الاستيراد: نجح {importResult.success}, فشل {importResult.failed}</p>
            <ul className="text-sm list-disc list-inside">
              {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>قائمة الحقول</CardTitle>
          <CardDescription>الحقول الإضافية التي تظهر عند إنشاء عنصر جديد</CardDescription>
        </CardHeader>
        <CardContent>
          {allLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : allFields.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد حقول ديناميكية</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المفتاح</TableHead>
                  <TableHead>التسمية</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>مطلوب</TableHead>
                  <TableHead>الترتيب</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allFields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-mono text-sm">{field.field_key}</TableCell>
                    <TableCell>{field.field_label}</TableCell>
                    <TableCell>{getFieldTypeBadge(field.field_type)}</TableCell>
                    <TableCell>{getDepartmentName(field.department_id)}</TableCell>
                    <TableCell>{getCategoryName(field.category_id)}</TableCell>
                    <TableCell>
                      {field.is_required ? <Badge variant="destructive">نعم</Badge> : <Badge variant="outline">لا</Badge>}
                    </TableCell>
                    <TableCell>{field.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(field)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(field.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField?.id ? 'تعديل حقل' : 'إضافة حقل جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المفتاح (بالإنجليزية) *</Label>
                <Input
                  value={editingField?.field_key || ''}
                  onChange={(e) => setEditingField({ ...editingField, field_key: e.target.value.replace(/\s/g, '_').toLowerCase() })}
                  placeholder="contract_value"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>التسمية *</Label>
                <Input
                  value={editingField?.field_label || ''}
                  onChange={(e) => setEditingField({ ...editingField, field_label: e.target.value })}
                  placeholder="قيمة العقد"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select
                  value={editingField?.department_id || 'all'}
                  onValueChange={(v) => setEditingField({ ...editingField, department_id: v === 'all' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select
                  value={editingField?.category_id || 'all'}
                  onValueChange={(v) => setEditingField({ ...editingField, category_id: v === 'all' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفئات</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نوع الحقل</Label>
                <Select
                  value={editingField?.field_type || 'text'}
                  onValueChange={(v) => setEditingField({ ...editingField, field_type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الترتيب</Label>
                <Input
                  type="number"
                  value={editingField?.sort_order || 0}
                  onChange={(e) => setEditingField({ ...editingField, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {editingField?.field_type === 'select' && (
              <div className="space-y-2">
                <Label>خيارات القائمة (سطر لكل خيار)</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="خيار 1&#10;خيار 2&#10;خيار 3"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={editingField?.is_required || false}
                onCheckedChange={(v) => setEditingField({ ...editingField, is_required: v })}
              />
              <Label>حقل مطلوب</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={createField.isPending || updateField.isPending}>
              {(createField.isPending || updateField.isPending) && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DynamicFields;
