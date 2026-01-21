-- Create item_deadlines table for multiple deadlines per item (vehicle)
CREATE TABLE public.item_deadlines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  deadline_type TEXT NOT NULL CHECK (deadline_type IN ('license', 'inspection', 'insurance')),
  deadline_label TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, deadline_type)
);

-- Enable Row Level Security
ALTER TABLE public.item_deadlines ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view deadlines for items they have access to" 
ON public.item_deadlines 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.items i 
    WHERE i.id = item_id 
    AND (
      i.created_by_user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('system_admin', 'admin', 'supervisor')
      )
    )
  )
);

CREATE POLICY "Users can create deadlines for items they manage" 
ON public.item_deadlines 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items i 
    WHERE i.id = item_id 
    AND (
      i.created_by_user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('system_admin', 'admin', 'supervisor')
      )
    )
  )
);

CREATE POLICY "Users can update deadlines for items they manage" 
ON public.item_deadlines 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.items i 
    WHERE i.id = item_id 
    AND (
      i.created_by_user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('system_admin', 'admin', 'supervisor')
      )
    )
  )
);

CREATE POLICY "Users can delete deadlines for items they manage" 
ON public.item_deadlines 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.items i 
    WHERE i.id = item_id 
    AND (
      i.created_by_user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.role IN ('system_admin', 'admin', 'supervisor')
      )
    )
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_item_deadlines_updated_at
BEFORE UPDATE ON public.item_deadlines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_item_deadlines_item_id ON public.item_deadlines(item_id);
CREATE INDEX idx_item_deadlines_due_date ON public.item_deadlines(due_date);
CREATE INDEX idx_item_deadlines_status ON public.item_deadlines(status);

-- Enable realtime for deadlines
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_deadlines;

COMMENT ON TABLE public.item_deadlines IS 'Stores multiple deadline dates per item (e.g., license, inspection, insurance for vehicles)';