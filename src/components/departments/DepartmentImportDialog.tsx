import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, HelpCircle, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

/**
 * نظام الحقول الديناميكية (Unlimited Dynamic Fields)
 * ===================================================
 * 
 * الحقول الديناميكية هي حقول إضافية يمكن إضافتها لكل قسم أو فئة بشكل مرن.
 * يتم تخزين القيم في عمود dynamic_fields (JSONB) في جدول items.
 * 
 * ### مفتاح الحقل (field_key):
 * - يمكنك استخدام أي مفتاح نصي فريد (مثال: request_number, contract_value)
 * - يجب أن يكون باللغة الإنجليزية بدون مسافات
 * - يُفضل استخدام snake_case (مثال: employee_id, hire_date)
 * - لا يوجد حد أقصى لعدد الحقول
 * 
 * ### أنواع الحقول المدعومة:
 * - text: حقل نصي عادي
 * - number: حقل رقمي
 * - date: حقل تاريخ
 * - select: قائمة منسدلة مع خيارات محددة
 */

interface DynamicFieldDef {
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select';
  field_options?: string[];
  is_required?: boolean;
  sort_order?: number;
}

interface CategoryDef {
  name: string;
  code?: string;
  description?: string;
  risk_level?: 'low' | 'medium' | 'high';
  dynamic_fields?: DynamicFieldDef[];
}

interface DepartmentImportData {
  name: string;
  code?: string;
  description?: string;
  categories?: CategoryDef[];
  dynamic_fields?: DynamicFieldDef[];
}

interface ImportResult {
  department: string;
  categories_created: number;
  fields_created: number;
  errors: string[];
}

const EXAMPLE_JSON = `{
  "name": "قسم الموارد البشرية",
  "code": "HR",
  "description": "إدارة شؤون الموظفين والتوظيف",
  "categories": [
    {
      "name": "وثائق الموظفين",
      "code": "EMP-DOCS",
      "description": "جميع وثائق الموظفين الرسمية",
      "risk_level": "high",
      "dynamic_fields": [
        {
          "field_key": "employee_number",
          "field_label": "رقم الموظف",
          "field_type": "text",
          "is_required": true
        },
        {
          "field_key": "hire_date",
          "field_label": "تاريخ التعيين",
          "field_type": "date",
          "is_required": true
        }
      ]
    },
    {
      "name": "العقود",
      "code": "CONTRACTS",
      "description": "عقود العمل والاتفاقيات",
      "risk_level": "high",
      "dynamic_fields": [
        {
          "field_key": "contract_type",
          "field_label": "نوع العقد",
          "field_type": "select",
          "field_options": ["دائم", "مؤقت", "استشاري"],
          "is_required": true
        },
        {
          "field_key": "contract_value",
          "field_label": "قيمة العقد",
          "field_type": "number",
          "is_required": false
        }
      ]
    }
  ],
  "dynamic_fields": [
    {
      "field_key": "sub_department",
      "field_label": "الإدارة الفرعية",
      "field_type": "text"
    },
    {
      "field_key": "priority_level",
      "field_label": "مستوى الأولوية",
      "field_type": "select",
      "field_options": ["عادي", "متوسط", "عاجل"]
    }
  ]
}`;

