-- =============================================
-- SECURITY FIX 1: Fix overly permissive RLS on invoice_otp_codes
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'invoice_otp_codes'
  ) THEN
    -- Drop overly permissive policies only when table exists
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update OTP codes for verification" ON public.invoice_otp_codes';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can verify OTP for signing" ON public.invoice_otp_codes';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create OTP codes" ON public.invoice_otp_codes';

    -- Recreate restrictive policies
    EXECUTE $sql$
      CREATE POLICY "Invoice owners can create OTP codes"
      ON public.invoice_otp_codes
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.invoices i
          WHERE i.id = invoice_otp_codes.invoice_id
          AND i.user_id = auth.uid()
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Valid OTP codes can be verified"
      ON public.invoice_otp_codes
      FOR SELECT
      USING (expires_at > now())
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Valid OTP codes can be updated for verification"
      ON public.invoice_otp_codes
      FOR UPDATE
      USING (expires_at > now())
    $sql$;
  END IF;
END
$$;

-- =============================================
-- SECURITY FIX 2: Create secure views for PII protection
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.invoices_secure
      WITH (security_invoker = on) AS
      SELECT
        id,
        user_id,
        invoice_number,
        CASE
          WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
          THEN customer_name
          ELSE '***REDACTED***'
        END as customer_name,
        CASE
          WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
          THEN customer_email
          ELSE '***REDACTED***'
        END as customer_email,
        CASE
          WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
          THEN customer_phone
          ELSE NULL
        END as customer_phone,
        CASE
          WHEN user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
          THEN customer_address
          ELSE NULL
        END as customer_address,
        items,
        subtotal,
        tax_percent,
        tax_amount,
        discount_percent,
        discount_amount,
        total_amount,
        currency,
        status,
        due_date,
        notes,
        terms,
        signature_data,
        signed_at,
        otp_verified,
        otp_verified_at,
        created_at,
        updated_at
      FROM public.invoices
    $sql$;
  END IF;
END
$$;

-- =============================================
-- SECURITY FIX 3: Create secure view for support_tickets (hide ip_hash)
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.support_tickets_secure
      WITH (security_invoker = on) AS
      SELECT
        id,
        ticket_number,
        user_id,
        user_name,
        user_email,
        status,
        assigned_staff_id,
        resolved_at,
        created_at,
        updated_at,
        CASE
          WHEN public.has_role(auth.uid(), 'super_admin')
          THEN ip_hash
          ELSE NULL
        END as ip_hash
      FROM public.support_tickets
    $sql$;
  END IF;
END
$$;

-- =============================================
-- SECURITY FIX 4: Add consent tracking for location data
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_sessions'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS location_consent boolean DEFAULT false';
    EXECUTE 'ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS consent_given_at timestamp with time zone';

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.has_location_consent(_user_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
        SELECT EXISTS (
          SELECT 1
          FROM public.user_sessions
          WHERE user_id = _user_id
            AND location_consent = true
          LIMIT 1
        )
      $fn$
    $sql$;

    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.user_sessions_secure
      WITH (security_invoker = on) AS
      SELECT
        id,
        user_id,
        device_type,
        device_name,
        browser,
        os,
        is_current,
        last_active_at,
        created_at,
        location_consent,
        consent_given_at,
        CASE
          WHEN location_consent = true OR public.has_role(auth.uid(), 'super_admin')
          THEN ip_address
          ELSE NULL
        END as ip_address,
        CASE
          WHEN location_consent = true OR public.has_role(auth.uid(), 'super_admin')
          THEN location
          ELSE NULL
        END as location
      FROM public.user_sessions
      WHERE user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
    $sql$;
  END IF;
END
$$;

-- =============================================
-- SECURITY FIX 5: Create audit log entries for security changes
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'table_name'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'user_agent'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.audit_logs (action, table_name, new_data, user_agent)
      VALUES (
        'update',
        'security_policies',
        '{"changes": ["Fixed overly permissive RLS on invoice_otp_codes", "Created secure views for PII protection", "Added location consent tracking", "Hidden ip_hash from regular users"]}'::jsonb,
        'System Security Update'
      )
    $sql$;
  END IF;
END
$$;