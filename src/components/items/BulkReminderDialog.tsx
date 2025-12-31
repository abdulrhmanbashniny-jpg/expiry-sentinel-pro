import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Send, MessageCircle, Loader2, Users, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Item {
  id: string;
  title: string;
  ref_number: string | null;
  expiry_date: string;
  responsible_person: string | null;
  department_id: string | null;
}

interface BulkReminderDialogProps {
  items: Item[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SendResult {
  itemId: string;
  itemTitle: string;
  recipientName: string;
  success: boolean;
  error?: string;
}

const EXPIRY_FILTERS = [
  { value: 'today', label: 'تنتهي اليوم', days: 0 },
  { value: '1day', label: 'بعد يوم', days: 1 },
  { value: '3days', label: 'بعد 3 أيام', days: 3 },
  { value: '7days', label: 'بعد 7 أيام', days: 7 },
  { value: '30days', label: 'بعد 30 يوم', days: 30 },
  { value: 'all', label: 'الكل', days: -1 },
];

export default function BulkReminderDialog({ items, open, onOpenChange }: BulkReminderDialogProps) {
  const { toast } = useToast();
  const [expiryFilter, setExpiryFilter] = useState('7days');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [channel, setChannel] = useState<'whatsapp' | 'telegram'>('telegram');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Filter items by expiry date
  const getFilteredItems = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = EXPIRY_FILTERS.find(f => f.value === expiryFilter);
    if (!filter || filter.days === -1) return items;

    return items.filter(item => {
      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= filter.days && diffDays >= 0;
    });
  };

  const filteredItems = getFilteredItems();

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedItems(filteredItems.map(i => i.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleItemSelect = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
      setSelectAll(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleSendReminders = async () => {
    if (selectedItems.length === 0) {
      toast({ title: 'يرجى تحديد عنصر واحد على الأقل', variant: 'destructive' });
      return;
    }

    setSending(true);
    setResults([]);
    setShowResults(false);
    const sendResults: SendResult[] = [];

    try {
      // 1. جلب المستلمين لكل عنصر محدد
      const { data: itemRecipients, error: recipientsError } = await supabase
        .from('item_recipients')
        .select(`
          item_id,
          recipient:recipients(id, name, telegram_id, whatsapp_number, is_active)
        `)
        .in('item_id', selectedItems);

      if (recipientsError) {
        toast({ 
          title: 'خطأ في جلب المستلمين', 
          description: recipientsError.message, 
          variant: 'destructive' 
        });
        setSending(false);
        return;
      }

      // تجميع المستلمين حسب العنصر
      const recipientsByItem = new Map<string, any[]>();
      itemRecipients?.forEach(ir => {
        if (!ir.recipient || !(ir.recipient as any).is_active) return;
        const existing = recipientsByItem.get(ir.item_id) || [];
        existing.push(ir.recipient);
        recipientsByItem.set(ir.item_id, existing);
      });

      // 2. جلب تفاصيل العناصر
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, title, ref_number, expiry_date')
        .in('id', selectedItems);

      const itemsMap = new Map(itemsData?.map(i => [i.id, i]) || []);

      // 3. إرسال التذكيرات
      for (const itemId of selectedItems) {
        const item = itemsMap.get(itemId);
        const recipients = recipientsByItem.get(itemId) || [];
        
        if (recipients.length === 0) {
          sendResults.push({
            itemId,
            itemTitle: item?.title || 'غير معروف',
            recipientName: '-',
            success: false,
            error: 'لا يوجد مستلمين مفعلين لهذا العنصر'
          });
          continue;
        }

        // إرسال لكل مستلم
        for (const recipient of recipients) {
          const daysLeft = getDaysUntilExpiry(item?.expiry_date || '');
          
          // تحضير الرسالة
          const message = `🔔 تذكير: ${item?.title || 'عنصر'}\n` +
            `📋 الرقم: ${item?.ref_number || '-'}\n` +
            `📅 تاريخ الانتهاء: ${item?.expiry_date ? format(new Date(item.expiry_date), 'yyyy-MM-dd') : '-'}\n` +
            `⏰ المتبقي: ${daysLeft <= 0 ? 'منتهي' : `${daysLeft} يوم`}`;

          try {
            if (channel === 'telegram') {
              if (!recipient.telegram_id) {
                sendResults.push({
                  itemId,
                  itemTitle: item?.title || 'غير معروف',
                  recipientName: recipient.name,
                  success: false,
                  error: 'لا يوجد معرف تيليجرام للمستلم'
                });
                continue;
              }

              const { data, error } = await supabase.functions.invoke('send-telegram', {
                body: { 
                  chat_id: recipient.telegram_id, 
                  message 
                }
              });

              if (error || !data?.success) {
                sendResults.push({
                  itemId,
                  itemTitle: item?.title || 'غير معروف',
                  recipientName: recipient.name,
                  success: false,
                  error: data?.error || error?.message || 'فشل الإرسال'
                });
              } else {
                // تسجيل في سجل الإشعارات
                await supabase.from('notification_log').insert({
                  item_id: itemId,
                  recipient_id: recipient.id,
                  reminder_day: daysLeft,
                  scheduled_for: new Date().toISOString(),
                  sent_at: new Date().toISOString(),
                  status: 'sent',
                  provider_message_id: data.message_id?.toString()
                });

                sendResults.push({
                  itemId,
                  itemTitle: item?.title || 'غير معروف',
                  recipientName: recipient.name,
                  success: true
                });
              }
            } else {
              // WhatsApp
              if (!recipient.whatsapp_number) {
                sendResults.push({
                  itemId,
                  itemTitle: item?.title || 'غير معروف',
                  recipientName: recipient.name,
                  success: false,
                  error: 'لا يوجد رقم واتساب للمستلم'
                });
                continue;
              }

              const { data, error } = await supabase.functions.invoke('send-whatsapp', {
                body: { 
                  phone: recipient.whatsapp_number, 
                  message,
                  item_id: itemId,
                  recipient_id: recipient.id
                }
              });

              if (error || !data?.success) {
                sendResults.push({
                  itemId,
                  itemTitle: item?.title || 'غير معروف',
                  recipientName: recipient.name,
                  success: false,
                  error: data?.error || error?.message || 'فشل الإرسال'
                });
              } else {
                sendResults.push({
                  itemId,
                  itemTitle: item?.title || 'غير معروف',
                  recipientName: recipient.name,
                  success: true
                });
              }
            }
          } catch (error: any) {
            sendResults.push({
              itemId,
              itemTitle: item?.title || 'غير معروف',
              recipientName: recipient.name,
              success: false,
              error: error.message || 'خطأ غير متوقع'
            });
          }
        }
      }

      setResults(sendResults);
      setShowResults(true);

      const successCount = sendResults.filter(r => r.success).length;
      const failCount = sendResults.filter(r => !r.success).length;

      if (successCount > 0 && failCount === 0) {
        toast({ 
          title: 'تم إرسال جميع التذكيرات بنجاح', 
          description: `تم إرسال ${successCount} تذكير` 
        });
      } else if (successCount > 0) {
        toast({ 
          title: 'تم إرسال بعض التذكيرات', 
          description: `نجح: ${successCount} | فشل: ${failCount}`,
          variant: 'default'
        });
      } else {
        toast({ 
          title: 'فشل إرسال التذكيرات', 
          description: 'راجع التفاصيل أدناه', 
          variant: 'destructive' 
        });
      }

    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setResults([]);
    setShowResults(false);
    setSelectedItems([]);
    setSelectAll(false);
    onOpenChange(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            تذكير جماعي
          </DialogTitle>
          <DialogDescription>
            اختر العناصر وقناة الإرسال لإرسال تذكيرات جماعية فورية
          </DialogDescription>
        </DialogHeader>

        {showResults ? (
          // نتائج الإرسال
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">{successCount} نجح</span>
                </div>
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">{failCount} فشل</span>
                </div>
              </div>
              <Badge variant={failCount === 0 ? 'default' : 'destructive'}>
                {failCount === 0 ? 'اكتمل بنجاح' : 'يوجد أخطاء'}
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[350px]">
              <div className="space-y-2 pr-4">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success 
                        ? 'bg-success/5 border-success/20' 
                        : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.itemTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        المستلم: {result.recipientName}
                      </p>
                    </div>
                    <div className="text-left">
                      {result.success ? (
                        <Badge variant="outline" className="text-success border-success">
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          تم الإرسال
                        </Badge>
                      ) : (
                        <div className="text-right">
                          <Badge variant="destructive" className="mb-1">
                            <XCircle className="h-3 w-3 ml-1" />
                            فشل
                          </Badge>
                          <p className="text-xs text-destructive max-w-[200px] truncate">
                            {result.error}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          // شاشة الاختيار
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <Label>فلترة حسب الانتهاء:</Label>
              <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_FILTERS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="outline" className="mr-auto">
                {filteredItems.length} عنصر
              </Badge>
            </div>

            {/* Channel Selection */}
            <div className="flex items-center gap-4">
              <Label>قناة الإرسال:</Label>
              <RadioGroup value={channel} onValueChange={(v) => setChannel(v as 'whatsapp' | 'telegram')} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="telegram" id="telegram" />
                  <Label htmlFor="telegram" className="flex items-center gap-1 cursor-pointer">
                    <Send className="h-4 w-4 text-blue-500" />
                    تيليجرام
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="whatsapp" id="whatsapp" />
                  <Label htmlFor="whatsapp" className="flex items-center gap-1 cursor-pointer">
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    واتساب
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Select All */}
            <div className="flex items-center gap-2 py-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium cursor-pointer">
                تحديد الكل ({filteredItems.length})
              </Label>
            </div>

            {/* Items List */}
            <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
              <div className="space-y-2 pr-4">
                {filteredItems.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>لا توجد عناصر تطابق الفلتر المحدد</AlertDescription>
                  </Alert>
                ) : (
                  filteredItems.map(item => {
                    const daysLeft = getDaysUntilExpiry(item.expiry_date);
                    const isSelected = selectedItems.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleItemSelect(item.id, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{item.ref_number || '-'}</span>
                            {item.responsible_person && (
                              <>
                                <span>•</span>
                                <span>{item.responsible_person}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-sm">{format(new Date(item.expiry_date), 'yyyy-MM-dd')}</p>
                          <Badge
                            variant={daysLeft <= 0 ? 'destructive' : daysLeft <= 7 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {daysLeft <= 0 ? 'منتهي' : `${daysLeft} يوم`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Summary */}
            {selectedItems.length > 0 && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  سيتم إرسال تذكيرات لـ {selectedItems.length} عنصر عبر {channel === 'whatsapp' ? 'واتساب' : 'تيليجرام'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {showResults ? (
            <Button onClick={handleClose}>
              إغلاق
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                إلغاء
              </Button>
              <Button onClick={handleSendReminders} disabled={sending || selectedItems.length === 0}>
                {sending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4 ml-2" />
                إرسال الآن ({selectedItems.length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
