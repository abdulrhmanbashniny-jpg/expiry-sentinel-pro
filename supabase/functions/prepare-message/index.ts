import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

// Authentication helper
async function verifyAuth(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const internalKey = req.headers.get('x-internal-key');
  if (internalKey) {
    const { data: n8nIntegration } = await adminClient
      .from('integrations')
      .select('config')
      .eq('key', 'n8n')
      .single();

    const expectedKey = (n8nIntegration?.config as Record<string, any>)?.internal_key;
    if (expectedKey && internalKey === expectedKey) {
      return { user: { id: 'internal-system' }, error: null };
    }
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }
  return { user, error: null };
}

// Apply template with variables
function applyTemplate(templateText: string, data: Record<string, any>): string {
  let result = templateText;

  // Replace regular variables
  for (const [key, value] of Object.entries(data)) {
    if (key === 'dynamic_fields' && typeof value === 'object') {
      for (const [dKey, dValue] of Object.entries(value as object)) {
        result = result.replace(new RegExp(`{{dynamic_fields\\.${dKey}}}`, 'g'), String(dValue || ''));
      }
    } else {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
    }
  }

  // Process conditionals {{#if field}}...{{/if}}
  result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, field, content) => {
    return data[field] ? content : '';
  });

  // Remove unreplaced variables
  result = result.replace(/{{[\w.]+}}/g, '');

  return result.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { item_id, recipient_id, channel = 'telegram' } = await req.json();

    if (!item_id || !recipient_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing item_id or recipient_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Preparing message for item:', item_id, 'recipient:', recipient_id, 'channel:', channel);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch item with relations
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(`
        *,
        category:categories(id, name, code),
        department:departments(id, name)
      `)
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return new Response(
        JSON.stringify({ success: false, error: 'العنصر غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recipient
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .select('*')
      .eq('id', recipient_id)
      .single();

    if (recipientError || !recipient) {
      return new Response(
        JSON.stringify({ success: false, error: 'المستلم غير موجود' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template for the specified channel
    const { data: templates } = await supabase
      .from('message_templates')
      .select('*')
      .eq('is_active', true)
      .or(`channel.eq.${channel},channel.eq.all`)
      .order('is_default', { ascending: false });

    const template = templates?.find(t => t.channel === channel && t.is_default) ||
                     templates?.find(t => t.channel === channel) ||
                     templates?.find(t => t.channel === 'all' && t.is_default) ||
                     templates?.[0];

    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: 'لا يوجد قالب متاح للقناة المحددة' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Published app URL
    const PUBLISHED_APP_URL = 'https://expiry-sentinel-pro.lovable.app';

    // Calculate days left
    const expiryDate = new Date(item.expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const remainingText = daysLeft === 0 ? 'اليوم' : 
                          daysLeft === 1 ? 'غداً' : 
                          daysLeft < 0 ? `متأخر ${Math.abs(daysLeft)} يوم` :
                          `${daysLeft} يوم`;

    // Build message data with all placeholders
    const messageData = {
      // Required fields
      recipient_name: recipient.name,
      title: item.title,
      item_title: item.title,
      item_code: item.ref_number || '-',
      ref_number: item.ref_number || '-',
      due_date: item.expiry_date,
      expiry_date: item.expiry_date,
      remaining_text: remainingText,
      days_left: daysLeft,
      item_url: `${PUBLISHED_APP_URL}/items/${item.id}`,
      
      // Optional fields
      department_name: item.department?.name || '-',
      category: item.category?.name || '-',
      category_name: item.category?.name || '-',
      creator_note: item.notes || '',
      notes: item.notes || '',
      responsible_person: item.responsible_person || '-',
      assignee: item.responsible_person || '-',
      expiry_time: item.expiry_time || '09:00',
      work_status: item.workflow_status,
      validity_status: item.status,
      serial_no: item.ref_number || '-',
      
      // Dynamic fields
      dynamic_fields: item.dynamic_fields || {},
    };

    // Apply template
    const message = applyTemplate(template.template_text, messageData);

    console.log('Message prepared successfully, length:', message.length);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          phone: recipient.whatsapp_number,
          telegram_id: recipient.telegram_id,
          recipient_name: recipient.name,
          message,
          item_id: item.id,
          recipient_id: recipient.id,
          days_left: daysLeft,
          channel,
          template_used: template.name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in prepare-message:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'حدث خطأ في النظام' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
