-- Server Security Issues Table
CREATE TABLE IF NOT EXISTS public.server_security_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  fixed BOOLEAN DEFAULT false,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  fixed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_server_security_issues_server_id ON public.server_security_issues(server_id);
CREATE INDEX idx_server_security_issues_severity ON public.server_security_issues(severity);

-- Server Health Metrics Table
CREATE TABLE IF NOT EXISTS public.server_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  disk_usage DECIMAL(5,2),
  uptime_percent DECIMAL(5,2),
  response_time_ms INT,
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_server_health_metrics_server_id ON public.server_health_metrics(server_id);
CREATE INDEX idx_server_health_metrics_checked_at ON public.server_health_metrics(checked_at);

-- Server SSL Certificates Table
CREATE TABLE IF NOT EXISTS public.server_ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  issuer TEXT,
  certificate_chain TEXT,
  private_key_encrypted TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'expiring', 'expired')),
  days_remaining INT,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_server_ssl_certificates_server_id ON public.server_ssl_certificates(server_id);
CREATE INDEX idx_server_ssl_certificates_status ON public.server_ssl_certificates(status);
CREATE INDEX idx_server_ssl_certificates_valid_until ON public.server_ssl_certificates(valid_until);

-- Server Backups Table
CREATE TABLE IF NOT EXISTS public.server_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'database')),
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'in_progress')),
  size_bytes BIGINT,
  location TEXT NOT NULL,
  checksum TEXT,
  retention_days INT DEFAULT 30,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  restored_from_id UUID REFERENCES public.server_backups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  restored_at TIMESTAMPTZ
);

CREATE INDEX idx_server_backups_server_id ON public.server_backups(server_id);
CREATE INDEX idx_server_backups_status ON public.server_backups(status);
CREATE INDEX idx_server_backups_created_at ON public.server_backups(created_at);
CREATE INDEX idx_server_backups_retention ON public.server_backups(created_at) WHERE (created_at + (retention_days || ' days')::INTERVAL) > now();

-- Add new columns to servers table if they don't exist
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS last_security_scan TIMESTAMPTZ;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS security_score INT DEFAULT 0;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS backup_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS ssl_auto_renew BOOLEAN DEFAULT true;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS backup_schedule TEXT DEFAULT 'daily';
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS server_type TEXT DEFAULT 'self' CHECK (server_type IN ('self', 'cloud', 'vercel', 'hybrid', 'vps', 'digitalocean', 'aws', 'azure'));
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS agent_url TEXT;
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS agent_token TEXT;

-- Server Activity Audit Log
CREATE TABLE IF NOT EXISTS public.server_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('security_scan', 'health_check', 'backup', 'ssl_provision', 'deploy', 'restart', 'config_change')),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_server_activity_logs_server_id ON public.server_activity_logs(server_id);
CREATE INDEX idx_server_activity_logs_action_type ON public.server_activity_logs(action_type);
CREATE INDEX idx_server_activity_logs_created_at ON public.server_activity_logs(created_at);

-- Enable RLS on new tables
ALTER TABLE public.server_security_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_ssl_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own server security issues" ON public.server_security_issues
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.servers WHERE id = server_security_issues.server_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can view their own server health metrics" ON public.server_health_metrics
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.servers WHERE id = server_health_metrics.server_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can view their own server SSL certificates" ON public.server_ssl_certificates
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.servers WHERE id = server_ssl_certificates.server_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can view their own server backups" ON public.server_backups
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.servers WHERE id = server_backups.server_id AND created_by = auth.uid()
  ));

CREATE POLICY "Users can view their own server activity logs" ON public.server_activity_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.servers WHERE id = server_activity_logs.server_id AND created_by = auth.uid()
  ));
