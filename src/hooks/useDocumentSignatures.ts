import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type SignatureStatus = 'pending' | 'signed' | 'rejected' | 'expired';

export interface DocumentSignature {
  id: string;
  tenant_id: string | null;
  document_title: string;
  document_url: string;
  document_hash: string | null;
  requester_id: string;
  status: string;
  expires_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SignatureRequest {
  id: string;
  document_id: string;
  signer_id: string;
  signer_name: string | null;
  signer_email: string | null;
  sign_order: number;
  status: SignatureStatus;
  signed_at: string | null;
  signature_data: string | null;
  ip_address: string | null;
  user_agent: string | null;
  rejection_reason: string | null;
  reminded_at: string | null;
  created_at: string;
}

export function useDocumentSignatures() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const documentsQuery = useQuery({
    queryKey: ['document-signatures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_signatures')
        .select('*, signature_requests(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (DocumentSignature & { signature_requests: SignatureRequest[] })[];
    },
  });

  const createDocument = useMutation({
    mutationFn: async (doc: {
      title: string;
      documentUrl: string;
      signers: { id: string; name: string; email?: string; order: number }[];
      expiresAt?: string;
    }) => {
      // إنشاء المستند
      const { data: document, error: docError } = await supabase
        .from('document_signatures')
        .insert({
          document_title: doc.title,
          document_url: doc.documentUrl,
          requester_id: user?.id,
          expires_at: doc.expiresAt,
        })
        .select()
        .single();

      if (docError) throw docError;

      // إنشاء طلبات التوقيع
      const signatureRequests = doc.signers.map(signer => ({
        document_id: document.id,
        signer_id: signer.id,
        signer_name: signer.name,
        signer_email: signer.email,
        sign_order: signer.order,
      }));

      const { error: sigError } = await supabase
        .from('signature_requests')
        .insert(signatureRequests);

      if (sigError) throw sigError;

      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-signatures'] });
      toast({ title: 'تم الإرسال', description: 'تم إرسال المستند للتوقيع' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const signDocument = useMutation({
    mutationFn: async ({ requestId, signatureData }: { requestId: string; signatureData: string }) => {
      const { error } = await supabase
        .from('signature_requests')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_data: signatureData,
          ip_address: 'client', // يمكن الحصول عليه من API
          user_agent: navigator.userAgent,
        })
        .eq('id', requestId);

      if (error) throw error;

      // التحقق إذا اكتملت كل التوقيعات
      const { data: requests } = await supabase
        .from('signature_requests')
        .select('*')
        .eq('document_id', requestId);

      // يمكن تحديث حالة المستند الرئيسي إذا اكتملت كل التوقيعات
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['pending-signatures'] });
      toast({ title: 'تم التوقيع', description: 'تم توقيع المستند بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const rejectSignature = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase
        .from('signature_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason,
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-signatures'] });
      queryClient.invalidateQueries({ queryKey: ['pending-signatures'] });
      toast({ title: 'تم الرفض', description: 'تم رفض التوقيع' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  return {
    documents: documentsQuery.data || [],
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    createDocument,
    signDocument,
    rejectSignature,
  };
}

// التوقيعات المطلوبة من المستخدم الحالي
export function usePendingSignatures() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-signatures', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('signature_requests')
        .select('*, document:document_signatures(*)')
        .eq('signer_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as (SignatureRequest & { document: DocumentSignature })[];
    },
    enabled: !!user?.id,
  });
}
