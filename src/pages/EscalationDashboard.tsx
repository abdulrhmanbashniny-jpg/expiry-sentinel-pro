import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, Shield, User, Users, Briefcase } from "lucide-react";

const EscalationDashboard = () => {
  const stats = [
    { title: "مهام الموظفين", count: 12, icon: User, color: "text-blue-500" },
    { title: "تصعيد للمشرف", count: 5, icon: Users, color: "text-yellow-500" },
    { title: "تصعيد للمدير", count: 2, icon: Briefcase, color: "text-orange-500" },
    { title: "تصعيد للموارد البشرية", count: 1, icon: Shield, color: "text-red-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">لوحة تحكم التصعيد التلقائي</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock size={16} />
          <span>آخر تحديث: منذ دقيقة</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={stat.color} size={20} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-orange-500" />
            المعاملات النشطة في مسار التصعيد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* مثال لمعاملة واحدة */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              <div>
                <div className="font-semibold">تجديد عقد الموظف: أحمد محمد</div>
                <div className="text-sm text-gray-500">منتهي الصلاحية منذ 3 أيام</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                  المستوى الحالي: المدير
                </div>
                <div className="text-sm font-medium text-red-600">
                  سيتم التصعيد لـ HR خلال 14 ساعة
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EscalationDashboard;
