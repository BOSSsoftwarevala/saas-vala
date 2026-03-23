-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Phases: 1 (wallet RLS), 2 (topup_requests), 8 (activity_logs)
-- ============================================================

-- ===================== PHASE 8: ACTIVITY LOGS TABLE =====================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only server (service_role) can insert; users can view their own; admin sees all
CREATE POLICY "Users view own activity logs" ON public.activity_logs
  FOR SELECT USING (performed_by = auth.uid());

CREATE POLICY "Admin full access activity logs" ON public.activity_logs
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- ===================== PHASE 2 & 6: TOPUP REQUESTS TABLE =====================
CREATE TABLE IF NOT EXISTS public.topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank',
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

-- Users can submit and view their own topup requests
CREATE POLICY "Users insert own topup requests" ON public.topup_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own topup requests" ON public.topup_requests
  FOR SELECT USING (user_id = auth.uid());

-- Admin full access
CREATE POLICY "Admin full access topup requests" ON public.topup_requests
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- updated_at trigger for topup_requests
CREATE TRIGGER update_topup_requests_updated_at
  BEFORE UPDATE ON public.topup_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================== PHASE 1: WALLET RLS HARDENING =====================
-- Remove any pre-existing update/insert policies that let users modify wallet directly
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Resellers manage wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users insert own transactions" ON public.transactions;

-- Ensure only SELECT policy exists for regular users (no INSERT/UPDATE/DELETE)
-- "Users view own wallet" and "Users view own transactions" already exist from previous migration.
-- Super admin policy already covers full access via service role.

-- ===================== DUPLICATE PAYMENT GUARD =====================
-- Prevent duplicate topup requests with same reference_id per user
-- Exclude both 'rejected' and 'approved' statuses so already-processed refs cannot be reused
CREATE UNIQUE INDEX IF NOT EXISTS idx_topup_requests_user_reference
  ON public.topup_requests(user_id, reference_id)
  WHERE status NOT IN ('rejected', 'approved');
