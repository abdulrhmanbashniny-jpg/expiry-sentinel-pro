import { supabase } from '@/integrations/supabase/client';

interface SendFinishNotificationParams {
  itemId: string;
  itemTitle: string;
  refNumber?: string;
}

export async function sendFinishNotification({ 
  itemId, 
  itemTitle, 
  refNumber 
}: SendFinishNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Get item recipients
    const { data: itemRecipients, error: recipientsError } = await supabase
      .from('item_recipients')
      .select(`
        recipient:recipients(id, name, telegram_id, whatsapp_number, is_active)
      `)
      .eq('item_id', itemId);

    if (recipientsError) throw recipientsError;

    const activeRecipients = itemRecipients
      ?.map(ir => ir.recipient)
      .filter(r => r && (r as any).is_active) || [];

    if (activeRecipients.length === 0) {
      console.log('No active recipients for finish notification');
      return { success: true };
    }

    // Get integration configs
    const { data: integrations } = await supabase
      .from('integrations')
      .select('key, config, is_active')
      .in('key', ['telegram', 'whatsapp']);

    const telegramConfig = integrations?.find(i => i.key === 'telegram');
    const whatsappConfig = integrations?.find(i => i.key === 'whatsapp');

    // Get item details
    const { data: item } = await supabase
      .from('items')
      .select(`
        title, ref_number, notes, responsible_person,
        category:categories(name),
        department:departments(name)
      `)
      .eq('id', itemId)
      .single();

    // Build finish notification message
    const message = `✅ *تم الانتهاء من المعاملة*

📋 *العنوان:* ${itemTitle}
${refNumber ? `🔢 *رقم المرجع:* ${refNumber}` : ''}
${item?.department ? `🏢 *القسم:* ${(item.department as any).name}` : ''}
${item?.category ? `📂 *الفئة:* ${(item.category as any).name}` : ''}
${item?.responsible_person ? `👤 *المسؤول:* ${item.responsible_person}` : ''}

🔗 *رابط المعاملة:*
https://expiry-sentinel-pro.lovable.app/items/${itemId}

تاريخ الإنهاء: ${new Date().toLocaleDateString('ar-SA')}`;

    // Plain text version for WhatsApp
    const plainMessage = `✅ تم الانتهاء من المعاملة

📋 العنوان: ${itemTitle}
${refNumber ? `🔢 رقم المرجع: ${refNumber}` : ''}
${item?.department ? `🏢 القسم: ${(item.department as any).name}` : ''}
${item?.category ? `📂 الفئة: ${(item.category as any).name}` : ''}
${item?.responsible_person ? `👤 المسؤول: ${item.responsible_person}` : ''}

🔗 رابط المعاملة:
https://expiry-sentinel-pro.lovable.app/items/${itemId}

تاريخ الإنهاء: ${new Date().toLocaleDateString('ar-SA')}`;

    const results = {
      telegram: 0,
      whatsapp: 0,
      errors: [] as string[],
    };

    // Send to each recipient
    for (const recipient of activeRecipients) {
      const r = recipient as any;

      // Try Telegram
      if (r.telegram_id && telegramConfig?.is_active) {
        try {
          const { data, error } = await supabase.functions.invoke('send-telegram', {
            body: {
              chat_id: r.telegram_id,
              message: message,
              parse_mode: 'Markdown',
            },
          });

          if (!error && data?.success) {
            // Log notification
            await supabase.from('notification_log').insert({
              item_id: itemId,
              recipient_id: r.id,
              reminder_day: -1, // -1 indicates finish notification
              scheduled_for: new Date().toISOString(),
              sent_at: new Date().toISOString(),
              status: 'sent',
              channel: 'telegram',
              provider_message_id: data.message_id?.toString(),
            });
            results.telegram++;
          }
        } catch (err: any) {
          results.errors.push(`Telegram ${r.name}: ${err.message}`);
        }
      }

      // Try WhatsApp
      if (r.whatsapp_number && whatsappConfig?.is_active) {
        try {
          const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: r.whatsapp_number,
              message: plainMessage,
              item_id: itemId,
              recipient_id: r.id,
            },
          });

          if (!error && data?.success) {
            results.whatsapp++;
          }
        } catch (err: any) {
          results.errors.push(`WhatsApp ${r.name}: ${err.message}`);
        }
      }
    }

    console.log('Finish notification results:', results);
    return { success: true };

  } catch (error: any) {
    console.error('Error sending finish notification:', error);
    return { success: false, error: error.message };
  }
}
