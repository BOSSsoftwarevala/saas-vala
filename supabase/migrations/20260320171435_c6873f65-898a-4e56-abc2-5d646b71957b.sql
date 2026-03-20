-- Performance indexes for 5000+ products scale
CREATE INDEX IF NOT EXISTS idx_products_business_type ON public.products (business_type);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_marketplace_visible ON public.products (marketplace_visible);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON public.products (business_type, status, marketplace_visible);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_products_trending ON public.products (trending) WHERE trending = true;

-- License keys performance
CREATE INDEX IF NOT EXISTS idx_license_keys_created_by ON public.license_keys (created_by);
CREATE INDEX IF NOT EXISTS idx_license_keys_product_id ON public.license_keys (product_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys (status);

-- Orders/transactions performance
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions (status);