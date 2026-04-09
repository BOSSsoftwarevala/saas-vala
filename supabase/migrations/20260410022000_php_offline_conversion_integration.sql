ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS build_type TEXT;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_build_type_chk;

ALTER TABLE public.products
  ADD CONSTRAINT products_build_type_chk
  CHECK (
    build_type IS NULL OR
    build_type IN ('web_apk', 'php_offline', 'desktop_webview', 'electron_exe', 'android_webview', 'ios_webview')
  );

ALTER TABLE public.source_code_catalog
  ADD COLUMN IF NOT EXISTS source_kind TEXT DEFAULT 'github_repo',
  ADD COLUMN IF NOT EXISTS source_language TEXT,
  ADD COLUMN IF NOT EXISTS source_bucket_path TEXT,
  ADD COLUMN IF NOT EXISTS source_repo_url TEXT,
  ADD COLUMN IF NOT EXISTS source_visibility TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS conversion_mode TEXT,
  ADD COLUMN IF NOT EXISTS offline_runtime_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.source_code_catalog
  DROP CONSTRAINT IF EXISTS source_code_catalog_source_kind_chk;

ALTER TABLE public.source_code_catalog
  ADD CONSTRAINT source_code_catalog_source_kind_chk
  CHECK (source_kind IN ('github_repo', 'zip_upload', 'manual'));

ALTER TABLE public.source_code_catalog
  DROP CONSTRAINT IF EXISTS source_code_catalog_source_visibility_chk;

ALTER TABLE public.source_code_catalog
  ADD CONSTRAINT source_code_catalog_source_visibility_chk
  CHECK (source_visibility IN ('private', 'restricted'));

ALTER TABLE public.apk_build_queue
  ADD COLUMN IF NOT EXISTS source_catalog_id UUID REFERENCES public.source_code_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_kind TEXT,
  ADD COLUMN IF NOT EXISTS source_bucket_path TEXT,
  ADD COLUMN IF NOT EXISTS source_repo_url TEXT,
  ADD COLUMN IF NOT EXISTS conversion_type TEXT NOT NULL DEFAULT 'web_to_apk',
  ADD COLUMN IF NOT EXISTS output_platform TEXT NOT NULL DEFAULT 'android_apk',
  ADD COLUMN IF NOT EXISTS output_version TEXT,
  ADD COLUMN IF NOT EXISTS output_file_hash TEXT,
  ADD COLUMN IF NOT EXISTS build_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.apk_build_queue
  DROP CONSTRAINT IF EXISTS apk_build_queue_conversion_type_chk;

ALTER TABLE public.apk_build_queue
  ADD CONSTRAINT apk_build_queue_conversion_type_chk
  CHECK (conversion_type IN ('web_to_apk', 'php_offline', 'desktop_wrapper'));

ALTER TABLE public.apk_build_queue
  DROP CONSTRAINT IF EXISTS apk_build_queue_output_platform_chk;

ALTER TABLE public.apk_build_queue
  ADD CONSTRAINT apk_build_queue_output_platform_chk
  CHECK (output_platform IN ('android_apk', 'windows_exe', 'desktop_webview', 'electron_exe', 'ios_bundle'));

CREATE INDEX IF NOT EXISTS idx_source_code_catalog_source_kind_status
  ON public.source_code_catalog(source_kind, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_apk_build_queue_conversion_status
  ON public.apk_build_queue(conversion_type, output_platform, build_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.offline_conversion_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES public.apk_build_queue(id) ON DELETE SET NULL,
  source_catalog_id UUID REFERENCES public.source_code_catalog(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  conversion_type TEXT NOT NULL DEFAULT 'php_offline',
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,
  license_runtime_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
  build_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, platform, version)
);

ALTER TABLE public.offline_conversion_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access offline_conversion_artifacts" ON public.offline_conversion_artifacts;
CREATE POLICY "Super admin full access offline_conversion_artifacts"
ON public.offline_conversion_artifacts
FOR ALL
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role]));

