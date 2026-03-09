
-- Bulk generate license keys for all products missing them
INSERT INTO license_keys (product_id, license_key, status, max_devices, expires_at)
SELECT 
  p.id,
  'VALA-' || UPPER(LEFT(COALESCE(p.target_industry, 'SW'), 3)) || '-' ||
  UPPER(SUBSTRING(md5(p.id::text || now()::text) FROM 1 FOR 4)) || '-' ||
  UPPER(SUBSTRING(md5(p.id::text || 'key1') FROM 5 FOR 4)) || '-' ||
  UPPER(SUBSTRING(md5(p.id::text || 'key2') FROM 9 FOR 4)) || '-' ||
  UPPER(SUBSTRING(md5(p.id::text || 'key3') FROM 13 FOR 4)),
  'active',
  3,
  (now() + interval '1 year')
FROM products p
WHERE p.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM license_keys lk WHERE lk.product_id = p.id)
;
