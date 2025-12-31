-- 1. إضافة حقل dynamic_fields للعناصر
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS dynamic_fields jsonb DEFAULT '{}'::jsonb;

-- 2. إنشاء جدول قوالب الرسائل
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  name_en text,
  description text,
  channel text NOT NULL DEFAULT 'telegram', -- telegram | whatsapp | all
  template_text text NOT NULL,
  placeholders jsonb DEFAULT '[]'::jsonb, -- قائمة المتغيرات المتاحة
  required_fields text[] DEFAULT '{}', -- الحقول المطلوبة
  optional_fields text[] DEFAULT '{}', -- الحقول الاختيارية
  dynamic_field_keys text[] DEFAULT '{}', -- مفاتيح الحقول الديناميكية المستخدمة
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Message Templates: Admin can manage"
ON public.message_templates FOR ALL
USING (is_admin_or_higher(auth.uid()));

CREATE POLICY "Message Templates: All can read active"
ON public.message_templates FOR SELECT
USING (is_active = true OR is_admin_or_higher(auth.uid()));

-- 5. Trigger للتحديث التلقائي
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. إدراج قالب افتراضي
INSERT INTO public.message_templates (
  name,
  name_en,
  channel,
  template_text,
  placeholders,
  required_fields,
  optional_fields,
  is_default,
  is_active
) VALUES (
  'قالب التذكير الافتراضي',
  'Default Reminder Template',
  'all',
  E'🔔 تذكير: {{item_title}}\n\n📋 الرقم/المرجع: {{ref_number}}\n🏢 القسم: {{department_name}}\n📁 الفئة: {{category_name}}\n📅 تاريخ الانتهاء: {{expiry_date}}\n⏰ المتبقي: {{days_left}} يوم\n\n{{#if creator_note}}📝 ملاحظة: {{creator_note}}\n{{/if}}\n🔗 رابط المعاملة: {{item_url}}',
  '[
    {"key": "item_title", "label": "عنوان المعاملة", "required": true},
    {"key": "ref_number", "label": "الرقم المرجعي", "required": true},
    {"key": "department_name", "label": "اسم القسم", "required": false},
    {"key": "category_name", "label": "اسم الفئة", "required": false},
    {"key": "expiry_date", "label": "تاريخ الانتهاء", "required": true},
    {"key": "days_left", "label": "الأيام المتبقية", "required": true},
    {"key": "creator_note", "label": "ملاحظة المنشئ", "required": false},
    {"key": "item_url", "label": "رابط المعاملة", "required": false},
    {"key": "dynamic_fields", "label": "الحقول الديناميكية", "required": false}
  ]'::jsonb,
  ARRAY['item_title', 'ref_number', 'expiry_date', 'days_left'],
  ARRAY['department_name', 'category_name', 'creator_note', 'item_url', 'dynamic_fields'],
  true,
  true
) ON CONFLICT DO NOTHING;