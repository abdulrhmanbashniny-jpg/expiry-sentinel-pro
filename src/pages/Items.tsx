import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Trash2, Edit, Archive, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItems } from '@/hooks/useItems';
import { useCategories } from '@/hooks/useCategories';
import { useDepartments } from '@/hooks/useDepartments';
import { format } from 'date-fns';
import { ItemStatus } from '@/types/database';
import { WorkflowStatus, WORKFLOW_STATUS_LABELS } from '@/hooks/useDashboardData';
import TestWhatsAppDialog from '@/components/TestWhatsAppDialog';
import SendTelegramDialog from '@/components/SendTelegramDialog';
import BulkReminderDialog from '@/components/items/BulkReminderDialog';

const Items: React.FC = () => {
  const navigate = useNavigate();
  const { items, isLoading, updateItem, deleteItem } = useItems();
  const { categories } = useCategories();
  const { departments } = useDepartments();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('active');
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);

  // Sequential filtering: Department → Category → Items
  const filteredCategories = useMemo(() => {
    if (departmentFilter === 'all') return categories;
    return categories.filter(cat => cat.department_id === departmentFilter);
  }, [categories, departmentFilter]);

  // Reset category filter when department changes
  const handleDepartmentChange = (value: string) => {
    setDepartmentFilter(value);
    setCategoryFilter('all'); // Reset category when department changes
  };

  // Filter items based on workflow tab
  const getFilteredByWorkflow = () => {
    if (workflowFilter === 'finished') {
      return items.filter(item => (item as any).workflow_status === 'finished');
    }
    // Active = all except finished
    return items.filter(item => (item as any).workflow_status !== 'finished');
  };

  const filteredItems = getFilteredByWorkflow().filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.responsible_person?.toLowerCase().includes(search.toLowerCase()) ||
      item.ref_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || (item as any).department_id === departmentFilter;
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    return matchesSearch && matchesStatus && matchesDepartment && matchesCategory;
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
    return <Badge className={`text-xs ${colors[workflowStatus] || ''}`}>{label}</Badge>;
  };

  const activeCount = items.filter(i => (i as any).workflow_status !== 'finished').length;
  const finishedCount = items.filter(i => (i as any).workflow_status === 'finished').length;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">العناصر</h1>
          <p className="text-muted-foreground">إدارة التراخيص والعقود والوثائق</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkReminderOpen(true)} className="gap-2">
            <Bell className="h-4 w-4" />
            تذكير جماعي
          </Button>
          <Button onClick={() => navigate('/items/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة عنصر
          </Button>
        </div>
      </div>

      {/* Workflow Tabs */}
      <Tabs value={workflowFilter} onValueChange={setWorkflowFilter} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="gap-2">
            النشطة
            <Badge variant="secondary" className="mr-1">{activeCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="finished" className="gap-2">
            المنتهية
            <Badge variant="secondary" className="mr-1">{finishedCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters - Sequential: Department → Category → Items */}
      <Card>
        <CardContent className="flex flex-wrap gap-4 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="بحث بالعنوان أو المسؤول أو الرقم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={handleDepartmentChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأقسام</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="الفئة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="expired">منتهي</SelectItem>
              <SelectItem value="archived">مؤرشف</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">جاري التحميل...</div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {workflowFilter === 'finished' ? 'لا توجد معاملات منتهية' : 'لا توجد عناصر'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {workflowFilter === 'finished' 
                    ? 'المعاملات المنتهية ستظهر هنا'
                    : 'ابدأ بإضافة عنصر جديد'
                  }
                </p>
              </div>
              {workflowFilter !== 'finished' && (
                <Button onClick={() => navigate('/items/new')}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة عنصر
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الرقم التسلسلي</th>
                    <th>العنوان</th>
                    <th>الفئة</th>
                    <th>حالة العمل</th>
                    <th>تاريخ الانتهاء</th>
                    <th>المسؤول</th>
                    <th>حالة الصلاحية</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="cursor-pointer" onClick={() => navigate(`/items/${item.id}`)}>
                      <td className="font-mono text-sm text-primary">{item.ref_number || '-'}</td>
                      <td className="font-medium">{item.title}</td>
                      <td>{item.category?.name || '-'}</td>
                      <td>{getWorkflowBadge((item as any).workflow_status || 'new')}</td>
                      <td>{format(new Date(item.expiry_date), 'dd/MM/yyyy')}</td>
                      <td>{item.responsible_person || '-'}</td>
                      <td>{getStatusBadge(item.status, item.expiry_date)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <TestWhatsAppDialog 
                            itemId={item.id} 
                            itemTitle={item.title}
                          />
                          <SendTelegramDialog 
                            itemId={item.id} 
                            itemTitle={item.title}
                          />
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/items/${item.id}/edit`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => updateItem.mutate({ id: item.id, status: 'archived' })}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteItem.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Reminder Dialog */}
      <BulkReminderDialog
        items={filteredItems.map(item => ({
          id: item.id,
          title: item.title,
          ref_number: item.ref_number,
          expiry_date: item.expiry_date,
          responsible_person: item.responsible_person,
          department_id: (item as any).department_id,
        }))}
        open={bulkReminderOpen}
        onOpenChange={setBulkReminderOpen}
      />
    </div>
  );
};

export default Items;
