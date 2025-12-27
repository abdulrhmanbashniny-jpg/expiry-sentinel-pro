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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return new Response(
        JSON.stringify({ error: 'المعرف وكلمة المرور مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Login attempt with identifier: ${identifier}`);

    let email = identifier;

    // Check if identifier is email or employee number
    const isEmail = identifier.includes('@');
    
    if (!isEmail) {
      // Look up email by employee number
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .eq('employee_number', identifier)
        .maybeSingle();

      if (profileError || !profile) {
        console.log('Employee number not found:', identifier);
        return new Response(
          JSON.stringify({ error: 'بيانات الدخول غير صحيحة' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get auth user email
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
      
      if (authError || !authUser.user?.email) {
        console.log('Auth user not found for profile:', profile.user_id);
        return new Response(
          JSON.stringify({ error: 'بيانات الدخول غير صحيحة' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      email = authUser.user.email;
    }

    // Now sign in with email and password
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (signInError || !signInData.user) {
      console.log('Sign in error:', signInError?.message);

      return new Response(
        JSON.stringify({ error: 'بيانات الدخول غير صحيحة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = signInData.user.id;

    // Log successful login
    if (userId) {
      await supabaseAdmin.from('login_history').insert({
        user_id: userId,
        success: true,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
      });
    }

    // Check if user must change password
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('must_change_password')
      .eq('user_id', userId)
      .maybeSingle();

    console.log(`Login successful for user: ${userId}, must_change_password: ${profile?.must_change_password}`);

    return new Response(
      JSON.stringify({ 
        session: signInData.session,
        user: signInData.user,
        must_change_password: profile?.must_change_password || false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'خطأ في تسجيل الدخول';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
