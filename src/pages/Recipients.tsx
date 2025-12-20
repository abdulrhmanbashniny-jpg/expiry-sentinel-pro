import React, { useState } from 'react';
import { Plus, Users, Trash2, Edit, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useRecipients } from '@/hooks/useRecipients';

const Recipients: React.FC = () => {
  const { recipients, isLoading, createRecipient, updateRecipient, deleteRecipient } = useRecipients();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState({ name: '', whatsapp_number: '' });
  const [editData, setEditData] = useState({ name: '', whatsapp_number: '' });

  const handleAdd = async () => {
    if (!newRecipient.name || !newRecipient.whatsapp_number) return;
    await createRecipient.mutateAsync(newRecipient);
    setNewRecipient({ name: '', whatsapp_number: '' });
    setIsAdding(false);
  };

  const handleEdit = async (id: string) => {
    await updateRecipient.mutateAsync({ id, ...editData });
    setEditingId(null);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المستلمون</h1>
          <p className="text-muted-foreground">إدارة أرقام الواتساب للتنبيهات</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2" disabled={isAdding}>
          <Plus className="h-4 w-4" />
          إضافة مستلم
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>رقم الواتساب</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isAdding && (
                <tr>
                  <td><Input value={newRecipient.name} onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })} placeholder="الاسم" /></td>
                  <td><Input value={newRecipient.whatsapp_number} onChange={(e) => setNewRecipient({ ...newRecipient, whatsapp_number: e.target.value })} placeholder="+966xxxxxxxxx" dir="ltr" /></td>
                  <td>-</td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={handleAdd}><Check className="h-4 w-4 text-success" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              )}
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td>{editingId === r.id ? <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /> : r.name}</td>
                  <td dir="ltr" className="text-left">{editingId === r.id ? <Input value={editData.whatsapp_number} onChange={(e) => setEditData({ ...editData, whatsapp_number: e.target.value })} dir="ltr" /> : r.whatsapp_number}</td>
                  <td><Switch checked={r.is_active} onCheckedChange={(checked) => updateRecipient.mutate({ id: r.id, is_active: checked })} /></td>
                  <td>
                    <div className="flex gap-1">
                      {editingId === r.id ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(r.id)}><Check className="h-4 w-4 text-success" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => { setEditingId(r.id); setEditData({ name: r.name, whatsapp_number: r.whatsapp_number }); }}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRecipient.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && recipients.length === 0 && !isAdding && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد مستلمون</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Recipients;
