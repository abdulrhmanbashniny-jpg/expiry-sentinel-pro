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
    const itemId = url.searchParams.get('item_id');

    if (!itemId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'يرجى تحديد رقم المعاملة' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Getting details for item:', itemId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get item details with all relations
    const { data: item, error: itemError } = await supabase
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
        attachment_url,
        created_at,
        updated_at,
        categories(id, name, description),
        reminder_rules(id, name, days_before, is_active)
      `)
      .eq('id', itemId)
      .single();

    if (itemError) {
      console.error('Database error:', itemError);
      if (itemError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'لم يتم العثور على المعاملة' 
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw itemError;
    }

    // Get recipients for this item
    const { data: itemRecipients, error: recipientsError } = await supabase
      .from('item_recipients')
      .select(`
        recipients(id, name, whatsapp_number, is_active)
      `)
      .eq('item_id', itemId);

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError);
    }

    // Get notification history for this item
    const { data: notifications, error: notificationsError } = await supabase
      .from('notification_log')
      .select(`
        id,
        reminder_day,
        status,
        sent_at,
        created_at,
        recipients(name, whatsapp_number)
      `)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
    }

    // Calculate days left
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(item.expiry_date);
    expiryDate.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Format response
    const typedItem = item as any;
    const formattedItem = {
      id: typedItem.id,
      title: typedItem.title,
      expiry_date: typedItem.expiry_date,
      expiry_time: typedItem.expiry_time,
      days_left: daysLeft,
      status: typedItem.status,
      status_text: daysLeft < 0 ? 'منتهية' : daysLeft === 0 ? 'تنتهي اليوم' : daysLeft <= 7 ? 'قريبة الانتهاء' : 'فعالة',
      notes: typedItem.notes,
      responsible_person: typedItem.responsible_person,
      owner_department: typedItem.owner_department,
      attachment_url: typedItem.attachment_url,
      created_at: typedItem.created_at,
      updated_at: typedItem.updated_at,
      category: typedItem.categories ? {
        id: typedItem.categories.id,
        name: typedItem.categories.name,
        description: typedItem.categories.description
      } : null,
      reminder_rule: typedItem.reminder_rules ? {
        id: typedItem.reminder_rules.id,
        name: typedItem.reminder_rules.name,
        days_before: typedItem.reminder_rules.days_before,
        is_active: typedItem.reminder_rules.is_active
      } : null,
      recipients: (itemRecipients || []).map((ir: any) => ({
        id: ir.recipients?.id,
        name: ir.recipients?.name,
        whatsapp_number: ir.recipients?.whatsapp_number,
        is_active: ir.recipients?.is_active
      })),
      notification_history: (notifications || []).map((n: any) => ({
        id: n.id,
        reminder_day: n.reminder_day,
        status: n.status,
        sent_at: n.sent_at,
        recipient_name: n.recipients?.name
      }))
    };

    console.log('Item details retrieved successfully');

    return new Response(
      JSON.stringify({
        success: true,
        item: formattedItem
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-item-details:', error);
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
