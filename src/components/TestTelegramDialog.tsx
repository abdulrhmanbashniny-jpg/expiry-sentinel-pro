import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRecipients } from '@/hooks/useRecipients';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, CheckCircle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TestTelegramDialogProps {
  trigger?: React.ReactNode;
}

const TestTelegramDialog: React.FC<TestTelegramDialogProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [customChatId, setCustomChatId] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('🔔 رسالة اختبار من نظام التنبيهات');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { recipients } = useRecipients();
  const { toast } = useToast();

  // Filter recipients with telegram_id
  const telegramRecipients = recipients.filter(r => r.telegram_id && r.is_active);

  const handleTest = async () => {
    const chatId = selectedRecipient 
      ? recipients.find(r => r.id === selectedRecipient)?.telegram_id 
      : customChatId;

    if (!chatId) {
      toast({ title: 'أدخل Chat ID أو اختر مستلم', variant: 'destructive' });
      return;
    }

    if (!testMessage.trim()) {
      toast({ title: 'أدخل رسالة للاختبار', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-telegram', {
        body: {
          chat_id: chatId,
          message: testMessage,
        }
      });

      if (error) throw error;

      setResult(data);
      toast({ 
        title: data.success ? 'تم إرسال الرسالة بنجاح' : 'فشل الإرسال',
        variant: data.success ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('Test Telegram error:', error);
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
    navigator.clipboard.writeText(testMessage);
    toast({ title: 'تم نسخ الرسالة' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Send className="h-4 w-4" />
            اختبار Telegram
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اختبار إرسال Telegram</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {telegramRecipients.length > 0 && (
            <div className="space-y-2">
              <Label>اختر مستلم (اختياري)</Label>
              <Select value={selectedRecipient} onValueChange={(v) => { setSelectedRecipient(v); setCustomChatId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستلم له Telegram ID" />
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
          )}

          <div className="space-y-2">
            <Label>أو أدخل Chat ID يدوياً</Label>
            <Input 
              value={customChatId} 
              onChange={(e) => { setCustomChatId(e.target.value); setSelectedRecipient(''); }}
              placeholder="123456789"
              dir="ltr"
              disabled={!!selectedRecipient}
            />
            <p className="text-xs text-muted-foreground">
              للحصول على Chat ID، أرسل /start للبوت ثم /mychatid
            </p>
          </div>

          <div className="space-y-2">
            <Label>رسالة الاختبار</Label>
            <Input 
              value={testMessage} 
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="رسالة اختبار..."
            />
          </div>

          <Button 
            onClick={handleTest} 
            disabled={isLoading || (!selectedRecipient && !customChatId)}
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
                إرسال رسالة اختبار
              </>
            )}
          </Button>

          {result?.success && (
            <Card className="border-success/50 bg-success/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">تم إرسال الرسالة بنجاح!</span>
                </div>
                
                <div className="text-sm">
                  <p><strong>Message ID:</strong> {result.message_id}</p>
                </div>

                <Button variant="outline" size="sm" onClick={copyMessage} className="w-full">
                  <Copy className="ml-2 h-4 w-4" />
                  نسخ الرسالة
                </Button>
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

export default TestTelegramDialog;
