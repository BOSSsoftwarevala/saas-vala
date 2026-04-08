
-- Link product_ids where slugs match
UPDATE apk_build_queue bq
SET product_id = p.id
FROM products p
WHERE p.slug = bq.slug AND bq.product_id IS NULL;

-- Delete orphan queue items that have no matching product
DELETE FROM apk_build_queue
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.slug = apk_build_queue.slug);

-- Reset the failed build so it can retry
UPDATE apk_build_queue
SET build_status = 'pending', build_error = NULL, build_attempts = 0
WHERE build_status = 'failed';
