-- Add expiry_time column to items table
ALTER TABLE public.items 
ADD COLUMN expiry_time time DEFAULT '09:00:00';

-- Add notification_time to settings for default reminder time
UPDATE public.settings 
SET value = '{"timezone": "Asia/Riyadh", "daily_check_time": "08:00", "notification_time": "09:00"}'::jsonb
WHERE key = 'notification_settings';

-- Update settings if not exists
INSERT INTO public.settings (key, value)
VALUES ('notification_settings', '{"timezone": "Asia/Riyadh", "daily_check_time": "08:00", "notification_time": "09:00"}'::jsonb)
ON CONFLICT (key) DO NOTHING;