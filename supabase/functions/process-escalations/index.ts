import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EscalationLog {
  id: string;
  tenant_id: string;
  notification_id: string | null;
  item_id: string;
  original_recipient_id: string;
  escalation_level: number;
  current_recipient_id: string;
  previous_recipient_id: string | null;
  status: string;
  next_escalation_at: string;
}

interface EscalationRule {
  escalation_level: number;
  delay_hours: number;
  recipient_role: string;
  notification_channels: string[];
  message_template: string;
}

const LEVEL_NAMES = ['الموظف', 'المشرف', 'المدير', 'المدير العام', 'الموارد البشرية'];
const LEVEL_NAMES_EN = ['Employee', 'Supervisor', 'Manager', 'Director', 'HR'];

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('=== بدء معالجة التصعيدات ===');
  const startTime = Date.now();
  let processedCount = 0;
  let escalatedCount = 0;
  let errorCount = 0;

  try {
    // 1. جلب التصعيدات المعلقة التي تجاوزت وقت التصعيد
    const now = new Date().toISOString();
    const { data: pendingEscalations, error: fetchError } = await supabase
      .from('escalation_log')
      .select('*')
      .eq('status', 'pending')
      .lte('next_escalation_at', now)
      .order('next_escalation_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      throw new Error(`خطأ في جلب التصعيدات: ${fetchError.message}`);
    }

    console.log(`تم العثور على ${pendingEscalations?.length || 0} تصعيد معلق`);

    if (!pendingEscalations || pendingEscalations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'لا توجد تصعيدات معلقة',
          processed: 0,
          escalated: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. معالجة كل تصعيد
    for (const escalation of pendingEscalations as EscalationLog[]) {
      processedCount++;

      try {
        const nextLevel = escalation.escalation_level + 1;

        // التحقق من الحد الأقصى للتصعيد (4 = HR)
        if (nextLevel > 4) {
          // تحديث الحالة إلى "منتهي" - لا مزيد من التصعيد
          await supabase
            .from('escalation_log')
            .update({
              status: 'expired',
              escalation_reason: 'تم الوصول للحد الأقصى من مستويات التصعيد',
              updated_at: now,
            })
            .eq('id', escalation.id);
          
          console.log(`التصعيد ${escalation.id} وصل للحد الأقصى`);
          continue;
        }

        // 3. جلب قاعدة التصعيد للمستوى التالي
        const { data: rules } = await supabase
          .from('escalation_rules')
          .select('*')
          .eq('escalation_level', nextLevel)
          .eq('is_active', true)
          .or(`tenant_id.eq.${escalation.tenant_id},tenant_id.is.null`)
          .order('tenant_id', { ascending: false, nullsFirst: false })
          .limit(1);

        const rule = (rules && rules[0]) as EscalationRule | undefined;
        if (!rule) {
          console.log(`لا توجد قاعدة تصعيد للمستوى ${nextLevel}`);
          continue;
        }

        // 4. الحصول على المستقبل التالي
        const { data: nextRecipient } = await supabase
          .rpc('get_next_escalation_recipient', {
            p_tenant_id: escalation.tenant_id,
            p_employee_id: escalation.original_recipient_id,
            p_current_level: escalation.escalation_level,
          });

        if (!nextRecipient) {
          console.log(`لا يوجد مستقبل للتصعيد في المستوى ${nextLevel} للموظف ${escalation.original_recipient_id}`);
          
          // تحديث الحالة - لا يوجد من يستلم
          await supabase
            .from('escalation_log')
            .update({
              status: 'expired',
              escalation_reason: `لا يوجد ${LEVEL_NAMES[nextLevel]} معين`,
              updated_at: now,
            })
            .eq('id', escalation.id);
          continue;
        }

        // 5. جلب تفاصيل المعاملة والموظف
        const { data: itemData } = await supabase
          .from('items')
          .select(`
            title, ref_number, expiry_date,
            category:categories(name),
            department:departments(name)
          `)
          .eq('id', escalation.item_id)
          .single();

        const { data: employeeData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', escalation.original_recipient_id)
          .single();

        const { data: previousRecipientData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', escalation.current_recipient_id)
          .single();

        // جلب سلسلة التصعيد السابقة لبناء ملخص
        const { data: escalationChain } = await supabase
          .from('escalation_log')
          .select('escalation_level, current_recipient_id, status, created_at, escalated_at')
          .eq('item_id', escalation.item_id)
          .eq('original_recipient_id', escalation.original_recipient_id)
          .order('escalation_level', { ascending: true });

        // بناء ملخص من لم يستجب
        const unacknowledgedLevels: string[] = [];
        if (escalationChain) {
          for (const entry of escalationChain) {
            if (entry.status === 'escalated' || entry.status === 'expired') {
              unacknowledgedLevels.push(LEVEL_NAMES[entry.escalation_level] || `المستوى ${entry.escalation_level}`);
            }
          }
        }

        // 6. تحديث السجل الحالي كـ "مصعّد"
        await supabase
          .from('escalation_log')
          .update({
            status: 'escalated',
            escalated_at: now,
            escalation_reason: `لم يستجب خلال ${rule.delay_hours} ساعة`,
            updated_at: now,
          })
          .eq('id', escalation.id);

        // 7. إنشاء سجل تصعيد جديد للمستوى التالي
        const nextEscalationTime = new Date();
        nextEscalationTime.setHours(nextEscalationTime.getHours() + rule.delay_hours);

        const { error: insertError } = await supabase
          .from('escalation_log')
          .insert({
            tenant_id: escalation.tenant_id,
            notification_id: escalation.notification_id,
            item_id: escalation.item_id,
            original_recipient_id: escalation.original_recipient_id,
            escalation_level: nextLevel,
            current_recipient_id: nextRecipient,
            previous_recipient_id: escalation.current_recipient_id,
            status: 'pending',
            next_escalation_at: nextEscalationTime.toISOString(),
          });

        if (insertError) {
          console.error(`خطأ في إنشاء سجل التصعيد: ${insertError.message}`);
          errorCount++;
          continue;
        }

        // 8. بناء رسالة التصعيد الاحترافية
        const messageTitle = `🚨 تصعيد (${LEVEL_NAMES[nextLevel]}) - المستوى ${nextLevel}`;
        
        // استبدال المتغيرات في قالب الرسالة
        let ruleMessage = (rule.message_template || 'معاملة تحتاج متابعتك')
          .replace('{employee_name}', employeeData?.full_name || 'موظف')
          .replace('{supervisor_name}', previousRecipientData?.full_name || 'المسؤول السابق')
          .replace('{item_title}', itemData?.title || 'معاملة')
          .replace('{item_ref}', itemData?.ref_number || '');

        // بناء الرسالة الكاملة مع التفاصيل
        const itemDept = (itemData?.department as any)?.name || '-';
        const itemCat = (itemData?.category as any)?.name || '-';
        const itemRef = itemData?.ref_number || '-';
        const itemExpiry = itemData?.expiry_date || '-';
        const PUBLISHED_APP_URL = 'https://expiry-sentinel-pro.lovable.app';

        const chainSummary = unacknowledgedLevels.length > 0
          ? `❌ لم يستجب: ${unacknowledgedLevels.join(' ← ')}`
          : '';

        const messageBody = `${ruleMessage}

📋 تفاصيل المعاملة:
📁 العنوان: ${itemData?.title || '-'}
🔢 المرجع: ${itemRef}
🏢 القسم: ${itemDept}
📂 الفئة: ${itemCat}
📅 تاريخ الاستحقاق: ${itemExpiry}
👤 الموظف الأصلي: ${employeeData?.full_name || '-'}

${chainSummary}

🔗 رابط المعاملة:
${PUBLISHED_APP_URL}/items/${escalation.item_id}`;

        // إنشاء إشعار in_app
        await supabase.from('in_app_notifications').insert({
          tenant_id: escalation.tenant_id,
          user_id: nextRecipient,
          entity_id: escalation.item_id,
          entity_type: 'item',
          notification_type: 'escalation',
          title: messageTitle,
          message: messageBody,
          priority: nextLevel >= 3 ? 'critical' : 'high',
          action_url: `/items/${escalation.item_id}`,
        });

        // 9. إرسال إشعارات عبر القنوات المحددة
        const fullMessage = `${messageTitle}\n\n${messageBody}`;

        if (rule.notification_channels.includes('whatsapp') || rule.notification_channels.includes('telegram')) {
          // جلب بيانات المستقبل
          const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('phone, telegram_user_id, allow_whatsapp, allow_telegram')
            .eq('user_id', nextRecipient)
            .single();

          if (recipientProfile) {
            // إرسال WhatsApp
            if (rule.notification_channels.includes('whatsapp') && recipientProfile.allow_whatsapp && recipientProfile.phone) {
              try {
                await supabase.functions.invoke('send-whatsapp', {
                  body: {
                    phone: recipientProfile.phone,
                    message: fullMessage,
                    tenantId: escalation.tenant_id,
                  },
                });
                console.log(`✅ WhatsApp escalation sent to level ${nextLevel}`);
              } catch (e) {
                console.error('خطأ في إرسال WhatsApp:', e);
              }
            }

            // إرسال Telegram
            if (rule.notification_channels.includes('telegram') && recipientProfile.allow_telegram && recipientProfile.telegram_user_id) {
              try {
                await supabase.functions.invoke('send-telegram', {
                  body: {
                    chat_id: recipientProfile.telegram_user_id,
                    message: fullMessage,
                    tenantId: escalation.tenant_id,
                  },
                });
                console.log(`✅ Telegram escalation sent to level ${nextLevel}`);
              } catch (e) {
                console.error('خطأ في إرسال Telegram:', e);
              }
            }
          }
        }

        escalatedCount++;
        console.log(`✅ تم تصعيد المعاملة ${escalation.item_id} للمستوى ${nextLevel} (${LEVEL_NAMES[nextLevel]})`);

      } catch (error) {
        console.error(`خطأ في معالجة التصعيد ${escalation.id}:`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`=== انتهت المعالجة: ${processedCount} معالج، ${escalatedCount} مصعّد، ${errorCount} خطأ (${duration}ms) ===`);

    // تسجيل في automation_runs
    await supabase.from('automation_runs').insert({
      job_type: 'process_escalations',
      status: errorCount > 0 ? 'partial' : 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: now,
      duration_ms: duration,
      items_processed: processedCount,
      items_success: escalatedCount,
      items_failed: errorCount,
      results: {
        escalated: escalatedCount,
        errors: errorCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `تمت معالجة ${processedCount} تصعيد، ${escalatedCount} تم تصعيده`,
        processed: processedCount,
        escalated: escalatedCount,
        errors: errorCount,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('خطأ عام في معالجة التصعيدات:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
