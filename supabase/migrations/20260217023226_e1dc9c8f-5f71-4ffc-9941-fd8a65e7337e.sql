
-- 1. Create APK storage bucket (private - no direct access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('apks', 'apks', false)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: Only super_admin can upload APKs
CREATE POLICY "Super admin can upload APKs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'apks' 
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3. RLS: Only super_admin can update APKs
CREATE POLICY "Super admin can update APKs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'apks' 
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

-- 4. RLS: Only super_admin can delete APKs
CREATE POLICY "Super admin can delete APKs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'apks' 
  AND has_role(auth.uid(), 'super_admin'::app_role)
);

-- 5. RLS: Authenticated users can read APKs (download via signed URL only)
CREATE POLICY "Authenticated users can read APKs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'apks' 
  AND auth.uid() IS NOT NULL
);

-- 6. Add download_logs table for tracking all APK downloads with device info
CREATE TABLE IF NOT EXISTS public.apk_download_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  license_key TEXT NOT NULL,
  device_id TEXT,
  download_ip TEXT,
  signed_url_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.apk_download_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own download logs"
ON public.apk_download_logs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert download logs"
ON public.apk_download_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Super admin full access download logs"
ON public.apk_download_logs FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 7. Add license_verification_logs table
CREATE TABLE IF NOT EXISTS public.license_verification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key TEXT NOT NULL,
  device_id TEXT,
  app_signature TEXT,
  user_id UUID,
  result TEXT NOT NULL, -- 'valid', 'invalid', 'blocked', 'wrong_device'
  reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.license_verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access verification logs"
ON public.license_verification_logs FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert verification logs"
ON public.license_verification_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users view own verification logs"
ON public.license_verification_logs FOR SELECT
USING (user_id = auth.uid());
