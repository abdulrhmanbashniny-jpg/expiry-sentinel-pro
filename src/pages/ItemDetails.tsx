import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Edit, Calendar, User, Building, FileText, Clock, Repeat, Eye, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useItems } from '@/hooks/useItems';
import { useItemPermissions } from '@/hooks/useItemPermissions';
import { format } from 'date-fns';
import { ItemStatus } from '@/types/database';
import { WorkflowStatus, WORKFLOW_STATUS_LABELS } from '@/hooks/useDashboardData';
import TestWhatsAppDialog from '@/components/TestWhatsAppDialog';
import SendTelegramDialog from '@/components/SendTelegramDialog';
import WorkflowActions from '@/components/workflow/WorkflowActions';
import ItemTimeline from '@/components/workflow/ItemTimeline';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getLevelName } from '@/hooks/useEscalations';

const ItemDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, isLoading } = useItems();

  const item = items.find(i => i.id === id);
  const itemCreatorId = (item as any)?.created_by_user_id;
  
  // Check permissions for this item
  const { canEdit, canDelete, isRecipient, isLoading: permissionsLoading } = useItemPermissions(id, itemCreatorId);

  // Fetch escalation status for this item
  const { data: itemEscalation } = useQuery({
    queryKey: ['item-escalation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('escalation_log')
        .select('id, escalation_level, status, current_recipient_id, next_escalation_at')
        .eq('item_id', id!)
        .order('escalation_level', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!id,
  });

  const getStatusBadge = (status: ItemStatus, expiryDate: string) => {
    const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (status === 'archived') return <Badge variant="secondary">مؤرشف</Badge>;
    if (status === 'expired' || daysLeft < 0) return <Badge variant="destructive">منتهي</Badge>;
    if (daysLeft <= 7) return <Badge className="bg-warning text-warning-foreground">قريب جداً</Badge>;
    if (daysLeft <= 30) return <Badge className="bg-primary/80 text-primary-foreground">قريب</Badge>;
    return <Badge className="bg-success text-success-foreground">نشط</Badge>;
  };

  const getWorkflowBadge = (status: string) => {
    const workflowStatus = status as WorkflowStatus;
    const label = WORKFLOW_STATUS_LABELS[workflowStatus] || status;
    const colors: Record<WorkflowStatus, string> = {
      new: 'bg-muted text-muted-foreground',
      acknowledged: 'bg-primary/15 text-primary',
      in_progress: 'bg-warning/15 text-warning',
      done_pending_supervisor: 'bg-accent/15 text-accent',
      returned: 'bg-destructive/15 text-destructive',
      escalated_to_manager: 'bg-destructive/20 text-destructive',
      finished: 'bg-success/15 text-success',
    };
    return (
      <Badge className={colors[workflowStatus] || ''}>
        {label}
      </Badge>
    );
  };

  const getDaysLeft = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">العنصر غير موجود</p>
        <Button onClick={() => navigate('/items')}>
          <ArrowRight className="ml-2 h-4 w-4" />
          العودة للعناصر
        </Button>
      </div>
    );
  }

  const daysLeft = getDaysLeft(item.expiry_date);
  const workflowStatus = (item as any).workflow_status as WorkflowStatus || 'new';

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/items')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{item.title}</h1>
              {getWorkflowBadge(workflowStatus)}
              {itemEscalation && itemEscalation.status === 'pending' && (
                <Badge variant="destructive" className="gap-1 animate-pulse">
                  <ArrowUp className="h-3 w-3" />
                  تصعيد: {getLevelName(itemEscalation.escalation_level)}
                </Badge>
              )}
              {itemEscalation && itemEscalation.status === 'escalated' && (
                <Badge variant="outline" className="gap-1 border-purple-500 text-purple-500">
                  <ArrowUp className="h-3 w-3" />
                  مُصعَّد: {getLevelName(itemEscalation.escalation_level)}
                </Badge>
              )}
              {(item as any).is_recurring && (
                <Badge variant="outline" className="gap-1">
                  <Repeat className="h-3 w-3" />
                  متكرر
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono">{item.ref_number || 'بدون رقم مرجعي'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Show recipient-only badge */}
          {isRecipient && !canEdit && (
            <Badge variant="outline" className="gap-1 bg-muted">
              <Eye className="h-3 w-3" />
              مستلم (عرض فقط)
            </Badge>
          )}
          <TestWhatsAppDialog itemId={item.id} itemTitle={item.title} />
          <SendTelegramDialog itemId={item.id} itemTitle={item.title} />
          {/* Only show edit button if user has permission */}
          {canEdit && (
            <Button onClick={() => navigate(`/items/${item.id}/edit`)}>
              <Edit className="ml-2 h-4 w-4" />
              تعديل
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Actions - Only show if user can edit or has workflow actions */}
      {canEdit ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">إجراءات سير العمل</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowActions 
              itemId={item.id} 
              currentStatus={workflowStatus}
            />
            {workflowStatus === 'finished' && (
              <p className="text-sm text-success mt-2">
                ✓ تم إنهاء المعاملة بنجاح
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert className="border-muted bg-muted/50">
          <Eye className="h-4 w-4" />
          <AlertDescription>
            أنت مستلم لهذه المعاملة. يمكنك المشاهدة فقط دون إمكانية التعديل.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for Details and Timeline */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">التفاصيل</TabsTrigger>
          <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">معلومات العنصر</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">حالة الصلاحية</span>
                  {getStatusBadge(item.status, item.expiry_date)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">حالة سير العمل</span>
                  {getWorkflowBadge(workflowStatus)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الفئة</span>
                  <span className="font-medium">{item.category?.name || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                  <span className="font-medium">{format(new Date(item.expiry_date), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">وقت الانتهاء:</span>
                  <span className="font-medium">{item.expiry_time || '09:00'}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">الأيام المتبقية</p>
                  <p className={`text-2xl font-bold ${daysLeft < 0 ? 'text-destructive' : daysLeft <= 7 ? 'text-warning' : 'text-success'}`}>
                    {daysLeft < 0 ? `منتهي منذ ${Math.abs(daysLeft)} يوم` : `${daysLeft} يوم`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">معلومات إضافية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">المسؤول:</span>
                  <span className="font-medium">{item.responsible_person || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">القسم:</span>
                  <span className="font-medium">{item.owner_department || '-'}</span>
                </div>
                {item.reminder_rule && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">قاعدة التذكير:</span>
                    <span className="font-medium">{item.reminder_rule.name}</span>
                  </div>
                )}
                {item.notes && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">ملاحظات:</p>
                    <p className="p-3 bg-muted rounded-lg text-sm">{item.notes}</p>
                  </div>
                )}
                {item.attachment_url && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">المرفق:</p>
                    <a 
                      href={item.attachment_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      عرض المرفق
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completion Proof Card - Show when item is done or finished */}
            {(workflowStatus === 'done_pending_supervisor' || workflowStatus === 'finished') && (
              <Card className="border-success/30 bg-success/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-success" />
                    إثبات الإنهاء
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(item as any).completion_description ? (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm">وصف ما تم:</p>
                      <p className="p-3 bg-background rounded-lg text-sm border">
                        {(item as any).completion_description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">لا يوجد وصف</p>
                  )}
                  
                  {(item as any).completion_attachment_url && (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm">مرفق الإثبات:</p>
                      <a 
                        href={(item as any).completion_attachment_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        عرض المرفق
                      </a>
                    </div>
                  )}

                  {(item as any).completion_date && (
                    <div className="text-xs text-muted-foreground">
                      تاريخ الإنهاء: {format(new Date((item as any).completion_date), 'dd/MM/yyyy HH:mm')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ItemTimeline itemId={item.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ItemDetails;