DROP POLICY IF EXISTS "Authenticated can read own scope artifacts" ON public.offline_conversion_artifacts;
CREATE POLICY "Authenticated can read own scope artifacts"
ON public.offline_conversion_artifacts
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    public.has_any_role(auth.uid(), ARRAY['super_admin'::public.app_role, 'admin'::public.app_role])
    OR EXISTS (
      SELECT 1
      FROM public.license_keys lk
      WHERE lk.product_id = offline_conversion_artifacts.product_id
        AND (
          lk.user_id = auth.uid()
          OR lk.created_by = auth.uid()
        )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_offline_conversion_artifacts_product_platform_version
  ON public.offline_conversion_artifacts(product_id, platform, version, created_at DESC);

CREATE OR REPLACE FUNCTION public.finalize_offline_conversion_build(
  p_queue_id UUID,
  p_product_id UUID,
  p_platform TEXT,
  p_version TEXT,
  p_file_path TEXT,
  p_file_size BIGINT DEFAULT NULL,
  p_file_hash TEXT DEFAULT NULL,
  p_conversion_type TEXT DEFAULT 'php_offline',
  p_build_type TEXT DEFAULT 'php_offline',
  p_license_runtime_bundle JSONB DEFAULT '{}'::jsonb,
  p_build_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue RECORD;
  v_artifact_id UUID;
  v_expected_prefix TEXT;
BEGIN
  IF p_product_id IS NULL OR COALESCE(trim(p_version), '') = '' OR COALESCE(trim(p_file_path), '') = '' THEN
    RAISE EXCEPTION 'Missing required conversion output values';
  END IF;

  IF p_file_path !~ '^builds\/[^\/]+\/[^\/]+\/[^\s]+$' THEN
    RAISE EXCEPTION 'Invalid build output path. Expected builds/{productId}/{version}/{file}';
  END IF;

  v_expected_prefix := format('builds/%s/%s/', p_product_id::text, trim(p_version));
  IF position(v_expected_prefix in p_file_path) <> 1 THEN
    RAISE EXCEPTION 'Build path does not match product/version namespace';
  END IF;

  IF p_queue_id IS NOT NULL THEN
    SELECT * INTO v_queue FROM public.apk_build_queue WHERE id = p_queue_id FOR UPDATE;
  END IF;

  INSERT INTO public.offline_conversion_artifacts (
    queue_id,
    source_catalog_id,
    product_id,
    conversion_type,
    platform,
    version,
    file_path,
    file_size,
    file_hash,
    license_runtime_bundle,
    build_meta,
    created_by,
    created_at
  ) VALUES (
    p_queue_id,
    v_queue.source_catalog_id,
    p_product_id,
    COALESCE(NULLIF(trim(p_conversion_type), ''), 'php_offline'),
    COALESCE(NULLIF(trim(p_platform), ''), 'android_apk'),
    trim(p_version),
    trim(p_file_path),
    p_file_size,
    NULLIF(trim(COALESCE(p_file_hash, '')), ''),
    COALESCE(p_license_runtime_bundle, '{}'::jsonb),
    COALESCE(p_build_meta, '{}'::jsonb),
    auth.uid(),
    now()
  )
  ON CONFLICT (product_id, platform, version)
  DO UPDATE SET
    queue_id = EXCLUDED.queue_id,
    source_catalog_id = EXCLUDED.source_catalog_id,
    conversion_type = EXCLUDED.conversion_type,
    file_path = EXCLUDED.file_path,
    file_size = EXCLUDED.file_size,
    file_hash = EXCLUDED.file_hash,
    license_runtime_bundle = EXCLUDED.license_runtime_bundle,
    build_meta = EXCLUDED.build_meta,
    created_by = EXCLUDED.created_by,
    created_at = now()
  RETURNING id INTO v_artifact_id;

  UPDATE public.products
  SET
    build_type = COALESCE(NULLIF(trim(p_build_type), ''), 'php_offline'),
    source_method = COALESCE(NULLIF(trim(p_conversion_type), ''), 'php_offline'),
    apk_url = trim(p_file_path),
    apk_enabled = true,
    download_enabled = true,
    license_enabled = true,
    is_apk = true,
    storage_path = trim(p_file_path),
    updated_at = now()
  WHERE id = p_product_id;

  IF p_queue_id IS NOT NULL THEN
    UPDATE public.apk_build_queue
    SET
      build_status = 'completed',
      build_completed_at = now(),
      build_error = NULL,
      apk_file_path = trim(p_file_path),
      apk_file_size = p_file_size,
      output_file_hash = NULLIF(trim(COALESCE(p_file_hash, '')), ''),
      output_version = trim(p_version),
      conversion_type = COALESCE(NULLIF(trim(p_conversion_type), ''), conversion_type),
      output_platform = COALESCE(NULLIF(trim(p_platform), ''), output_platform),
      build_meta = COALESCE(build_meta, '{}'::jsonb) || COALESCE(p_build_meta, '{}'::jsonb),
      marketplace_listed = true,
      updated_at = now()
    WHERE id = p_queue_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'artifact_id', v_artifact_id,
    'queue_id', p_queue_id,
    'product_id', p_product_id,
    'file_path', trim(p_file_path)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_offline_conversion_build(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_offline_conversion_build(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
