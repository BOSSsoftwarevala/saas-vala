-- Drop the overly permissive policies
DROP POLICY IF EXISTS "System can insert audit logs" ON public.support_audit_logs;

-- Create proper audit log insert policy (only authenticated users can insert)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.support_audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Note: The other warnings about invoice_otp_codes are existing from before