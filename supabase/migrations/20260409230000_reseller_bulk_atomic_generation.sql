BEGIN;

CREATE OR REPLACE FUNCTION public.reseller_generate_license_keys_bulk_atomic(
  p_request_id text,
  p_user_id uuid,
  p_reseller_id uuid,
  p_wallet_id uuid,
  p_product_id uuid,
  p_plan_duration text,
  p_amount_per_key numeric,
  p_key_type text,
  p_expires_at timestamptz,
  p_license_keys text[],
  p_key_signatures text[],
  p_device_limit integer default 1,
  p_client_id uuid default null,
  p_delivery_status text default 'pending',
  p_meta jsonb default '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty integer;
  v_idx integer;
  v_key text;
  v_sig text;
  v_req text;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  v_qty := COALESCE(array_length(p_license_keys, 1), 0);

  IF v_qty <= 0 OR v_qty > 500 THEN
    RAISE EXCEPTION 'Invalid bulk quantity';
  END IF;

  IF COALESCE(array_length(p_key_signatures, 1), 0) <> v_qty THEN
    RAISE EXCEPTION 'Bulk payload mismatch';
  END IF;

  FOR v_idx IN 1..v_qty LOOP
    v_key := p_license_keys[v_idx];
    v_sig := p_key_signatures[v_idx];
    v_req := CONCAT(p_request_id, ':', v_idx::text);

    v_result := public.reseller_generate_license_key_atomic(
      v_req,
      p_user_id,
      p_reseller_id,
      p_wallet_id,
      p_product_id,
      p_amount_per_key,
      p_plan_duration,
      v_key,
      v_sig,
      p_key_type,
      p_expires_at,
      p_client_id,
      NULL,
      p_delivery_status,
      'Reseller bulk key generation',
      COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('bulk_index', v_idx, 'bulk_quantity', v_qty),
      p_device_limit
    );

    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN jsonb_build_object(
    'quantity', v_qty,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reseller_generate_license_keys_bulk_atomic(text, uuid, uuid, uuid, uuid, text, numeric, text, timestamptz, text[], text[], integer, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_generate_license_keys_bulk_atomic(text, uuid, uuid, uuid, uuid, text, numeric, text, timestamptz, text[], text[], integer, uuid, text, jsonb) TO authenticated;

COMMIT;
