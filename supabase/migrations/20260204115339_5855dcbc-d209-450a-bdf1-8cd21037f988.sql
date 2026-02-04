-- Server Manager Database Schema Extension

-- Create enum for domain status
CREATE TYPE domain_status AS ENUM ('pending', 'active', 'failed', 'expired');

-- Create enum for git provider
CREATE TYPE git_provider AS ENUM ('github', 'gitlab', 'bitbucket');

-- Create enum for backup status
CREATE TYPE backup_status AS ENUM ('pending', 'running', 'success', 'failed');

-- Create enum for event type
CREATE TYPE server_event_type AS ENUM ('restart', 'deploy', 'backup', 'ssl_renewal', 'health_check', 'error');

-- Domains table
CREATE TABLE public.domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  domain_type TEXT NOT NULL DEFAULT 'subdomain' CHECK (domain_type IN ('subdomain', 'custom')),
  domain_name TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'expired', 'failed')),
  ssl_expiry_at TIMESTAMP WITH TIME ZONE,
  ssl_auto_renew BOOLEAN DEFAULT true,
  dns_verified BOOLEAN DEFAULT false,
  dns_verified_at TIMESTAMP WITH TIME ZONE,
  status domain_status DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Git connections table
CREATE TABLE public.git_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  provider git_provider NOT NULL DEFAULT 'github',
  repository_url TEXT NOT NULL,
  repository_name TEXT,
  branch TEXT DEFAULT 'main',
  deploy_token TEXT,
  auto_deploy BOOLEAN DEFAULT true,
  webhook_secret TEXT,
  last_commit_sha TEXT,
  last_commit_message TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'failed', 'disconnected')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Deployment logs table (detailed build logs)
CREATE TABLE public.deployment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE CASCADE,
  log_level TEXT DEFAULT 'info' CHECK (log_level IN ('info', 'warning', 'error', 'debug')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Backup logs table
CREATE TABLE public.backup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  backup_type TEXT DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'database', 'files')),
  file_path TEXT,
  file_size BIGINT,
  status backup_status DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Server events table (for monitoring)
CREATE TABLE public.server_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  event_type server_event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  meta JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Server auto rules table
CREATE TABLE public.server_auto_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE UNIQUE,
  auto_deploy BOOLEAN DEFAULT true,
  auto_ssl_renewal BOOLEAN DEFAULT true,
  auto_health_check BOOLEAN DEFAULT true,
  auto_restart BOOLEAN DEFAULT false,
  auto_backup BOOLEAN DEFAULT false,
  health_check_interval INTEGER DEFAULT 60,
  backup_schedule TEXT DEFAULT 'daily',
  restart_on_failure BOOLEAN DEFAULT true,
  max_restart_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SSL logs table
CREATE TABLE public.ssl_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID REFERENCES public.domains(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('issue', 'renew', 'revoke', 'expire')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  provider TEXT DEFAULT 'letsencrypt',
  error_message TEXT,
  issued_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_auto_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssl_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for domains
CREATE POLICY "Super admin full access domains" ON public.domains FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers view own domains" ON public.domains FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND server_id IN (SELECT id FROM servers WHERE created_by = auth.uid())
);

-- RLS Policies for git_connections
CREATE POLICY "Super admin full access git_connections" ON public.git_connections FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers manage own git_connections" ON public.git_connections FOR ALL USING (
  has_role(auth.uid(), 'reseller') AND server_id IN (SELECT id FROM servers WHERE created_by = auth.uid())
);

-- RLS Policies for deployment_logs
CREATE POLICY "Super admin full access deployment_logs" ON public.deployment_logs FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers view own deployment_logs" ON public.deployment_logs FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND deployment_id IN (
    SELECT d.id FROM deployments d 
    JOIN servers s ON d.server_id = s.id 
    WHERE s.created_by = auth.uid()
  )
);

-- RLS Policies for backup_logs
CREATE POLICY "Super admin full access backup_logs" ON public.backup_logs FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers view own backup_logs" ON public.backup_logs FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND server_id IN (SELECT id FROM servers WHERE created_by = auth.uid())
);

-- RLS Policies for server_events
CREATE POLICY "Super admin full access server_events" ON public.server_events FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers view own server_events" ON public.server_events FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND server_id IN (SELECT id FROM servers WHERE created_by = auth.uid())
);

-- RLS Policies for server_auto_rules
CREATE POLICY "Super admin full access server_auto_rules" ON public.server_auto_rules FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers manage own server_auto_rules" ON public.server_auto_rules FOR ALL USING (
  has_role(auth.uid(), 'reseller') AND server_id IN (SELECT id FROM servers WHERE created_by = auth.uid())
);

-- RLS Policies for ssl_logs
CREATE POLICY "Super admin full access ssl_logs" ON public.ssl_logs FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Resellers view own ssl_logs" ON public.ssl_logs FOR SELECT USING (
  has_role(auth.uid(), 'reseller') AND domain_id IN (
    SELECT d.id FROM domains d 
    JOIN servers s ON d.server_id = s.id 
    WHERE s.created_by = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_domains_server_id ON public.domains(server_id);
CREATE INDEX idx_domains_status ON public.domains(status);
CREATE INDEX idx_domains_ssl_expiry ON public.domains(ssl_expiry_at);
CREATE INDEX idx_git_connections_server_id ON public.git_connections(server_id);
CREATE INDEX idx_deployment_logs_deployment_id ON public.deployment_logs(deployment_id);
CREATE INDEX idx_backup_logs_server_id ON public.backup_logs(server_id);
CREATE INDEX idx_backup_logs_status ON public.backup_logs(status);
CREATE INDEX idx_server_events_server_id ON public.server_events(server_id);
CREATE INDEX idx_server_events_type ON public.server_events(event_type);
CREATE INDEX idx_ssl_logs_domain_id ON public.ssl_logs(domain_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.domains;
ALTER PUBLICATION supabase_realtime ADD TABLE public.git_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.backup_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_auto_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ssl_logs;

-- Create trigger for updated_at
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON public.domains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_git_connections_updated_at BEFORE UPDATE ON public.git_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_server_auto_rules_updated_at BEFORE UPDATE ON public.server_auto_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();