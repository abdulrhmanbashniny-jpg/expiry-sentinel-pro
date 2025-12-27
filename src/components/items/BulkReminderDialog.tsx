import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Send, MessageCircle, Loader2, Users, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const [channel, setChannel] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [sending, setSending] = useState(false);

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
    let successCount = 0;
    let failCount = 0;

    try {
      for (const itemId of selectedItems) {
        try {
          const functionName = channel === 'whatsapp' ? 'send-whatsapp' : 'send-telegram';
          const { error } = await supabase.functions.invoke(functionName, {
            body: { item_id: itemId, reminder_type: 'bulk' }
          });

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Failed to send reminder for item ${itemId}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({ 
          title: 'تم إرسال التذكيرات', 
          description: `نجح: ${successCount} | فشل: ${failCount}` 
        });
      }

      if (failCount === selectedItems.length) {
        toast({ title: 'فشل إرسال جميع التذكيرات', variant: 'destructive' });
      }

      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            تذكير جماعي
          </DialogTitle>
          <DialogDescription>
            اختر العناصر وقناة الإرسال لإرسال تذكيرات جماعية
          </DialogDescription>
        </DialogHeader>

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
                <RadioGroupItem value="whatsapp" id="whatsapp" />
                <Label htmlFor="whatsapp" className="flex items-center gap-1 cursor-pointer">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  واتساب
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="telegram" id="telegram" />
                <Label htmlFor="telegram" className="flex items-center gap-1 cursor-pointer">
                  <Send className="h-4 w-4 text-blue-500" />
                  تيليجرام
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
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[300px]">
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

          {/* Summary */}
          {selectedItems.length > 0 && (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                سيتم إرسال {selectedItems.length} تذكير عبر {channel === 'whatsapp' ? 'واتساب' : 'تيليجرام'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSendReminders} disabled={sending || selectedItems.length === 0}>
            {sending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4 ml-2" />
            إرسال ({selectedItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
