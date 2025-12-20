import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';

    if (!query.trim()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'يرجى إدخال نص للبحث' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching for:', query);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Search in items by title or notes
    const { data: items, error } = await supabase
      .from('items')
      .select(`
        id,
        title,
        expiry_date,
        expiry_time,
        status,
        notes,
        responsible_person,
        owner_department,
        created_at,
        categories(id, name),
        reminder_rules(id, name, days_before)
      `)
      .or(`title.ilike.%${query}%,notes.ilike.%${query}%,responsible_person.ilike.%${query}%,owner_department.ilike.%${query}%`)
      .order('expiry_date', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Calculate days left for each item
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formattedItems = (items || []).map((item: any) => {
      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const diffTime = expiryDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: item.id,
        title: item.title,
        expiry_date: item.expiry_date,
        expiry_time: item.expiry_time,
        days_left: daysLeft,
        status: item.status,
        notes: item.notes,
        responsible_person: item.responsible_person,
        owner_department: item.owner_department,
        category: item.categories?.name || null,
        reminder_rule: item.reminder_rules?.name || null
      };
    });

    console.log(`Found ${formattedItems.length} items matching "${query}"`);

    return new Response(
      JSON.stringify({
        success: true,
        query: query,
        count: formattedItems.length,
        items: formattedItems
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in search-items:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'حدث خطأ في النظام' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
