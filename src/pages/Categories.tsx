import React, { useState } from 'react';
import { Plus, Trash2, Edit, Check, X, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import { useDepartments } from '@/hooks/useDepartments';

const Categories: React.FC = () => {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const { departments } = useDepartments();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', code: '', description: '', department_id: '' });
  const [editData, setEditData] = useState({ name: '', code: '', description: '', department_id: '' });

  const handleAdd = async () => {
    if (!newCategory.name) return;
    await createCategory.mutateAsync({
      ...newCategory,
      department_id: newCategory.department_id || undefined,
    } as any);
    setNewCategory({ name: '', code: '', description: '', department_id: '' });
    setIsAdding(false);
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return null;
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || null;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفئات</h1>
          <p className="text-muted-foreground">تصنيف العناصر حسب النوع مع إمكانية ربطها بالأقسام</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2" disabled={isAdding}>
          <Plus className="h-4 w-4" />
          إضافة فئة
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الاسم</th>
                <th>القسم</th>
                <th>الوصف</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {isAdding && (
                <tr>
                  <td>
                    <Input 
                      value={newCategory.code} 
                      onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })} 
                      placeholder="LIC" 
                      className="w-20 font-mono" 
                      maxLength={5} 
                    />
                  </td>
                  <td>
                    <Input 
                      value={newCategory.name} 
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} 
                      placeholder="اسم الفئة" 
                    />
                  </td>
                  <td>
                    <Select 
                      value={newCategory.department_id} 
                      onValueChange={(v) => setNewCategory({ ...newCategory, department_id: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="عام (الكل)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">عام (الكل)</SelectItem>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <Input 
                      value={newCategory.description} 
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} 
                      placeholder="اختياري" 
                    />
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={handleAdd}>
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {categories.map((cat) => {
                const catDeptId = (cat as any).department_id;
                const deptName = getDepartmentName(catDeptId);
                
                return (
                  <tr key={cat.id}>
                    <td className="font-mono text-primary">
                      {editingId === cat.id ? (
                        <Input 
                          value={editData.code} 
                          onChange={(e) => setEditData({ ...editData, code: e.target.value.toUpperCase() })} 
                          className="w-20 font-mono" 
                          maxLength={5} 
                        />
                      ) : (
                        cat.code || '-'
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <Input 
                          value={editData.name} 
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })} 
                        />
                      ) : (
                        cat.name
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <Select 
                          value={editData.department_id || 'none'} 
                          onValueChange={(v) => setEditData({ ...editData, department_id: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">عام (الكل)</SelectItem>
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : deptName ? (
                        <Badge variant="outline" className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {deptName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">عام</span>
                      )}
                    </td>
                    <td>
                      {editingId === cat.id ? (
                        <Input 
                          value={editData.description} 
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })} 
                        />
                      ) : (
                        cat.description || '-'
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {editingId === cat.id ? (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => { 
                                updateCategory.mutate({ 
                                  id: cat.id, 
                                  ...editData,
                                  department_id: editData.department_id || null,
                                } as any); 
                                setEditingId(null); 
                              }}
                            >
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => { 
                                setEditingId(cat.id); 
                                setEditData({ 
                                  name: cat.name, 
                                  code: cat.code || '', 
                                  description: cat.description || '',
                                  department_id: catDeptId || '',
                                }); 
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-destructive" 
                              onClick={() => deleteCategory.mutate(cat.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && categories.length === 0 && !isAdding && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد فئات</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Categories;
