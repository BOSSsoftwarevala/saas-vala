-- Add public read policy for categories to ensure unauthenticated users can read categories
-- This fixes the RLS issue where the new schema only had role-based policies

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Allow public (unauthenticated) users to read active categories
CREATE POLICY "Public can view active categories" 
ON public.categories FOR SELECT 
USING (is_active = true);

-- Allow authenticated users to read all categories
CREATE POLICY "Authenticated users can view categories" 
ON public.categories FOR SELECT 
USING (auth.role() = 'authenticated');

-- Fallback for old schema (status column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'status') THEN
    CREATE POLICY IF NOT EXISTS "Public can view active categories (old schema)" 
    ON public.categories FOR SELECT 
    USING (status = 'active');
  END IF;
END $$;
