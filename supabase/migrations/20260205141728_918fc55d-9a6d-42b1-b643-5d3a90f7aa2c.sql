-- إضافة Cron Job لتشغيل التصعيدات كل ساعة
SELECT cron.schedule(
  'process-escalations-hourly',
  '0 * * * *',  -- كل ساعة
  $$
  SELECT net.http_post(
    url := 'https://aazshokdhlodzaafrifh.supabase.co/functions/v1/process-escalations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);