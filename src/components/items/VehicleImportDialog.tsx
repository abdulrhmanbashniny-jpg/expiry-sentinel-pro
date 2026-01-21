import React, { useState, useRef } from 'react';
import { useVehicleImport, VehicleImportRow } from '@/hooks/useVehicleImport';
import { useDepartments } from '@/hooks/useDepartments';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Car, 
  Loader2,
  FileWarning,
  Eye
} from 'lucide-react';

interface VehicleImportDialogContentProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const VehicleImportDialogContent: React.FC<VehicleImportDialogContentProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { isAdmin, isSystemAdmin, role } = useAuth();
  const { departments } = useDepartments();
  const { parseFile, importVehicles, downloadTemplate, isImporting } = useVehicleImport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [parsedData, setParsedData] = useState<VehicleImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  // Check permissions
  const canImport = isAdmin || isSystemAdmin || role === 'supervisor';

  if (!canImport) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>غير مصرح</AlertTitle>
        <AlertDescription>ميزة الاستيراد متاحة للمسؤولين والمشرفين فقط</AlertDescription>
      </Alert>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError(null);
    setImportResult(null);

    try {
      const data = await parseFile(file);
      if (data.length === 0) {
        setParseError('الملف فارغ أو لا يحتوي على بيانات صالحة');
        setParsedData(null);
      } else {
        setParsedData(data);
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'خطأ في قراءة الملف');
      setParsedData(null);
    }
  };

  const handleImport = async () => {
    if (!parsedData || !selectedDepartment) return;

    try {
      const result = await importVehicles.mutateAsync({
        fileName: selectedFile?.name || 'import.xlsx',
        vehicles: parsedData,
        departmentId: selectedDepartment,
      });

      setImportResult({
        success: result.success,
        failed: result.failed,
        errors: result.errors.map(e => ({ row: e.row, error: e.error })),
      });

      if (result.success > 0 && result.failed === 0) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Import error:', error);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setParsedData(null);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header with download template button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <span className="font-medium">استيراد مركبات من Excel</span>
          <Badge variant="outline">TAMM_CAR_IMPORT</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 ml-2" />
          تحميل القالب
        </Button>
      </div>

      {/* Import Result */}
      {importResult && (
        <Alert variant={importResult.failed === 0 ? 'default' : 'destructive'}>
          {importResult.failed === 0 ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>نتيجة الاستيراد</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>
                تم استيراد <strong>{importResult.success}</strong> مركبة بنجاح
                {importResult.failed > 0 && (
                  <span className="text-destructive"> (فشل {importResult.failed})</span>
                )}
              </p>
              {importResult.errors.length > 0 && (
                <ScrollArea className="h-32 rounded border p-2">
                  <ul className="space-y-1 text-sm">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx} className="flex gap-2">
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        <span>صف {err.row}: {err.error}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
              <Button variant="outline" size="sm" onClick={resetForm}>
                استيراد ملف جديد
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* File Upload & Department Selection */}
      {!importResult && (
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="upload" className="flex-1 gap-2">
              <Upload className="h-4 w-4" />
              رفع الملف
            </TabsTrigger>
            {parsedData && (
              <TabsTrigger value="preview" className="flex-1 gap-2">
                <Eye className="h-4 w-4" />
                معاينة ({parsedData.length} صف)
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {/* Department Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">القسم المالك *</label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">ملف Excel *</label>
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">اضغط لاختيار ملف أو اسحبه هنا</p>
                    <p className="text-xs text-muted-foreground">xlsx, xls, csv</p>
                  </div>
                )}
              </div>
            </div>

            {/* Parse Error */}
            {parseError && (
              <Alert variant="destructive">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>خطأ في الملف</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* Import Button */}
            {parsedData && parsedData.length > 0 && (
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleImport} 
                  disabled={isImporting || !selectedDepartment}
                  className="flex-1"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      جاري الاستيراد...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 ml-2" />
                      استيراد {parsedData.length} مركبة
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  إلغاء
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview">
            {parsedData && (
              <ScrollArea className="h-64 rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>رقم اللوحة</TableHead>
                      <TableHead>الرقم التسلسلي</TableHead>
                      <TableHead>رخصة السير</TableHead>
                      <TableHead>الفحص</TableHead>
                      <TableHead>التأمين</TableHead>
                      <TableHead>نوع التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{row.title}</TableCell>
                        <TableCell>{row.plate_number}</TableCell>
                        <TableCell>{row.serial_number}</TableCell>
                        <TableCell>{row.license_expiry}</TableCell>
                        <TableCell>{row.inspection_expiry}</TableCell>
                        <TableCell>{row.insurance_expiry}</TableCell>
                        <TableCell>
                          <Badge variant={row.date_type === 'هجري' ? 'secondary' : 'outline'}>
                            {row.date_type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    + {parsedData.length - 5} صفوف أخرى
                  </p>
                )}
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default VehicleImportDialogContent;
