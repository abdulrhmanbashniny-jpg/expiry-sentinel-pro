import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Edit, Calendar, User, Building, FileText, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useItems } from '@/hooks/useItems';
import { format } from 'date-fns';
import { ItemStatus } from '@/types/database';
import TestWhatsAppDialog from '@/components/TestWhatsAppDialog';
import SendTelegramDialog from '@/components/SendTelegramDialog';

const ItemDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, isLoading } = useItems();

  const item = items.find(i => i.id === id);

  const getStatusBadge = (status: ItemStatus, expiryDate: string) => {
    const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (status === 'archived') return <Badge variant="secondary">مؤرشف</Badge>;
    if (status === 'expired' || daysLeft < 0) return <Badge variant="destructive">منتهي</Badge>;
    if (daysLeft <= 7) return <Badge className="bg-warning text-warning-foreground">قريب جداً</Badge>;
    if (daysLeft <= 30) return <Badge className="bg-primary/80 text-primary-foreground">قريب</Badge>;
    return <Badge className="bg-success text-success-foreground">نشط</Badge>;
  };

  const getDaysLeft = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">العنصر غير موجود</p>
        <Button onClick={() => navigate('/items')}>
          <ArrowRight className="ml-2 h-4 w-4" />
          العودة للعناصر
        </Button>
      </div>
    );
  }

  const daysLeft = getDaysLeft(item.expiry_date);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/items')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{item.title}</h1>
            <p className="text-muted-foreground font-mono">{item.ref_number || 'بدون رقم مرجعي'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TestWhatsAppDialog itemId={item.id} itemTitle={item.title} />
          <SendTelegramDialog itemId={item.id} itemTitle={item.title} />
          <Button onClick={() => navigate(`/items/${item.id}/edit`)}>
            <Edit className="ml-2 h-4 w-4" />
            تعديل
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">معلومات العنصر</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الحالة</span>
              {getStatusBadge(item.status, item.expiry_date)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الفئة</span>
              <span className="font-medium">{item.category?.name || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">تاريخ الانتهاء:</span>
              <span className="font-medium">{format(new Date(item.expiry_date), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">وقت الانتهاء:</span>
              <span className="font-medium">{item.expiry_time || '09:00'}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">الأيام المتبقية</p>
              <p className={`text-2xl font-bold ${daysLeft < 0 ? 'text-destructive' : daysLeft <= 7 ? 'text-warning' : 'text-success'}`}>
                {daysLeft < 0 ? `منتهي منذ ${Math.abs(daysLeft)} يوم` : `${daysLeft} يوم`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">معلومات إضافية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">المسؤول:</span>
              <span className="font-medium">{item.responsible_person || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">القسم:</span>
              <span className="font-medium">{item.owner_department || '-'}</span>
            </div>
            {item.reminder_rule && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">قاعدة التذكير:</span>
                <span className="font-medium">{item.reminder_rule.name}</span>
              </div>
            )}
            {item.notes && (
              <div className="space-y-2">
                <p className="text-muted-foreground">ملاحظات:</p>
                <p className="p-3 bg-muted rounded-lg text-sm">{item.notes}</p>
              </div>
            )}
            {item.attachment_url && (
              <div className="space-y-2">
                <p className="text-muted-foreground">المرفق:</p>
                <a 
                  href={item.attachment_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  عرض المرفق
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ItemDetails;
