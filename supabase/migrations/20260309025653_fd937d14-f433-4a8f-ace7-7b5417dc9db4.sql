
UPDATE source_code_catalog sc
SET is_on_marketplace = true, status = 'listed', listed_at = now()
WHERE sc.target_industry IS NOT NULL 
  AND sc.target_industry != 'general'
  AND sc.is_on_marketplace = false
  AND EXISTS (SELECT 1 FROM products p WHERE p.slug = sc.slug);
