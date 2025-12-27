import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExportSummary {
  table: string;
  rowCount: number;
}

interface ExportResult {
  exportedAt: string;
  projectId: string;
  tables: Record<string, any[]>;
  summary: ExportSummary[];
  errors?: string[];
}

const DatabaseExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('export-database');

      if (error) throw error;

      setExportResult(data);
      
      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('تم تصدير البيانات بنجاح!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل في تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  };

  const totalRows = exportResult?.summary.reduce((sum, t) => sum + t.rowCount, 0) || 0;

  return (
    <>
      <Helmet>
        <title>تصدير قاعدة البيانات | المنصة</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">تصدير قاعدة البيانات</h1>
          <p className="text-muted-foreground">
            قم بتصدير جميع بيانات المنصة لنقلها إلى مشروع Supabase آخر
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              تصدير البيانات
            </CardTitle>
            <CardDescription>
              سيتم تصدير جميع الجداول كملف JSON يمكن استيراده في مشروع Supabase الجديد
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              className="w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 ml-2" />
                  تصدير جميع البيانات
                </>
              )}
            </Button>

            {exportResult && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">تم التصدير بنجاح</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">عدد الجداول:</span>
                    <span className="font-bold mr-2">{exportResult.summary.length}</span>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">إجمالي السجلات:</span>
                    <span className="font-bold mr-2">{totalRows}</span>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <span className="text-muted-foreground">التاريخ:</span>
                    <span className="font-bold mr-2">
                      {new Date(exportResult.exportedAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                </div>

                {exportResult.errors && exportResult.errors.length > 0 && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">أخطاء أثناء التصدير:</span>
                    </div>
                    <ul className="text-sm text-destructive/80 list-disc list-inside">
                      {exportResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-right p-2 border-b">الجدول</th>
                        <th className="text-center p-2 border-b">عدد السجلات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportResult.summary.map((item) => (
                        <tr key={item.table} className="border-b last:border-0">
                          <td className="p-2 font-mono text-xs">{item.table}</td>
                          <td className="p-2 text-center">{item.rowCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>خطوات الاستيراد في Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>أنشئ مشروع جديد في <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">supabase.com</a></li>
              <li>انسخ ملفات الـ migrations من <code className="bg-muted px-1 rounded">supabase/migrations/</code> وشغّلها في SQL Editor</li>
              <li>استخدم ملف JSON المُصدَّر لاستيراد البيانات عبر SQL Editor أو أداة pgAdmin</li>
              <li>حدّث متغيرات البيئة في مشروعك الجديد</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default DatabaseExport;
