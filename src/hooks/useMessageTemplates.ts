import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MessageTemplate {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  channel: 'telegram' | 'whatsapp' | 'all';
  template_text: string;
  placeholders: Array<{
    key: string;
    label: string;
    required: boolean;
  }>;
  required_fields: string[];
  optional_fields: string[];
  dynamic_field_keys: string[];
  version: number;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// المتغيرات المتاحة للقوالب
export const AVAILABLE_PLACEHOLDERS = [
  { key: 'item_title', label: 'عنوان المعاملة', required: true },
  { key: 'ref_number', label: 'الرقم المرجعي', required: true },
  { key: 'department_name', label: 'اسم القسم', required: false },
  { key: 'category_name', label: 'اسم الفئة', required: false },
  { key: 'expiry_date', label: 'تاريخ الانتهاء', required: true },
  { key: 'days_left', label: 'الأيام المتبقية', required: true },
  { key: 'creator_note', label: 'ملاحظة المنشئ', required: false },
  { key: 'item_url', label: 'رابط المعاملة', required: false },
  { key: 'responsible_person', label: 'المسؤول', required: false },
  { key: 'recipient_name', label: 'اسم المستلم', required: false },
];

// بيانات مرجعية للذكاء الصناعي
export const REFERENCE_PAYLOAD = {
  item_title: "تجديد رخصة البلدية",
  ref_number: "LIC-2025-0042",
  department_name: "الشؤون الإدارية",
  category_name: "التراخيص",
  expiry_date: "2025-02-15",
  days_left: 7,
  creator_note: "يرجى التجديد قبل انتهاء المهلة",
  item_url: "https://example.com/items/123",
  responsible_person: "أحمد محمد",
  recipient_name: "خالد عبدالله",
  dynamic_fields: {
    contract_value: "50,000 ريال",
    vendor_name: "شركة التوريدات",
    license_number: "BR-12345"
  }
};

export function useMessageTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Partial<MessageTemplate>) => {
      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          name: template.name!,
          channel: template.channel || 'all',
          template_text: template.template_text!,
          name_en: template.name_en,
          description: template.description,
          placeholders: template.placeholders || [],
          required_fields: template.required_fields || [],
          optional_fields: template.optional_fields || [],
          dynamic_field_keys: template.dynamic_field_keys || [],
          is_active: template.is_active ?? true,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'تم إنشاء القالب بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MessageTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('message_templates')
        .update({ ...updates, version: templates.find(t => t.id === id)?.version || 1 + 1 })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'تم تحديث القالب بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'تم حذف القالب' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (id: string) => {
      const original = templates.find(t => t.id === id);
      if (!original) throw new Error('القالب غير موجود');

      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          name: `${original.name} (نسخة)`,
          name_en: original.name_en ? `${original.name_en} (Copy)` : null,
          description: original.description,
          channel: original.channel,
          template_text: original.template_text,
          placeholders: original.placeholders,
          required_fields: original.required_fields,
          optional_fields: original.optional_fields,
          dynamic_field_keys: original.dynamic_field_keys,
          is_active: false,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: 'تم نسخ القالب بنجاح' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('message_templates')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast({ title: is_active ? 'تم تفعيل القالب' : 'تم تعطيل القالب' });
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  // تصدير القوالب كـ JSON
  const exportTemplates = (templateIds?: string[]) => {
    const toExport = templateIds 
      ? templates.filter(t => templateIds.includes(t.id))
      : templates;

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      templates: toExport.map(t => ({
        name: t.name,
        name_en: t.name_en,
        description: t.description,
        channel: t.channel,
        template_text: t.template_text,
        placeholders: t.placeholders,
        required_fields: t.required_fields,
        optional_fields: t.optional_fields,
        dynamic_field_keys: t.dynamic_field_keys,
      })),
      reference_payload: REFERENCE_PAYLOAD,
      available_placeholders: AVAILABLE_PLACEHOLDERS,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'تم تصدير القوالب بنجاح' });
  };

  // استيراد القوالب من JSON
  const importTemplates = async (jsonData: string): Promise<{ success: number; failed: number; errors: string[] }> => {
    try {
      const data = JSON.parse(jsonData);
      const errors: string[] = [];
      let success = 0;
      let failed = 0;

      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('صيغة الملف غير صحيحة');
      }

      for (const template of data.templates) {
        try {
          const { error } = await supabase
            .from('message_templates')
            .insert({
              name: template.name,
              name_en: template.name_en,
              description: template.description,
              channel: template.channel || 'all',
              template_text: template.template_text,
              placeholders: template.placeholders || [],
              required_fields: template.required_fields || [],
              optional_fields: template.optional_fields || [],
              dynamic_field_keys: template.dynamic_field_keys || [],
              is_active: false,
              is_default: false,
            });

          if (error) {
            errors.push(`${template.name}: ${error.message}`);
            failed++;
          } else {
            success++;
          }
        } catch (err: any) {
          errors.push(`${template.name}: ${err.message}`);
          failed++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['message-templates'] });

      return { success, failed, errors };
    } catch (error: any) {
      throw new Error(`فشل تحليل الملف: ${error.message}`);
    }
  };

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    toggleActive,
    exportTemplates,
    importTemplates,
  };
}

// دالة لتطبيق القالب على البيانات
export function applyTemplate(templateText: string, data: Record<string, any>): string {
  let result = templateText;

  // استبدال المتغيرات العادية
  for (const [key, value] of Object.entries(data)) {
    if (key === 'dynamic_fields' && typeof value === 'object') {
      // معالجة الحقول الديناميكية
      for (const [dKey, dValue] of Object.entries(value)) {
        result = result.replace(new RegExp(`{{dynamic_fields\\.${dKey}}}`, 'g'), String(dValue || ''));
      }
    } else {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
    }
  }

  // معالجة الشروط {{#if field}}...{{/if}}
  result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, field, content) => {
    return data[field] ? content : '';
  });

  // إزالة المتغيرات غير المستبدلة
  result = result.replace(/{{[\w.]+}}/g, '');

  return result.trim();
}
