import React from 'react';
import { 
  FileCheck, 
  FileInput, 
  PlayCircle, 
  Clock, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  useDashboardWorkflowStats, 
  WorkflowStatus, 
  WORKFLOW_STATUS_LABELS 
} from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkflowStatusStatsProps {
  departmentId: string | null;
}

const statusIcons: Record<WorkflowStatus, React.ElementType> = {
  new: FileInput,
  acknowledged: FileCheck,
  in_progress: PlayCircle,
  done_pending_supervisor: Clock,
  returned: RotateCcw,
  escalated_to_manager: AlertTriangle,
  finished: CheckCircle2,
};

const statusColors: Record<WorkflowStatus, { bg: string; text: string }> = {
  new: { bg: 'bg-muted', text: 'text-muted-foreground' },
  acknowledged: { bg: 'bg-primary/10', text: 'text-primary' },
  in_progress: { bg: 'bg-warning/10', text: 'text-warning' },
  done_pending_supervisor: { bg: 'bg-accent/10', text: 'text-accent' },
  returned: { bg: 'bg-destructive/10', text: 'text-destructive' },
  escalated_to_manager: { bg: 'bg-destructive/15', text: 'text-destructive' },
  finished: { bg: 'bg-success/10', text: 'text-success' },
};

const WorkflowStatusStats: React.FC<WorkflowStatusStatsProps> = ({ departmentId }) => {
  const { data: stats, isLoading } = useDashboardWorkflowStats({ departmentId });

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const statuses: WorkflowStatus[] = [
    'new',
    'acknowledged',
    'in_progress',
    'done_pending_supervisor',
    'returned',
    'escalated_to_manager',
    'finished',
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
      {statuses.map((status) => {
        const Icon = statusIcons[status];
        const colors = statusColors[status];
        const count = stats?.[status] || 0;

        return (
          <Card key={status} className="stat-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${colors.bg}`}>
                  <Icon className={`h-5 w-5 ${colors.text}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {WORKFLOW_STATUS_LABELS[status]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WorkflowStatusStats;
