import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DynamicFieldDefinition {
  id: string;
  department_id: string | null;
  category_id: string | null;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select';
  field_options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

export function useDynamicFields(departmentId?: string, categoryId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch field definitions for a specific department/category combo
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['dynamic-fields', departmentId, categoryId],
    queryFn: async () => {
      let query = supabase
        .from('dynamic_field_definitions')
        .select('*')
        .order('sort_order');

      // Get fields that match:
      // 1. Exact department + category match
      // 2. Department only (applies to all categories in dept)
      // 3. Category only (applies across departments)
      // 4. Global (null department and category)
      
      const conditions: string[] = [];
      
      if (departmentId && categoryId) {
        conditions.push(`and(department_id.eq.${departmentId},category_id.eq.${categoryId})`);
        conditions.push(`and(department_id.eq.${departmentId},category_id.is.null)`);
        conditions.push(`and(department_id.is.null,category_id.eq.${categoryId})`);
      } else if (departmentId) {
        conditions.push(`department_id.eq.${departmentId}`);
      } else if (categoryId) {
        conditions.push(`category_id.eq.${categoryId}`);
      }
      
      conditions.push('and(department_id.is.null,category_id.is.null)');

      const { data, error } = await query.or(conditions.join(','));
      
      if (error) throw error;
      return (data || []) as DynamicFieldDefinition[];
    },
    enabled: !!(departmentId || categoryId),
  });

  // Fetch all field definitions (for admin management)
  const { data: allFields = [], isLoading: allLoading } = useQuery({
    queryKey: ['dynamic-fields-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dynamic_field_definitions')
        .select('*')
        .order('department_id')
        .order('category_id')
        .order('sort_order');
      
      if (error) throw error;
      return (data || []) as DynamicFieldDefinition[];
    },
  });

  const createField = useMutation({
    mutationFn: async (field: Omit<DynamicFieldDefinition, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('dynamic_field_definitions')
        .insert(field)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields-all'] });
      toast({ title: 'تم إضافة الحقل بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DynamicFieldDefinition> & { id: string }) => {
      const { data, error } = await supabase
        .from('dynamic_field_definitions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields-all'] });
      toast({ title: 'تم تحديث الحقل' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dynamic_field_definitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields-all'] });
      toast({ title: 'تم حذف الحقل' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // Import fields from JSON
  const importFields = async (jsonData: string): Promise<{ success: number; failed: number; errors: string[] }> => {
    try {
      const data = JSON.parse(jsonData);
      const errors: string[] = [];
      let success = 0;
      let failed = 0;

      const fieldsToImport = Array.isArray(data) ? data : data.fields;
      if (!fieldsToImport) throw new Error('صيغة غير صالحة');

      for (const field of fieldsToImport) {
        try {
          const { error } = await supabase
            .from('dynamic_field_definitions')
            .insert({
              department_id: field.department_id || null,
              category_id: field.category_id || null,
              field_key: field.field_key,
              field_label: field.field_label,
              field_type: field.field_type || 'text',
              field_options: field.field_options || null,
              is_required: field.is_required || false,
              sort_order: field.sort_order || 0,
            });

          if (error) {
            errors.push(`${field.field_key}: ${error.message}`);
            failed++;
          } else {
            success++;
          }
        } catch (err: any) {
          errors.push(`${field.field_key}: ${err.message}`);
          failed++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['dynamic-fields'] });
      queryClient.invalidateQueries({ queryKey: ['dynamic-fields-all'] });

      return { success, failed, errors };
    } catch (error: any) {
      throw new Error(`فشل تحليل الملف: ${error.message}`);
    }
  };

  // Export fields as JSON
  const exportFields = () => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      fields: allFields.map(f => ({
        department_id: f.department_id,
        category_id: f.category_id,
        field_key: f.field_key,
        field_label: f.field_label,
        field_type: f.field_type,
        field_options: f.field_options,
        is_required: f.is_required,
        sort_order: f.sort_order,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dynamic-fields-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'تم تصدير الحقول بنجاح' });
  };

  return {
    fields,
    allFields,
    isLoading,
    allLoading,
    createField,
    updateField,
    deleteField,
    importFields,
    exportFields,
  };
}
