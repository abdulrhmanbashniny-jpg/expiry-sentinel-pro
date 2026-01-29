import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

type NotificationChannel = 'whatsapp' | 'telegram' | 'email' | 'in_app';
type NotificationType = 'reminder' | 'invitation' | 'alert' | 'system';

interface NotificationRecipient {
  user_id?: string;
  profile_id?: string;
  recipient_id?: string;
  name: string;
  phone?: string;
  email?: string;
  telegram_id?: string;
}

interface SendNotificationParams {
  type: NotificationType;
  channels: NotificationChannel[];
  recipient: NotificationRecipient;
  data: Record<string, any>;
  template_key?: string;
  item_id?: string;
  priority?: 'low' | 'normal' | 'high';
}

interface NotificationResult {
  success: boolean;
  results: Array<{
    channel: string;
    success: boolean;
    message_id?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

/**
 * Hook for sending notifications through the unified notification service
 */
export function useNotificationService() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const sendNotification = useMutation({
    mutationFn: async (params: SendNotificationParams): Promise<NotificationResult> => {
      const { data, error } = await supabase.functions.invoke('unified-notification', {
        body: {
          ...params,
          tenant_id: currentTenant?.id,
        },
      });

      if (error) throw error;
      return data as NotificationResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'تم الإرسال',
          description: `نجح ${result.summary.success} من ${result.summary.total} قنوات`,
        });
      } else {
        toast({
          title: 'فشل الإرسال',
          description: 'لم يتم إرسال الإشعار على أي قناة',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ في الإرسال',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  /**
   * Send reminder notification to a recipient
   */
  const sendReminder = async (params: {
    recipient: NotificationRecipient;
    item: {
      id: string;
      title: string;
      ref_number?: string;
      expiry_date: string;
      days_left: number;
      category?: string;
      department?: string;
    };
    channels?: NotificationChannel[];
  }) => {
    const { recipient, item, channels = ['telegram', 'whatsapp', 'in_app'] } = params;
    
    const remainingText = item.days_left === 0 ? 'اليوم' : 
                          item.days_left === 1 ? 'غداً' : 
                          `${item.days_left} يوم`;

    return sendNotification.mutateAsync({
      type: 'reminder',
      channels,
      recipient,
      item_id: item.id,
      data: {
        title: item.title,
        item_title: item.title,
        ref_number: item.ref_number || '-',
        expiry_date: item.expiry_date,
        days_left: item.days_left,
        remaining_text: remainingText,
        category_name: item.category || '-',
        department_name: item.department || '-',
        item_url: `${window.location.origin}/items/${item.id}`,
        notification_title: `تذكير: ${item.title}`,
        notification_message: `متبقي ${remainingText} على انتهاء الصلاحية`,
      },
    });
  };

  /**
   * Send invitation notification to a new user
   */
  const sendInvitation = async (params: {
    recipient: NotificationRecipient;
    company: {
      name: string;
      code: string;
    };
    activation_link: string;
    channels?: NotificationChannel[];
  }) => {
    const { recipient, company, activation_link, channels = ['whatsapp', 'in_app'] } = params;

    return sendNotification.mutateAsync({
      type: 'invitation',
      channels,
      recipient,
      template_key: 'user_invitation',
      data: {
        company_name: company.name,
        company_code: company.code,
        activation_link,
        notification_title: `دعوة للانضمام إلى ${company.name}`,
        notification_message: `تم دعوتك للانضمام إلى منصة HR Reminder`,
      },
    });
  };

  /**
   * Send alert notification (urgent)
   */
  const sendAlert = async (params: {
    recipient: NotificationRecipient;
    title: string;
    message: string;
    action_url?: string;
    channels?: NotificationChannel[];
  }) => {
    const { recipient, title, message, action_url, channels = ['telegram', 'whatsapp', 'in_app'] } = params;

    return sendNotification.mutateAsync({
      type: 'alert',
      channels,
      recipient,
      priority: 'high',
      data: {
        notification_title: title,
        notification_message: message,
        action_url,
      },
    });
  };

  return {
    sendNotification,
    sendReminder,
    sendInvitation,
    sendAlert,
    isLoading: sendNotification.isPending,
  };
}

/**
 * Get available channels for a recipient based on their contact info
 */
export function getAvailableChannels(recipient: NotificationRecipient): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  
  if (recipient.phone) channels.push('whatsapp');
  if (recipient.telegram_id) channels.push('telegram');
  if (recipient.email) channels.push('email');
  if (recipient.user_id || recipient.profile_id) channels.push('in_app');
  
  return channels;
}
