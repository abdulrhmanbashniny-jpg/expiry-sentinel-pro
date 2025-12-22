import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useRecipients } from '@/hooks/useRecipients';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SendTelegramDialogProps {
  itemId: string;
  itemTitle: string;
  trigger?: React.ReactNode;
}

const SendTelegramDialog: React.FC<SendTelegramDialogProps> = ({ itemId, itemTitle, trigger }) => {
  const [open, setOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [preparedMessage, setPreparedMessage] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const { recipients } = useRecipients();
  const { toast } = useToast();

  // Filter recipients with telegram_id
  const telegramRecipients = recipients.filter(r => r.telegram_id && r.is_active);

  // Prepare message when recipient is selected
  useEffect(() => {
    if (selectedRecipient && itemId) {
      prepareMessage();
    }
  }, [selectedRecipient, itemId]);

  const prepareMessage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('prepare-message', {
        body: { item_id: itemId, recipient_id: selectedRecipient }
      });
      
      if (error) throw error;
      if (data?.message) {
        setPreparedMessage(data.message);
      }
    } catch (error) {
      console.error('Error preparing message:', error);
    }
  };

  const handleSend = async () => {
    const recipient = recipients.find(r => r.id === selectedRecipient);
    if (!recipient?.telegram_id) {
      toast({ title: 'المستلم ليس لديه Telegram ID', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const messageToSend = preparedMessage || `🔔 تذكير بخصوص: ${itemTitle}`;
      
      const { data, error } = await supabase.functions.invoke('send-telegram', {
        body: {
          chat_id: recipient.telegram_id,
          message: messageToSend,
        }
      });

      if (error) throw error;

      setResult(data);
      toast({ 
        title: data.success ? 'تم إرسال الرسالة بنجاح' : 'فشل الإرسال',
        variant: data.success ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('Send Telegram error:', error);
      toast({
        title: 'خطأ في الإرسال',
        description: error instanceof Error ? error.message : 'حدث خطأ',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="icon" variant="ghost" title="إرسال عبر Telegram">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إرسال تذكير عبر Telegram</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">{itemTitle}</p>
          </div>

          {telegramRecipients.length === 0 ? (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-warning">لا يوجد مستلمين لديهم Telegram ID</p>
                <p className="text-xs text-muted-foreground mt-1">قم بإضافة Telegram ID للمستلمين أولاً</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                <Label>اختر المستلم</Label>
                <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مستلم" />
                  </SelectTrigger>
                  <SelectContent>
                    {telegramRecipients.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        {recipient.name} ({recipient.telegram_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {preparedMessage && (
                <div className="space-y-2">
                  <Label>نص الرسالة</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {preparedMessage}
                  </div>
                </div>
              )}

              <Button 
                onClick={handleSend} 
                disabled={isLoading || !selectedRecipient}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="ml-2 h-4 w-4" />
                    إرسال الآن
                  </>
                )}
              </Button>
            </>
          )}

          {result?.success && (
            <Card className="border-success/50 bg-success/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">تم إرسال الرسالة بنجاح!</span>
                </div>
              </CardContent>
            </Card>
          )}

          {result && !result.success && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-sm text-destructive">{result.error}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendTelegramDialog;
