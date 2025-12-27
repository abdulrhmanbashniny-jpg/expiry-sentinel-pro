import React, { useState } from 'react';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, UserPlus, Trash2, Shield, RefreshCw, Building2, Link2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AppRole, ROLE_LABELS, ROLE_HIERARCHY } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROLE_COLORS: Record<AppRole, string> = {
  system_admin: 'bg-red-500',
  admin: 'bg-orange-500',
  hr_user: 'bg-purple-500',
  supervisor: 'bg-blue-500',
  employee: 'bg-gray-500',
};

export default function TeamManagement() {
  const { 
    users, 
    teamMembers, 
    departments,
    departmentScopes,
    isLoading, 
    updateRole, 
    addTeamMember, 
    removeTeamMember,
    updateDepartmentManager,
    addUserToDepartment,
    removeUserFromDepartment,
    refetch 
  } = useTeamManagement();
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedSubordinate, setSelectedSubordinate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Department user dialog
  const [isDeptUserDialogOpen, setIsDeptUserDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedUserForDept, setSelectedUserForDept] = useState('');

  // Get managers (system_admin, admin) who can have direct reports
  const managers = users.filter(u => 
    u.role === 'system_admin' || u.role === 'admin' || u.role === 'supervisor'
  );
  
  // Get subordinates (anyone who is not system_admin)
  const subordinates = users.filter(u => 
    u.role !== 'system_admin'
  );

  const handleAddTeamMember = () => {
    if (selectedManager && selectedSubordinate) {
      addTeamMember.mutate(
        { supervisorId: selectedManager, employeeId: selectedSubordinate },
        {
          onSuccess: () => {
            setIsAddDialogOpen(false);
            setSelectedManager('');
            setSelectedSubordinate('');
          },
        }
      );
    }
  };

  const handleAddUserToDepartment = () => {
    if (selectedDepartment && selectedUserForDept) {
      addUserToDepartment.mutate(
        { userId: selectedUserForDept, departmentId: selectedDepartment },
        {
          onSuccess: () => {
            setIsDeptUserDialogOpen(false);
            setSelectedDepartment('');
            setSelectedUserForDept('');
          },
        }
      );
    }
  };

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_missing_users');
      
      if (error) throw error;
      
      const result = data?.[0];
      if (result && result.synced_count > 0) {
        toast({
          title: 'تمت المزامنة',
          description: `تم مزامنة ${result.synced_count} مستخدم: ${result.synced_users?.join(', ')}`,
        });
        refetch();
      } else {
        toast({
          title: 'لا يوجد مستخدمين',
          description: 'جميع المستخدمين متزامنين بالفعل',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'خطأ في المزامنة',
        description: error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getTeamMemberDetails = (teamMember: typeof teamMembers[0]) => {
    const manager = users.find(u => u.profile.user_id === teamMember.supervisor_id);
    const subordinate = users.find(u => u.profile.user_id === teamMember.employee_id);
    return { manager, subordinate };
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'غير محدد';
    const user = users.find(u => u.profile.user_id === userId);
    return user?.profile.full_name || user?.profile.email || 'غير معروف';
  };

  const getDepartmentName = (departmentId: string) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept?.name || 'غير معروف';
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
        <title>إدارة الفريق - HR Reminder</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">إدارة الفريق والصلاحيات</h1>
          <p className="text-muted-foreground">
            إدارة المستخدمين وأدوارهم وفرق العمل والأقسام
          </p>
        </div>

        <Tabs defaultValue="users" dir="rtl">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">المستخدمون</TabsTrigger>
            <TabsTrigger value="teams">فرق العمل</TabsTrigger>
            <TabsTrigger value="departments">الأقسام</TabsTrigger>
            <TabsTrigger value="memberships">العضويات</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>المستخدمون والأدوار</CardTitle>
                      <CardDescription>تعيين وتعديل أدوار المستخدمين ({users.length} مستخدم)</CardDescription>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleSyncUsers}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="ml-2 h-4 w-4" />
                    )}
                    مزامنة المستخدمين
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المستخدم</TableHead>
                        <TableHead>البريد الإلكتروني</TableHead>
                        <TableHead>الدور الحالي</TableHead>
                        <TableHead>تغيير الدور</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.profile.id}>
                          <TableCell className="font-medium">
                            {user.profile.full_name || 'بدون اسم'}
                          </TableCell>
                          <TableCell dir="ltr" className="text-right">
                            {user.profile.email}
                          </TableCell>
                          <TableCell>
                            {user.role ? (
                              <Badge className={`${ROLE_COLORS[user.role]} text-white`}>
                                {ROLE_LABELS[user.role]}
                              </Badge>
                            ) : (
                              <Badge variant="outline">غير محدد</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role || ''}
                              onValueChange={(value) => 
                                updateRole.mutate({ userId: user.profile.user_id, newRole: value as AppRole })
                              }
                              disabled={updateRole.isPending}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="اختر الدور" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system_admin">{ROLE_LABELS.system_admin}</SelectItem>
                                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                                <SelectItem value="hr_user">{ROLE_LABELS.hr_user}</SelectItem>
                                <SelectItem value="supervisor">{ROLE_LABELS.supervisor}</SelectItem>
                                <SelectItem value="employee">{ROLE_LABELS.employee}</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>الهيكل الإداري</CardTitle>
                      <CardDescription>
                        ربط الموظفين بالمشرفين/المدراء (موظف ← مشرف ← مدير)
                      </CardDescription>
                    </div>
                  </div>

                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="ml-2 h-4 w-4" />
                        إضافة ارتباط
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>إضافة ارتباط إداري</DialogTitle>
                        <DialogDescription>
                          ربط موظف/مشرف بمديره المباشر. يمكن ربط الموظف مباشرة بالمدير إذا لم يكن هناك مشرف.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>المدير/المشرف المباشر</Label>
                          <Select value={selectedManager} onValueChange={setSelectedManager}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المدير أو المشرف" />
                            </SelectTrigger>
                            <SelectContent>
                              {managers.map((m) => (
                                <SelectItem key={m.profile.user_id} value={m.profile.user_id}>
                                  <span className="flex items-center gap-2">
                                    {m.profile.full_name || m.profile.email}
                                    {m.role && (
                                      <Badge variant="outline" className="text-xs">
                                        {ROLE_LABELS[m.role]}
                                      </Badge>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            يمكن اختيار مدير نظام، مدير، أو مشرف
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>الموظف/المشرف التابع</Label>
                          <Select value={selectedSubordinate} onValueChange={setSelectedSubordinate}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الموظف أو المشرف" />
                            </SelectTrigger>
                            <SelectContent>
                              {subordinates
                                .filter(e => e.profile.user_id !== selectedManager)
                                .map((e) => (
                                  <SelectItem key={e.profile.user_id} value={e.profile.user_id}>
                                    <span className="flex items-center gap-2">
                                      {e.profile.full_name || e.profile.email}
                                      {e.role && (
                                        <Badge variant="outline" className="text-xs">
                                          {ROLE_LABELS[e.role]}
                                        </Badge>
                                      )}
                                    </span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button 
                          onClick={handleAddTeamMember}
                          disabled={!selectedManager || !selectedSubordinate || addTeamMember.isPending}
                        >
                          {addTeamMember.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                          إضافة
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد ارتباطات إدارية محددة بعد
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>المدير/المشرف</TableHead>
                          <TableHead>دوره</TableHead>
                          <TableHead>التابع</TableHead>
                          <TableHead>دوره</TableHead>
                          <TableHead className="w-20">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamMembers.map((member) => {
                          const { manager, subordinate } = getTeamMemberDetails(member);
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                {manager?.profile.full_name || manager?.profile.email || 'غير معروف'}
                              </TableCell>
                              <TableCell>
                                {manager?.role ? (
                                  <Badge className={`${ROLE_COLORS[manager.role]} text-white`}>
                                    {ROLE_LABELS[manager.role]}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">غير محدد</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {subordinate?.profile.full_name || subordinate?.profile.email || 'غير معروف'}
                              </TableCell>
                              <TableCell>
                                {subordinate?.role ? (
                                  <Badge className={`${ROLE_COLORS[subordinate.role]} text-white`}>
                                    {ROLE_LABELS[subordinate.role]}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">غير محدد</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => removeTeamMember.mutate(member.id)}
                                  disabled={removeTeamMember.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>الأقسام ومدراؤها</CardTitle>
                    <CardDescription>
                      تعيين مدير لكل قسم - المدراء والمشرفون ومدير النظام يملكون صلاحيات على المعاملات
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {departments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد أقسام. أضف أقسام من صفحة الأقسام أولاً.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>القسم</TableHead>
                          <TableHead>الرمز</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead>المدير الحالي</TableHead>
                          <TableHead>تغيير المدير</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departments.map((dept) => (
                          <TableRow key={dept.id}>
                            <TableCell className="font-medium">{dept.name}</TableCell>
                            <TableCell>{dept.code || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={dept.is_active ? 'default' : 'secondary'}>
                                {dept.is_active ? 'نشط' : 'غير نشط'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getUserName(dept.manager_user_id)}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={dept.manager_user_id || 'none'}
                                onValueChange={(value) => 
                                  updateDepartmentManager.mutate({ 
                                    departmentId: dept.id, 
                                    managerId: value === 'none' ? null : value 
                                  })
                                }
                                disabled={updateDepartmentManager.isPending}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="اختر المدير" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">بدون مدير</SelectItem>
                                  {managers.map((m) => (
                                    <SelectItem key={m.profile.user_id} value={m.profile.user_id}>
                                      {m.profile.full_name || m.profile.email}
                                      {m.role && ` (${ROLE_LABELS[m.role]})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memberships Tab */}
          <TabsContent value="memberships">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Link2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>عضوية المستخدمين في الأقسام</CardTitle>
                      <CardDescription>ربط المستخدمين بالأقسام التي يعملون بها</CardDescription>
                    </div>
                  </div>

                  <Dialog open={isDeptUserDialogOpen} onOpenChange={setIsDeptUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="ml-2 h-4 w-4" />
                        إضافة عضوية
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>إضافة مستخدم لقسم</DialogTitle>
                        <DialogDescription>
                          ربط مستخدم بقسم معين
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>القسم</Label>
                          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر القسم" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.filter(d => d.is_active).map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>المستخدم</Label>
                          <Select value={selectedUserForDept} onValueChange={setSelectedUserForDept}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المستخدم" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map((u) => (
                                <SelectItem key={u.profile.user_id} value={u.profile.user_id}>
                                  {u.profile.full_name || u.profile.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeptUserDialogOpen(false)}>
                          إلغاء
                        </Button>
                        <Button 
                          onClick={handleAddUserToDepartment}
                          disabled={!selectedDepartment || !selectedUserForDept || addUserToDepartment.isPending}
                        >
                          {addUserToDepartment.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                          إضافة
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {departmentScopes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    لا توجد عضويات محددة بعد
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>المستخدم</TableHead>
                          <TableHead>القسم</TableHead>
                          <TableHead>نوع العضوية</TableHead>
                          <TableHead className="w-20">إجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departmentScopes.map((scope) => (
                          <TableRow key={scope.id}>
                            <TableCell>
                              {getUserName(scope.user_id)}
                            </TableCell>
                            <TableCell>
                              {getDepartmentName(scope.department_id)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={scope.scope_type === 'primary' ? 'default' : 'secondary'}>
                                {scope.scope_type === 'primary' ? 'أساسي' : 'إضافي'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => removeUserFromDepartment.mutate(scope.id)}
                                disabled={removeUserFromDepartment.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
