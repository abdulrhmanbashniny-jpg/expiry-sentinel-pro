# دليل Multi-Tenant الشامل

## 📋 نظرة عامة

يدعم النظام استضافة **شركات متعددة** على نفس المنصة مع **فصل تام للبيانات**. كل شركة (Tenant) لها:
- مستخدمون مستقلون
- بيانات معزولة (عناصر، أقسام، فئات...)
- تكاملات خاصة (API Keys مختلفة)
- إعدادات مستقلة

---

## 🏗️ البنية التقنية

### الجداول الرئيسية

```sql
-- جدول الشركات
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- الاسم بالعربي
  name_en text,                          -- الاسم بالإنجليزي
  code text UNIQUE NOT NULL,             -- كود فريد (مثل ACME)
  logo_url text,                         -- شعار الشركة
  domain text,                           -- نطاق مخصص (اختياري)
  settings jsonb DEFAULT '{}',           -- إعدادات إضافية
  subscription_plan text DEFAULT 'basic', -- خطة الاشتراك
  max_users int DEFAULT 50,              -- الحد الأقصى للمستخدمين
  max_items int DEFAULT 1000,            -- الحد الأقصى للعناصر
  is_active boolean DEFAULT true,        -- هل الشركة نشطة؟
  trial_ends_at timestamptz,             -- تاريخ انتهاء التجربة
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- تكاملات كل شركة
CREATE TABLE public.tenant_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  integration_key text NOT NULL,         -- telegram, whatsapp, n8n, ai
  config jsonb NOT NULL DEFAULT '{}',    -- الإعدادات
  is_active boolean DEFAULT true,
  last_tested_at timestamptz,
  test_result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, integration_key)
);

-- إحصائيات الاستخدام
CREATE TABLE public.tenant_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  users_count int DEFAULT 0,
  items_count int DEFAULT 0,
  notifications_sent int DEFAULT 0,
  ai_calls int DEFAULT 0,
  storage_used_mb numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- دعوات المستخدمين
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'employee',
  token text UNIQUE NOT NULL,
  invited_by uuid NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### الجداول المعزولة بـ tenant_id

| الجدول | الوصف |
|--------|-------|
| `profiles` | ملفات المستخدمين |
| `items` | العناصر/المعاملات |
| `departments` | الأقسام |
| `categories` | الفئات |
| `recipients` | المستلمين |
| `item_recipients` | ربط العناصر بالمستلمين |
| `reminder_rules` | قواعد التذكير |
| `message_templates` | قوالب الرسائل |
| `notification_log` | سجل الإشعارات |
| `automation_runs` | سجل تشغيل الأتمتة |
| `kpi_templates` | قوالب تقييم الأداء |
| `evaluation_cycles` | دورات التقييم |
| `evaluations` | التقييمات |
| `compliance_scores` | درجات الامتثال |
| `compliance_reports` | تقارير الامتثال |
| `conversation_logs` | سجل المحادثات |
| `ai_agent_configs` | إعدادات وكلاء AI |
| `dynamic_field_definitions` | تعريفات الحقول الديناميكية |
| `team_members` | أعضاء الفرق |

---

## 🔐 Row Level Security (RLS)

### الدوال الأساسية

```sql
-- استرجاع tenant_id للمستخدم الحالي
CREATE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  RETURN v_tenant_id;
END;
$$;

-- هل المستخدم في هذا الـ tenant؟
CREATE FUNCTION public.is_user_in_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  )
$$;

-- هل المستخدم admin في هذا الـ tenant؟
CREATE FUNCTION public.is_tenant_admin(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.user_id = auth.uid() 
      AND p.tenant_id = _tenant_id
      AND ur.role IN ('system_admin', 'admin')
  )
$$;
```

### سياسات RLS النموذجية

لكل جدول معزول، يتم إنشاء 4 سياسات:

```sql
-- 1. SELECT: قراءة بيانات الشركة فقط
CREATE POLICY "TableName: Tenant SELECT"
ON public.table_name
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  is_system_admin(auth.uid()) OR 
  (tenant_id = get_current_tenant_id())
);

-- 2. INSERT: إضافة مع تحقق من tenant
CREATE POLICY "TableName: Tenant INSERT"
ON public.table_name
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  is_system_admin(auth.uid()) OR 
  ((tenant_id IS NULL) AND (get_current_tenant_id() IS NOT NULL)) OR 
  (tenant_id = get_current_tenant_id())
);

-- 3. UPDATE: تعديل بيانات الشركة فقط
CREATE POLICY "TableName: Tenant UPDATE"
ON public.table_name
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (is_system_admin(auth.uid()) OR (tenant_id = get_current_tenant_id()))
WITH CHECK (is_system_admin(auth.uid()) OR (tenant_id = get_current_tenant_id()));

-- 4. DELETE: حذف بيانات الشركة فقط
CREATE POLICY "TableName: Tenant DELETE"
ON public.table_name
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (is_system_admin(auth.uid()) OR (tenant_id = get_current_tenant_id()));
```

### Triggers للحماية

```sql
-- منع تغيير tenant_id بعد الإنشاء
CREATE FUNCTION public.prevent_tenant_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cannot change tenant_id after creation';
  END IF;
  RETURN NEW;
END;
$$;

