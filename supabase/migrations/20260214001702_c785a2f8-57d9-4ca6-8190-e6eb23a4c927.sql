
-- Payment attempt logging table
CREATE TABLE public.payment_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id TEXT,
  product_name TEXT,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated', 'processing', 'completed', 'failed', 'retrying'
  attempt_number INTEGER DEFAULT 1,
  error_message TEXT,
  ip_address TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_attempt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment attempts"
  ON public.payment_attempt_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create payment attempts"
  ON public.payment_attempt_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own payment attempts"
  ON public.payment_attempt_log FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Super admin full access payment_attempt_log"
  ON public.payment_attempt_log FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_payment_attempts_user ON public.payment_attempt_log(user_id);
CREATE INDEX idx_payment_attempts_status ON public.payment_attempt_log(status);
