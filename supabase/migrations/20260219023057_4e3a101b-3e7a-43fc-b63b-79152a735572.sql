
-- Add missing columns to products table
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS app_hash TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS tags_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS keywords_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS license_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS device_limit INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS device_bind BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_type TEXT DEFAULT 'lifetime',
  ADD COLUMN IF NOT EXISTS require_payment BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS secure_download BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS log_downloads BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS demo_url TEXT,
  ADD COLUMN IF NOT EXISTS demo_login TEXT,
  ADD COLUMN IF NOT EXISTS demo_password TEXT,
  ADD COLUMN IF NOT EXISTS demo_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_category TEXT,
  ADD COLUMN IF NOT EXISTS nano_category TEXT,
  ADD COLUMN IF NOT EXISTS micro_category TEXT,
  ADD COLUMN IF NOT EXISTS deep_category TEXT,
  ADD COLUMN IF NOT EXISTS tech_stack_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS use_case TEXT,
  ADD COLUMN IF NOT EXISTS target_industry TEXT,
  ADD COLUMN IF NOT EXISTS source_method TEXT DEFAULT 'apk',
  ADD COLUMN IF NOT EXISTS apk_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS apk_version_code INTEGER,
  ADD COLUMN IF NOT EXISTS demo_click_count INTEGER DEFAULT 0;

-- Unique index on package_name
CREATE UNIQUE INDEX IF NOT EXISTS products_package_name_idx ON public.products(package_name) WHERE package_name IS NOT NULL;

-- Storage policies for apks bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can upload APKs'
  ) THEN
    CREATE POLICY "Authenticated users can upload APKs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'apks');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can read APKs'
  ) THEN
    CREATE POLICY "Authenticated users can read APKs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'apks');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can delete own APKs'
  ) THEN
    CREATE POLICY "Authenticated users can delete own APKs"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'apks');
  END IF;
END $$;
