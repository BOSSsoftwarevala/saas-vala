-- Fix overly permissive RLS policy
DROP POLICY IF EXISTS "System can manage violations" ON public.user_violations;

-- Create proper insert policy for authenticated users (system operations)
CREATE POLICY "Authenticated users can insert violations" 
ON public.user_violations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create update policy for own violations only
CREATE POLICY "Users can update own violations" 
ON public.user_violations 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create insert policy for apk_downloads
CREATE POLICY "Users can insert their own downloads" 
ON public.apk_downloads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);