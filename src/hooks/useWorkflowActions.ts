import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { WorkflowStatus, WORKFLOW_STATUS_LABELS } from '@/hooks/useDashboardData';
import { sendFinishNotification } from '@/hooks/useFinishNotification';

export type { WorkflowStatus };
export { WORKFLOW_STATUS_LABELS };

// Workflow transitions based on role
export const WORKFLOW_TRANSITIONS: Record<string, {
  from: WorkflowStatus[];
  to: WorkflowStatus;
  label: string;
  requiresReason?: boolean;
  allowedRoles: ('employee' | 'supervisor' | 'admin' | 'system_admin')[];
}> = {
  acknowledge: {
    from: ['new'],
    to: 'acknowledged',
    label: 'تم الاستلام',
    allowedRoles: ['employee', 'supervisor', 'admin', 'system_admin'],
  },
  start: {
    from: ['acknowledged'],
    to: 'in_progress',
    label: 'بدأ التنفيذ',
    allowedRoles: ['employee', 'supervisor', 'admin', 'system_admin'],
  },
  done: {
    from: ['in_progress'],
    to: 'done_pending_supervisor',
    label: 'تم الإنجاز',
    allowedRoles: ['employee', 'supervisor', 'admin', 'system_admin'],
  },
  approve: {
    from: ['done_pending_supervisor'],
    to: 'finished',
    label: 'اعتماد وإنهاء',
    allowedRoles: ['supervisor', 'admin', 'system_admin'],
  },
  return: {
    from: ['done_pending_supervisor', 'escalated_to_manager'],
    to: 'returned',
    label: 'إرجاع',
    requiresReason: true,
    allowedRoles: ['supervisor', 'admin', 'system_admin'],
  },
  escalate: {
    from: ['done_pending_supervisor'],
    to: 'escalated_to_manager',
    label: 'تصعيد للمدير',
    requiresReason: true,
    allowedRoles: ['supervisor'],
  },
  manager_close: {
    from: ['escalated_to_manager'],
    to: 'finished',
    label: 'إنهاء (المدير)',
    allowedRoles: ['admin', 'system_admin'],
  },
  resubmit: {
    from: ['returned'],
    to: 'in_progress',
    label: 'إعادة التقديم',
    allowedRoles: ['employee', 'supervisor', 'admin', 'system_admin'],
  },
};

// Get available actions for a given status and role
export const getAvailableActions = (
  currentStatus: WorkflowStatus,
  userRole: string | null
): { action: string; label: string; requiresReason: boolean; variant: 'default' | 'destructive' | 'outline' | 'secondary' }[] => {
  if (!userRole) return [];

  const roleMapping: Record<string, ('employee' | 'supervisor' | 'admin' | 'system_admin')[]> = {
    employee: ['employee'],
    supervisor: ['supervisor'],
    admin: ['admin'],
    system_admin: ['system_admin'],
    hr_user: ['employee'], // Map hr_user to employee level
  };

  const userRoles = roleMapping[userRole] || [];

  const actions = Object.entries(WORKFLOW_TRANSITIONS)
    .filter(([_, transition]) => {
      const statusMatch = transition.from.includes(currentStatus);
      const roleMatch = transition.allowedRoles.some(r => userRoles.includes(r) || 
        (userRole === 'system_admin') || 
        (userRole === 'admin' && r !== 'system_admin'));
      return statusMatch && roleMatch;
    })
    .map(([action, transition]) => ({
      action,
      label: transition.label,
      requiresReason: transition.requiresReason || false,
      variant: getActionVariant(action),
    }));

  return actions;
};

const getActionVariant = (action: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
  switch (action) {
    case 'approve':
    case 'manager_close':
      return 'default';
    case 'return':
      return 'destructive';
    case 'escalate':
      return 'secondary';
    default:
      return 'outline';
  }
};

