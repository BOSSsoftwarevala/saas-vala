
-- Add git integration and marketplace fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS git_repo_url text,
  ADD COLUMN IF NOT EXISTS git_repo_name text,
  ADD COLUMN IF NOT EXISTS git_default_branch text DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS deploy_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS marketplace_visible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_url text,
  ADD COLUMN IF NOT EXISTS live_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
