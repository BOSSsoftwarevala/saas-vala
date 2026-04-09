ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS plan_duration TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_keys_plan_duration_chk'
  ) THEN
    ALTER TABLE public.license_keys
      ADD CONSTRAINT license_keys_plan_duration_chk
      CHECK (plan_duration IN ('1M', '3M', '6M', '12M', 'lifetime'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_license_keys_plan_duration
  ON public.license_keys(plan_duration);
