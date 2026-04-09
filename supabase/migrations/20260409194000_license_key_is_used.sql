ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_license_keys_is_used
  ON public.license_keys(is_used);
