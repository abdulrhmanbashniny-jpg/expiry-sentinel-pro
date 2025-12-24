import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, Building, FolderOpen, Users, RefreshCw, FileText, Send } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6', '#f97316'];

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  return 'text-red-500';
}

function getScoreBadge(score: number) {
  if (score >= 80) return <Badge className="bg-green-500">ممتاز</Badge>;
  if (score >= 60) return <Badge className="bg-yellow-500">مقبول</Badge>;
  return <Badge variant="destructive">ضعيف</Badge>;
}

export default function ComplianceReports() {
  const queryClient = useQueryClient();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  
  // Fetch latest scores
  const { data: scores, isLoading: loadingScores } = useQuery({
    queryKey: ['compliance-scores', periodType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_scores')
        .select('*')
        .eq('period_type', periodType)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });
  
  // Fetch reports
  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ['compliance-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });
  
  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: async (reportType: string) => {
      const { data, error } = await supabase.functions.invoke('generate-compliance-report', {
        body: { report_type: reportType, send_notification: false }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`تم إنشاء التقرير بنجاح - الدرجة الكلية: ${data.global_score}%`);
      queryClient.invalidateQueries({ queryKey: ['compliance-scores'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-reports'] });
    },
    onError: (error: any) => {
      toast.error(`فشل إنشاء التقرير: ${error.message}`);
    }
  });
  
  // Send report via Telegram
  const sendReport = useMutation({
    mutationFn: async (reportType: string) => {
      const { data, error } = await supabase.functions.invoke('generate-compliance-report', {
        body: { report_type: reportType, send_notification: true }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم إرسال التقرير للمديرين عبر Telegram');
    },
    onError: (error: any) => {
      toast.error(`فشل الإرسال: ${error.message}`);
    }
  });
  
  // Process scores for charts
  const globalScore = scores?.find(s => s.score_type === 'global');
  const departmentScores = scores?.filter(s => s.score_type === 'department') || [];
  const categoryScores = scores?.filter(s => s.score_type === 'category') || [];
  const personScores = scores?.filter(s => s.score_type === 'person') || [];
  
  const departmentChartData = departmentScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => ({
      name: s.reference_name || 'غير محدد',
      score: s.score,
      fill: s.score >= 80 ? COLORS[0] : s.score >= 60 ? COLORS[1] : COLORS[2]
    }));
  
  const categoryChartData = categoryScores
    .sort((a, b) => b.score - a.score)
    .map(s => ({
      name: s.reference_name || 'غير محدد',
      score: s.score,
      total: s.total_items
    }));
  
  const pieData = [
    { name: 'في الوقت', value: globalScore?.on_time_items || 0, fill: COLORS[0] },
    { name: 'متأخر', value: globalScore?.late_items || 0, fill: COLORS[2] }
  ];
  
  if (loadingScores) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>تقارير الالتزام - HR Reminder</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">تقارير الالتزام</h1>
            <p className="text-muted-foreground">
              تحليل أداء المعاملات ودرجات الالتزام
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
                <SelectItem value="yearly">سنوي</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={() => generateReport.mutate(periodType)}
              disabled={generateReport.isPending}
            >
              {generateReport.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="ml-2 h-4 w-4" />
              )}
              تحديث التقرير
            </Button>
            <Button 
              variant="outline"
              onClick={() => sendReport.mutate(periodType)}
              disabled={sendReport.isPending}
            >
              {sendReport.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="ml-2 h-4 w-4" />
              )}
              إرسال للمديرين
            </Button>
          </div>
        </div>

        {/* Global Score Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>الدرجة الكلية</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={`text-4xl font-bold ${getScoreColor(globalScore?.score || 0)}`}>
                  {globalScore?.score || 0}%
                </span>
                {getScoreBadge(globalScore?.score || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>إجمالي المعاملات</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{globalScore?.total_items || 0}</span>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>في الوقت</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-3xl font-bold text-green-500">{globalScore?.on_time_items || 0}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>متأخرة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <span className="text-3xl font-bold text-red-500">{globalScore?.late_items || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="departments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="departments" className="gap-2">
              <Building className="h-4 w-4" />
              الأقسام
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              الفئات
            </TabsTrigger>
            <TabsTrigger value="persons" className="gap-2">
              <Users className="h-4 w-4" />
              المسؤولون
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileText className="h-4 w-4" />
              التقارير السابقة
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="departments" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>أداء الأقسام</CardTitle>
                </CardHeader>
                <CardContent>
                  {departmentChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={departmentChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip />
                        <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>توزيع الالتزام</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الأقسام</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {departmentScores.sort((a, b) => b.score - a.score).map((dept, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-medium">{i + 1}</span>
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{dept.reference_name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {dept.total_items} معاملة | {dept.late_items} متأخر
                        </span>
                        <span className={`text-xl font-bold ${getScoreColor(dept.score)}`}>
                          {dept.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>أداء الفئات</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-12">لا توجد بيانات</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الفئات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryScores.sort((a, b) => a.score - b.score).map((cat, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span>{cat.reference_name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {cat.total_items} معاملة | متوسط التأخير: {cat.avg_delay_days} يوم
                        </span>
                        <span className={`text-xl font-bold ${getScoreColor(cat.score)}`}>
                          {cat.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="persons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>أداء المسؤولين</CardTitle>
                <CardDescription>يظهر فقط المسؤولون الذين لديهم 3 معاملات أو أكثر</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {personScores.sort((a, b) => b.score - a.score).map((person, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${i < 3 ? 'text-green-500' : i >= personScores.length - 3 ? 'text-red-500' : ''}`}>
                          {i + 1}
                        </span>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{person.reference_name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {person.total_items} معاملة | {person.on_time_items} في الوقت
                        </span>
                        <span className={`text-xl font-bold ${getScoreColor(person.score)}`}>
                          {person.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {personScores.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">لا توجد بيانات كافية</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>التقارير السابقة</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReports ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : reports && reports.length > 0 ? (
                  <div className="space-y-4">
                    {reports.map((report: any) => (
                      <Card key={report.id} className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{report.title}</CardTitle>
                            <Badge variant="outline">{report.report_type}</Badge>
                          </div>
                          <CardDescription>
                            {format(new Date(report.created_at), 'PPpp', { locale: ar })}
                            {report.sent_at && ' • تم الإرسال'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm whitespace-pre-wrap bg-background p-3 rounded-lg">
                            {report.summary_text}
                          </div>
                          {report.ai_analysis && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium">تحليل AI:</p>
                              <p className="text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg">
                                {report.ai_analysis}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد تقارير سابقة. اضغط "تحديث التقرير" لإنشاء تقرير جديد.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
