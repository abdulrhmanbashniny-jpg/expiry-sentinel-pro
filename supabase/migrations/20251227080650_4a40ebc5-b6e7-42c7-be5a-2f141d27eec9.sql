-- إضافة الأعمدة الجديدة للـ profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS employee_number TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS allow_whatsapp BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_telegram BOOLEAN DEFAULT false;

-- تحديث الـ trigger لالتقاط البيانات الإضافية
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, employee_number, national_id, phone, allow_whatsapp, allow_telegram)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'full_name', 
    NEW.email,
    NEW.raw_user_meta_data ->> 'employee_number',
    NEW.raw_user_meta_data ->> 'national_id',
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE((NEW.raw_user_meta_data ->> 'allow_whatsapp')::boolean, false),
    COALESCE((NEW.raw_user_meta_data ->> 'allow_telegram')::boolean, false)
  );
  
  -- First user gets system_admin role
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'system_admin');
  ELSE
    -- Default new users to employee role
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إنشاء دالة مزامنة المستخدمين (Backfill) - لمدير النظام فقط
CREATE OR REPLACE FUNCTION public.sync_missing_users()
RETURNS TABLE (synced_count integer, synced_users text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  missing_user RECORD;
  synced_ids text[] := '{}';
  count_synced integer := 0;
BEGIN
  -- Find users in auth.users without profiles
  FOR missing_user IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.user_id
    WHERE p.id IS NULL
  LOOP
    -- Create profile
    INSERT INTO public.profiles (user_id, email, full_name, employee_number, national_id, phone, allow_whatsapp, allow_telegram)
    VALUES (
      missing_user.id,
      missing_user.email,
      missing_user.raw_user_meta_data ->> 'full_name',
      missing_user.raw_user_meta_data ->> 'employee_number',
      missing_user.raw_user_meta_data ->> 'national_id',
      missing_user.raw_user_meta_data ->> 'phone',
      COALESCE((missing_user.raw_user_meta_data ->> 'allow_whatsapp')::boolean, false),
      COALESCE((missing_user.raw_user_meta_data ->> 'allow_telegram')::boolean, false)
    );
    
    synced_ids := array_append(synced_ids, missing_user.email);
    count_synced := count_synced + 1;
  END LOOP;
  
  -- Find users without roles
  FOR missing_user IN
    SELECT p.user_id, p.email
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
    WHERE ur.id IS NULL
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (missing_user.user_id, 'employee');
    
    IF NOT missing_user.email = ANY(synced_ids) THEN
      synced_ids := array_append(synced_ids, missing_user.email);
      count_synced := count_synced + 1;
    END IF;
  END LOOP;
  
  synced_count := count_synced;
  synced_users := synced_ids;
  RETURN NEXT;
END;
$$;

-- منح صلاحية استدعاء الدالة
GRANT EXECUTE ON FUNCTION public.sync_missing_users() TO authenticated;