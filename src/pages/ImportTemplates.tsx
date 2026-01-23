import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileSpreadsheet, Download, Plus, Edit, Trash2, AlertTriangle, Check, Loader2, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string;
  columns: TemplateColumn[];
  sample_data: Record<string, string>[];
  is_active: boolean;
  created_at: string;
}

interface TemplateColumn {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'date' | 'number' | 'select' | 'phone' | 'code';
  description?: string;
  lookup_table?: string; // For code-based lookups
}

const DEFAULT_TEMPLATES: Omit<ImportTemplate, 'id' | 'created_at'>[] = [
  {
    template_key: 'TAMM_CAR_IMPORT',
    name: 'استيراد المركبات (تم)',
    description: 'قالب استيراد بيانات المركبات من منصة تم/المرور مع دعم التواريخ الهجرية',
    is_active: true,
    columns: [
      { key: 'title', label: 'العنوان', required: true, type: 'text', description: 'عنوان المركبة' },
      { key: 'plate_number', label: 'رقم اللوحة', required: true, type: 'text', description: 'رقم لوحة المركبة' },
      { key: 'registration_type', label: 'نوع التسجيل', required: false, type: 'text' },
      { key: 'branch', label: 'الفرع', required: false, type: 'text' },
      { key: 'brand', label: 'الماركة', required: false, type: 'text' },
      { key: 'model', label: 'الطراز', required: false, type: 'text' },
      { key: 'year', label: 'سنة الصنع', required: false, type: 'number' },
      { key: 'serial_number', label: 'الرقم التسلسلي', required: true, type: 'text', description: 'المعرّف الفريد للمركبة' },
      { key: 'chassis_number', label: 'رقم الهيكل', required: false, type: 'text' },
      { key: 'color', label: 'اللون الأساسي', required: false, type: 'text' },
      { key: 'vehicle_status', label: 'وضع المركبة', required: false, type: 'text' },
      { key: 'ownership_date', label: 'تاريخ الملكية', required: false, type: 'date' },
      { key: 'license_expiry', label: 'تاريخ انتهاء رخصة السير', required: true, type: 'date' },
      { key: 'inspection_expiry', label: 'تاريخ انتهاء الفحص', required: false, type: 'date' },
      { key: 'insurance_expiry', label: 'تاريخ انتهاء التامين', required: false, type: 'date' },
      { key: 'date_type', label: 'نوع التاريخ', required: true, type: 'select', description: 'هجري أو ميلادي' },
      { key: 'item_status', label: 'حالة العنصر', required: true, type: 'select', description: 'نشط أو موقوف' },
      { key: 'responsible_phone', label: 'responsible_phone', required: false, type: 'phone', description: 'رقم المسؤول بصيغة دولية' },
      { key: 'reminder_rule_code', label: 'اسم قاعدة التذكير', required: false, type: 'code', lookup_table: 'reminder_rules', description: 'اسم أو كود القاعدة' },
      { key: 'recipients', label: 'المستلمون', required: false, type: 'text', description: 'أرقام مفصولة بفاصلة' },
      { key: 'notes', label: 'خانة الملاحظات', required: false, type: 'text' },
      { key: 'department_code', label: 'القسم المالك', required: false, type: 'code', lookup_table: 'departments' },
      { key: 'category_code', label: 'الفئة', required: false, type: 'code', lookup_table: 'categories' },
    ],
    sample_data: [
      {
        title: 'تويوتا كامري 2024',
        plate_number: 'ا ب ت 1234',
        serial_number: 'VH001',
        license_expiry: '1446/06/15',
        inspection_expiry: '1446/08/20',
        insurance_expiry: '1446/12/01',
        date_type: 'هجري',
        item_status: 'نشط',
        responsible_phone: '966512345678',
        reminder_rule_code: 'Qa',
        recipients: '966512345678,966598765432',
      },
    ],
  },
];

