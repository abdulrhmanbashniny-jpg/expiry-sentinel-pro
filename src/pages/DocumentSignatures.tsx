import React, { useState, useRef } from 'react';
import { useDocumentSignatures, usePendingSignatures } from '@/hooks/useDocumentSignatures';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, FileSignature, Clock, CheckCircle2, XCircle, 
  FileText, Download, Send, PenTool, AlertCircle 
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'بانتظار التوقيع', variant: 'secondary', icon: <Clock className="h-4 w-4" /> },
  signed: { label: 'تم التوقيع', variant: 'default', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  rejected: { label: 'مرفوض', variant: 'destructive', icon: <XCircle className="h-4 w-4" /> },
  expired: { label: 'منتهي', variant: 'outline', icon: <AlertCircle className="h-4 w-4" /> },
};

export default function DocumentSignatures() {
  const { documents, isLoading, createDocument, signDocument, rejectSignature } = useDocumentSignatures();
  const { data: pendingSignatures } = usePendingSignatures();
  const { hasRole } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // رسم التوقيع
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async (requestId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const signatureData = canvas.toDataURL('image/png');
    await signDocument.mutateAsync({ requestId, signatureData });
    setSignDialogOpen(null);
    clearSignature();
  };

  const handleReject = async (requestId: string) => {
    await rejectSignature.mutateAsync({ requestId, reason: rejectionReason });
    setRejectDialogOpen(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileSignature className="h-8 w-8" />
            التوقيع الإلكتروني
          </h1>
          <p className="text-muted-foreground">توقيع المستندات إلكترونياً</p>
        </div>
        {hasRole('admin') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="ml-2 h-4 w-4" /> طلب توقيع جديد</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إرسال مستند للتوقيع</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    هذه ميزة MVP - يمكن تطويرها لاحقاً لدعم رفع الملفات وإضافة موقعين متعددين
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>عنوان المستند</Label>
                  <Input placeholder="مثال: عقد توظيف - أحمد محمد" />
                </div>
                <div className="space-y-2">
                  <Label>رابط المستند</Label>
                  <Input placeholder="أدخل رابط المستند..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button disabled>
                    <Send className="ml-2 h-4 w-4" /> إرسال للتوقيع
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* التوقيعات المطلوبة مني */}
      {pendingSignatures && pendingSignatures.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <PenTool className="h-5 w-5" />
              مستندات بانتظار توقيعك ({pendingSignatures.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingSignatures.map(request => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{request.document.document_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(request.created_at), { locale: ar, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <a href={request.document.document_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 ml-1" /> عرض
                      </a>
                    </Button>
                    <Dialog open={signDialogOpen === request.id} onOpenChange={(open) => setSignDialogOpen(open ? request.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <PenTool className="h-4 w-4 ml-1" /> توقيع
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>التوقيع على المستند</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            ارسم توقيعك في المربع أدناه:
                          </p>
                          <div className="border rounded-lg p-2 bg-white">
                            <canvas
                              ref={canvasRef}
                              width={400}
                              height={150}
                              className="border rounded cursor-crosshair w-full"
                              onMouseDown={startDrawing}
                              onMouseMove={draw}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                            />
                          </div>
                          <div className="flex justify-between">
                            <Button variant="outline" size="sm" onClick={clearSignature}>
                              مسح التوقيع
                            </Button>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => setSignDialogOpen(null)}>
                                إلغاء
                              </Button>
                              <Button onClick={() => handleSign(request.id)} disabled={signDocument.isPending}>
                                <CheckCircle2 className="h-4 w-4 ml-1" />
                                {signDocument.isPending ? 'جاري التوقيع...' : 'تأكيد التوقيع'}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            بتوقيعك هذا المستند، فإنك توافق على محتواه وشروطه
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={rejectDialogOpen === request.id} onOpenChange={(open) => setRejectDialogOpen(open ? request.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <XCircle className="h-4 w-4 ml-1" /> رفض
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>رفض التوقيع</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Textarea
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder="اكتب سبب الرفض..."
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setRejectDialogOpen(null)}>
                              إلغاء
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleReject(request.id)}
                              disabled={!rejectionReason || rejectSignature.isPending}
                            >
                              تأكيد الرفض
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* إحصائيات */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المستندات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">بانتظار التوقيع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {documents.filter(d => d.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">مكتملة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {documents.filter(d => d.signature_requests?.every(r => r.status === 'signed')).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">مرفوضة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {documents.filter(d => d.signature_requests?.some(r => r.status === 'rejected')).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* قائمة المستندات */}
      <Card>
        <CardHeader>
          <CardTitle>المستندات</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان المستند</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead>حالة التوقيعات</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    لا توجد مستندات
                  </TableCell>
                </TableRow>
              ) : (
                documents.map(doc => {
                  const signedCount = doc.signature_requests?.filter(r => r.status === 'signed').length || 0;
                  const totalCount = doc.signature_requests?.length || 0;
                  
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {doc.document_title}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(doc.created_at), { locale: ar, addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={signedCount === totalCount ? 'default' : 'secondary'}>
                            {signedCount} / {totalCount} توقيعات
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={doc.document_url} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
