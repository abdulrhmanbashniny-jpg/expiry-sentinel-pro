import React, { useState } from 'react';
import { useAuditLog, AUDIT_ACTIONS, ENTITY_TYPES } from '@/hooks/useAuditLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Filter, Eye, User, FileText, Settings } from 'lucide-react';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-purple-100 text-purple-800',
  logout: 'bg-gray-100 text-gray-800',
  approve: 'bg-emerald-100 text-emerald-800',
  reject: 'bg-orange-100 text-orange-800',
  export: 'bg-cyan-100 text-cyan-800',
  import: 'bg-indigo-100 text-indigo-800',
  status_change: 'bg-amber-100 text-amber-800',
  password_change: 'bg-pink-100 text-pink-800',
  settings_change: 'bg-slate-100 text-slate-800',
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  item: <FileText className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  contract: <FileText className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

export default function AuditLog() {
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    fromDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    toDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const { data: auditLogs, isLoading } = useAuditLog({
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
    limit: 200,
  });

  const renderJsonDiff = (oldValues: any, newValues: any) => {
    if (!oldValues && !newValues) return null;

    const allKeys = new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ]);

    return (
      <div className="space-y-2">
        {Array.from(allKeys).map(key => {
          const oldVal = oldValues?.[key];
          const newVal = newValues?.[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);

          if (!changed && !oldVal && !newVal) return null;

          return (
            <div key={key} className={`p-2 rounded ${changed ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <span className="font-medium text-sm">{key}:</span>
              {changed ? (
                <div className="flex flex-col gap-1 mt-1 text-sm">
                  {oldVal !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 line-through">
                        {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                      </span>
                    </div>
                  )}
                  {newVal !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">
                        {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground mr-2">
                  {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            سجل التدقيق
          </h1>
          <p className="text-muted-foreground">تتبع جميع العمليات والتغييرات في النظام</p>
        </div>
      </div>

      {/* الفلاتر */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> تصفية السجلات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>نوع الكيان</Label>
              <Select
                value={filters.entityType || 'all'}
                onValueChange={v => setFilters({ ...filters, entityType: v === 'all' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(ENTITY_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نوع العملية</Label>
              <Select
                value={filters.action || 'all'}
                onValueChange={v => setFilters({ ...filters, action: v === 'all' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {Object.entries(AUDIT_ACTIONS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={e => setFilters({ ...filters, toDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* جدول السجلات */}
      <Card>
        <CardHeader>
          <CardTitle>السجلات ({auditLogs?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ والوقت</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>العملية</TableHead>
                <TableHead>الكيان</TableHead>
                <TableHead>التفاصيل</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : auditLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا توجد سجلات
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs?.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">
                      <div>{format(new Date(entry.created_at), 'yyyy/MM/dd', { locale: ar })}</div>
                      <div className="text-muted-foreground text-xs">
                        {format(new Date(entry.created_at), 'HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{entry.user_email || 'النظام'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[entry.action] || 'bg-gray-100'}>
                        {AUDIT_ACTIONS[entry.action as keyof typeof AUDIT_ACTIONS] || entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ENTITY_ICONS[entry.entity_type] || <FileText className="h-4 w-4" />}
                        <div>
                          <div className="text-sm">
                            {ENTITY_TYPES[entry.entity_type as keyof typeof ENTITY_TYPES] || entry.entity_type}
                          </div>
                          {entry.entity_name && (
                            <div className="text-xs text-muted-foreground">{entry.entity_name}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {entry.old_values || entry.new_values ? 'تغييرات متعددة' : '-'}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>تفاصيل السجل</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-muted-foreground">التاريخ والوقت</Label>
                                  <p>{format(new Date(entry.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: ar })}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">المستخدم</Label>
                                  <p>{entry.user_email || 'النظام'}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">العملية</Label>
                                  <Badge className={ACTION_COLORS[entry.action] || 'bg-gray-100'}>
                                    {AUDIT_ACTIONS[entry.action as keyof typeof AUDIT_ACTIONS] || entry.action}
                                  </Badge>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">الكيان</Label>
                                  <p>{ENTITY_TYPES[entry.entity_type as keyof typeof ENTITY_TYPES] || entry.entity_type}</p>
                                </div>
                                {entry.ip_address && (
                                  <div>
                                    <Label className="text-muted-foreground">عنوان IP</Label>
                                    <p className="font-mono text-sm">{entry.ip_address}</p>
                                  </div>
                                )}
                              </div>

                              {(entry.old_values || entry.new_values) && (
                                <div>
                                  <Label className="text-muted-foreground mb-2 block">التغييرات</Label>
                                  {renderJsonDiff(entry.old_values, entry.new_values)}
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
