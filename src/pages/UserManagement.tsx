import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, Search, Edit, Mail, Phone, Hash, User, 
  MessageCircle, Send, Shield, Building2, Loader2,
  UserX, Trash2, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS } from '@/types/database';

export default function UserManagement() {
  const { isSystemAdmin, isAdmin } = useAuth();
  const { users, isLoading, refetch } = useTeamManagement();
  const { toast } = useToast();
  
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    employee_number: '',
    national_id: '',
    allow_whatsapp: false,
    allow_telegram: false,
    telegram_user_id: '',
  });
  
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUserForAction, setSelectedUserForAction] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canEdit = isSystemAdmin || isAdmin;

  const filteredUsers = users.filter(u => {
    const searchLower = search.toLowerCase();
    const profile = u.profile as any;
    return (
      profile.full_name?.toLowerCase().includes(searchLower) ||
      profile.email?.toLowerCase().includes(searchLower) ||
      profile.employee_number?.toLowerCase().includes(searchLower) ||
      profile.phone?.includes(search)
    );
  });

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.profile.full_name || '',
      email: user.profile.email || '',
      phone: user.profile.phone || '',
      employee_number: user.profile.employee_number || '',
      national_id: user.profile.national_id || '',
      allow_whatsapp: user.profile.allow_whatsapp || false,
      allow_telegram: user.profile.allow_telegram || false,
      telegram_user_id: user.profile.telegram_user_id || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
          employee_number: editForm.employee_number,
          national_id: editForm.national_id,
          allow_whatsapp: editForm.allow_whatsapp,
          allow_telegram: editForm.allow_telegram,
          telegram_user_id: editForm.telegram_user_id || null,
        })
        .eq('user_id', editingUser.profile.user_id);

      if (error) throw error;

      toast({ title: 'تم حفظ البيانات بنجاح' });
      setEditDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleDeactivateUser = async () => {
    if (!selectedUserForAction) return;
    setActionLoading(true);
    
    try {
      // Deactivate by disabling all communication channels
      const { error } = await supabase
        .from('profiles')
        .update({
          allow_whatsapp: false,
          allow_telegram: false,
        })
        .eq('user_id', selectedUserForAction.profile.user_id);

      if (error) throw error;

      toast({ 
        title: 'تم تعطيل الحساب',
        description: 'تم إيقاف قنوات التواصل للمستخدم. لن يتلقى أي تنبيهات.',
      });
      setDeactivateDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({ 
        title: 'خطأ', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setActionLoading(false);
      setSelectedUserForAction(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForAction) return;
    setActionLoading(true);
    
    try {
      const userId = selectedUserForAction.profile.user_id;
      
      // Delete profile first (will cascade or we handle related data)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Delete user roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) console.warn('Role deletion warning:', roleError);

      toast({ 
        title: 'تم حذف الحساب',
        description: 'تم حذف بيانات المستخدم من النظام.',
        variant: 'destructive'
      });
      setDeleteDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({ 
        title: 'خطأ في الحذف', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setActionLoading(false);
      setSelectedUserForAction(null);
    }
  };

  const openDeactivateDialog = (user: any) => {
    setSelectedUserForAction(user);
    setDeactivateDialogOpen(true);
  };

  const openDeleteDialog = (user: any) => {
    setSelectedUserForAction(user);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground">عرض وتعديل بيانات المستخدمين وقنوات التواصل</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Users className="h-4 w-4" />
          {users.length} مستخدم
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستخدمين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">واتساب مفعّل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => (u.profile as any).allow_whatsapp).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تيليجرام مفعّل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(u => (u.profile as any).allow_telegram).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">بدون قنوات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {users.filter(u => !(u.profile as any).allow_whatsapp && !(u.profile as any).allow_telegram).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم، البريد، رقم الموظف، أو الجوال..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              لا يوجد مستخدمون مطابقون للبحث
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>رقم الموظف</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>قنوات التواصل</TableHead>
                  {canEdit && <TableHead>الإجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const profile = user.profile as any;
                  return (
                    <TableRow key={profile.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(profile.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{profile.full_name || 'بدون اسم'}</p>
                            <p className="text-sm text-muted-foreground" dir="ltr">{profile.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{profile.employee_number || '-'}</TableCell>
                      <TableCell dir="ltr">{profile.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {profile.allow_whatsapp && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              <MessageCircle className="h-3 w-3 ml-1" />
                              واتساب
                            </Badge>
                          )}
                          {profile.allow_telegram && (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <Send className="h-3 w-3 ml-1" />
                              تيليجرام
                            </Badge>
                          )}
                          {!profile.allow_whatsapp && !profile.allow_telegram && (
                            <span className="text-sm text-muted-foreground">لا يوجد</span>
                          )}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditUser(user)} title="تعديل">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => openDeactivateDialog(user)}
                              title="تعطيل الحساب"
                              className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                            {isSystemAdmin && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => openDeleteDialog(user)}
                                title="حذف الحساب"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>
              {editingUser?.profile.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>رقم الموظف</Label>
                <Input
                  value={editForm.employee_number}
                  onChange={(e) => setEditForm({ ...editForm, employee_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهوية</Label>
                <Input
                  value={editForm.national_id}
                  onChange={(e) => setEditForm({ ...editForm, national_id: e.target.value })}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">قنوات التواصل</h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  <Label>واتساب</Label>
                </div>
                <Switch
                  checked={editForm.allow_whatsapp}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, allow_whatsapp: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-500" />
                  <Label>تيليجرام</Label>
                </div>
                <Switch
                  checked={editForm.allow_telegram}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, allow_telegram: checked })}
                />
              </div>

              {editForm.allow_telegram && (
                <div className="space-y-2">
                  <Label>معرف تيليجرام (Chat ID)</Label>
                  <Input
                    value={editForm.telegram_user_id}
                    onChange={(e) => setEditForm({ ...editForm, telegram_user_id: e.target.value })}
                    placeholder="مثال: 123456789"
                    dir="ltr"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <UserX className="h-5 w-5" />
              تعطيل حساب المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  هل تريد تعطيل حساب <strong>{selectedUserForAction?.profile?.full_name}</strong>؟
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-orange-800">ماذا سيحدث:</p>
                  <ul className="list-disc list-inside text-orange-700 mt-1">
                    <li>سيتم إيقاف جميع قنوات التواصل (واتساب، تيليجرام)</li>
                    <li>لن يتلقى المستخدم أي تنبيهات</li>
                    <li>ستبقى بياناته وسجلاته محفوظة</li>
                    <li>يمكن إعادة تفعيله لاحقاً</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeactivateUser}
              className="bg-orange-500 hover:bg-orange-600"
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تعطيل الحساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              حذف حساب المستخدم نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  هل أنت متأكد من حذف حساب <strong>{selectedUserForAction?.profile?.full_name}</strong>؟
                </p>
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                  <p className="font-medium text-destructive">تحذير - لا يمكن التراجع:</p>
                  <ul className="list-disc list-inside text-destructive/80 mt-1">
                    <li>سيتم حذف بيانات المستخدم من النظام</li>
                    <li>قد تتأثر العناصر والتقييمات المرتبطة به</li>
                    <li>لن يمكن استعادة البيانات</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-destructive hover:bg-destructive/90"
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
