-- Backfill missing server runtime tables when historical migration was marked applied but not executed.

CREATE TABLE IF NOT EXISTS public.server_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  cpu_percent NUMERIC(5,2) NOT NULL CHECK (cpu_percent >= 0 AND cpu_percent <= 100),
  ram_used_mb NUMERIC(12,2) NOT NULL DEFAULT 0,
  ram_total_mb NUMERIC(12,2) NOT NULL DEFAULT 0,
  disk_used_gb NUMERIC(12,2) NOT NULL DEFAULT 0,
  disk_total_gb NUMERIC(12,2) NOT NULL DEFAULT 0,
  network_in_mbps NUMERIC(10,2) NOT NULL DEFAULT 0,
  network_out_mbps NUMERIC(10,2) NOT NULL DEFAULT 0,
  request_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  avg_response_time_ms NUMERIC(10,2) NOT NULL DEFAULT 0,
  uptime_seconds INT NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_disk CHECK (disk_used_gb <= disk_total_gb),
  CONSTRAINT valid_ram CHECK (ram_used_mb <= ram_total_mb)
);

CREATE INDEX IF NOT EXISTS idx_server_metrics_server_time
  ON public.server_metrics(server_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.server_ssh_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  public_key TEXT NOT NULL,
  key_type TEXT NOT NULL DEFAULT 'rsa',
  fingerprint TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INT NOT NULL DEFAULT 22,
  username TEXT NOT NULL DEFAULT 'root',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, key_name)
);

CREATE TABLE IF NOT EXISTS public.server_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  api_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.server_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.server_agents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
  message TEXT,
  error_details TEXT,
  command TEXT,
  output TEXT,
  duration_seconds INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.server_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_cycle_start DATE NOT NULL,
  billing_cycle_end DATE NOT NULL,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 49.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  overage_charges NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid', 'failed', 'refunded')),
  payment_method TEXT,
  invoice_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.server_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  tokens_used INT,
  confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recommendations TEXT[],
  actionable_items JSONB,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.server_ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  certificate_data TEXT NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  issuer TEXT,
  issued_at DATE,
  expires_at DATE NOT NULL,
  auto_renewal BOOLEAN DEFAULT TRUE,
  renewal_attempted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired', 'renewal_failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, domain)
);

CREATE TABLE IF NOT EXISTS public.server_deployment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  deployment_type TEXT NOT NULL,
  docker_image TEXT,
  env_vars JSONB DEFAULT '{}'::jsonb,
  ports JSONB DEFAULT '[]'::jsonb,
  volumes JSONB DEFAULT '[]'::jsonb,
  resource_limits JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'preparing' CHECK (status IN ('preparing', 'deploying', 'running', 'stopped', 'error')),
  deployed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_uptime_percent NUMERIC(5,2),
  actual_uptime_percent NUMERIC(5,2),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_server_agents_server ON public.server_agents(server_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_server ON public.server_logs(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_billing_user ON public.server_billing(user_id, billing_cycle_start DESC);
CREATE INDEX IF NOT EXISTS idx_server_ai_analysis_server ON public.server_ai_analysis(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_ssl_expires ON public.server_ssl_certificates(expires_at);
CREATE INDEX IF NOT EXISTS idx_server_deployment_history_server ON public.server_deployment_history(server_id, deployed_at DESC);

ALTER TABLE public.server_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_ssh_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_ssl_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_deployment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own server metrics" ON public.server_metrics;
CREATE POLICY "Users view own server metrics" ON public.server_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own SSH keys" ON public.server_ssh_keys;
CREATE POLICY "Users view own SSH keys" ON public.server_ssh_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own SSH keys" ON public.server_ssh_keys;
CREATE POLICY "Users manage own SSH keys" ON public.server_ssh_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own agents" ON public.server_agents;
CREATE POLICY "Users view own agents" ON public.server_agents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own logs" ON public.server_logs;
CREATE POLICY "Users view own logs" ON public.server_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own billing" ON public.server_billing;
CREATE POLICY "Users view own billing" ON public.server_billing
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own AI analysis" ON public.server_ai_analysis;
CREATE POLICY "Users view own AI analysis" ON public.server_ai_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own SSL certs" ON public.server_ssl_certificates;
CREATE POLICY "Users view own SSL certs" ON public.server_ssl_certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own deployment history" ON public.server_deployment_history;
CREATE POLICY "Users view own deployment history" ON public.server_deployment_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = server_id AND s.created_by = auth.uid()
    )
  );
