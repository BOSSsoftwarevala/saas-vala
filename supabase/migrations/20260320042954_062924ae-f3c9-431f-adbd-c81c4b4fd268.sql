
CREATE TABLE public.festival_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_name text NOT NULL,
  description text,
  country_code text NOT NULL DEFAULT 'ALL',
  state_region text,
  offer_text text NOT NULL,
  discount_percent integer DEFAULT 0,
  coupon_code text,
  banner_image_url text,
  badge_text text,
  badge_color text DEFAULT 'from-amber-500 to-orange-500',
  festival_size text NOT NULL DEFAULT 'small',
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  auto_generated boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.festival_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active festival offers"
  ON public.festival_offers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage festival offers"
  ON public.festival_offers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.festival_offers (festival_name, description, country_code, state_region, offer_text, discount_percent, badge_text, badge_color, festival_size, start_date, end_date) VALUES
  ('Holi Festival Sale', 'Celebrate Holi with amazing software deals!', 'IN', NULL, '🎨 Holi Special — Extra 25% OFF', 25, '🇮🇳 HOLI', 'from-pink-500 to-purple-500', 'big', '2026-03-14', '2026-03-20'),
  ('Eid ul-Fitr Sale', 'Special Eid discounts on all software', 'AE', NULL, '🌙 Eid Mubarak — 20% OFF All Software', 20, 'EID SALE', 'from-emerald-600 to-teal-600', 'big', '2026-03-30', '2026-04-05'),
  ('Eid ul-Fitr Sale', 'Special Eid discounts on all software', 'SA', NULL, '🌙 Eid Mubarak — 20% OFF All Software', 20, 'EID SALE', 'from-emerald-600 to-teal-600', 'big', '2026-03-30', '2026-04-05'),
  ('Independence Day Sale', 'USA Independence Day deals', 'US', NULL, '🇺🇸 July 4th Special — 30% OFF', 30, 'JULY 4TH', 'from-blue-500 to-red-500', 'big', '2026-07-01', '2026-07-07'),
  ('Diwali Dhamaka', 'Diwali festival of lights mega sale', 'IN', NULL, '🪔 Diwali Dhamaka — ₹99 Software', 50, '🇮🇳 DIWALI', 'from-orange-500 to-yellow-500', 'big', '2026-10-18', '2026-10-24'),
  ('Christmas Sale', 'Christmas & New Year software deals', 'ALL', NULL, '🎄 Christmas Sale — 25% OFF Everything', 25, 'XMAS', 'from-red-500 to-green-500', 'big', '2026-12-22', '2026-12-28'),
  ('Republic Day Sale', 'India Republic Day special', 'IN', NULL, '🇮🇳 Republic Day — Extra 15% OFF', 15, '26 JAN', 'from-orange-500 to-green-500', 'small', '2026-01-25', '2026-01-27'),
  ('Thanksgiving Sale', 'Thanksgiving weekend deals', 'US', NULL, '🦃 Thanksgiving Sale — 35% OFF', 35, 'THANKS', 'from-amber-600 to-orange-600', 'small', '2026-11-26', '2026-11-28'),
  ('Chinese New Year', 'Chinese New Year celebration sale', 'CN', NULL, '🧧 New Year Sale — 20% OFF', 20, 'CNY', 'from-red-600 to-yellow-500', 'big', '2026-02-15', '2026-02-21'),
  ('Navratri Sale', 'Navratri festive offers', 'IN', NULL, '🕉️ Navratri Special — 20% OFF', 20, 'NAVRATRI', 'from-red-500 to-orange-500', 'big', '2026-10-01', '2026-10-07'),
  ('Black Friday', 'Black Friday mega sale worldwide', 'ALL', NULL, '🖤 Black Friday — Up to 50% OFF', 50, 'BLACK FRI', 'from-gray-900 to-gray-700', 'small', '2026-11-27', '2026-11-29'),
  ('Onam Festival', 'Kerala Onam celebration sale', 'IN', 'Kerala', '🌸 Onam Special — 20% OFF', 20, 'ONAM', 'from-yellow-500 to-green-500', 'big', '2026-09-05', '2026-09-11'),
  ('Pongal Sale', 'Tamil Nadu Pongal special', 'IN', 'Tamil Nadu', '🌾 Pongal Sale — 15% OFF', 15, 'PONGAL', 'from-orange-400 to-yellow-400', 'small', '2026-01-14', '2026-01-16');

ALTER PUBLICATION supabase_realtime ADD TABLE public.festival_offers;
