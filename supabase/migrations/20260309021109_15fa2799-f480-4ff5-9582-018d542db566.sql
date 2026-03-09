
-- BUG FIX: Allow authenticated users to insert error_logs (used in purchase error handling)
CREATE POLICY "Authenticated users can insert error_logs"
  ON public.error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- BUG FIX: Allow authenticated users to insert notifications for themselves (used in purchase flow)
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
