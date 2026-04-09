BEGIN;

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_balance_non_negative_chk;

ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_balance_non_negative_chk
  CHECK (balance >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_keys_reseller_requires_transaction_chk'
  ) THEN
    ALTER TABLE public.license_keys
      ADD CONSTRAINT license_keys_reseller_requires_transaction_chk
      CHECK (reseller_id IS NULL OR key_status = 'pool' OR purchase_transaction_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_keys_reseller_single_device_chk'
  ) THEN
    ALTER TABLE public.license_keys
      ADD CONSTRAINT license_keys_reseller_single_device_chk
      CHECK (reseller_id IS NULL OR max_devices = 1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.reseller_wallet_debit_for_key_generation(
  p_user_id uuid,
  p_reseller_id uuid,
  p_wallet_id uuid,
  p_product_id uuid,
  p_amount numeric,
  p_description text,
  p_meta jsonb default '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet record;
  v_tx_id uuid;
  v_amount numeric(12,2);
BEGIN
  v_amount := round(COALESCE(p_amount, 0)::numeric, 2);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction failed';
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
    COALESCE(p_description, 'Reseller key generation'),
    'reseller_key_generation',
    p_user_id,
    COALESCE(p_meta, '{}'::jsonb),
    now()
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'balance_after', v_wallet.balance,
    'version', v_wallet.version,
    'total_spent', v_wallet.total_spent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reseller_wallet_debit_for_key_generation(uuid, uuid, uuid, uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_wallet_debit_for_key_generation(uuid, uuid, uuid, uuid, numeric, text, jsonb) TO authenticated;

COMMIT;
