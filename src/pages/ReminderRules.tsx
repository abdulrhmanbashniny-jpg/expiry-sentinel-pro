import React, { useState } from 'react';
import { Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useReminderRules } from '@/hooks/useReminderRules';
import { Badge } from '@/components/ui/badge';

const ReminderRules: React.FC = () => {
  const { rules, isLoading, createRule, updateRule, deleteRule } = useReminderRules();
  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', days: '' });

  const handleAdd = async () => {
    if (!newRule.name || !newRule.days) return;
    const daysArray = newRule.days.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    await createRule.mutateAsync({ name: newRule.name, days_before: daysArray });
    setNewRule({ name: '', days: '' });
    setIsAdding(false);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قواعد التذكير</h1>
          <p className="text-muted-foreground">تحديد أوقات إرسال التنبيهات</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2" disabled={isAdding}>
          <Plus className="h-4 w-4" />
          إضافة قاعدة
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead><tr><th>الاسم</th><th>أيام التذكير</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              {isAdding && (
                <tr>
                  <td><Input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="اسم القاعدة" /></td>
                  <td><Input value={newRule.days} onChange={(e) => setNewRule({ ...newRule, days: e.target.value })} placeholder="30, 14, 7, 3, 1, 0" dir="ltr" /></td>
                  <td>-</td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={handleAdd}><Check className="h-4 w-4 text-success" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              )}
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="font-medium">{rule.name}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {rule.days_before.sort((a, b) => b - a).map((d) => (
                        <Badge key={d} variant="secondary">{d} يوم</Badge>
                      ))}
                    </div>
                  </td>
                  <td><Switch checked={rule.is_active} onCheckedChange={(checked) => updateRule.mutate({ id: rule.id, is_active: checked })} /></td>
                  <td>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReminderRules;
