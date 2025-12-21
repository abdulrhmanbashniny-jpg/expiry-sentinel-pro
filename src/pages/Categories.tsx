import React, { useState } from 'react';
import { Plus, Trash2, Edit, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategories } from '@/hooks/useCategories';

const Categories: React.FC = () => {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', code: '', description: '' });
  const [editData, setEditData] = useState({ name: '', code: '', description: '' });

  const handleAdd = async () => {
    if (!newCategory.name) return;
    await createCategory.mutateAsync(newCategory);
    setNewCategory({ name: '', code: '', description: '' });
    setIsAdding(false);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفئات</h1>
          <p className="text-muted-foreground">تصنيف العناصر حسب النوع</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2" disabled={isAdding}>
          <Plus className="h-4 w-4" />
          إضافة فئة
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead><tr><th>الكود</th><th>الاسم</th><th>الوصف</th><th>الإجراءات</th></tr></thead>
            <tbody>
              {isAdding && (
                <tr>
                  <td><Input value={newCategory.code} onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })} placeholder="الكود (مثال: LIC)" className="w-20 font-mono" maxLength={5} /></td>
                  <td><Input value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} placeholder="اسم الفئة" /></td>
                  <td><Input value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} placeholder="الوصف (اختياري)" /></td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={handleAdd}><Check className="h-4 w-4 text-success" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}><X className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              )}
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="font-mono text-primary">{editingId === cat.id ? <Input value={editData.code} onChange={(e) => setEditData({ ...editData, code: e.target.value.toUpperCase() })} className="w-20 font-mono" maxLength={5} /> : cat.code || '-'}</td>
                  <td>{editingId === cat.id ? <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /> : cat.name}</td>
                  <td>{editingId === cat.id ? <Input value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} /> : cat.description || '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      {editingId === cat.id ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => { updateCategory.mutate({ id: cat.id, ...editData }); setEditingId(null); }}><Check className="h-4 w-4 text-success" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => { setEditingId(cat.id); setEditData({ name: cat.name, code: cat.code || '', description: cat.description || '' }); }}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteCategory.mutate(cat.id)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && categories.length === 0 && !isAdding && (
                <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد فئات</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Categories;
