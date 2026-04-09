CREATE UNIQUE INDEX IF NOT EXISTS uq_license_keys_license_key
  ON public.license_keys(license_key);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_keys_sell_price_min_chk'
  ) THEN
    ALTER TABLE public.license_keys
      ADD CONSTRAINT license_keys_sell_price_min_chk
      CHECK (
        reseller_id IS NULL OR
        sell_price IS NULL OR
        cost_price IS NULL OR
        sell_price >= cost_price
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reseller_idempotency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  response_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_idempotency_requests_reseller
  ON public.reseller_idempotency_requests(reseller_id, created_at DESC);

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
  p_meta jsonb default '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_amount numeric(12,2);
  v_wallet record;
  v_tx_id uuid;
  v_key_id uuid;
  v_idem record;
  v_response jsonb;
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
    updated_at = now()
  WHERE id = p_wallet_id
    AND user_id = p_user_id
    AND reseller_id = p_reseller_id
    AND is_locked = false
    AND balance >= v_amount
  RETURNING id, balance, version, total_spent
  INTO v_wallet;

  IF NOT FOUND THEN
    UPDATE public.reseller_idempotency_requests
    SET status = 'failed', error_message = 'Insufficient balance', updated_at = now()
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
    now()
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
    1,
    COALESCE(p_notes, 'Reseller generated key'),
    COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('transaction_id', v_tx_id),
    now(),
    now()
  ) RETURNING id INTO v_key_id;

  v_response := jsonb_build_object(
    'transaction_id', v_tx_id,
    'license_key_id', v_key_id,
    'balance_after', v_wallet.balance,
    'version', v_wallet.version,
    'total_spent', v_wallet.total_spent,
    'idempotent', false
  );

  UPDATE public.reseller_idempotency_requests
  SET status = 'completed', response_json = v_response, error_message = null, updated_at = now()
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
$function$;

REVOKE ALL ON FUNCTION public.reseller_generate_license_key_atomic(text, uuid, uuid, uuid, uuid, numeric, text, text, text, text, timestamptz, uuid, numeric, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_generate_license_key_atomic(text, uuid, uuid, uuid, uuid, numeric, text, text, text, text, timestamptz, uuid, numeric, text, text, jsonb) TO authenticated;
