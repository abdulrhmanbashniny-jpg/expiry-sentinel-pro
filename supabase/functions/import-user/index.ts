import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const rawBody = await req.json();
    
    // Sanitize email - remove invisible Unicode characters (RTL marks, zero-width chars, etc.)
    const sanitizeEmail = (email: string | undefined): string | undefined => {
      if (!email) return undefined;
      // Remove invisible Unicode characters and trim whitespace
      return email
        .replace(/[\u200B-\u200D\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
        .trim();
    };
    
    const { 
      fullname, 
      employee_number, 
      role, 
      department, 
      phone, 
      national_id, 
      password,
      job_title,
      direct_manager,
      hire_date,
      must_change_password = true 
    } = rawBody;
    
    const email = sanitizeEmail(rawBody.email);

    console.log(`Importing user: ${fullname}, employee_number: ${employee_number}, email: ${email}`);

    // Validate required fields
    if (!fullname) {
      return new Response(
        JSON.stringify({ error: 'الاسم الكامل مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email && !employee_number) {
      return new Response(
        JSON.stringify({ error: 'البريد الإلكتروني أو الرقم الوظيفي مطلوب' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate temporary email if not provided (using employee number with valid domain)
    // Supabase Auth requires a valid-looking email format
    const userEmail = email || `emp_${employee_number}@internal.placeholder.com`;
    const userPassword = password || generateRandomPassword();

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        full_name: fullname,
        employee_number: employee_number,
        national_id: national_id,
        phone: phone,
        allow_whatsapp: false,
        allow_telegram: false,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user?.id;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'فشل في إنشاء المستخدم' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile with all fields
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        must_change_password: must_change_password,
        email: email || null,
        employee_number: employee_number || null,
        national_id: national_id || null,
        phone: phone || null,
        job_title: job_title || null,
        direct_manager: direct_manager || null,
        hire_date: hire_date || null,
      })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    // Set role if provided
    if (role) {
      const validRoles = ['employee', 'supervisor', 'admin', 'hr_user', 'system_admin'];
      if (validRoles.includes(role)) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role: role })
          .eq('user_id', userId);
        
        if (roleError) {
          console.error('Role update error:', roleError);
        }
      }
    }

    // Link to department if provided
    if (department) {
      // Find department by name
      const { data: deptData } = await supabaseAdmin
        .from('departments')
        .select('id')
        .eq('name', department)
        .maybeSingle();

      if (deptData) {
        await supabaseAdmin
          .from('user_department_scopes')
          .insert({
            user_id: userId,
            department_id: deptData.id,
            scope_type: 'primary',
          });
      }
    }

    // Log password audit
    await supabaseAdmin
      .from('password_audit_log')
      .insert({
        user_id: userId,
        action: 'imported_with_temp_password',
        performed_by: null, // System action
      });

    console.log(`User imported successfully: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        email: userEmail,
        employee_number: employee_number,
        must_change_password: must_change_password,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Import user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ في استيراد المستخدم';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
