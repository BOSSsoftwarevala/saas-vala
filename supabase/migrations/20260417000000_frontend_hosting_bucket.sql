-- Create frontend hosting bucket for web application
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'frontend',
  'frontend',
  true,
  52428800, -- 50MB limit for frontend assets
  ARRAY['text/html', 'text/css', 'text/javascript', 'application/javascript', 'application/json', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'font/woff', 'font/woff2', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security for frontend bucket
-- Public read access for all frontend assets
CREATE POLICY "Public frontend assets are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'frontend');

-- Admins can upload and manage frontend assets
CREATE POLICY "Admins can upload frontend assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'frontend' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can update frontend assets"
ON storage.objects FOR UPDATE
TO authenticated
WITH CHECK (
  bucket_id = 'frontend' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admins can delete frontend assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'frontend' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
