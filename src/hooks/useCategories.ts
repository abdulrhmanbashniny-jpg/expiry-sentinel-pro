import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export const useCategories = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
  });

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; code?: string; description?: string }) => {
      const { data: category, error } = await supabase
        .from('categories')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'تم إضافة الفئة بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في إضافة الفئة',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Category> & { id: string }) => {
      const { data: category, error } = await supabase
        .from('categories')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'تم تحديث الفئة بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في تحديث الفئة',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'تم حذف الفئة بنجاح' });
    },
    onError: (error) => {
      toast({
        title: 'خطأ في حذف الفئة',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    categories: categoriesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
