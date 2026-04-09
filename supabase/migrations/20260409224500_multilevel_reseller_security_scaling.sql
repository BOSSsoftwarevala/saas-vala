ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS parent_reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reseller_level TEXT NOT NULL DEFAULT 'sub' CHECK (reseller_level IN ('master', 'sub', 'client')),
  ADD COLUMN IF NOT EXISTS upstream_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_keys_per_day INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_wallet_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_resellers_parent_reseller_id ON public.resellers(parent_reseller_id);
CREATE INDEX IF NOT EXISTS idx_resellers_level_blocked ON public.resellers(reseller_level, is_blocked);

CREATE TABLE IF NOT EXISTS public.reseller_allowed_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_allowed_products_reseller ON public.reseller_allowed_products(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_allowed_products_product ON public.reseller_allowed_products(product_id);

CREATE TABLE IF NOT EXISTS public.reseller_fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  meta JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_fraud_events_reseller ON public.reseller_fraud_events(reseller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_fraud_events_severity ON public.reseller_fraud_events(severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.reseller_generate_license_key_atomic(
  p_request_id text,
  p_user_id uuid,
  p_reseller_id uuid,
  p_wallet_id uuid,
  p_product_id uuid,
  p_amount numeric,
  p_plan_duration text,
  p_license_key text,
  p_key_signature text,
  p_key_type text,
  p_expires_at timestamptz,
  p_client_id uuid default null,
  p_sell_price numeric default null,
  p_delivery_status text default 'pending',
  p_notes text default null,
  p_meta jsonb default '{}'::jsonb,
  p_device_limit integer default 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(12,2);
  v_wallet record;
  v_tx_id uuid;
  v_key_id uuid;
  v_idem record;
  v_response jsonb;
  v_daily_count integer;
  v_has_allowlist boolean;
  v_now timestamptz := now();

  v_current_reseller_id uuid;
  v_parent_id uuid;
  v_commission_percent numeric(5,2);
  v_commission_amount numeric(12,2);
  v_parent_wallet record;
  v_parent_user_id uuid;
  v_parent_max_wallet_limit numeric(12,2);
  v_parent_blocked boolean;
  v_loop_guard integer := 0;
BEGIN
  v_amount := round(COALESCE(p_amount, 0)::numeric, 2);

  IF COALESCE(trim(p_request_id), '') = '' THEN
    RAISE EXCEPTION 'Transaction failed';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction failed';
  END IF;

  IF COALESCE(trim(p_license_key), '') = '' THEN
    RAISE EXCEPTION 'Key generation failed';
  END IF;

  IF p_sell_price IS NOT NULL AND p_sell_price < v_amount THEN
    RAISE EXCEPTION 'Sell price cannot be below reseller minimum price';
  END IF;

  PERFORM 1
  FROM public.resellers r
  WHERE r.id = p_reseller_id
    AND COALESCE(r.is_blocked, false) = true;

  IF FOUND THEN
    RAISE EXCEPTION 'Reseller account is blocked';
  END IF;

  SELECT COUNT(*)::int
  INTO v_daily_count
  FROM public.license_keys lk
  WHERE lk.reseller_id = p_reseller_id
    AND lk.created_at >= date_trunc('day', v_now)
    AND COALESCE(lk.key_status, '') <> 'pool';

  IF EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = p_reseller_id
      AND COALESCE(r.max_keys_per_day, 0) > 0
      AND v_daily_count >= r.max_keys_per_day
  ) THEN
    RAISE EXCEPTION 'Reseller key daily limit reached';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.license_keys lk
    WHERE lk.reseller_id = p_reseller_id
      AND lk.created_at >= (v_now - interval '1 minute')
      AND COALESCE(lk.key_status, '') <> 'pool'
    GROUP BY lk.reseller_id
    HAVING COUNT(*) >= 25
  ) THEN
    UPDATE public.resellers
    SET is_blocked = true,
        blocked_reason = 'Automated fraud control: abnormal key generation burst',
        blocked_at = v_now
    WHERE id = p_reseller_id;

    INSERT INTO public.reseller_fraud_events (reseller_id, event_type, severity, description, meta)
    VALUES (
      p_reseller_id,
      'abnormal_key_generation_burst',
      'critical',
      'Automatic block due to excessive key generation velocity',
      jsonb_build_object('window_seconds', 60, 'threshold', 25, 'detected_at', v_now)
    );

    RAISE EXCEPTION 'Reseller account blocked due to suspicious activity';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reseller_allowed_products rap
    WHERE rap.reseller_id = p_reseller_id
  )
  INTO v_has_allowlist;

  IF v_has_allowlist AND NOT EXISTS (
    SELECT 1
    FROM public.reseller_allowed_products rap
    WHERE rap.reseller_id = p_reseller_id
      AND rap.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Product is not allowed for this reseller account';
  END IF;

  INSERT INTO public.reseller_idempotency_requests (reseller_id, user_id, request_id, status)
  VALUES (p_reseller_id, p_user_id, p_request_id, 'processing')
  ON CONFLICT (reseller_id, request_id) DO NOTHING;

  SELECT *
  INTO v_idem
  FROM public.reseller_idempotency_requests
  WHERE reseller_id = p_reseller_id
    AND request_id = p_request_id
  FOR UPDATE;

  IF v_idem.status = 'completed' AND v_idem.response_json IS NOT NULL THEN
    RETURN v_idem.response_json || jsonb_build_object('idempotent', true);
  END IF;

  IF v_idem.status = 'failed' THEN
    RAISE EXCEPTION '%', COALESCE(v_idem.error_message, 'Transaction failed');
  END IF;

  UPDATE public.wallets
  SET
    balance = round(balance - v_amount, 2),
    total_spent = round(COALESCE(total_spent, 0) + v_amount, 2),
    version = COALESCE(version, 0) + 1,
    updated_at = v_now
  WHERE id = p_wallet_id
    AND user_id = p_user_id
    AND reseller_id = p_reseller_id
    AND is_locked = false
    AND balance >= v_amount
  RETURNING id, balance, version, total_spent
  INTO v_wallet;

  IF NOT FOUND THEN
    UPDATE public.reseller_idempotency_requests
    SET status = 'failed', error_message = 'Insufficient balance', updated_at = v_now
    WHERE id = v_idem.id;
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.transactions (
    wallet_id,
    reseller_id,
    product_id,
    amount,
    balance_after,
    type,
    status,
    description,
    reference_type,
    created_by,
    meta,
    created_at
  ) VALUES (
    p_wallet_id,
    p_reseller_id,
    p_product_id,
    v_amount,
    v_wallet.balance,
    'debit',
    'completed',
    COALESCE(p_notes, 'Reseller key generation'),
    'reseller_key_generation',
    p_user_id,
    COALESCE(p_meta, '{}'::jsonb),
    v_now
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.license_keys (
    id,
    reseller_id,
    product_id,
    plan_duration,
    license_key,
    key_signature,
    key_type,
    key_status,
    status,
    is_used,
    assigned_to,
    client_id,
    cost_price,
    sell_price,
    profit_amount,
    delivery_status,
    expires_at,
    created_by,
    purchase_transaction_id,
    activated_devices,
    max_devices,
    notes,
    meta,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_reseller_id,
    p_product_id,
    p_plan_duration,
    p_license_key,
    p_key_signature,
    p_key_type::public.key_type,
    'unused',
    'active',
    false,
    p_reseller_id,
    p_client_id,
    v_amount,
    p_sell_price,
    CASE WHEN p_sell_price IS NULL THEN NULL ELSE round(p_sell_price - v_amount, 2) END,
    COALESCE(NULLIF(trim(p_delivery_status), ''), 'pending'),
    p_expires_at,
    p_user_id,
    v_tx_id,
    0,
    GREATEST(1, COALESCE(p_device_limit, 1)),
    COALESCE(p_notes, 'Reseller generated key'),
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('transaction_id', v_tx_id),
    v_now,
    v_now
  ) RETURNING id INTO v_key_id;

  v_current_reseller_id := p_reseller_id;

  WHILE v_loop_guard < 8 LOOP
    v_loop_guard := v_loop_guard + 1;

    SELECT r.parent_reseller_id, COALESCE(r.upstream_commission_percent, 0)
    INTO v_parent_id, v_commission_percent
    FROM public.resellers r
    WHERE r.id = v_current_reseller_id;

    EXIT WHEN v_parent_id IS NULL;

    IF v_commission_percent > 0 THEN
      v_commission_amount := round(v_amount * (v_commission_percent / 100.0), 2);

      IF v_commission_amount > 0 THEN
        SELECT r.user_id, COALESCE(r.max_wallet_limit, 0), COALESCE(r.is_blocked, false)
        INTO v_parent_user_id, v_parent_max_wallet_limit, v_parent_blocked
        FROM public.resellers r
        WHERE r.id = v_parent_id;

        IF v_parent_blocked THEN
          RAISE EXCEPTION 'Parent reseller is blocked';
        END IF;

        SELECT w.id, w.balance, COALESCE(w.total_earned, 0) AS total_earned, COALESCE(w.version, 0) AS version
        INTO v_parent_wallet
        FROM public.wallets w
        WHERE w.reseller_id = v_parent_id
        LIMIT 1;

        IF v_parent_wallet.id IS NULL THEN
          INSERT INTO public.wallets (
            user_id,
            reseller_id,
            balance,
            total_added,
            total_spent,
            total_earned,
            currency,
            is_locked,
            created_at,
            updated_at
          ) VALUES (
            v_parent_user_id,
            v_parent_id,
            0,
            0,
            0,
            0,
            'USD',
            false,
            v_now,
            v_now
          )
          RETURNING id, balance, total_earned, version
          INTO v_parent_wallet;
        END IF;

        IF v_parent_max_wallet_limit > 0 AND (COALESCE(v_parent_wallet.balance, 0) + v_commission_amount) > v_parent_max_wallet_limit THEN
          RAISE EXCEPTION 'Parent wallet limit exceeded';
        END IF;

        UPDATE public.wallets
        SET
          balance = round(COALESCE(balance, 0) + v_commission_amount, 2),
          total_earned = round(COALESCE(total_earned, 0) + v_commission_amount, 2),
          version = COALESCE(version, 0) + 1,
          updated_at = v_now
        WHERE id = v_parent_wallet.id
        RETURNING id, balance
        INTO v_parent_wallet;

        INSERT INTO public.transactions (
          wallet_id,
          reseller_id,
          product_id,
          amount,
          balance_after,
          type,
          status,
          description,
          reference_type,
          created_by,
          meta,
          created_at
        ) VALUES (
          v_parent_wallet.id,
          v_parent_id,
          p_product_id,
          v_commission_amount,
          v_parent_wallet.balance,
          'credit',
          'completed',
          'Commission credited from reseller key generation',
          'reseller_commission',
          p_user_id,
          jsonb_build_object(
            'source_reseller_id', v_current_reseller_id,
            'origin_reseller_id', p_reseller_id,
            'origin_transaction_id', v_tx_id,
            'origin_license_key_id', v_key_id,
            'commission_percent', v_commission_percent
          ),
          v_now
        );
      END IF;
    END IF;

    v_current_reseller_id := v_parent_id;
  END LOOP;

  v_response := jsonb_build_object(
    'transaction_id', v_tx_id,
    'license_key_id', v_key_id,
    'balance_after', v_wallet.balance,
    'version', v_wallet.version,
    'total_spent', v_wallet.total_spent,
    'idempotent', false
  );

  UPDATE public.reseller_idempotency_requests
  SET status = 'completed', response_json = v_response, error_message = null, updated_at = v_now
  WHERE id = v_idem.id;

  RETURN v_response;
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.reseller_idempotency_requests
    SET status = 'failed', error_message = 'Key generation failed', updated_at = now()
    WHERE reseller_id = p_reseller_id AND request_id = p_request_id;
    RAISE EXCEPTION 'Key generation failed';
  WHEN OTHERS THEN
    UPDATE public.reseller_idempotency_requests
    SET status = 'failed', error_message = COALESCE(SQLERRM, 'Transaction failed'), updated_at = now()
    WHERE reseller_id = p_reseller_id AND request_id = p_request_id;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.reseller_generate_license_key_atomic(text, uuid, uuid, uuid, uuid, numeric, text, text, text, text, timestamptz, uuid, numeric, text, text, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_generate_license_key_atomic(text, uuid, uuid, uuid, uuid, numeric, text, text, text, text, timestamptz, uuid, numeric, text, text, jsonb, integer) TO authenticated;
