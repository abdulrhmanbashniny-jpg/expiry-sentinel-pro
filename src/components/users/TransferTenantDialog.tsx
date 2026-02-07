import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TransferTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    tenant_id: string | null;
  } | null;
  onSuccess: () => void;
}

interface Tenant {
  id: string;
  name: string;
  code: string;
}

export function TransferTenantDialog({ open, onOpenChange, user, onSuccess }: TransferTenantDialogProps) {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedTenantId('');
      fetchTenants();
    }
  }, [open]);

  const fetchTenants = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTenants(data || []);
    } catch (error: any) {
      toast({ title: 'خطأ في جلب الشركات', description: error.message, variant: 'destructive' });
    } finally {
      setFetching(false);
    }
  };

  const handleTransfer = async () => {
    if (!user || !selectedTenantId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tenant_id: selectedTenantId })
        .eq('user_id', user.user_id);
      if (error) throw error;

      const targetTenant = tenants.find(t => t.id === selectedTenantId);
      toast({
        title: 'تم النقل بنجاح',
        description: `تم نقل ${user.full_name} إلى شركة ${targetTenant?.name}`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: 'خطأ في النقل', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const currentTenant = tenants.find(t => t.id === user?.tenant_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            نقل موظف إلى شركة أخرى
          </DialogTitle>
          <DialogDescription>
            نقل <strong>{user?.full_name}</strong> ({user?.email}) إلى شركة مختلفة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>الشركة الحالية</Label>
            <div className="p-2 rounded-md bg-muted text-sm">
              {currentTenant ? `${currentTenant.name} (${currentTenant.code})` : 'غير محدد'}
            </div>
          </div>

          <div className="space-y-2">
            <Label>الشركة الجديدة *</Label>
            {fetching ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">جاري تحميل الشركات...</span>
              </div>
            ) : (
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشركة" />
                </SelectTrigger>
                <SelectContent>
                  {tenants
                    .filter(t => t.id !== user?.tenant_id)
                    .map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleTransfer} disabled={loading || !selectedTenantId}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ArrowRightLeft className="h-4 w-4 ml-2" />}
            نقل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
