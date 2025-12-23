import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

// Authentication helper
async function verifyAuth(req: Request) {
  // 1) أولاً: مفتاح داخلي للاستدعاءات الخلفية (مثلاً من n8n)
  const internalKey = req.headers.get("x-internal-key");
  const expectedKey = Deno.env.get("INTERNAL_FUNCTION_KEY");

  if (internalKey && expectedKey && internalKey === expectedKey) {
    // نرجع مستخدم وهمي يمثل النظام الداخلي
    return { user: { id: "internal-system" }, error: null };
  }

  // 2) إن لم يوجد مفتاح داخلي، نرجع للطريقة العادية (JWT من Supabase Auth)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { user: null, error: "Missing authorization header" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "Unauthorized" };
  }

  return { user, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const checkDate =
      url.searchParams.get("date") || new Date().toISOString().split("T")[0];

    console.log("Fetching due items for date:", checkDate, "by user:", user.id);

    // Fetch all active items with their reminder rules
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select(`
        *,
        category:categories(id, name),
        reminder_rule:reminder_rules(id, name, days_before, is_active)
      `)
      .eq("status", "active")
      .gte("expiry_date", checkDate);

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      throw itemsError;
    }

    const today = new Date(checkDate);
    today.setHours(0, 0, 0, 0);

    const dueItems: any[] = [];

    for (const item of items || []) {
      if (!item.reminder_rule || !item.reminder_rule.is_active) continue;

      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Check if today matches any reminder day
      const daysBefore = item.reminder_rule.days_before || [];
      if (daysBefore.includes(daysLeft)) {
        // Get recipients for this item
        const { data: itemRecipients } = await supabase
          .from("item_recipients")
          .select(`
            recipient:recipients(id, name, whatsapp_number, is_active)
          `)
          .eq("item_id", item.id);

        const activeRecipients: { id: string; name: string; whatsapp_number: string }[] = [];
        for (const ir of itemRecipients || []) {
          const rec = ir.recipient as unknown as {
            id: string;
            name: string;
            whatsapp_number: string;
            is_active: boolean;
          } | null;

          if (rec && rec.is_active) {
            activeRecipients.push({
              id: rec.id,
              name: rec.name,
              whatsapp_number: rec.whatsapp_number,
            });
          }
        }

        // Check if notification already sent today
        const { data: existingLogs } = await supabase
          .from("notification_log")
          .select("id, recipient_id")
          .eq("item_id", item.id)
          .eq("reminder_day", daysLeft)
          .gte("created_at", `${checkDate}T00:00:00`)
          .lte("created_at", `${checkDate}T23:59:59`);

        const notifiedRecipientIds = (existingLogs || []).map(
          (log: any) => log.recipient_id,
        );

        const pendingRecipients = activeRecipients.filter(
          (r) => !notifiedRecipientIds.includes(r.id),
        );

        if (pendingRecipients.length > 0) {
          dueItems.push({
            item: {
              id: item.id,
              title: item.title,
              expiry_date: item.expiry_date,
              expiry_time: item.expiry_time || "09:00",
              days_left: daysLeft,
              category: item.category?.name || null,
              responsible_person: item.responsible_person,
              notes: item.notes,
            },
            reminder_rule: {
              id: item.reminder_rule.id,
              name: item.reminder_rule.name,
              trigger_day: daysLeft,
            },
            recipients: pendingRecipients,
          });
        }
      }
    }

    console.log(`Found ${dueItems.length} items due for notification`);

    return new Response(
      JSON.stringify({
        success: true,
        check_date: checkDate,
        total_due: dueItems.length,
        items: dueItems,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in get-due-items:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "حدث خطأ في النظام",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
