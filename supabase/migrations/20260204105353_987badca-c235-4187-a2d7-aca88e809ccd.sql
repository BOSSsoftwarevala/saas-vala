-- Create storage bucket for support chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-media', 'support-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to support-media bucket
CREATE POLICY "Users can upload support media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support-media');

-- Allow authenticated users to view support media
CREATE POLICY "Users can view support media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'support-media');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete own support media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'support-media' AND auth.uid()::text = (storage.foldername(name))[1]);