import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
}

export const useUserImport = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // جلب سجلات الاستيراد
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

  // استيراد المستخدمين
  const importUsers = useMutation({
    mutationFn: async ({ fileName, users }: { fileName: string; users: ImportUserRow[] }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const results: { success: number; failed: number; errors: Array<{ row: number; error: string; data?: unknown }> } = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < users.length; i++) {
        const userData = users[i];
        try {
          // التحقق من التكرار
          if (userData.email) {
            const { data: existingEmail } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', userData.email)
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

          // إنشاء المستخدم عبر Edge Function
          const { data, error } = await supabase.functions.invoke('import-user', {
            body: {
              ...userData,
              must_change_password: true,
            },
          });

          if (error) throw error;

          results.success++;
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
        error_details: JSON.stringify(results.errors),
      }]);

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

  // تحليل ملف CSV/Excel
  const parseFile = (file: File): Promise<ImportUserRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter((line) => line.trim());

          if (lines.length < 2) {
            reject(new Error('الملف فارغ أو لا يحتوي على بيانات'));
            return;
          }

          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
          const users: ImportUserRow[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map((v) => v.trim());
            const row: Record<string, string> = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            // التحقق من الحقول المطلوبة
            if (!row.fullname) {
              continue;
            }

            if (!row.email && !row.employee_number) {
              continue;
            }

            users.push({
              fullname: row.fullname,
              email: row.email || undefined,
              employee_number: row.employee_number || undefined,
              role: row.role || undefined,
              department: row.department || undefined,
              phone: row.phone || undefined,
              national_id: row.national_id || undefined,
              password: row.password || generateRandomPassword(),
            });
          }

          resolve(users);
        } catch (error) {
          reject(error);
        }
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

// توليد كلمة مرور عشوائية
function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
