-- Fix invoice_otp_codes RLS policies to prevent public data exposure
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'invoice_otp_codes'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can verify OTP for signing" ON public.invoice_otp_codes';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can update OTP codes for verification" ON public.invoice_otp_codes';

    EXECUTE $sql$
      CREATE POLICY "Invoice owner can view OTP codes"
      ON public.invoice_otp_codes
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.invoices
          WHERE invoices.id = invoice_otp_codes.invoice_id
          AND invoices.user_id = auth.uid()
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Invoice owner can create OTP codes"
      ON public.invoice_otp_codes
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.invoices
          WHERE invoices.id = invoice_otp_codes.invoice_id
          AND invoices.user_id = auth.uid()
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Invoice owner can update OTP codes"
      ON public.invoice_otp_codes
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.invoices
          WHERE invoices.id = invoice_otp_codes.invoice_id
          AND invoices.user_id = auth.uid()
        )
      )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Invoice owner can delete OTP codes"
      ON public.invoice_otp_codes
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.invoices
          WHERE invoices.id = invoice_otp_codes.invoice_id
          AND invoices.user_id = auth.uid()
        )
      )
    $sql$;
  END IF;
END
$$;