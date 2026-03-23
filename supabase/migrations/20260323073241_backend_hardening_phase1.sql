-- ============================================================
-- BACKEND HARDENING PHASE 1: DATABASE HARDENING
-- Adds indexes, missing tables, atomic functions, constraints
-- ============================================================

-- ============================================================
-- SECTION 1: INDEXES ON CORE TABLES (Performance & Query Speed)
-- ============================================================

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products(created_by);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- License keys indexes
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_user_id ON public.license_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_product_id ON public.license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON public.license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_expires_at ON public.license_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);

-- Wallets table indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Resellers indexes
CREATE INDEX IF NOT EXISTS idx_resellers_user_id ON public.resellers(user_id);
CREATE INDEX IF NOT EXISTS idx_resellers_status ON public.resellers(status) WHERE status IS NOT NULL;

-- Leads indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email) WHERE email IS NOT NULL;

-- Marketplace orders indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON public.marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(status);

-- Marketplace listings indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_product_id ON public.marketplace_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON public.marketplace_listings(status);

-- Servers indexes
CREATE INDEX IF NOT EXISTS idx_servers_created_by ON public.servers(created_by);
CREATE INDEX IF NOT EXISTS idx_servers_status ON public.servers(status) WHERE status IS NOT NULL;

-- Deployments indexes
CREATE INDEX IF NOT EXISTS idx_deployments_server_id ON public.deployments(server_id);
CREATE INDEX IF NOT EXISTS idx_deployments_triggered_by ON public.deployments(triggered_by);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON public.deployments(created_at DESC);

-- Activity logs indexes (audit trail performance)
CREATE INDEX IF NOT EXISTS idx_activity_logs_performed_by ON public.activity_logs(performed_by) WHERE performed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON public.activity_logs(entity_type);

-- ============================================================
-- SECTION 2: DEVICES TABLE (device fingerprint system)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT DEFAULT 'unknown' CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_trusted BOOLEAN DEFAULT false NOT NULL,
  is_blocked BOOLEAN DEFAULT false NOT NULL,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON public.devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_is_blocked ON public.devices(is_blocked) WHERE is_blocked = true;

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can insert own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can delete devices"
  ON public.devices FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- SECTION 3: FRANCHISE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.franchise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  franchise_name TEXT NOT NULL,
  territory TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 10.00 NOT NULL
    CHECK (commission_rate >= 0 AND commission_rate <= 100),
  status TEXT DEFAULT 'active' NOT NULL
    CHECK (status IN ('active', 'inactive', 'suspended')),
  parent_franchise_id UUID REFERENCES public.franchise(id) ON DELETE SET NULL,
  balance NUMERIC(14,2) DEFAULT 0 NOT NULL CHECK (balance >= 0),
  total_sales NUMERIC(14,2) DEFAULT 0 NOT NULL CHECK (total_sales >= 0),
  meta JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_franchise_user_id ON public.franchise(user_id);
CREATE INDEX IF NOT EXISTS idx_franchise_status ON public.franchise(status);
CREATE INDEX IF NOT EXISTS idx_franchise_parent ON public.franchise(parent_franchise_id) WHERE parent_franchise_id IS NOT NULL;

ALTER TABLE public.franchise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own franchise"
  ON public.franchise FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage franchise"
  ON public.franchise FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ============================================================
-- SECTION 4: PAYMENT LOGS TABLE (detailed payment audit)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'INR' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_reference TEXT,
  gateway_response JSONB DEFAULT '{}' NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON public.payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_transaction_id ON public.payment_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON public.payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON public.payment_logs(created_at DESC);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment logs"
  ON public.payment_logs FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert payment logs"
  ON public.payment_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- SECTION 5: RATE LIMIT TRACKING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1 NOT NULL CHECK (request_count >= 0),
  window_start TIMESTAMPTZ DEFAULT date_trunc('minute', now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(identifier, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_identifier ON public.api_rate_limits(identifier, endpoint);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON public.api_rate_limits(window_start);

-- No RLS needed — managed exclusively by service role
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.api_rate_limits FOR ALL
  USING (false);

-- Auto-cleanup function: remove rate limit records older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.api_rate_limits
  WHERE window_start < now() - INTERVAL '1 hour';
$$;

-- ============================================================
-- SECTION 6: ATOMIC WALLET OPERATIONS (Concurrency Control)
-- These functions use SELECT FOR UPDATE to prevent race conditions
-- ============================================================

-- Atomic wallet debit (prevents double-spend)
CREATE OR REPLACE FUNCTION public.atomic_wallet_debit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Debit',
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock the wallet row to prevent concurrent modifications
  SELECT id, balance INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance',
      'available', v_wallet.balance, 'requested', p_amount);
  END IF;

  v_new_balance := v_wallet.balance - p_amount;

  UPDATE public.wallets
  SET balance = v_new_balance
  WHERE id = v_wallet.id;

  INSERT INTO public.transactions (
    wallet_id, type, amount, balance_after, status, description,
    created_by, reference_id, reference_type
  ) VALUES (
    v_wallet.id, 'debit', p_amount, v_new_balance, 'completed',
    p_description, p_user_id, p_reference_id, p_reference_type
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;

-- Atomic wallet credit
CREATE OR REPLACE FUNCTION public.atomic_wallet_credit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Credit',
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock the wallet row to prevent concurrent modifications
  SELECT id, balance INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_new_balance := v_wallet.balance + p_amount;

  UPDATE public.wallets
  SET balance = v_new_balance
  WHERE id = v_wallet.id;

  INSERT INTO public.transactions (
    wallet_id, type, amount, balance_after, status, description,
    created_by, meta
  ) VALUES (
    v_wallet.id, 'credit', p_amount, v_new_balance, 'completed',
    p_description, p_user_id,
    CASE WHEN p_payment_method IS NOT NULL
      THEN jsonb_build_object('payment_method', p_payment_method,
        'reference_id', p_reference_id, 'reference_type', p_reference_type)
      ELSE NULL
    END
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_new_balance,
    'transaction_id', v_tx_id
  );
END;
$$;

-- ============================================================
-- SECTION 7: RATE LIMIT CHECK FUNCTION
-- Returns true if request is within allowed limits
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 60,
  p_window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_window := date_trunc('minute', now()) - (((date_part('minute', now())::integer % p_window_minutes)) * INTERVAL '1 minute');

  INSERT INTO public.api_rate_limits (identifier, endpoint, request_count, window_start)
  VALUES (p_identifier, p_endpoint, 1, v_window)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

-- ============================================================
-- SECTION 8: DATA INTEGRITY — ensure non-negative wallet balances
-- ============================================================

ALTER TABLE public.wallets
  ADD CONSTRAINT IF NOT EXISTS chk_wallets_balance_non_negative CHECK (balance >= 0);

-- ============================================================
-- SECTION 9: UPDATED_AT TRIGGERS for new tables
-- ============================================================

CREATE TRIGGER set_franchise_updated_at
  BEFORE UPDATE ON public.franchise
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_payment_logs_updated_at
  BEFORE UPDATE ON public.payment_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
