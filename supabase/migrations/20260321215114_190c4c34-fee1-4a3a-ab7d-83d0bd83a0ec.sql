
-- Add result column to reseller_seo_runs
ALTER TABLE public.reseller_seo_runs ADD COLUMN IF NOT EXISTS result text;

-- Add ai_strategy column to reseller_campaigns
ALTER TABLE public.reseller_campaigns ADD COLUMN IF NOT EXISTS ai_strategy text;
