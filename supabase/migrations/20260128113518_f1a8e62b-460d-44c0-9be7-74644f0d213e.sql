-- Create the attachments storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments', 
  'attachments', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid() IS NOT NULL));

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid() IS NOT NULL));