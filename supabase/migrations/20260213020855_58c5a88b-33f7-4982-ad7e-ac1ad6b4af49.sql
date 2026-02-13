
-- =============================================
-- SYSTEM MONITOR QUEUE (Smart Approval System)
-- =============================================
CREATE TABLE public.system_monitor_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_type TEXT NOT NULL, -- 'security_patch', 'dependency_update', 'deploy', 'config_change', 'new_product', 'error_fix', 'performance'
  title TEXT NOT NULL,
  reason TEXT NOT NULL, -- Simple short explanation
  effect TEXT NOT NULL, -- What happens if approved
  risk_level TEXT NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  auto_approved BOOLEAN DEFAULT false, -- true if low risk and auto-handled
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'auto_approved', 'executed', 'failed'
  source_module TEXT, -- 'server', 'ai', 'seo', 'git', 'billing', 'security'
  target_entity_id UUID, -- product_id, server_id, etc.
  target_entity_type TEXT, -- 'product', 'server', 'edge_function', etc.
  action_payload JSONB DEFAULT '{}'::jsonb, -- Data needed to execute the action
  ai_confidence NUMERIC DEFAULT 0, -- 0-100 confidence score
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_monitor_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access system_monitor_queue"
  ON public.system_monitor_queue FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_monitor_queue_status ON public.system_monitor_queue(status);
CREATE INDEX idx_monitor_queue_risk ON public.system_monitor_queue(risk_level);
CREATE INDEX idx_monitor_queue_created ON public.system_monitor_queue(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_system_monitor_queue_updated_at
  BEFORE UPDATE ON public.system_monitor_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SYSTEM HEALTH SNAPSHOTS (24/7 Monitoring)
-- =============================================
CREATE TABLE public.system_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL, -- 'server', 'edge_function', 'database', 'ai', 'full_system'
  status TEXT NOT NULL DEFAULT 'healthy', -- 'healthy', 'degraded', 'critical', 'unknown'
  metrics JSONB DEFAULT '{}'::jsonb,
  issues_detected INTEGER DEFAULT 0,
  auto_actions_taken INTEGER DEFAULT 0,
  approvals_queued INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access system_health_snapshots"
  ON public.system_health_snapshots FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_health_snapshots_type ON public.system_health_snapshots(snapshot_type);
CREATE INDEX idx_health_snapshots_created ON public.system_health_snapshots(created_at DESC);
