-- Migration: Add SEO support for marketplace products
-- Date: 2026-04-13
-- Purpose: Link SEO data directly with products (one product = one SEO record)

-- Create marketplace_seo table
CREATE TABLE IF NOT EXISTS marketplace_seo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    meta_description TEXT,
    keywords TEXT[] DEFAULT '{}',
    hashtags TEXT[] DEFAULT '{}',
    seo_score INTEGER DEFAULT 0 CHECK (seo_score >= 0 AND seo_score <= 100),
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    twitter_card TEXT DEFAULT 'summary_large_image',
    canonical_url TEXT,
    target_country TEXT DEFAULT 'IN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on product_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_seo_product_id ON marketplace_seo(product_id);

-- Create index on slug for URL routing
CREATE INDEX IF NOT EXISTS idx_marketplace_seo_slug ON marketplace_seo(slug);

-- Create index on target_country
CREATE INDEX IF NOT EXISTS idx_marketplace_seo_country ON marketplace_seo(target_country);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_marketplace_seo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marketplace_seo_updated_at
    BEFORE UPDATE ON marketplace_seo
    FOR EACH ROW
    EXECUTE FUNCTION update_marketplace_seo_updated_at();

-- Trigger to auto-create SEO entry when product is created
CREATE OR REPLACE FUNCTION auto_create_marketplace_seo()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    unique_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from product name
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9\s-]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := trim(base_slug, '-');
    
    -- Start with base slug
    unique_slug := base_slug || '-' || NEW.target_country;
    
    -- Ensure slug is unique
    WHILE EXISTS (SELECT 1 FROM marketplace_seo WHERE slug = unique_slug) LOOP
        counter := counter + 1;
        unique_slug := base_slug || '-' || NEW.target_country || '-' || counter::TEXT;
    END LOOP;
    
    -- Insert SEO record
    INSERT INTO marketplace_seo (
        product_id,
        slug,
        title,
        meta_description,
        keywords,
        hashtags,
        target_country
    ) VALUES (
        NEW.id,
        unique_slug,
        NEW.name,
        COALESCE(NEW.tagline, NEW.name),
        ARRAY[NEW.name, NEW.tagline] FILTER (WHERE NEW.tagline IS NOT NULL),
        ARRAY['software', 'saas', NEW.name] FILTER (WHERE NEW.name IS NOT NULL),
        COALESCE(NEW.target_country, 'IN')
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_marketplace_seo
    AFTER INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_marketplace_seo();

-- Enable RLS
ALTER TABLE marketplace_seo ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can read SEO by product"
    ON marketplace_seo FOR SELECT
    USING (true);

CREATE POLICY "Admins can insert SEO"
    ON marketplace_seo FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update SEO"
    ON marketplace_seo FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete SEO"
    ON marketplace_seo FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Function to generate SEO score based on completeness
CREATE OR REPLACE FUNCTION calculate_seo_score(seo_record marketplace_seo)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Title (20 points)
    IF seo_record.title IS NOT NULL AND LENGTH(TRIM(seo_record.title)) > 0 THEN
        score := score + 20;
    END IF;
    
    -- Meta description (20 points)
    IF seo_record.meta_description IS NOT NULL AND LENGTH(TRIM(seo_record.meta_description)) >= 120 THEN
        score := score + 20;
    ELSIF seo_record.meta_description IS NOT NULL AND LENGTH(TRIM(seo_record.meta_description)) > 0 THEN
        score := score + 10;
    END IF;
    
    -- Keywords (20 points)
    IF seo_record.keywords IS NOT NULL AND array_length(seo_record.keywords, 1) >= 3 THEN
        score := score + 20;
    ELSIF seo_record.keywords IS NOT NULL AND array_length(seo_record.keywords, 1) > 0 THEN
        score := score + 10;
    END IF;
    
    -- Hashtags (10 points)
    IF seo_record.hashtags IS NOT NULL AND array_length(seo_record.hashtags, 1) > 0 THEN
        score := score + 10;
    END IF;
    
    -- OG tags (10 points)
    IF seo_record.og_title IS NOT NULL AND seo_record.og_description IS NOT NULL THEN
        score := score + 10;
    END IF;
    
    -- Canonical URL (10 points)
    IF seo_record.canonical_url IS NOT NULL AND LENGTH(TRIM(seo_record.canonical_url)) > 0 THEN
        score := score + 10;
    END IF;
    
    -- Slug (10 points)
    IF seo_record.slug IS NOT NULL AND LENGTH(TRIM(seo_record.slug)) > 0 THEN
        score := score + 10;
    END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate SEO score
CREATE OR REPLACE FUNCTION auto_calculate_seo_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.seo_score := calculate_seo_score(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_calculate_seo_score
    BEFORE INSERT OR UPDATE ON marketplace_seo
    FOR EACH ROW
    EXECUTE FUNCTION auto_calculate_seo_score();
