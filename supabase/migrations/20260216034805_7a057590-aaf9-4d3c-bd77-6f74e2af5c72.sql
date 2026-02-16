
-- Allow public/anonymous users to view marketplace-visible active products
CREATE POLICY "Public can view marketplace products"
ON public.products
FOR SELECT
USING (marketplace_visible = true AND status = 'active'::product_status);
