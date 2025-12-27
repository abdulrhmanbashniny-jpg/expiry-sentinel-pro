import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Departments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Department[];
    }
  });

  const createDepartment = useMutation({
    mutationFn: async (data: { name: string; code: string; description: string }) => {
      const { error } = await supabase
        .from('departments')
        .insert({
          name: data.name,
          code: data.code || null,
          description: data.description || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'تم الإنشاء', description: 'تم إنشاء القسم بنجاح' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; code: string; description: string } }) => {
      const { error } = await supabase
        .from('departments')
        .update({
          name: data.name,
          code: data.code || null,
          description: data.description || null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث القسم بنجاح' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'تم الحذف', description: 'تم حذف القسم بنجاح' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('departments')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'تم التحديث', description: 'تم تحديث حالة القسم' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '' });
    setEditingDept(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code || '',
      description: dept.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'يجب إدخال اسم القسم' });
      return;
    }

    if (editingDept) {
      updateDepartment.mutate({ id: editingDept.id, data: formData });
    } else {
      createDepartment.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إدارة الأقسام - HR Reminder</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">إدارة الأقسام</h1>
            <p className="text-muted-foreground">إنشاء وتعديل الأقسام في المنظمة</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إضافة قسم
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDept ? 'تعديل القسم' : 'إضافة قسم جديد'}</DialogTitle>
                <DialogDescription>
                  {editingDept ? 'قم بتعديل بيانات القسم' : 'أدخل بيانات القسم الجديد'}
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم القسم *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: قسم الموارد البشرية"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="code">الرمز</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="مثال: HR"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف مختصر للقسم"
                    rows={3}
                  />
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createDepartment.isPending || updateDepartment.isPending}>
                    {(createDepartment.isPending || updateDepartment.isPending) && (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    )}
                    {editingDept ? 'حفظ التعديلات' : 'إضافة'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>الأقسام</CardTitle>
                <CardDescription>{departments?.length || 0} قسم مسجل</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {departments?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد أقسام بعد</p>
                <p className="text-sm">قم بإضافة قسم جديد للبدء</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم القسم</TableHead>
                      <TableHead>الرمز</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="w-28">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments?.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>{dept.code || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{dept.description || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={dept.is_active ? 'default' : 'secondary'}
                            className="cursor-pointer"
                            onClick={() => toggleActive.mutate({ id: dept.id, is_active: !dept.is_active })}
                          >
                            {dept.is_active ? 'نشط' : 'معطل'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(dept)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف القسم</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف قسم "{dept.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteDepartment.mutate(dept.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
