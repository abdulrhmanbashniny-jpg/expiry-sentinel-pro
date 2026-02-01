import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';

export interface UserImportLog {
  id: string;
  imported_by: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  failure_count: number;
  error_details: Array<{ row: number; error: string; data?: unknown }>;
  created_at: string;
}

export interface ImportUserRow {
  fullname: string;
  employee_number?: string;
  email?: string;
  role?: string;
  department?: string;
  phone?: string;
  national_id?: string;
  password: string;
  job_title?: string;
  direct_manager?: string;
  hire_date?: string;
}

// توليد كلمة مرور عشوائية من 8 أرقام
function generateRandomPassword(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// تنظيف البريد الإلكتروني من أحرف Unicode المخفية
function sanitizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return email
    .replace(/[\u200B-\u200D\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

export const useUserImport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const importLogsQuery = useQuery({
    queryKey: ['user-import-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_import_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserImportLog[];
    },
  });

  const importUsers = useMutation({
    mutationFn: async ({ fileName, users }: { fileName: string; users: ImportUserRow[] }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const results: { 
        success: number; 
        failed: number; 
        errors: Array<{ row: number; error: string; data?: unknown }>;
        imported: Array<{ email: string; password: string; fullname: string; phone?: string }>;
      } = { success: 0, failed: 0, errors: [], imported: [] };

      for (let i = 0; i < users.length; i++) {
        const userData = users[i];
        try {
        // تنظيف البريد الإلكتروني
        const cleanEmail = sanitizeEmail(userData.email);
        
        // التحقق من التكرار
        if (cleanEmail) {
          const { data: existingEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (existingEmail) {
            results.errors.push({ row: i + 1, error: 'البريد الإلكتروني موجود مسبقاً', data: userData });
            results.failed++;
            continue;
          }
        }

          if (userData.employee_number) {
            const { data: existingEmp } = await supabase
              .from('profiles')
              .select('id')
              .eq('employee_number', userData.employee_number)
              .maybeSingle();
            if (existingEmp) {
              results.errors.push({ row: i + 1, error: 'الرقم الوظيفي موجود مسبقاً', data: userData });
              results.failed++;
              continue;
            }
          }

          // إنشاء المستخدم مع الإيميل النظيف
          const { data, error } = await supabase.functions.invoke('import-user', {
            body: { ...userData, email: cleanEmail, must_change_password: true },
          });
          if (error) throw error;

          results.success++;
          results.imported.push({
            email: userData.email || `${userData.employee_number}@temp.local`,
            password: userData.password,
            fullname: userData.fullname,
            phone: userData.phone,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
          results.errors.push({ row: i + 1, error: errorMessage, data: userData });
          results.failed++;
        }
      }

      // تسجيل في سجل الاستيراد
      await supabase.from('user_import_logs').insert([{
        imported_by: user.id,
        file_name: fileName,
        total_rows: users.length,
        success_count: results.success,
        failure_count: results.failed,
        error_details: JSON.parse(JSON.stringify(results.errors)),
      }]);

      // إرسال بيانات الدخول للمستخدمين المستوردين
      if (results.imported.length > 0) {
        try {
          await supabase.functions.invoke('send-credentials', {
            body: { users: results.imported },
          });
        } catch (e) {
          console.error('Error sending credentials:', e);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['user-import-logs'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast({
        title: 'تم الاستيراد',
        description: `نجح: ${results.success} | فشل: ${results.failed}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تحليل ملف XLSX أو CSV
  const parseFile = async (file: File): Promise<ImportUserRow[]> => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
      
      return data
        .filter(row => row.fullname && (row.email || row.employee_number))
        .map(row => ({
          fullname: row.fullname,
          email: row.email || undefined,
          employee_number: row.employee_number || undefined,
          role: row.role || undefined,
          department: row.department || undefined,
          phone: row.phone || undefined,
          national_id: row.national_id || undefined,
          password: row.password || generateRandomPassword(),
          job_title: row.job_title || undefined,
          direct_manager: row.direct_manager || undefined,
          hire_date: row.hire_date || undefined,
        }));
    }

    // CSV parsing
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            reject(new Error('الملف فارغ'));
            return;
          }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const users: ImportUserRow[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: Record<string, string> = {};
            headers.forEach((header, index) => { row[header] = values[index] || ''; });
            if (!row.fullname || (!row.email && !row.employee_number)) continue;
            users.push({
              fullname: row.fullname,
              email: row.email || undefined,
              employee_number: row.employee_number || undefined,
              role: row.role || undefined,
              department: row.department || undefined,
              phone: row.phone || undefined,
              national_id: row.national_id || undefined,
              password: row.password || generateRandomPassword(),
              job_title: row.job_title || undefined,
              direct_manager: row.direct_manager || undefined,
              hire_date: row.hire_date || undefined,
            });
          }
          resolve(users);
        } catch (error) { reject(error); }
      };
      reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
      reader.readAsText(file);
    });
  };

  return {
    importLogs: importLogsQuery.data || [],
    isLoading: importLogsQuery.isLoading,
    importUsers,
    parseFile,
    refetch: importLogsQuery.refetch,
  };
};
