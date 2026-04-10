-- Hot-path read indexes for marketplace, orders, and license flows.
-- Safe to run repeatedly.

CREATE INDEX IF NOT EXISTS idx_products_marketplace_visible_created_at
  ON public.products (marketplace_visible, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_visible_status_created_at
  ON public.products (status, created_at DESC)
  WHERE marketplace_visible = true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'business_type'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_marketplace_business_type ON public.products (business_type) WHERE marketplace_visible = true';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON public.orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_product_payment_status
  ON public.orders (product_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_license_keys_assigned_to_created_at
  ON public.license_keys (assigned_to, created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.favorites') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_favorites_user_product ON public.favorites (user_id, product_id)';
  END IF;
END
$$;
