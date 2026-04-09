
-- Catalog sync seed (schema-safe)
INSERT INTO products (name, slug, description, status, price, currency, meta)
SELECT
  INITCAP(REPLACE(sc.project_name, '-', ' ')),
  COALESCE(sc.slug, LOWER(REGEXP_REPLACE(sc.project_name, '[^a-zA-Z0-9 ]', '', 'g'))),
  COALESCE(sc.ai_description, 'Professional software solution by Software Vala'),
  'active'::product_status,
  499,
  'INR',
  jsonb_build_object('catalog_id', sc.id, 'synced_at', now()::text, 'source_method', 'catalog_sync')
FROM source_code_catalog sc
WHERE COALESCE(sc.is_on_marketplace, false) = false
  AND sc.project_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.slug = COALESCE(sc.slug, LOWER(REGEXP_REPLACE(sc.project_name, '[^a-zA-Z0-9 ]', '', 'g')))
  );
