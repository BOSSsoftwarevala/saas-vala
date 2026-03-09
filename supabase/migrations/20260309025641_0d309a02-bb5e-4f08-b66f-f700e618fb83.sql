
-- Insert with explicit unique product_codes
INSERT INTO products (name, slug, description, status, price, currency, target_industry, git_repo_url, git_repo_name, source_method, marketplace_visible, is_apk, demo_enabled, license_enabled, product_code, meta)
SELECT 
  COALESCE(sc.vala_name, INITCAP(REPLACE(sc.project_name, '-', ' '))),
  sc.slug,
  COALESCE(sc.ai_description, 'Professional ' || INITCAP(sc.target_industry) || ' software solution by Software Vala'),
  'active'::product_status,
  499,
  'INR',
  sc.target_industry,
  sc.github_repo_url,
  sc.project_name,
  'catalog_sync',
  true,
  true,
  true,
  true,
  'PRD-' || LPAD((ROW_NUMBER() OVER (ORDER BY sc.created_at) + 100000)::text, 6, '0'),
  jsonb_build_object('catalog_id', sc.id, 'synced_at', now()::text)
FROM source_code_catalog sc
WHERE sc.is_on_marketplace = false 
  AND sc.target_industry IS NOT NULL 
  AND sc.target_industry != 'general'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = sc.slug)
;
