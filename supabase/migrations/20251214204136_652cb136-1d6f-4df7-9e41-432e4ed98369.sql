-- Create study-files bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-files', 'study-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'study-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'study-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'study-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'study-files' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);