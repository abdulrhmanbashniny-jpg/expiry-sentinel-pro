import React, { useState } from 'react';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, UserPlus, Trash2, Shield, RefreshCw } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AppRole, ROLE_LABELS } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ROLE_COLORS: Record<AppRole, string> = {
  system_admin: 'bg-red-500',
  admin: 'bg-orange-500',
  hr_user: 'bg-purple-500',
  supervisor: 'bg-blue-500',
  employee: 'bg-gray-500',
};

export default function TeamManagement() {
  const { users, teamMembers, isLoading, updateRole, addTeamMember, removeTeamMember, refetch } = useTeamManagement();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const supervisors = users.filter(u => u.role === 'supervisor');
  const employees = users.filter(u => u.role === 'employee');

  const handleAddTeamMember = () => {
    if (selectedSupervisor && selectedEmployee) {
      addTeamMember.mutate(
        { supervisorId: selectedSupervisor, employeeId: selectedEmployee },
        {
          onSuccess: () => {
            setIsAddDialogOpen(false);
            setSelectedSupervisor('');
            setSelectedEmployee('');
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
    const supervisor = users.find(u => u.profile.user_id === teamMember.supervisor_id);
    const employee = users.find(u => u.profile.user_id === teamMember.employee_id);
    return { supervisor, employee };
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
            إدارة المستخدمين وأدوارهم وفرق العمل
          </p>
        </div>

        {/* Users and Roles */}
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

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>فرق العمل</CardTitle>
                  <CardDescription>ربط الموظفين بالمشرفين</CardDescription>
                </div>
              </div>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="ml-2 h-4 w-4" />
                    إضافة عضو
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إضافة عضو لفريق</DialogTitle>
                    <DialogDescription>
                      اختر المشرف والموظف لإنشاء علاقة الإشراف
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>المشرف</Label>
                      <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المشرف" />
                        </SelectTrigger>
                        <SelectContent>
                          {supervisors.map((s) => (
                            <SelectItem key={s.profile.user_id} value={s.profile.user_id}>
                              {s.profile.full_name || s.profile.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>الموظف</Label>
                      <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.profile.user_id} value={e.profile.user_id}>
                              {e.profile.full_name || e.profile.email}
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
                      disabled={!selectedSupervisor || !selectedEmployee || addTeamMember.isPending}
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
                لا توجد فرق عمل محددة بعد
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المشرف</TableHead>
                      <TableHead>الموظف</TableHead>
                      <TableHead className="w-20">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => {
                      const { supervisor, employee } = getTeamMemberDetails(member);
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            {supervisor?.profile.full_name || supervisor?.profile.email || 'غير معروف'}
                          </TableCell>
                          <TableCell>
                            {employee?.profile.full_name || employee?.profile.email || 'غير معروف'}
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
      </div>
    </>
  );
}
