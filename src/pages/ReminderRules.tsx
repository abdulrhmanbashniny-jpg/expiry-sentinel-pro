import React, { useState } from 'react';
import { Plus, Trash2, Edit, Check, X, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useReminderRules } from '@/hooks/useReminderRules';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const ENTITY_TYPES = [
  { value: 'item', label: 'المعاملات' },
  { value: 'contract', label: 'العقود' },
];

const CHANNELS = [
  { value: 'whatsapp', label: 'واتساب', icon: '📱' },
  { value: 'telegram', label: 'تيليجرام', icon: '✈️' },
  { value: 'email', label: 'البريد الإلكتروني', icon: '📧' },
  { value: 'in_app', label: 'إشعار داخلي', icon: '🔔' },
];

const ReminderRules: React.FC = () => {
  const { rules, isLoading, createRule, updateRule, deleteRule } = useReminderRules();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    days: '',
    target_entity_type: 'item',
    channels: ['whatsapp', 'telegram'] as string[],
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.days) return;
    
    const daysArray = formData.days.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    
    if (editingRule) {
      await updateRule.mutateAsync({
        id: editingRule.id,
        name: formData.name,
        days_before: daysArray,
        description: formData.description,
        target_entity_type: formData.target_entity_type,
        channels: formData.channels,
      } as any);
    } else {
      await createRule.mutateAsync({
        name: formData.name,
        days_before: daysArray,
      });
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', days: '', target_entity_type: 'item', channels: ['whatsapp', 'telegram'] });
    setEditingRule(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      days: rule.days_before.join(', '),
      target_entity_type: rule.target_entity_type || 'item',
      channels: rule.channels || ['whatsapp', 'telegram'],
    });
    setIsDialogOpen(true);
  };

  const toggleChannel = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قواعد التذكير</h1>
          <p className="text-muted-foreground">تحديد أوقات وقنوات إرسال التنبيهات</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => resetForm()}>
              <Plus className="h-4 w-4" />
              إضافة قاعدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'تعديل القاعدة' : 'إضافة قاعدة جديدة'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>اسم القاعدة *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: تذكير افتراضي"
                />
              </div>
              
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف القاعدة (اختياري)"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label>أيام التذكير قبل الانتهاء *</Label>
                <Input
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                  placeholder="30, 14, 7, 3, 1, 0"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">أدخل الأيام مفصولة بفاصلة (مثال: 30, 14, 7, 1, 0)</p>
              </div>
              
              <div className="space-y-2">
                <Label>نوع الكيان</Label>
                <Select
                  value={formData.target_entity_type}
                  onValueChange={(v) => setFormData({ ...formData, target_entity_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>قنوات الإرسال</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map(channel => (
                    <div
                      key={channel.value}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.channels.includes(channel.value)
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => toggleChannel(channel.value)}
                    >
                      <Checkbox
                        checked={formData.channels.includes(channel.value)}
                        onCheckedChange={() => toggleChannel(channel.value)}
                      />
                      <span>{channel.icon}</span>
                      <span className="text-sm">{channel.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={resetForm}>إلغاء</Button>
                <Button onClick={handleSubmit} disabled={createRule.isPending || updateRule.isPending}>
                  <Save className="h-4 w-4 ml-2" />
                  {editingRule ? 'حفظ التغييرات' : 'إضافة'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>أيام التذكير</th>
                <th>القنوات</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">جاري التحميل...</td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا توجد قواعد تذكير
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <div>
                        <span className="font-medium">{rule.name}</span>
                        {(rule as any).description && (
                          <p className="text-xs text-muted-foreground">{(rule as any).description}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge variant="outline">
                        {ENTITY_TYPES.find(t => t.value === ((rule as any).target_entity_type || 'item'))?.label}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {rule.days_before.sort((a, b) => b - a).map((d) => (
                          <Badge key={d} variant="secondary">{d} يوم</Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {((rule as any).channels || ['whatsapp', 'telegram']).map((ch: string) => (
                          <span key={ch} title={CHANNELS.find(c => c.value === ch)?.label}>
                            {CHANNELS.find(c => c.value === ch)?.icon}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={(checked) => updateRule.mutate({ id: rule.id, is_active: checked })}
                      />
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(rule)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteRule.mutate(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReminderRules;
