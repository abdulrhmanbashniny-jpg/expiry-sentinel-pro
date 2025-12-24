import React from 'react';
import { Clock, ArrowRight, User, Monitor, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useItemTimeline } from '@/hooks/useWorkflowActions';
import { WORKFLOW_STATUS_LABELS, WorkflowStatus } from '@/hooks/useDashboardData';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ItemTimelineProps {
  itemId: string;
}

const channelIcons: Record<string, React.ElementType> = {
  web: Monitor,
  telegram: MessageCircle,
};

const channelLabels: Record<string, string> = {
  web: 'الويب',
  telegram: 'تيليجرام',
};

const ItemTimeline: React.FC<ItemTimelineProps> = ({ itemId }) => {
  const { data: timeline, isLoading } = useItemTimeline(itemId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            السجل الزمني
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          السجل الزمني
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!timeline || timeline.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            لا يوجد سجل زمني
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {timeline.map((entry, index) => {
                const oldStatus = entry.old_status as WorkflowStatus | null;
                const newStatus = entry.new_status as WorkflowStatus;
                const ChannelIcon = channelIcons[entry.channel || 'web'] || Monitor;

                return (
                  <div key={entry.id} className="relative pr-10">
                    {/* Timeline dot */}
                    <div className={`absolute right-2 top-2 w-4 h-4 rounded-full border-2 bg-background
                      ${index === 0 ? 'border-primary bg-primary' : 'border-muted-foreground'}`} 
                    />

                    <div className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                      {/* Status transition */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {oldStatus && (
                          <>
                            <Badge variant="outline" className="text-xs">
                              {WORKFLOW_STATUS_LABELS[oldStatus] || oldStatus}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <Badge className={`text-xs ${getStatusColor(newStatus)}`}>
                          {WORKFLOW_STATUS_LABELS[newStatus] || newStatus}
                        </Badge>
                      </div>

                      {/* Reason if exists */}
                      {entry.reason && !entry.reason.startsWith('DATA_QUALITY') && (
                        <p className="text-sm text-muted-foreground mb-2 bg-muted/50 p-2 rounded">
                          <strong>السبب:</strong> {entry.reason}
                        </p>
                      )}

                      {/* Footer info */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          <span>{entry.changed_by_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <ChannelIcon className="h-3 w-3" />
                            <span>{channelLabels[entry.channel || 'web'] || entry.channel}</span>
                          </div>
                          <span>
                            {formatDistanceToNow(new Date(entry.changed_at), { 
                              locale: ar, 
                              addSuffix: true 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const getStatusColor = (status: WorkflowStatus): string => {
  const colors: Record<WorkflowStatus, string> = {
    new: 'bg-muted text-muted-foreground',
    acknowledged: 'bg-primary/15 text-primary',
    in_progress: 'bg-warning/15 text-warning',
    done_pending_supervisor: 'bg-accent/15 text-accent',
    returned: 'bg-destructive/15 text-destructive',
    escalated_to_manager: 'bg-destructive/20 text-destructive',
    finished: 'bg-success/15 text-success',
  };
  return colors[status] || '';
};

export default ItemTimeline;
