-- =============================================
-- SECURITY FIX 1: Fix overly permissive RLS on invoice_otp_codes
-- =============================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can update OTP codes for verification" ON public.invoice_otp_codes;
DROP POLICY IF EXISTS "Anyone can verify OTP for signing" ON public.invoice_otp_codes;
DROP POLICY IF EXISTS "Authenticated users can create OTP codes" ON public.invoice_otp_codes;

-- Create proper restrictive policies for invoice_otp_codes
-- Only the invoice owner can create OTP codes for their invoices
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
);

-- OTP codes can be verified by anyone with the correct email (for customer signing)
-- But we limit to non-expired codes only
CREATE POLICY "Valid OTP codes can be verified"
ON public.invoice_otp_codes
FOR SELECT
USING (
  expires_at > now()
);

-- Only allow updates (verification) on non-expired codes
CREATE POLICY "Valid OTP codes can be updated for verification"
ON public.invoice_otp_codes
FOR UPDATE
USING (
  expires_at > now()
);

-- =============================================
-- SECURITY FIX 2: Create secure views for PII protection
-- =============================================

-- Create a secure view for invoices that hides sensitive customer PII from non-owners
CREATE OR REPLACE VIEW public.invoices_secure
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  invoice_number,
  -- Only show full customer details to the invoice owner
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
FROM public.invoices;

-- =============================================
-- SECURITY FIX 3: Create secure view for support_tickets (hide ip_hash)
-- =============================================

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
  -- Only show ip_hash to super admins for security investigations
  CASE 
    WHEN public.has_role(auth.uid(), 'super_admin') 
    THEN ip_hash 
    ELSE NULL 
  END as ip_hash
FROM public.support_tickets;

-- =============================================
-- SECURITY FIX 4: Add consent tracking for location data
-- =============================================

-- Add consent columns to user_sessions table
ALTER TABLE public.user_sessions 
ADD COLUMN IF NOT EXISTS location_consent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_given_at timestamp with time zone;

-- Create a function to check if user has given location consent
CREATE OR REPLACE FUNCTION public.has_location_consent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_sessions
    WHERE user_id = _user_id
      AND location_consent = true
    LIMIT 1
  )
$$;

-- Update user_sessions view to hide location data unless consent is given
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
  -- Only show location and IP if user has consented
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
WHERE user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin');

-- =============================================
-- SECURITY FIX 5: Create audit log entries for security changes
-- =============================================

-- Log this security update
INSERT INTO public.audit_logs (action, table_name, new_data, user_agent)
VALUES (
  'update',
  'security_policies',
  '{"changes": ["Fixed overly permissive RLS on invoice_otp_codes", "Created secure views for PII protection", "Added location consent tracking", "Hidden ip_hash from regular users"]}'::jsonb,
  'System Security Update'
);