-- Enable public access to marketplace tables for anon users

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON marketplace_ticker_messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON marketplace_products;
DROP POLICY IF EXISTS "Enable read access for all users" ON marketplace_banner_slides;
DROP POLICY IF EXISTS "Enable read access for all users" ON marketplace_banner_settings;

-- Enable RLS on marketplace tables
ALTER TABLE marketplace_ticker_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_banner_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_banner_settings ENABLE ROW LEVEL SECURITY;

-- Create policies to allow anon (public) read access
CREATE POLICY "Enable read access for all users" ON marketplace_ticker_messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable read access for all users" ON marketplace_products
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable read access for all users" ON marketplace_banner_slides
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable read access for all users" ON marketplace_banner_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);
