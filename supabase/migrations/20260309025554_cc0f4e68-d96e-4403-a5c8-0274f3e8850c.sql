
-- Insert all categorized catalog entries as products (education, healthcare, food, hospitality, transport, ecommerce, finance, hr, social, media, crm, realestate)
INSERT INTO products (name, slug, description, status, price, currency, target_industry, git_repo_url, git_repo_name, source_method, marketplace_visible, is_apk, demo_enabled, license_enabled, meta)
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
  jsonb_build_object('catalog_id', sc.id, 'synced_at', now()::text)
FROM source_code_catalog sc
WHERE sc.is_on_marketplace = false 
  AND sc.target_industry IS NOT NULL 
  AND sc.target_industry NOT IN ('general')
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = sc.slug)
ON CONFLICT DO NOTHING;

-- Now update catalog entries as listed
UPDATE source_code_catalog 
SET is_on_marketplace = true, status = 'listed', listed_at = now()
WHERE target_industry IS NOT NULL 
  AND target_industry NOT IN ('general')
  AND is_on_marketplace = false
  AND slug IN (SELECT slug FROM products WHERE source_method = 'catalog_sync');
