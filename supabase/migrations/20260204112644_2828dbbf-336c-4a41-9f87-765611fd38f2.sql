-- Make product_code have a default to prevent type errors (trigger will override)
ALTER TABLE public.products 
ALTER COLUMN product_code SET DEFAULT 'PRD-TEMP';