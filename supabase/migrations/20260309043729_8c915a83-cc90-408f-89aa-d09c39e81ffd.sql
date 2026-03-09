
-- APK Build Pipeline Queue table
CREATE TABLE public.apk_build_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  target_industry TEXT,
  build_status TEXT NOT NULL DEFAULT 'pending',
  build_started_at TIMESTAMPTZ,
  build_completed_at TIMESTAMPTZ,
  build_error TEXT,
  build_attempts INTEGER DEFAULT 0,
  apk_file_path TEXT,
  apk_file_size BIGINT,
  product_id UUID,
  license_template TEXT DEFAULT 'SV-2026',
  marketplace_listed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apk_build_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access apk_build_queue"
  ON public.apk_build_queue FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated can view builds"
  ON public.apk_build_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);
