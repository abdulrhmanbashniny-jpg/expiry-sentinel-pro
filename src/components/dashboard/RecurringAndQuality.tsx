import React from 'react';
import { Repeat, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRecurringItemsStats, useDataQualityWarnings } from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';

interface RecurringAndQualityProps {
  departmentId: string | null;
}

const RecurringAndQuality: React.FC<RecurringAndQualityProps> = ({ departmentId }) => {
  const { data: recurringData, isLoading: recurringLoading } = useRecurringItemsStats({ 
    departmentId 
  });
  const { data: qualityData, isLoading: qualityLoading } = useDataQualityWarnings();

  if (recurringLoading || qualityLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Recurring Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            المعاملات المتكررة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-2xl font-bold text-primary">
                {recurringData?.recurring || 0}
              </p>
              <p className="text-xs text-primary/80">متكررة</p>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold">
                {recurringData?.nonRecurring || 0}
              </p>
              <p className="text-xs text-muted-foreground">غير متكررة</p>
            </div>
          </div>

          {recurringData?.topRecurring && recurringData.topRecurring.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                الأكثر تكراراً
              </p>
              <div className="space-y-2">
                {recurringData.topRecurring.map((item, idx) => (
                  <div 
                    key={item.parentId} 
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate flex-1">{item.title}</span>
                    <Badge variant="secondary">{item.count} مرات</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            جودة البيانات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-warning/10 text-center mb-4">
            <p className="text-3xl font-bold text-warning">
              {qualityData?.count || 0}
            </p>
            <p className="text-sm text-warning/80">تحذيرات عدم تطابق القسم</p>
          </div>

          {qualityData?.warnings && qualityData.warnings.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                آخر التحذيرات
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {qualityData.warnings.slice(0, 5).map((warning) => (
                  <div 
                    key={warning.id} 
                    className="text-sm p-2 rounded bg-muted/50"
                  >
                    <p className="font-medium truncate">
                      {warning.item?.title || warning.item?.ref_number || 'معاملة'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(warning.changed_at).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!qualityData?.warnings || qualityData.warnings.length === 0) && (
            <p className="text-center text-success text-sm">
              ✓ لا توجد تحذيرات
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecurringAndQuality;
