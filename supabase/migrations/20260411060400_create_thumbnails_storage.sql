-- Create thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thumbnails',
  'thumbnails',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security for thumbnails
CREATE POLICY "Public thumbnails are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "Anyone can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Anyone can update their own thumbnails"
ON storage.objects FOR UPDATE
USING (bucket_id = 'thumbnails');

CREATE POLICY "Anyone can delete their own thumbnails"
ON storage.objects FOR DELETE
USING (bucket_id = 'thumbnails');

-- Create function to automatically generate thumbnail when demo_url is updated
CREATE OR REPLACE FUNCTION generate_product_thumbnail()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate thumbnail if demo_url is provided and has changed
  IF NEW.demo_url IS NOT NULL 
     AND NEW.demo_url != OLD.demo_url 
     AND NEW.demo_url != '' THEN
    
    -- Update the thumbnail_url to a temporary value to indicate generation is in progress
    NEW.thumbnail_url := '/softwarevala-logo.png';
    
    -- Note: The actual thumbnail generation will be handled by the application
    -- This trigger ensures the thumbnail_url field is updated when demo_url changes
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update thumbnail when demo_url changes
DROP TRIGGER IF EXISTS auto_generate_thumbnail ON products;
CREATE TRIGGER auto_generate_thumbnail
  BEFORE UPDATE OF demo_url ON products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_thumbnail();
