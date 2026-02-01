import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useRecipients } from '@/hooks/useRecipients';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, Search, Edit, MessageCircle, Send, Loader2,
  UserX, Trash2, AlertTriangle, UserPlus, CheckSquare, Mail, Check, X, Plus, UserCog
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, AppRole } from '@/types/database';
import { InviteUserDialog } from '@/components/users/InviteUserDialog';
import TestTelegramDialog from '@/components/TestTelegramDialog';

// Remove invisible Unicode characters (RTL marks, zero-width chars, etc.) from emails
function sanitizeEmail(email: string): string {
  return (email || '')
    .replace(/[\u200B-\u200D\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .trim();
}

export default function UserManagement() {
  const { isSystemAdmin, isAdmin } = useAuth();
  const { currentTenant } = useTenant();
  const { users, departments, isLoading, refetch, addUserToDepartment } = useTeamManagement();
  const { recipients, isLoading: recipientsLoading, createRecipient, updateRecipient, deleteRecipient } = useRecipients();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('users');
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

  // Bulk selection
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Add user dialog
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    employee_number: '',
    role: 'employee' as AppRole,
    department_id: '',
    password: '',
  });

  // Invite user dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Recipients state
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState({ name: '', whatsapp_number: '', telegram_id: '' });
  const [editRecipientData, setEditRecipientData] = useState({ name: '', whatsapp_number: '', telegram_id: '' });

  const canEdit = isSystemAdmin || isAdmin;

  // Filter only active users (not deleted)
  const activeUsers = users.filter(u => {
    const profile = u.profile as any;
    return profile.account_status !== 'deleted';
  });

  const filteredUsers = activeUsers.filter(u => {
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
      // Deactivate by disabling all communication channels and setting status
      const { error } = await supabase
        .from('profiles')
        .update({
          allow_whatsapp: false,
          allow_telegram: false,
          account_status: 'disabled',
        })
        .eq('user_id', selectedUserForAction.profile.user_id);

      if (error) throw error;

      toast({ 
        title: 'تم تعطيل الحساب',
        description: 'تم إيقاف قنوات التواصل للمستخدم ولن يتمكن من تسجيل الدخول.',
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
      
      // Mark as deleted (soft delete) and disable login
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ account_status: 'deleted', allow_whatsapp: false, allow_telegram: false })
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

  // Bulk selection handlers
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => (u.profile as any).user_id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    setBulkDeleting(true);

    try {
      const userIds = Array.from(selectedUsers);
      
      // Mark all as deleted (hard delete via account_status)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ account_status: 'deleted', allow_whatsapp: false, allow_telegram: false })
        .in('user_id', userIds);

      if (profileError) throw profileError;

      // Delete roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .in('user_id', userIds);

      if (roleError) console.warn('Bulk role deletion warning:', roleError);

      toast({
        title: 'تم الحذف الجماعي',
        description: `تم حذف ${selectedUsers.size} مستخدم بنجاح.`,
        variant: 'destructive',
      });
      setSelectedUsers(new Set());
      setBulkDeleteDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: 'خطأ في الحذف الجماعي',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Add user handler
  const handleAddUser = async () => {
    const cleanEmail = sanitizeEmail(newUserForm.email);

    if (!newUserForm.full_name || !cleanEmail) {
      toast({ title: 'خطأ', description: 'الاسم والبريد الإلكتروني مطلوبان', variant: 'destructive' });
      return;
    }
    
    setAddingUser(true);
    try {
      // Check if email exists
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();
      
      if (existingEmail) {
        toast({ title: 'خطأ', description: 'البريد الإلكتروني موجود مسبقاً', variant: 'destructive' });
        return;
      }

      // Create user via edge function
      const password = newUserForm.password || Math.random().toString(36).slice(-10);
      const { data, error } = await supabase.functions.invoke('import-user', {
        body: {
          fullname: newUserForm.full_name,
          email: cleanEmail,
          phone: newUserForm.phone,
          employee_number: newUserForm.employee_number,
          role: newUserForm.role,
          password,
          must_change_password: true,
        }
      });

      if (error) throw error;

      // Backend may return a handled failure (e.g., email already exists)
      if (!data?.success) {
        toast({
          title: 'تعذر إضافة المستخدم',
          description: data?.error || 'حدث خطأ غير معروف',
          variant: 'destructive',
        });
        return;
      }

      // Link to department if selected
      if (newUserForm.department_id && data?.user_id) {
        await addUserToDepartment.mutateAsync({
          userId: data.user_id,
          departmentId: newUserForm.department_id,
          scopeType: 'primary',
        });
      }

      toast({
        title: 'تم إضافة المستخدم',
        description: `كلمة المرور المؤقتة: ${password}`,
      });
      setAddUserDialogOpen(false);
      setNewUserForm({
        full_name: '',
        email: '',
        phone: '',
        employee_number: '',
        role: 'employee',
        department_id: '',
        password: '',
      });
      refetch();
    } catch (error: any) {
      toast({ title: 'خطأ في الإضافة', description: error.message, variant: 'destructive' });
    } finally {
      setAddingUser(false);
    }
  };

  const getAccountStatusBadge = (status: string | null) => {
    if (status === 'disabled') {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">معطّل</Badge>;
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">نشط</Badge>;
  };

  // Recipient handlers
  const handleAddRecipient = async () => {
    if (!newRecipient.name || !newRecipient.whatsapp_number) return;
    await createRecipient.mutateAsync({
      name: newRecipient.name,
      whatsapp_number: newRecipient.whatsapp_number,
      telegram_id: newRecipient.telegram_id || null,
    });
    setNewRecipient({ name: '', whatsapp_number: '', telegram_id: '' });
    setIsAddingRecipient(false);
  };

  const handleEditRecipient = async (id: string) => {
    await updateRecipient.mutateAsync({ 
      id, 
      name: editRecipientData.name,
      whatsapp_number: editRecipientData.whatsapp_number,
      telegram_id: editRecipientData.telegram_id || null,
    });
    setEditingRecipientId(null);
  };

  const filteredRecipients = recipients.filter(r => {
    const searchLower = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(searchLower) ||
      r.whatsapp_number?.includes(search) ||
      r.telegram_id?.includes(search)
    );
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة المستخدمين والمستلمين</h1>
          <p className="text-muted-foreground">عرض وتعديل بيانات الموظفين والمستلمين الخارجيين</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'users' && (
            <>
              {isSystemAdmin && selectedUsers.size > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف المحددين ({selectedUsers.size})
                </Button>
              )}
              {(isSystemAdmin || isAdmin) && currentTenant && (
                <Button onClick={() => setInviteDialogOpen(true)} className="gap-1" variant="outline">
                  <Mail className="h-4 w-4" />
                  دعوة موظف
                </Button>
              )}
              {isSystemAdmin && (
                <Button onClick={() => setAddUserDialogOpen(true)} className="gap-1">
                  <UserPlus className="h-4 w-4" />
                  إضافة مستخدم
                </Button>
              )}
            </>
          )}
          {activeTab === 'recipients' && (
            <>
              <TestTelegramDialog />
              <Button onClick={() => setIsAddingRecipient(true)} className="gap-2" disabled={isAddingRecipient}>
                <Plus className="h-4 w-4" />
                إضافة مستلم
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            الموظفون
            <Badge variant="secondary" className="mr-1">{activeUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="recipients" className="gap-2">
            <UserCog className="h-4 w-4" />
            المستلمون الخارجيون
            <Badge variant="secondary" className="mr-1">{recipients.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستخدمين</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeUsers.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">واتساب مفعّل</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {activeUsers.filter(u => (u.profile as any).allow_whatsapp).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">تيليجرام مفعّل</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {activeUsers.filter(u => (u.profile as any).allow_telegram).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">حسابات معطّلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {activeUsers.filter(u => (u.profile as any).account_status === 'disabled').length}
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
                      {isSystemAdmin && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                      )}
                      <TableHead>المستخدم</TableHead>
                      <TableHead>رقم الموظف</TableHead>
                      <TableHead>الجوال</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>قنوات التواصل</TableHead>
                      {canEdit && <TableHead>الإجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const profile = user.profile as any;
                      const isSelected = selectedUsers.has(profile.user_id);
                      return (
                        <TableRow key={profile.user_id} className={isSelected ? 'bg-primary/5' : ''}>
                          {isSystemAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleUserSelection(profile.user_id)}
                              />
                            </TableCell>
                          )}
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
                            {getAccountStatusBadge(profile.account_status)}
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
        </TabsContent>

        {/* Recipients Tab */}
        <TabsContent value="recipients" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                المستلمون الخارجيون
              </CardTitle>
              <CardDescription>
                أشخاص من خارج المنظمة يستقبلون الإشعارات (مثل الجهات الحكومية أو المقاولين)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>رقم الواتساب</TableHead>
                    <TableHead>Telegram ID</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAddingRecipient && (
                    <TableRow>
                      <TableCell>
                        <Input 
                          value={newRecipient.name} 
                          onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })} 
                          placeholder="الاسم" 
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          value={newRecipient.whatsapp_number} 
                          onChange={(e) => setNewRecipient({ ...newRecipient, whatsapp_number: e.target.value })} 
                          placeholder="+966xxxxxxxxx" 
                          dir="ltr" 
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          value={newRecipient.telegram_id} 
                          onChange={(e) => setNewRecipient({ ...newRecipient, telegram_id: e.target.value })} 
                          placeholder="123456789" 
                          dir="ltr" 
                        />
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={handleAddRecipient}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setIsAddingRecipient(false)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {recipientsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredRecipients.length === 0 && !isAddingRecipient ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا يوجد مستلمون خارجيون
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {editingRecipientId === r.id ? (
                            <Input 
                              value={editRecipientData.name} 
                              onChange={(e) => setEditRecipientData({ ...editRecipientData, name: e.target.value })} 
                            />
                          ) : (
                            r.name
                          )}
                        </TableCell>
                        <TableCell dir="ltr" className="text-left">
                          {editingRecipientId === r.id ? (
                            <Input 
                              value={editRecipientData.whatsapp_number} 
                              onChange={(e) => setEditRecipientData({ ...editRecipientData, whatsapp_number: e.target.value })} 
                              dir="ltr" 
                            />
                          ) : (
                            r.whatsapp_number
                          )}
                        </TableCell>
                        <TableCell dir="ltr" className="text-left">
                          {editingRecipientId === r.id ? (
                            <Input 
                              value={editRecipientData.telegram_id} 
                              onChange={(e) => setEditRecipientData({ ...editRecipientData, telegram_id: e.target.value })} 
                              dir="ltr" 
                            />
                          ) : (
                            r.telegram_id || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch 
                            checked={r.is_active} 
                            onCheckedChange={(checked) => updateRecipient.mutate({ id: r.id, is_active: checked })} 
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {editingRecipientId === r.id ? (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => handleEditRecipient(r.id)}>
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setEditingRecipientId(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => { 
                                    setEditingRecipientId(r.id); 
                                    setEditRecipientData({ 
                                      name: r.name, 
                                      whatsapp_number: r.whatsapp_number, 
                                      telegram_id: r.telegram_id || '' 
                                    }); 
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="text-destructive" 
                                  onClick={() => deleteRecipient.mutate(r.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة مستخدم جديد</DialogTitle>
            <DialogDescription>أدخل بيانات المستخدم الجديد</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>الاسم الكامل *</Label>
                <Input
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  placeholder="أحمد محمد"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني *</Label>
                <Input
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="user@example.com"
                  dir="ltr"
                  type="email"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>رقم الموظف</Label>
                <Input
                  value={newUserForm.employee_number}
                  onChange={(e) => setNewUserForm({ ...newUserForm, employee_number: e.target.value })}
                  placeholder="EMP001"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  placeholder="966xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>الدور</Label>
                <Select
                  value={newUserForm.role}
                  onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value as AppRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">موظف</SelectItem>
                    <SelectItem value="supervisor">مشرف</SelectItem>
                    <SelectItem value="hr_user">مستخدم HR</SelectItem>
                    <SelectItem value="admin">مسؤول</SelectItem>
                    {isSystemAdmin && <SelectItem value="system_admin">مدير النظام</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select
                  value={newUserForm.department_id}
                  onValueChange={(value) => setNewUserForm({ ...newUserForm, department_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>كلمة المرور (اختياري - سيتم توليدها تلقائياً)</Label>
              <Input
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="اتركها فارغة لتوليد كلمة مرور عشوائية"
                type="password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddUser} disabled={addingUser}>
              {addingUser ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <UserPlus className="h-4 w-4 ml-2" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              تعطيل حساب المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تعطيل حساب <strong>{selectedUserForAction?.profile.full_name}</strong>؟
              <br /><br />
              سيتم:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>إيقاف جميع قنوات التواصل (واتساب وتيليجرام)</li>
                <li>منع المستخدم من تسجيل الدخول</li>
                <li>الاحتفاظ بالسجلات والبيانات المرتبطة</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateUser}
              disabled={actionLoading}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <UserX className="h-4 w-4 ml-2" />}
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
              <Trash2 className="h-5 w-5" />
              حذف حساب المستخدم نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حساب <strong>{selectedUserForAction?.profile.full_name}</strong>؟
              <br /><br />
              سيتم:
              <ul className="list-disc list-inside mt-2 space-y-1 text-destructive">
                <li>حذف بيانات المستخدم نهائياً</li>
                <li>حذف صلاحيات المستخدم</li>
                <li>قد يؤثر على العناصر والتذكيرات المرتبطة</li>
              </ul>
              <p className="mt-3 font-semibold text-destructive">هذا الإجراء لا يمكن التراجع عنه!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Trash2 className="h-4 w-4 ml-2" />}
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              حذف {selectedUsers.size} مستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف <strong>{selectedUsers.size}</strong> مستخدم؟
              <br /><br />
              سيتم:
              <ul className="list-disc list-inside mt-2 space-y-1 text-destructive">
                <li>حذف بيانات المستخدمين نهائياً</li>
                <li>حذف صلاحيات جميع المستخدمين المحددين</li>
                <li>قد يؤثر على العناصر والتذكيرات المرتبطة</li>
              </ul>
              <p className="mt-3 font-semibold text-destructive">هذا الإجراء لا يمكن التراجع عنه!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Trash2 className="h-4 w-4 ml-2" />}
              حذف {selectedUsers.size} مستخدم
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        departments={departments.map(d => ({ id: d.id, name: d.name }))}
        onSuccess={refetch}
      />
    </div>
  );
}