const ImportTemplates: React.FC = () => {
  const { isAdmin, isSystemAdmin } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ImportTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      // Load from platform_metadata
      const { data } = await supabase
        .from('platform_metadata')
        .select('*')
        .eq('category', 'import_template')
        .eq('is_active', true);

      if (data && data.length > 0) {
        const loaded = data.map(d => ({
          id: d.id,
          template_key: d.key,
          name: d.name,
          description: d.description || '',
          columns: (d.config as any)?.columns || [],
          sample_data: (d.config as any)?.sample_data || [],
          is_active: d.is_active ?? true,
          created_at: d.created_at || '',
        }));
        setTemplates(loaded);
      } else {
        // Initialize with defaults
        const defaultsWithIds = DEFAULT_TEMPLATES.map((t, i) => ({
          ...t,
          id: `default-${i}`,
          created_at: new Date().toISOString(),
        }));
        setTemplates(defaultsWithIds);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = (template: ImportTemplate) => {
    // Create workbook with headers and sample data
    const headers = template.columns.map(c => c.label);
    const sampleRows = template.sample_data.map(row => 
      template.columns.map(c => row[c.key] || '')
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    // Add instructions sheet
    const instructions = [
      ['قالب الاستيراد', template.name],
      ['الوصف', template.description],
      [''],
      ['الأعمدة المطلوبة:'],
      ...template.columns.filter(c => c.required).map(c => [c.label, c.description || '']),
      [''],
      ['الأعمدة الاختيارية:'],
      ...template.columns.filter(c => !c.required).map(c => [c.label, c.description || '']),
      [''],
      ['ملاحظات مهمة:'],
      ['- للتواريخ الهجرية: استخدم صيغة YYYY/MM/DD مثل 1446/06/15'],
      ['- للتواريخ الميلادية: استخدم صيغة YYYY-MM-DD مثل 2025-01-15'],
      ['- أرقام الهاتف بصيغة دولية: 9665XXXXXXXX'],
      ['- المستلمون: أرقام مفصولة بفاصلة (,) فقط'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'التعليمات');

    XLSX.writeFile(wb, `${template.template_key}_TEMPLATE.xlsx`);
    
    toast({
      title: 'تم تحميل القالب',
      description: `تم تحميل قالب ${template.name}`,
    });
  };

  if (!isAdmin && !isSystemAdmin) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          هذه الصفحة متاحة للمديرين فقط.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            قوالب الاستيراد
          </h1>
          <p className="text-muted-foreground">
            إدارة قوالب استيراد البيانات من Excel
          </p>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>ملاحظة مهمة:</strong> يُفضل استخدام <strong>الأكواد</strong> بدلاً من الأسماء للحقول التالية لتقليل أخطاء الكتابة:
          <ul className="list-disc list-inside mt-2">
            <li>القسم المالك: استخدم كود القسم</li>
            <li>الفئة: استخدم كود الفئة</li>
            <li>قاعدة التذكير: استخدم اسم القاعدة بالضبط</li>
            <li>المستلمون: أرقام الهاتف بصيغة دولية</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={template.is_active ? 'default' : 'secondary'}>
                    {template.is_active ? 'مفعل' : 'معطل'}
                  </Badge>
                  <Badge variant="outline">{template.template_key}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">الأعمدة المطلوبة:</h4>
                  <div className="flex flex-wrap gap-1">
                    {template.columns.filter(c => c.required).map((col) => (
                      <Badge key={col.key} variant="destructive" className="text-xs">
                        {col.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">الأعمدة الاختيارية:</h4>
                  <div className="flex flex-wrap gap-1">
                    {template.columns.filter(c => !c.required).slice(0, 8).map((col) => (
                      <Badge key={col.key} variant="secondary" className="text-xs">
                        {col.label}
                      </Badge>
                    ))}
                    {template.columns.filter(c => !c.required).length > 8 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.columns.filter(c => !c.required).length - 8} أخرى
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <Button 
                  onClick={() => downloadTemplate(template)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  تحميل القالب
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <Eye className="h-4 w-4" />
                      معاينة الأعمدة
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{template.name} - تفاصيل الأعمدة</DialogTitle>
                      <DialogDescription>
                        قائمة كاملة بالأعمدة المتاحة في هذا القالب
                      </DialogDescription>
                    </DialogHeader>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">العمود</TableHead>
                          <TableHead className="text-right">المفتاح</TableHead>
                          <TableHead className="text-right">النوع</TableHead>
                          <TableHead className="text-center">مطلوب</TableHead>
                          <TableHead className="text-right">الوصف</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {template.columns.map((col) => (
                          <TableRow key={col.key}>
                            <TableCell className="font-medium">{col.label}</TableCell>
                            <TableCell className="font-mono text-xs">{col.key}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{col.type}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {col.required ? (
                                <Check className="h-4 w-4 text-success mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {col.description || '-'}
                              {col.lookup_table && (
                                <Badge variant="secondary" className="mr-2 text-xs">
                                  جدول: {col.lookup_table}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">لا توجد قوالب استيراد</p>
            <p className="text-muted-foreground">سيتم إضافة القوالب الافتراضية تلقائياً</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportTemplates;
