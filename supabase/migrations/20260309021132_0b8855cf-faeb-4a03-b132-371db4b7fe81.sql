
-- BUG FIX: Allow buyers to create marketplace orders (purchase flow)
CREATE POLICY "Buyers can insert own marketplace_orders"
  ON public.marketplace_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

-- BUG FIX: Allow users to update their own apk_downloads (verification_attempts, device_info)
CREATE POLICY "Users can update own apk_downloads"
  ON public.apk_downloads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
