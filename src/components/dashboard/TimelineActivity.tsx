import React from 'react';
import { Activity, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  useTimelineActivity, 
  WORKFLOW_STATUS_LABELS, 
  WORKFLOW_STATUS_COLORS,
  WorkflowStatus 
} from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TimelineActivityProps {
  departmentId: string | null;
}

const TimelineActivity: React.FC<TimelineActivityProps> = ({ departmentId }) => {
  const { data: activities, isLoading } = useTimelineActivity({ departmentId }, 15);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            آخر التغييرات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          آخر التغييرات
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activities || activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            لا توجد تغييرات حديثة
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {activities.map((activity) => {
              const newStatus = activity.new_status as WorkflowStatus;
              const oldStatus = activity.old_status as WorkflowStatus | null;
              
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {activity.item?.title || activity.item?.ref_number || 'معاملة'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {oldStatus && (
                        <>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${WORKFLOW_STATUS_COLORS[oldStatus] || ''}`}
                          >
                            {WORKFLOW_STATUS_LABELS[oldStatus] || oldStatus}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </>
                      )}
                      <Badge className={`text-xs ${WORKFLOW_STATUS_COLORS[newStatus] || ''}`}>
                        {WORKFLOW_STATUS_LABELS[newStatus] || newStatus}
                      </Badge>
                    </div>
                    {activity.reason && !activity.reason.startsWith('DATA_QUALITY') && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        السبب: {activity.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.changed_at), { 
                      locale: ar, 
                      addSuffix: true 
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimelineActivity;
