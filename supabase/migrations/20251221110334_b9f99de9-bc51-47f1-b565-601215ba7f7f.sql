-- Add telegram_id column to recipients table
ALTER TABLE public.recipients 
ADD COLUMN telegram_id TEXT;