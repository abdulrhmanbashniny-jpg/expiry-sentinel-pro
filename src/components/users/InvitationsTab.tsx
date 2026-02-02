import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mail, Search, Edit, RotateCcw, Ban, Trash2, Loader2, 
  Clock, CheckCircle2, XCircle, AlertCircle, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { EditInvitationDialog } from './EditInvitationDialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';

interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  employee_number: string | null;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  resent_count: number;
  last_resent_at: string | null;
  department_id: string | null;
  tenant_id: string;
  invited_by: string;
  token: string;
}

type StatusFilter = 'all' | 'pending' | 'accepted' | 'expired' | 'revoked';

export function InvitationsTab() {
  const { currentTenant } = useTenant();
  const { isSystemAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingInvitation, setEditingInvitation] = useState<Invitation | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch invitations
  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['user-invitations', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Invitation[];
    },
    enabled: !!currentTenant?.id,
  });

  // Resend invitation mutation
  const resendMutation = useMutation({
    mutationFn: async (invitation: Invitation) => {
      // Generate new token and extend expiration
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const { error } = await supabase
        .from('user_invitations')
        .update({
          token: newToken,
          expires_at: newExpiresAt.toISOString(),
          status: 'pending',
          resent_count: (invitation.resent_count || 0) + 1,
          last_resent_at: new Date().toISOString(),
        })
        .eq('id', invitation.id);

      if (error) throw error;

      // Send WhatsApp if phone exists
      if (invitation.phone) {
        const activationLink = `https://expiry-sentinel-pro.lovable.app/activate?token=${newToken}&company=${currentTenant?.code}`;
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: invitation.phone,
              message: `مرحباً ${invitation.full_name || 'الموظف'} 👋\n\nتم إعادة إرسال دعوة التفعيل.\n\n🏢 ${currentTenant?.name}\n📧 ${invitation.email}\n\nرابط التفعيل (صالح 7 أيام):\n🔗 ${activationLink}`,
            },
          });
        } catch (e) {
          console.warn('WhatsApp send failed:', e);
        }
      }

      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast({
        title: 'تم إعادة إرسال الدعوة',
        description: 'تم تجديد الرابط وإرساله مرة أخرى',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Revoke invitation
  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast({
        title: 'تم إلغاء الدعوة',
        description: 'لن يتمكن المستخدم من استخدام رابط التفعيل',
      });
      setRevokeDialogOpen(false);
      setSelectedInvitation(null);
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete invitation (hard delete - admin only)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast({
        title: 'تم حذف الدعوة',
        description: 'تم حذف السجل نهائياً',
        variant: 'destructive',
      });
      setDeleteDialogOpen(false);
      setSelectedInvitation(null);
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Compute effective status (handle expired)
  const getEffectiveStatus = (inv: Invitation): string => {
    if (inv.status === 'accepted') return 'accepted';
    if (inv.status === 'revoked') return 'revoked';
    if (inv.status === 'pending' && isPast(new Date(inv.expires_at))) return 'expired';
    return inv.status || 'pending';
  };

  // Filter invitations
  const filteredInvitations = invitations.filter(inv => {
    const effectiveStatus = getEffectiveStatus(inv);
    
    // Status filter
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        inv.email?.toLowerCase().includes(searchLower) ||
        inv.full_name?.toLowerCase().includes(searchLower) ||
        inv.employee_number?.toLowerCase().includes(searchLower) ||
        inv.phone?.includes(search)
      );
    }
    
    return true;
  });

  // Stats
  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => getEffectiveStatus(i) === 'pending').length,
    accepted: invitations.filter(i => getEffectiveStatus(i) === 'accepted').length,
    expired: invitations.filter(i => getEffectiveStatus(i) === 'expired').length,
    revoked: invitations.filter(i => getEffectiveStatus(i) === 'revoked').length,
  };

  const getStatusBadge = (inv: Invitation) => {
    const status = getEffectiveStatus(inv);
    switch (status) {
      case 'accepted':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 ml-1" />
            مفعّل
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            <Clock className="h-3 w-3 ml-1" />
            في الانتظار
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 ml-1" />
            منتهي
          </Badge>
        );
      case 'revoked':
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">
            <Ban className="h-3 w-3 ml-1" />
            ملغى
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      employee: 'موظف',
      supervisor: 'مشرف',
      admin: 'مدير',
      system_admin: 'مدير النظام',
    };
    return labels[role] || role;
  };

  const handleResend = (inv: Invitation) => {
    resendMutation.mutate(inv);
  };

  const handleRevoke = (inv: Invitation) => {
    setSelectedInvitation(inv);
    setRevokeDialogOpen(true);
  };

  const handleDelete = (inv: Invitation) => {
    setSelectedInvitation(inv);
    setDeleteDialogOpen(true);
  };

  const copyActivationLink = (inv: Invitation) => {
    const link = `https://expiry-sentinel-pro.lovable.app/activate?token=${inv.token}&company=${currentTenant?.code}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'تم نسخ الرابط' });
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('all')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الإجمالي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('pending')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">في الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('accepted')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">مفعّل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('expired')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">منتهي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('revoked')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ملغى</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.revoked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، البريد، رقم الموظف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="فلترة الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="pending">في الانتظار</SelectItem>
                <SelectItem value="accepted">مفعّل</SelectItem>
                <SelectItem value="expired">منتهي</SelectItem>
                <SelectItem value="revoked">ملغى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            دعوات المستخدمين
          </CardTitle>
          <CardDescription>
            عرض وإدارة دعوات التسجيل للموظفين الجدد
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredInvitations.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد دعوات مطابقة</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>رقم الموظف</TableHead>
                  <TableHead>الجوال</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>تاريخ الإرسال</TableHead>
                  <TableHead>انتهاء الصلاحية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvitations.map((inv) => {
                  const effectiveStatus = getEffectiveStatus(inv);
                  const canResend = effectiveStatus === 'pending' || effectiveStatus === 'expired';
                  const canRevoke = effectiveStatus === 'pending';
                  
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{inv.full_name || 'بدون اسم'}</p>
                          <p className="text-sm text-muted-foreground" dir="ltr">{inv.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{inv.employee_number || '-'}</TableCell>
                      <TableCell dir="ltr">{inv.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(inv.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(inv.created_at), 'yyyy/MM/dd', { locale: ar })}</p>
                          <p className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true, locale: ar })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(inv.expires_at), 'yyyy/MM/dd', { locale: ar })}</p>
                          {effectiveStatus === 'pending' && (
                            <p className="text-muted-foreground text-xs">
                              {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true, locale: ar })}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(inv)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {effectiveStatus !== 'accepted' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setEditingInvitation(inv)}
                              title="تعديل البيانات"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canResend && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleResend(inv)}
                              disabled={resendMutation.isPending}
                              title="إعادة إرسال الدعوة"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {canRevoke && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleRevoke(inv)}
                              title="إلغاء الدعوة"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {isSystemAdmin && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleDelete(inv)}
                              title="حذف نهائي"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingInvitation && (
        <EditInvitationDialog
          invitation={editingInvitation}
          open={!!editingInvitation}
          onOpenChange={(open) => !open && setEditingInvitation(null)}
          onSuccess={() => {
            setEditingInvitation(null);
            queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
          }}
        />
      )}

      {/* Revoke Confirmation */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              إلغاء الدعوة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء دعوة <strong>{selectedInvitation?.full_name || selectedInvitation?.email}</strong>؟
              <br />
              لن يتمكن المستخدم من استخدام رابط التفعيل بعد الإلغاء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedInvitation && revokeMutation.mutate(selectedInvitation.id)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إلغاء الدعوة'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              حذف الدعوة نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف دعوة <strong>{selectedInvitation?.full_name || selectedInvitation?.email}</strong>؟
              <br />
              <strong className="text-destructive">هذا الإجراء لا يمكن التراجع عنه.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedInvitation && deleteMutation.mutate(selectedInvitation.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
