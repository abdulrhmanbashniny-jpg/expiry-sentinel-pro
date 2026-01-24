import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ItemPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isCreator: boolean;
  isRecipient: boolean;
}

export const useItemPermissions = (itemId: string | undefined, itemCreatorId?: string | null) => {
  const { user, role, isAdmin, isSystemAdmin, isSupervisor } = useAuth();
  
  // Check if user is a recipient of the item
  const { data: isRecipientData, isLoading } = useQuery({
    queryKey: ['item-recipient-check', itemId, user?.id],
    queryFn: async () => {
      if (!itemId || !user?.id) return false;
      
      // Check if user is linked via item_recipients (through profiles with matching user_id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile) return false;
      
      // Check if user's profile is in recipients for this item
      const { data: recipientLink } = await supabase
        .from('item_recipients')
        .select(`
          id,
          recipient:recipients!inner(
            id,
            phone,
            whatsapp_number
          )
        `)
        .eq('item_id', itemId);
      
      // Also check if user's phone matches any recipient
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .single();
      
      if (!userProfile?.phone || !recipientLink) return false;
      
      // Check if user's phone matches any recipient's phone
      return recipientLink.some((link: any) => {
        const recipientPhone = link.recipient?.whatsapp_number || link.recipient?.phone;
        return recipientPhone && userProfile.phone && 
               (recipientPhone.includes(userProfile.phone) || userProfile.phone.includes(recipientPhone));
      });
    },
    enabled: !!itemId && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const isRecipient = !!isRecipientData;
  const isCreator = !!user?.id && !!itemCreatorId && user.id === itemCreatorId;
  
  // Permission logic:
  // - System Admin / Admin: Full access to everything
  // - Supervisor: Can edit their team's items
  // - Creator: Can edit their own items
  // - Recipient (not creator): View only
  // - Employee: Can view their own items only
  
  const permissions: ItemPermissions = {
    canView: true, // If they can see the item at all, they can view it
    canEdit: isSystemAdmin || isAdmin || isSupervisor || isCreator,
    canDelete: isSystemAdmin || isAdmin,
    isCreator,
    isRecipient,
  };
  
  // If user is only a recipient (not creator, not admin/supervisor), restrict to view only
  if (isRecipient && !isCreator && !isAdmin && !isSystemAdmin && !isSupervisor) {
    permissions.canEdit = false;
    permissions.canDelete = false;
  }
  
  return {
    ...permissions,
    isLoading,
  };
};

// Hook to check permissions for a list of items
export const useItemsPermissions = () => {
  const { user, isAdmin, isSystemAdmin, isSupervisor } = useAuth();
  
  const checkPermissions = (itemCreatorId: string | null): ItemPermissions => {
    const isCreator = !!user?.id && !!itemCreatorId && user.id === itemCreatorId;
    
    return {
      canView: true,
      canEdit: isSystemAdmin || isAdmin || isSupervisor || isCreator,
      canDelete: isSystemAdmin || isAdmin,
      isCreator,
      isRecipient: false, // Would need async check per item
    };
  };
  
  return { checkPermissions };
};
