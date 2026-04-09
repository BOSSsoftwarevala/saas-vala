-- Reseller pricing, key pool, and reporting support
-- This migration aligns DB schema with marketplace reseller purchase flows.
-- 1) Transaction enums: support marketplace reseller flow types/statuses used by API code.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    BEGIN
      ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'purchase';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'credit_add';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    BEGIN
      ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'success';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'refunded';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

-- 2) Reseller pricing defaults.
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_spent_reset_at TIMESTAMPTZ;

-- 3) Per-reseller per-product pricing override table.
CREATE TABLE IF NOT EXISTS public.reseller_product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  margin_percent NUMERIC(5,2),
  fixed_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reseller_product_pricing_unique UNIQUE (reseller_id, product_id),
  CONSTRAINT reseller_product_pricing_margin_chk CHECK (margin_percent IS NULL OR (margin_percent >= 0 AND margin_percent <= 100)),
  CONSTRAINT reseller_product_pricing_fixed_chk CHECK (fixed_price IS NULL OR fixed_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_reseller_product_pricing_reseller ON public.reseller_product_pricing(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_product_pricing_product ON public.reseller_product_pricing(product_id);

-- 4) License key ownership/key-pool/strict mapping columns.
ALTER TABLE public.license_keys
  ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS key_signature TEXT,
  ADD COLUMN IF NOT EXISTS key_status TEXT DEFAULT 'unused',
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- key_status values used in app logic.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_keys_key_status_chk'
  ) THEN
    ALTER TABLE public.license_keys
      ADD CONSTRAINT license_keys_key_status_chk
      CHECK (key_status IN ('pool', 'pending_activation', 'unused', 'active', 'expired', 'blocked', 'revoked'));
  END IF;
END$$;

-- Strict transaction -> key mapping when available.
CREATE UNIQUE INDEX IF NOT EXISTS idx_license_keys_purchase_transaction
  ON public.license_keys(purchase_transaction_id)
  WHERE purchase_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_license_keys_reseller_product_status
  ON public.license_keys(reseller_id, product_id, key_status);

-- 5) License activation table for binding keys to device/install/hardware identifiers.
CREATE TABLE IF NOT EXISTS public.license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key_id UUID NOT NULL REFERENCES public.license_keys(id) ON DELETE CASCADE,
  device_id TEXT,
  hardware_id TEXT,
  installation_id TEXT,
  activated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT license_activations_one_binding_chk CHECK (
    COALESCE(NULLIF(device_id, ''), NULLIF(hardware_id, ''), NULLIF(installation_id, '')) IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_license_activations_key ON public.license_activations(license_key_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_device ON public.license_activations(device_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_hardware ON public.license_activations(hardware_id);
CREATE INDEX IF NOT EXISTS idx_license_activations_installation ON public.license_activations(installation_id);
