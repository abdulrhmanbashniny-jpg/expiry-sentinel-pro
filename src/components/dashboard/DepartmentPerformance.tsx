import React from 'react';
import { Building2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useDepartmentPerformance } from '@/hooks/useDashboardData';
import { Skeleton } from '@/components/ui/skeleton';

const DepartmentPerformance: React.FC = () => {
  const { data: departments, isLoading } = useDepartmentPerformance();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            أداء الأقسام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            أداء الأقسام
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            لا توجد بيانات أقسام
          </p>
        </CardContent>
      </Card>
    );
  }

  const topDepts = departments.slice(0, 3);
  const bottomDepts = departments.slice(-3).reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          أداء الأقسام
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Performers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">الأفضل أداءً</span>
          </div>
          <div className="space-y-3">
            {topDepts.map((dept, index) => (
              <div key={dept.id} className="flex items-center gap-3">
                <span className="text-lg font-bold text-success w-6">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium truncate">{dept.name}</span>
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      {dept.completionRate}%
                    </Badge>
                  </div>
                  <Progress value={dept.completionRate} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Performers */}
        {bottomDepts.length > 0 && bottomDepts[0]?.completionRate < 100 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">يحتاج تحسين</span>
            </div>
            <div className="space-y-3">
              {bottomDepts.filter((d) => d.completionRate < 80).map((dept) => (
                <div key={dept.id} className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium truncate">{dept.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          {dept.delayed} متأخر
                        </Badge>
                        <Badge variant="secondary">
                          {dept.completionRate}%
                        </Badge>
                      </div>
                    </div>
                    <Progress 
                      value={dept.completionRate} 
                      className="h-2 [&>div]:bg-destructive" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DepartmentPerformance;
