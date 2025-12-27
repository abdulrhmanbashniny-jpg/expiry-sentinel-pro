import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserImport } from '@/hooks/useUserImport';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, XCircle, History } from 'lucide-react';
import { format } from 'date-fns';

export default function UserImport() {
  const { isSystemAdmin } = useAuth();
  const { importLogs, importUsers, parseFile, isLoading } = useUserImport();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<Awaited<ReturnType<typeof parseFile>> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  if (!isSystemAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>غير مصرح</AlertTitle>
          <AlertDescription>هذه الصفحة متاحة لمدير النظام فقط</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);

    try {
      const users = await parseFile(file);
      setParsedUsers(users);
    } catch (error) {
      console.error('Error parsing file:', error);
      setParsedUsers(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !parsedUsers || parsedUsers.length === 0) return;

    setImporting(true);
    try {
      const result = await importUsers.mutateAsync({
        fileName: selectedFile.name,
        users: parsedUsers,
      });
      setImportResult({ success: result.success, failed: result.failed });
      setParsedUsers(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'fullname,employee_number,email,role,department,phone,national_id,password';
    const example = 'أحمد محمد,EMP001,ahmed@example.com,employee,تقنية المعلومات,0501234567,1234567890,TempPass@123';
    const content = `${headers}\n${example}`;
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">استيراد المستخدمين</h1>
          <p className="text-muted-foreground">استيراد المستخدمين من ملف Excel أو CSV</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 ml-2" />
          تحميل القالب
        </Button>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            استيراد
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            سجل الاستيراد
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>رفع ملف المستخدمين</CardTitle>
              <CardDescription>
                ارفع ملف CSV أو Excel يحتوي على بيانات المستخدمين. يجب أن يحتوي الملف على الأعمدة التالية:
                fullname, employee_number, email, role, department, phone, national_id, password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* منطقة الرفع */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  {selectedFile ? selectedFile.name : 'اختر ملف أو اسحبه هنا'}
                </p>
                <p className="text-sm text-muted-foreground">
                  يدعم ملفات CSV و Excel (.csv, .xlsx)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* نتيجة الاستيراد */}
              {importResult && (
                <Alert variant={importResult.failed === 0 ? 'default' : 'destructive'}>
                  {importResult.failed === 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>نتيجة الاستيراد</AlertTitle>
                  <AlertDescription>
                    تم استيراد {importResult.success} مستخدم بنجاح
                    {importResult.failed > 0 && ` | فشل ${importResult.failed} مستخدم`}
                  </AlertDescription>
                </Alert>
              )}

              {/* معاينة البيانات */}
              {parsedUsers && parsedUsers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">معاينة البيانات ({parsedUsers.length} مستخدم)</h3>
                    <Button onClick={handleImport} disabled={importing}>
                      {importing ? (
                        <>
                          <Progress className="h-4 w-4 ml-2 animate-spin" />
                          جاري الاستيراد...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 ml-2" />
                          بدء الاستيراد
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>الاسم</TableHead>
                          <TableHead>الرقم الوظيفي</TableHead>
                          <TableHead>البريد</TableHead>
                          <TableHead>الدور</TableHead>
                          <TableHead>القسم</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedUsers.slice(0, 10).map((user, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell className="font-medium">{user.fullname}</TableCell>
                            <TableCell>{user.employee_number || '-'}</TableCell>
                            <TableCell>{user.email || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role || 'employee'}</Badge>
                            </TableCell>
                            <TableCell>{user.department || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {parsedUsers.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              و {parsedUsers.length - 10} مستخدم آخر...
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* تعليمات */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>ملاحظات هامة</AlertTitle>
                <AlertDescription className="mt-2 space-y-1">
                  <ul className="list-disc list-inside text-sm">
                    <li>يجب أن يحتوي كل صف على <strong>الاسم الكامل</strong> و<strong>البريد أو الرقم الوظيفي</strong></li>
                    <li>كلمات المرور المؤقتة ستُعرض مرة واحدة فقط بعد الاستيراد</li>
                    <li>سيُجبر المستخدمون على تغيير كلمة المرور عند أول دخول</li>
                    <li>الأدوار المتاحة: employee, supervisor, admin</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>سجل الاستيراد</CardTitle>
              <CardDescription>سجل عمليات استيراد المستخدمين السابقة</CardDescription>
            </CardHeader>
            <CardContent>
              {importLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد عمليات استيراد سابقة</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>اسم الملف</TableHead>
                      <TableHead>إجمالي الصفوف</TableHead>
                      <TableHead>نجح</TableHead>
                      <TableHead>فشل</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{log.file_name}</TableCell>
                        <TableCell>{log.total_rows}</TableCell>
                        <TableCell className="text-green-600">{log.success_count}</TableCell>
                        <TableCell className="text-red-600">{log.failure_count}</TableCell>
                        <TableCell>
                          {log.failure_count === 0 ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              مكتمل
                            </Badge>
                          ) : log.success_count === 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              فشل
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              جزئي
                            </Badge>
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
      </Tabs>
    </div>
  );
}
