
-- Fix overly permissive INSERT policy on license_verification_logs
DROP POLICY IF EXISTS "System can insert verification logs" ON public.license_verification_logs;

CREATE POLICY "Authenticated can insert verification logs"
ON public.license_verification_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
