-- PHASE 1+2+6: Wallet Security & Payment Flow
-- Create topup_requests table for real payment flow
CREATE TABLE IF NOT EXISTS public.topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank',
  reference_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'approved', 'rejected')),
  admin_note TEXT,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access topup_requests"
  ON public.topup_requests FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users can insert own topup requests"
  ON public.topup_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own topup requests"
  ON public.topup_requests FOR SELECT
  USING (user_id = auth.uid());

-- Trigger to auto-update updated_at
CREATE TRIGGER update_topup_requests_updated_at
  BEFORE UPDATE ON public.topup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PHASE 8: Activity logs RLS (ensure table has proper policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Users can insert own activity logs'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own activity logs" ON public.activity_logs
      FOR INSERT WITH CHECK (performed_by = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Users can view own activity logs'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own activity logs" ON public.activity_logs
      FOR SELECT USING (performed_by = auth.uid() OR public.has_role(auth.uid(), ''super_admin''))';
  END IF;
END $$;

-- PHASE 1: Remove any direct user wallet update/insert policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wallets' AND policyname = 'Users can update own wallet'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own wallet" ON public.wallets';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Users can insert own transactions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can insert own transactions" ON public.transactions';
  END IF;
END $$;
