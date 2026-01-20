-- إضافة عمود حالة الحساب وعمود القناة في سجل الإشعارات

-- 1) إضافة عمود حالة الحساب للمستخدمين
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'disabled', 'deleted'));

-- 2) إضافة عمود القناة في سجل الإشعارات لتتبع واتساب وتيليجرام
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS channel text;

-- 3) إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_notification_log_channel ON public.notification_log(channel);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);