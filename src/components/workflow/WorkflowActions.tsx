import React, { useState } from 'react';
import { 
  CheckCircle2, 
  PlayCircle, 
  FileCheck, 
  RotateCcw, 
  ArrowUp, 
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useWorkflowAction, 
  getAvailableActions, 
  isActionBlocked,
  WorkflowStatus 
} from '@/hooks/useWorkflowActions';
import { useAuth } from '@/contexts/AuthContext';
import CompletionProofDialog from './CompletionProofDialog';

interface WorkflowActionsProps {
  itemId: string;
  currentStatus: WorkflowStatus;
  onActionComplete?: () => void;
}

const actionIcons: Record<string, React.ElementType> = {
  acknowledge: FileCheck,
  start: PlayCircle,
  done: CheckCircle2,
  approve: CheckCircle2,
  return: RotateCcw,
  escalate: ArrowUp,
  manager_close: CheckCircle2,
  resubmit: PlayCircle,
};

const WorkflowActions: React.FC<WorkflowActionsProps> = ({
  itemId,
  currentStatus,
  onActionComplete,
}) => {
  const { role } = useAuth();
  const workflowAction = useWorkflowAction();
  
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const availableActions = getAvailableActions(currentStatus, role);

  const handleAction = async (action: string, requiresReason: boolean) => {
    // For 'done' action, show completion proof dialog
    if (action === 'done') {
      setCompletionDialogOpen(true);
      return;
    }

    if (requiresReason) {
      setPendingAction(action);
      setReason('');
      setReasonError('');
      setReasonDialogOpen(true);
      return;
    }

    // Check guard rails
    const guardCheck = isActionBlocked(action, currentStatus);
    if (guardCheck.blocked) {
      return; // Button should already be disabled
    }

    await workflowAction.mutateAsync({ itemId, action });
    onActionComplete?.();
  };

  // Handle completion with proof
  const handleCompletionConfirm = async (description?: string, attachmentUrl?: string) => {
    await workflowAction.mutateAsync({ 
      itemId, 
      action: 'done',
      completionDescription: description,
      completionAttachmentUrl: attachmentUrl,
    });
    setCompletionDialogOpen(false);
    onActionComplete?.();
  };

  const handleReasonSubmit = async () => {
    if (!reason.trim()) {
      setReasonError('السبب مطلوب');
      return;
    }

    if (!pendingAction) return;

    await workflowAction.mutateAsync({ 
      itemId, 
      action: pendingAction, 
      reason: reason.trim() 
    });
    
    setReasonDialogOpen(false);
    setPendingAction(null);
    setReason('');
    onActionComplete?.();
  };

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {availableActions.map(({ action, label, requiresReason, variant }) => {
          const Icon = actionIcons[action] || CheckCircle2;
          const guardCheck = isActionBlocked(action, currentStatus);
          const isDisabled = guardCheck.blocked || workflowAction.isPending;

          return (
            <div key={action} className="relative group">
              <Button
                variant={variant}
                size="sm"
                disabled={isDisabled}
                onClick={() => handleAction(action, requiresReason)}
                className="gap-2"
              >
                {workflowAction.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {label}
              </Button>
              {guardCheck.blocked && (
                <div className="absolute bottom-full mb-2 right-0 hidden group-hover:block z-50">
                  <Alert variant="destructive" className="w-64 p-2">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {guardCheck.message}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reason Dialog */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'return' ? 'سبب الإرجاع' : 'سبب التصعيد'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === 'return' 
                ? 'يرجى إدخال سبب إرجاع المعاملة'
                : 'يرجى إدخال سبب تصعيد المعاملة للمدير'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">السبب *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError('');
                }}
                placeholder="اكتب السبب هنا..."
                rows={4}
                className={reasonError ? 'border-destructive' : ''}
              />
              {reasonError && (
                <p className="text-sm text-destructive">{reasonError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReasonDialogOpen(false)}
              disabled={workflowAction.isPending}
            >
              إلغاء
            </Button>
            <Button
              variant={pendingAction === 'return' ? 'destructive' : 'default'}
              onClick={handleReasonSubmit}
              disabled={workflowAction.isPending}
            >
              {workflowAction.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completion Proof Dialog */}
      <CompletionProofDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        itemId={itemId}
        onConfirm={handleCompletionConfirm}
        isSubmitting={workflowAction.isPending}
      />
    </>
  );
};

export default WorkflowActions;