export function DepartmentImportDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<DepartmentImportData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const validateAndParse = () => {
    setParseError(null);
    setParsedData(null);
    
    if (!jsonInput.trim()) {
      setParseError('الرجاء إدخال بيانات JSON');
      return;
    }

    try {
      const data = JSON.parse(jsonInput) as DepartmentImportData;
      
      // Validate required fields
      if (!data.name || typeof data.name !== 'string') {
        throw new Error('حقل "name" (اسم القسم) مطلوب ويجب أن يكون نصاً');
      }

      // Validate categories
      if (data.categories && !Array.isArray(data.categories)) {
        throw new Error('حقل "categories" يجب أن يكون مصفوفة');
      }

      // Validate dynamic fields - no more field_XX restriction
      const validateFields = (fields: DynamicFieldDef[] | undefined, context: string) => {
        if (!fields) return;
        const usedKeys = new Set<string>();
        
        for (const field of fields) {
          if (!field.field_key || !field.field_label) {
            throw new Error(`الحقول الديناميكية في ${context} تفتقد field_key أو field_label`);
          }
          
          // Validate field_key format (no spaces, English only)
          if (!/^[a-z][a-z0-9_]*$/i.test(field.field_key)) {
            throw new Error(`مفتاح الحقل "${field.field_key}" غير صالح. يجب أن يكون باللغة الإنجليزية بدون مسافات (مثال: employee_id)`);
          }
          
          // Check for duplicate keys
          if (usedKeys.has(field.field_key)) {
            throw new Error(`مفتاح الحقل "${field.field_key}" مكرر في ${context}`);
          }
          usedKeys.add(field.field_key);
          
          if (!['text', 'number', 'date', 'select'].includes(field.field_type)) {
            throw new Error(`نوع الحقل "${field.field_type}" غير مدعوم في ${context}. الأنواع المدعومة: text, number, date, select`);
          }
          if (field.field_type === 'select' && (!field.field_options || !Array.isArray(field.field_options))) {
            throw new Error(`الحقل "${field.field_label}" من نوع select يجب أن يحتوي على field_options`);
          }
        }
      };

      validateFields(data.dynamic_fields, 'القسم');
      data.categories?.forEach((cat, idx) => {
        if (!cat.name) {
          throw new Error(`الفئة رقم ${idx + 1} تفتقد اسم`);
        }
        validateFields(cat.dynamic_fields, `الفئة "${cat.name}"`);
      });

      setParsedData(data);
      toast({ title: 'تم التحقق بنجاح', description: 'البيانات صالحة وجاهزة للاستيراد' });
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        setParseError(`خطأ في صيغة JSON: ${error.message}`);
      } else {
        setParseError(error.message);
      }
    }
  };

  const performImport = async () => {
    if (!parsedData) return;
    
    setIsImporting(true);
    const result: ImportResult = {
      department: parsedData.name,
      categories_created: 0,
      fields_created: 0,
      errors: [],
    };

    try {
      // 1. Create department
      const { data: dept, error: deptError } = await supabase
        .from('departments')
        .insert({
          name: parsedData.name,
          code: parsedData.code || null,
          description: parsedData.description || null,
        })
        .select()
        .single();

      if (deptError) throw new Error(`فشل إنشاء القسم: ${deptError.message}`);

      // 2. Create department-level dynamic fields
      if (parsedData.dynamic_fields?.length) {
        for (let i = 0; i < parsedData.dynamic_fields.length; i++) {
          const field = parsedData.dynamic_fields[i];
          const { error: fieldError } = await supabase
            .from('dynamic_field_definitions')
            .insert({
              department_id: dept.id,
              category_id: null,
              field_key: field.field_key,
              field_label: field.field_label,
              field_type: field.field_type,
              field_options: field.field_options || null,
              is_required: field.is_required || false,
              sort_order: field.sort_order ?? i,
            });

          if (fieldError) {
            result.errors.push(`فشل إنشاء الحقل "${field.field_label}": ${fieldError.message}`);
          } else {
            result.fields_created++;
          }
        }
      }

      // 3. Create categories with their dynamic fields
      if (parsedData.categories?.length) {
        for (const category of parsedData.categories) {
          const { data: cat, error: catError } = await supabase
            .from('categories')
            .insert({
              name: category.name,
              code: category.code || null,
              description: category.description || null,
              department_id: dept.id,
              risk_level: category.risk_level || null,
            })
            .select()
            .single();

          if (catError) {
            result.errors.push(`فشل إنشاء الفئة "${category.name}": ${catError.message}`);
            continue;
          }

          result.categories_created++;

          // Create category-level dynamic fields
          if (category.dynamic_fields?.length) {
            for (let i = 0; i < category.dynamic_fields.length; i++) {
              const field = category.dynamic_fields[i];
              const { error: fieldError } = await supabase
                .from('dynamic_field_definitions')
                .insert({
                  department_id: dept.id,
                  category_id: cat.id,
                  field_key: field.field_key,
                  field_label: field.field_label,
                  field_type: field.field_type,
                  field_options: field.field_options || null,
                  is_required: field.is_required || false,
                  sort_order: field.sort_order ?? i,
                });

              if (fieldError) {
                result.errors.push(`فشل إنشاء الحقل "${field.field_label}" للفئة "${category.name}": ${fieldError.message}`);
              } else {
                result.fields_created++;
              }
            }
          }
        }
      }

      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields-all'] });

      if (result.errors.length === 0) {
        toast({ 
          title: 'تم الاستيراد بنجاح', 
          description: `تم إنشاء القسم "${result.department}" مع ${result.categories_created} فئة و ${result.fields_created} حقل`,
        });
      } else {
        toast({ 
          title: 'تم الاستيراد مع تحذيرات', 
          description: `${result.errors.length} خطأ أثناء الاستيراد`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      result.errors.push(error.message);
      setImportResult(result);
      toast({ title: 'فشل الاستيراد', description: error.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const resetDialog = () => {
    setJsonInput('');
    setParseError(null);
    setParsedData(null);
    setImportResult(null);
  };

  const loadExample = () => {
    setJsonInput(EXAMPLE_JSON);
    setParseError(null);
    setParsedData(null);
    setImportResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetDialog(); setIsOpen(open); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileJson className="ml-2 h-4 w-4" />
          استيراد من JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>استيراد هيكل القسم الكامل</DialogTitle>
          <DialogDescription>
            استيراد قسم كامل مع الفئات والحقول الديناميكية من ملف JSON
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Documentation Section */}
            <Accordion type="single" collapsible className="border rounded-lg">
              <AccordionItem value="docs" className="border-0">
                <AccordionTrigger className="px-4 py-2 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span>دليل كتابة ملف JSON والحقول الديناميكية</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-semibold mb-2">هيكل البيانات:</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><code className="bg-muted px-1 rounded">name</code> (مطلوب): اسم القسم</li>
                        <li><code className="bg-muted px-1 rounded">code</code>: رمز القسم المختصر (مثال: HR, IT)</li>
                        <li><code className="bg-muted px-1 rounded">description</code>: وصف القسم</li>
                        <li><code className="bg-muted px-1 rounded">categories</code>: مصفوفة الفئات التابعة للقسم</li>
                        <li><code className="bg-muted px-1 rounded">dynamic_fields</code>: الحقول الديناميكية على مستوى القسم</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">هيكل الفئة:</h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><code className="bg-muted px-1 rounded">name</code> (مطلوب): اسم الفئة</li>
                        <li><code className="bg-muted px-1 rounded">code</code>: رمز الفئة</li>
                        <li><code className="bg-muted px-1 rounded">risk_level</code>: مستوى المخاطرة (low, medium, high)</li>
                        <li><code className="bg-muted px-1 rounded">dynamic_fields</code>: الحقول الخاصة بهذه الفئة</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">نظام الحقول الديناميكية (غير محدود):</h4>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <p className="text-emerald-800 dark:text-emerald-200 mb-2">
                          <strong>✓ لا يوجد حد أقصى لعدد الحقول!</strong>
                        </p>
                        <div className="text-muted-foreground space-y-1">
                          <p>• استخدم أي مفتاح نصي فريد (بالإنجليزية)</p>
                          <p>• يُفضل استخدام snake_case: <code className="bg-muted px-1 rounded">employee_id</code>, <code className="bg-muted px-1 rounded">contract_value</code></p>
                          <p>• تجنب المسافات والأحرف الخاصة في المفتاح</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">أنواع الحقول:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 p-2 rounded">
                          <Badge variant="secondary">text</Badge>
                          <p className="text-muted-foreground text-xs mt-1">حقل نصي عادي</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <Badge variant="secondary">number</Badge>
                          <p className="text-muted-foreground text-xs mt-1">حقل رقمي</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <Badge variant="secondary">date</Badge>
                          <p className="text-muted-foreground text-xs mt-1">حقل تاريخ</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded">
                          <Badge variant="secondary">select</Badge>
                          <p className="text-muted-foreground text-xs mt-1">قائمة اختيار (يتطلب field_options)</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">مثال لحقل ديناميكي:</h4>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto" dir="ltr">
{`{
  "field_key": "employee_number",
  "field_label": "رقم الموظف",
  "field_type": "text",
  "is_required": true
}`}
                      </pre>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">مثال لحقل من نوع select:</h4>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto" dir="ltr">
{`{
  "field_key": "contract_type",
  "field_label": "نوع العقد",
  "field_type": "select",
  "field_options": ["دائم", "مؤقت", "استشاري"],
  "is_required": true
}`}
                      </pre>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* JSON Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="json-input">بيانات JSON</Label>
                <Button variant="ghost" size="sm" onClick={loadExample}>
                  تحميل مثال
                </Button>
              </div>
              <Textarea
                id="json-input"
                value={jsonInput}
                onChange={(e) => { 
                  setJsonInput(e.target.value); 
                  setParseError(null);
                  setParsedData(null);
                }}
                placeholder="الصق كود JSON هنا..."
                className="font-mono text-sm min-h-[200px]"
                dir="ltr"
              />
            </div>

            {/* Parse Error */}
            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>خطأ في البيانات</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* Parsed Preview */}
            {parsedData && !importResult && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">تم التحقق بنجاح</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <div className="mt-2 space-y-1">
                    <p><strong>القسم:</strong> {parsedData.name} {parsedData.code && `(${parsedData.code})`}</p>
                    <p><strong>عدد الفئات:</strong> {parsedData.categories?.length || 0}</p>
                    <p><strong>حقول على مستوى القسم:</strong> {parsedData.dynamic_fields?.length || 0}</p>
                    <p><strong>إجمالي الحقول للفئات:</strong> {parsedData.categories?.reduce((sum, c) => sum + (c.dynamic_fields?.length || 0), 0) || 0}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Import Result */}
            {importResult && (
              <Alert className={importResult.errors.length > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30' : 'border-green-200 bg-green-50 dark:bg-green-950/30'}>
                {importResult.errors.length > 0 ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                <AlertTitle className={importResult.errors.length > 0 ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}>
                  {importResult.errors.length > 0 ? 'تم الاستيراد مع تحذيرات' : 'تم الاستيراد بنجاح'}
                </AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    <p><strong>القسم:</strong> {importResult.department}</p>
                    <p><strong>الفئات المنشأة:</strong> {importResult.categories_created}</p>
                    <p><strong>الحقول المنشأة:</strong> {importResult.fields_created}</p>
                    {importResult.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold text-destructive">الأخطاء:</p>
                        <ul className="list-disc list-inside text-destructive text-sm">
                          {importResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {importResult ? 'إغلاق' : 'إلغاء'}
          </Button>
          {!importResult && (
            <>
              <Button 
                variant="secondary" 
                onClick={validateAndParse}
                disabled={!jsonInput.trim() || isImporting}
              >
                تحقق من البيانات
              </Button>
              <Button 
                onClick={performImport}
                disabled={!parsedData || isImporting}
              >
                {isImporting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Upload className="ml-2 h-4 w-4" />
                استيراد
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