// Check if an action is blocked by guard rails
export const isActionBlocked = (
  action: string,
  currentStatus: WorkflowStatus
): { blocked: boolean; message: string } => {
  // Guard Rail: Cannot mark as done before starting
  if (action === 'done' && currentStatus !== 'in_progress') {
    return {
      blocked: true,
      message: 'لا يمكن وضع علامة "تم الإنجاز" قبل "بدأ التنفيذ"',
    };
  }

  return { blocked: false, message: '' };
};

// Hook to update workflow status
export const useWorkflowAction = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      itemId,
      action,
      reason,
      completionDescription,
      completionAttachmentUrl,
    }: {
      itemId: string;
      action: string;
      reason?: string;
      completionDescription?: string;
      completionAttachmentUrl?: string;
    }) => {
      const transition = WORKFLOW_TRANSITIONS[action];
      if (!transition) {
        throw new Error('إجراء غير صالح');
      }

      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('يجب تسجيل الدخول');
      }

      // Get current item status
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('workflow_status')
        .eq('id', itemId)
        .single();

      if (itemError) throw itemError;

      const currentStatus = item.workflow_status as WorkflowStatus;

      // Validate transition
      if (!transition.from.includes(currentStatus)) {
        throw new Error(`لا يمكن تنفيذ "${transition.label}" من الحالة الحالية`);
      }

      // Guard Rail check
      const guardCheck = isActionBlocked(action, currentStatus);
      if (guardCheck.blocked) {
        throw new Error(guardCheck.message);
      }

      // Prepare update data
      const updateData: Record<string, any> = { workflow_status: transition.to };
      
      // Add completion proof if provided (for 'done' action)
      if (action === 'done') {
        if (completionDescription) {
          updateData.completion_description = completionDescription;
        }
        if (completionAttachmentUrl) {
          updateData.completion_attachment_url = completionAttachmentUrl;
        }
        updateData.completion_date = new Date().toISOString();
        updateData.completed_by_user_id = userData.user.id;
      }

      // Update item workflow status
      const { error: updateError } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', itemId);

      if (updateError) throw updateError;

      if (updateError) throw updateError;

      // Log to item_status_log
      const { error: logError } = await supabase
        .from('item_status_log')
        .insert({
          item_id: itemId,
          old_status: currentStatus,
          new_status: transition.to,
          reason: reason || null,
          channel: 'web',
          changed_by_user_id: userData.user.id,
        });

      if (logError) {
        console.error('Error logging status change:', logError);
      }

      // Send finish notification if status is now 'finished'
      if (transition.to === 'finished') {
        console.log('Sending finish notification for item:', itemId);
        const { data: itemData } = await supabase
          .from('items')
          .select('title, ref_number')
          .eq('id', itemId)
          .single();
        
        if (itemData) {
          await sendFinishNotification({
            itemId,
            itemTitle: itemData.title,
            refNumber: itemData.ref_number || undefined,
          });
        }
      }

      return { newStatus: transition.to };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['item-timeline', variables.itemId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-activity'] });
      
      const transition = WORKFLOW_TRANSITIONS[variables.action];
      toast({
        title: 'تم بنجاح',
        description: `تم تنفيذ "${transition?.label}" بنجاح`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Hook to get item timeline
export const useItemTimeline = (itemId: string) => {
  return useQuery({
    queryKey: ['item-timeline', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_status_log')
        .select('*')
        .eq('item_id', itemId)
        .order('changed_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get user info for changers
      const userIds = [...new Set(data?.map(d => d.changed_by_user_id).filter(Boolean) || [])];
      
      let usersMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        profiles?.forEach(p => {
          usersMap.set(p.user_id, p.full_name || p.email || 'مستخدم');
        });
      }

      return data?.map(log => ({
        ...log,
        changed_by_name: log.changed_by_user_id 
          ? usersMap.get(log.changed_by_user_id) || 'مستخدم'
          : 'النظام',
      })) || [];
    },
    enabled: !!itemId,
  });
};
