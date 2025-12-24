import React from 'react';
import { Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransitionTimeStats, useReturnsAndEscalations } from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';

interface TransitionStatsProps {
  departmentId: string | null;
}

const transitionLabels: Record<string, { from: string; to: string }> = {
  new_to_acknowledged: { from: 'جديد', to: 'تم الاستلام' },
  acknowledged_to_in_progress: { from: 'تم الاستلام', to: 'قيد التنفيذ' },
  in_progress_to_done: { from: 'قيد التنفيذ', to: 'بانتظار المشرف' },
  done_to_finished: { from: 'بانتظار المشرف', to: 'منتهي' },
};

const TransitionStats: React.FC<TransitionStatsProps> = ({ departmentId }) => {
  const { data: transitions, isLoading: transLoading } = useTransitionTimeStats({ departmentId });
  const { data: returnsData, isLoading: returnsLoading } = useReturnsAndEscalations({ departmentId });

  if (transLoading || returnsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            إحصاءات الانتقال
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          متوسط زمن الانتقال
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transition Times */}
        <div className="space-y-3">
          {Object.entries(transitionLabels).map(([key, labels]) => {
            const hours = transitions?.[key];
            return (
              <div 
                key={key} 
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{labels.from}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{labels.to}</span>
                </div>
                <span className="font-bold text-primary">
                  {hours !== null && hours !== undefined 
                    ? `${hours} ساعة` 
                    : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Returns & Escalations */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            آخر 30 يوم
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-destructive/10 text-center">
              <p className="text-2xl font-bold text-destructive">
                {returnsData?.returns || 0}
              </p>
              <p className="text-xs text-destructive/80">إرجاعات</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 text-center">
              <p className="text-2xl font-bold text-warning">
                {returnsData?.escalations || 0}
              </p>
              <p className="text-xs text-warning/80">تصعيدات</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TransitionStats;