-- تعيين tenant_id تلقائياً + منع التزوير
CREATE FUNCTION public.enforce_tenant_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_tenant_id UUID;
BEGIN
  v_current_tenant_id := get_current_tenant_id();
  
  -- رفض إذا حاول إدخال tenant مختلف
  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id != v_current_tenant_id THEN
    IF NOT is_system_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot insert records for other tenants';
    END IF;
  END IF;
  
  -- تعيين تلقائي
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_current_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- تطبيق Trigger على الجداول
CREATE TRIGGER enforce_tenant_items_insert
  BEFORE INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION enforce_tenant_on_insert();

CREATE TRIGGER prevent_tenant_change_items
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION prevent_tenant_id_change();
```

---

## 👥 إدارة المستخدمين

### تدفق الدعوات

```
1. Admin في شركة A يُرسل دعوة لـ user@example.com
   ↓
2. إنشاء سجل في user_invitations مع tenant_id = شركة A
   ↓
3. المستخدم يستلم رابط الدعوة عبر البريد
   ↓
4. المستخدم يفتح الرابط ويُنشئ حسابه
   ↓
5. يتم ربط profiles.tenant_id = شركة A تلقائياً
```

### RLS للدعوات

```sql
-- Admin يدير دعوات شركته فقط
CREATE POLICY "Invitations: Tenant admin can manage"
ON public.user_invitations
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  is_system_admin(auth.uid()) OR 
  (is_tenant_admin(tenant_id) AND tenant_id = get_current_tenant_id())
);

-- عرض الدعوة للمدعو عبر JWT email
CREATE POLICY "Invitations: View by token access"
ON public.user_invitations
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  is_tenant_admin(tenant_id) OR 
  is_system_admin(auth.uid()) OR 
  (
    (email = (auth.jwt() ->> 'email')) AND 
    (accepted_at IS NULL) AND 
    (expires_at > now())
  )
);
```

---

## ⚙️ التكاملات لكل شركة

### هيكل الإعدادات

```typescript
interface TenantIntegrationConfig {
  // Telegram
  bot_token?: string;
  bot_username?: string;
  
  // WhatsApp
  api_base_url?: string;
  apikey?: string;
  instance_name?: string;
  
  // n8n
  webhook_url?: string;
  n8n_api_key?: string;
  
  // AI
  provider?: string;
  model?: string;
  ai_api_key?: string;
}
```

### مثال الاستخدام في Edge Function

```typescript
async function getTenantIntegration(tenantId: string, key: string) {
  const { data } = await supabase
    .from('tenant_integrations')
    .select('config, is_active')
    .eq('tenant_id', tenantId)
    .eq('integration_key', key)
    .single();
  
  if (!data?.is_active) return null;
  return data.config;
}

// استخدام Telegram config الخاص بالشركة
const telegramConfig = await getTenantIntegration(tenantId, 'telegram');
if (telegramConfig?.bot_token) {
  await sendTelegramMessage(telegramConfig.bot_token, chatId, message);
}
```

---

## 📊 خطط الاشتراك

```typescript
const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'أساسي',
    max_users: 10,
    max_items: 500,
    features: ['إدارة العناصر', 'تذكيرات البريد'],
  },
  professional: {
    name: 'احترافي',
    max_users: 50,
    max_items: 2000,
    features: ['كل مميزات الأساسي', 'WhatsApp', 'Telegram', 'تقارير'],
  },
  enterprise: {
    name: 'مؤسسات',
    max_users: -1, // unlimited
    max_items: -1, // unlimited
    features: ['كل المميزات', 'دعم مخصص', 'API كامل', 'تخصيص العلامة التجارية'],
  },
};
```

---

## 🔄 تدفق تسجيل الدخول

```
1. المستخدم يُدخل بيانات الدخول
   ↓
2. Supabase Auth يتحقق من الهوية
   ↓
3. النظام يقرأ profiles.tenant_id
   ↓
4. [إذا tenant_id موجود] → دخول مباشر للشركة
   [إذا system_admin] → عرض قائمة الشركات للاختيار
   [إذا لا tenant] → رسالة خطأ / انتظار دعوة
```

---

## ✅ قائمة التحقق للتطوير

عند إضافة جدول جديد:

- [ ] إضافة عمود `tenant_id uuid REFERENCES tenants(id)`
- [ ] إضافة سياسة `SELECT` مع `get_current_tenant_id()`
- [ ] إضافة سياسة `INSERT` مع `WITH CHECK`
- [ ] إضافة سياسة `UPDATE` مع `USING` و `WITH CHECK`
- [ ] إضافة سياسة `DELETE` مع `USING`
- [ ] إضافة trigger `enforce_tenant_on_insert`
- [ ] إضافة trigger `prevent_tenant_id_change`
- [ ] تحديث الـ Hooks في Frontend

---

## 🛡️ أخطاء شائعة وحلولها

### 1. لا أستطيع رؤية البيانات
**السبب**: المستخدم غير مرتبط بـ tenant
**الحل**: تحقق من `profiles.tenant_id`

### 2. خطأ عند الإضافة
**السبب**: محاولة إضافة لـ tenant مختلف
**الحل**: لا تُرسل `tenant_id` يدوياً، الـ trigger يعيّنه تلقائياً

### 3. System Admin لا يرى كل البيانات
**السبب**: سياسة RLS لا تتحقق من `is_system_admin`
**الحل**: تأكد من وجود `is_system_admin(auth.uid())` في كل سياسة

---

## 📞 الدعم

للمساعدة التقنية، راجع:
- [README.md](../README.md)
- [INTEGRATIONS.md](../INTEGRATIONS.md)
