import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useRecipients } from '@/hooks/useRecipients';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Loader2, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TestWhatsAppDialogProps {
  itemId: string;
  itemTitle: string;
  assignedRecipientIds?: string[];
}

const TestWhatsAppDialog: React.FC<TestWhatsAppDialogProps> = ({ 
  itemId, 
  itemTitle,
  assignedRecipientIds = []
}) => {
  const [open, setOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { recipients } = useRecipients();
  const { toast } = useToast();

  // Filter to show only assigned recipients if available
  const availableRecipients = assignedRecipientIds.length > 0
    ? recipients.filter(r => assignedRecipientIds.includes(r.id) && r.is_active)
    : recipients.filter(r => r.is_active);

  const handleTest = async () => {
    if (!selectedRecipient) {
      toast({ title: 'اختر مستلم', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-whatsapp', {
        body: {
          item_id: itemId,
          recipient_id: selectedRecipient,
        }
      });

      if (error) throw error;

      setResult(data);
      toast({ 
        title: 'تم إعداد الرسالة بنجاح',
        description: 'يمكنك نسخ الرسالة أو إرسالها عبر n8n'
      });
    } catch (error) {
      console.error('Test WhatsApp error:', error);
      toast({
        title: 'خطأ في اختبار الإرسال',
        description: error instanceof Error ? error.message : 'حدث خطأ',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = () => {
    if (result?.data?.message) {
      navigator.clipboard.writeText(result.data.message);
      toast({ title: 'تم نسخ الرسالة' });
    }
  };

  const openWhatsApp = () => {
    if (result?.data?.webhook_payload?.phone && result?.data?.message) {
      const phone = result.data.webhook_payload.phone.replace('+', '');
      const message = encodeURIComponent(result.data.message);
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          اختبار واتساب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اختبار إرسال واتساب</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            العنصر: <span className="font-medium text-foreground">{itemTitle}</span>
          </div>

          <div className="space-y-2">
            <Label>اختر المستلم</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger>
                <SelectValue placeholder="اختر مستلم للاختبار" />
              </SelectTrigger>
              <SelectContent>
                {availableRecipients.map((recipient) => (
                  <SelectItem key={recipient.id} value={recipient.id}>
                    {recipient.name} ({recipient.whatsapp_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableRecipients.length === 0 && (
            <p className="text-sm text-muted-foreground">
              لا يوجد مستلمون مرتبطون بهذا العنصر. أضف مستلمين أولاً.
            </p>
          )}

          <Button 
            onClick={handleTest} 
            disabled={isLoading || !selectedRecipient}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الاختبار...
              </>
            ) : (
              'اختبار الإرسال'
            )}
          </Button>

          {result?.success && (
            <Card className="border-success/50 bg-success/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">تم إعداد الرسالة بنجاح</span>
                </div>
                
                <div className="text-sm space-y-1">
                  <p><strong>المستلم:</strong> {result.data.recipient.name}</p>
                  <p><strong>الرقم:</strong> {result.data.recipient.whatsapp_number}</p>
                  <p><strong>الأيام المتبقية:</strong> {result.data.item.days_left} يوم</p>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                  {result.data.message}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyMessage} className="flex-1">
                    <Copy className="ml-2 h-4 w-4" />
                    نسخ الرسالة
                  </Button>
                  <Button variant="default" size="sm" onClick={openWhatsApp} className="flex-1">
                    <ExternalLink className="ml-2 h-4 w-4" />
                    فتح واتساب
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TestWhatsAppDialog;
