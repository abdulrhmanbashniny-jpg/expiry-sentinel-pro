import React, { useState, useRef } from 'react';
import { Loader2, Upload, X, Image as ImageIcon, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompletionProofDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  onConfirm: (description?: string, attachmentUrl?: string) => Promise<void>;
  isSubmitting: boolean;
}

const CompletionProofDialog: React.FC<CompletionProofDialogProps> = ({
  open,
  onOpenChange,
  itemId,
  onConfirm,
  isSubmitting,
}) => {
  const [description, setDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'نوع ملف غير مدعوم',
        description: 'يُسمح فقط بالصور (JPEG, PNG, GIF, WebP) أو PDF',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'الملف كبير جداً',
        description: 'الحد الأقصى لحجم الملف 5 ميجابايت',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `completion-proofs/${itemId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(data.path);

      setAttachmentUrl(urlData.publicUrl);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }

      toast({ title: 'تم رفع الملف بنجاح' });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'فشل رفع الملف',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentUrl(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    await onConfirm(description.trim() || undefined, attachmentUrl || undefined);
    // Reset form
    setDescription('');
    setAttachmentUrl(null);
    setPreviewUrl(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
      setDescription('');
      setAttachmentUrl(null);
      setPreviewUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>إثبات إنهاء الخدمة</DialogTitle>
          <DialogDescription>
            يمكنك إضافة وصف أو صورة لتوثيق إنجاز المهمة (اختياري)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="completion-desc">وصف ما تم إنجازه (اختياري)</Label>
            <Textarea
              id="completion-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: تم تجديد الرخصة وإرفاق الصورة..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>إرفاق صورة أو ملف (اختياري)</Label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!attachmentUrl ? (
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-dashed flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSubmitting}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>جاري الرفع...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    <span>اضغط لاختيار ملف</span>
                    <span className="text-xs text-muted-foreground">
                      صور أو PDF (حتى 5 ميجابايت)
                    </span>
                  </>
                )}
              </Button>
            ) : (
              <div className="relative border rounded-lg p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 left-1 h-6 w-6"
                  onClick={handleRemoveAttachment}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>

                {previewUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={previewUrl}
                      alt="معاينة"
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <ImageIcon className="h-4 w-4" />
                        <span>تم رفع الصورة بنجاح</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pr-8">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">ملف PDF</p>
                      <p className="text-xs text-muted-foreground">تم الرفع بنجاح</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الإرسال...
              </>
            ) : (
              'تأكيد الإنجاز'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompletionProofDialog;
