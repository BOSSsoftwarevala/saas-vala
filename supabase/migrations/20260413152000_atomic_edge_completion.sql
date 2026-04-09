-- Atomic Edge Completion: final hidden enterprise/defense gaps

CREATE TABLE IF NOT EXISTS public.platform_timezone_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timezone TEXT NOT NULL,
  country_code TEXT,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('ads', 'email', 'followup')),
  scheduled_at TIMESTAMPTZ,
  confidence NUMERIC(8,4) NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_currency_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  fx_rate NUMERIC(14,6) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'internal',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, fetched_at)
);

CREATE TABLE IF NOT EXISTS public.platform_currency_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_amount NUMERIC(14,4) NOT NULL,
  source_currency TEXT NOT NULL,
  target_currency TEXT NOT NULL,
  converted_amount NUMERIC(14,4) NOT NULL,
  fx_rate NUMERIC(14,6) NOT NULL,
  module_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  tax_type TEXT NOT NULL CHECK (tax_type IN ('gst', 'vat', 'sales_tax')),
  tax_rate NUMERIC(8,4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, tax_type)
);

INSERT INTO public.platform_tax_rules (country_code, tax_type, tax_rate, is_active)
VALUES
  ('IN', 'gst', 0.18, true),
  ('DE', 'vat', 0.19, true),
  ('FR', 'vat', 0.20, true),
  ('US', 'sales_tax', 0.08, true)
ON CONFLICT (country_code, tax_type) DO UPDATE SET
  tax_rate = EXCLUDED.tax_rate,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.platform_tax_compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  country_code TEXT NOT NULL,
  tax_type TEXT NOT NULL,
  taxable_amount NUMERIC(14,4) NOT NULL,
  tax_amount NUMERIC(14,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'failed', 'exempted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_cookie_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  country_code TEXT,
  gdpr_region BOOLEAN NOT NULL DEFAULT false,
  consent_necessary BOOLEAN NOT NULL DEFAULT true,
  consent_analytics BOOLEAN NOT NULL DEFAULT false,
  consent_marketing BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version TEXT NOT NULL DEFAULT 'v1'
);

CREATE TABLE IF NOT EXISTS public.platform_session_replay_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'scroll', 'input', 'navigation')),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_heatmap_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url TEXT NOT NULL,
  viewport_key TEXT NOT NULL,
  x NUMERIC(8,3) NOT NULL,
  y NUMERIC(8,3) NOT NULL,
  intensity NUMERIC(8,4) NOT NULL DEFAULT 1,
  drop_off BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_form_abandon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  session_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'sms')),
  trigger_reason TEXT NOT NULL,
  reminder_status TEXT NOT NULL DEFAULT 'queued' CHECK (reminder_status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_duplicate_merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  merged_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  merge_basis TEXT[] NOT NULL DEFAULT '{email,phone}'::text[],
  auto_merged BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_global_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'product', 'ad', 'report')),
  entity_id UUID,
  searchable_text TSVECTOR,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_global_search_fts ON public.platform_global_search_index USING GIN(searchable_text);

CREATE TABLE IF NOT EXISTS public.platform_command_center_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_leads INTEGER NOT NULL DEFAULT 0,
  total_ads_campaigns INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ai_calls INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_api_marketplace_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_key TEXT NOT NULL UNIQUE,
  provider_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key' CHECK (auth_type IN ('none', 'api_key', 'oauth2')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_whitelabel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  custom_domain TEXT,
  theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reseller_id)
);

CREATE TABLE IF NOT EXISTS public.platform_sla_priority_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL,
  priority_level INTEGER NOT NULL DEFAULT 1,
  queue_weight NUMERIC(8,4) NOT NULL DEFAULT 1,
  ai_fast_lane BOOLEAN NOT NULL DEFAULT false,
  processing_target_seconds INTEGER NOT NULL DEFAULT 300,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_key)
);

INSERT INTO public.platform_sla_priority_rules (plan_key, priority_level, queue_weight, ai_fast_lane, processing_target_seconds)
VALUES
  ('free', 1, 1.0, false, 600),
  ('pro', 2, 2.0, true, 300),
  ('enterprise', 3, 4.0, true, 120)
ON CONFLICT (plan_key) DO UPDATE SET
  priority_level = EXCLUDED.priority_level,
  queue_weight = EXCLUDED.queue_weight,
  ai_fast_lane = EXCLUDED.ai_fast_lane,
  processing_target_seconds = EXCLUDED.processing_target_seconds,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.platform_error_auto_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  error_code TEXT,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  error_message TEXT NOT NULL,
  auto_fix_attempted BOOLEAN NOT NULL DEFAULT false,
  auto_fix_status TEXT NOT NULL DEFAULT 'pending' CHECK (auto_fix_status IN ('pending', 'fixed', 'failed')),
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_version_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  change_notes TEXT,
  rollback_ref TEXT,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deployed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.platform_data_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  export_scope TEXT NOT NULL,
  export_format TEXT NOT NULL DEFAULT 'json' CHECK (export_format IN ('json', 'csv', 'parquet')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  output_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_auto_docs_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docs_type TEXT NOT NULL CHECK (docs_type IN ('api', 'user_guide', 'changelog')),
  source_module TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  output_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_notification_priority_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  priority_level INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dispatch_status TEXT NOT NULL DEFAULT 'queued' CHECK (dispatch_status IN ('queued', 'sent', 'failed', 'delayed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_cost_energy_monitor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL,
  server_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  ai_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
  roi_value NUMERIC(14,4) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_business_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL,
  cac NUMERIC(14,4) NOT NULL DEFAULT 0,
  ltv NUMERIC(14,4) NOT NULL DEFAULT 0,
  roi NUMERIC(14,4) NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_disaster_recovery_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_region TEXT NOT NULL,
  backup_region TEXT NOT NULL,
  readiness_status TEXT NOT NULL DEFAULT 'ready' CHECK (readiness_status IN ('ready', 'degraded', 'down')),
  last_drill_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (primary_region, backup_region)
);

CREATE TABLE IF NOT EXISTS public.platform_multiregion_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_region TEXT NOT NULL,
  target_region TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  lag_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'synced' CHECK (status IN ('synced', 'lagging', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_legal_log_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_hash TEXT NOT NULL,
  log_payload JSONB NOT NULL,
  immutable BOOLEAN NOT NULL DEFAULT true,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (log_hash)
);

CREATE TABLE IF NOT EXISTS public.platform_ai_safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT,
  violation_type TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_prompt_injection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt_excerpt TEXT,
  detection_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  blocked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_zero_trust_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_key TEXT NOT NULL,
  trust_result TEXT NOT NULL CHECK (trust_result IN ('allow', 'deny', 'challenge')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_secret_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_key TEXT NOT NULL UNIQUE,
  owner_module TEXT NOT NULL,
  rotation_days INTEGER NOT NULL DEFAULT 30,
  last_rotated_at TIMESTAMPTZ,
  next_rotation_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_key_rotation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_key TEXT NOT NULL,
  rotation_status TEXT NOT NULL CHECK (rotation_status IN ('success', 'failed')),
  details TEXT,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_encryption_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_name TEXT NOT NULL CHECK (layer_name IN ('at_rest', 'in_transit', 'in_memory')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'failed')),
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_billing_failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'retrying' CHECK (status IN ('retrying', 'recovered', 'downgraded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_subscription_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  grace_period_ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'grace', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_feature_usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  quota_limit BIGINT NOT NULL,
  quota_window TEXT NOT NULL DEFAULT 'monthly',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_key, feature_key)
);

CREATE TABLE IF NOT EXISTS public.platform_ai_cost_anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT,
  observed_cost NUMERIC(14,6) NOT NULL,
  baseline_cost NUMERIC(14,6) NOT NULL,
  anomaly_score NUMERIC(8,4) NOT NULL,
  auto_stopped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_bot_management_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_signature TEXT NOT NULL UNIQUE,
  bot_type TEXT NOT NULL CHECK (bot_type IN ('google_bot', 'allowed_bot', 'spam_bot')),
  action TEXT NOT NULL CHECK (action IN ('allow', 'block', 'throttle')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_realtime_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source_module TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_service_dependency_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  depends_on TEXT[] NOT NULL DEFAULT '{}'::text[],
  criticality TEXT NOT NULL DEFAULT 'medium' CHECK (criticality IN ('low', 'medium', 'high')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_name)
);

CREATE TABLE IF NOT EXISTS public.platform_feature_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_user_behavior_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  churn_risk_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  buying_intent_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  next_best_action TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_sla_monitoring_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL,
  uptime_percent NUMERIC(8,4) NOT NULL DEFAULT 100,
  p95_response_ms NUMERIC(10,2) NOT NULL DEFAULT 0,
  violations INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_global_compliance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL UNIQUE,
  requires_cookie_banner BOOLEAN NOT NULL DEFAULT false,
  requires_data_residency BOOLEAN NOT NULL DEFAULT false,
  policy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_clock_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name TEXT NOT NULL,
  offset_ms NUMERIC(12,4) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_sync', 'drift', 'critical')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_id_generation_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_name TEXT NOT NULL UNIQUE,
  last_id TEXT NOT NULL,
  sequence_hint BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_distributed_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key TEXT NOT NULL UNIQUE,
  holder_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_exactly_once_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  handler_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processed', 'duplicate_skipped', 'failed')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  request_hash TEXT,
  response_payload JSONB,
  status_code INTEGER,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS public.platform_circuit_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependency_name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_bulkhead_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name TEXT NOT NULL UNIQUE,
  concurrency_limit INTEGER NOT NULL DEFAULT 10,
  queue_limit INTEGER NOT NULL DEFAULT 500,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_deadlock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_tag TEXT,
  table_name TEXT,
  killed BOOLEAN NOT NULL DEFAULT false,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_query_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_fingerprint TEXT NOT NULL,
  duration_ms NUMERIC(12,3) NOT NULL,
  suggested_index TEXT,
  status TEXT NOT NULL DEFAULT 'logged' CHECK (status IN ('logged', 'optimized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_hot_cold_storage_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  hot_retention_days INTEGER NOT NULL DEFAULT 30,
  cold_retention_days INTEGER NOT NULL DEFAULT 365,
  archive_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_cache_invalidation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  reason TEXT NOT NULL,
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_event_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  schema_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_name, version)
);

CREATE TABLE IF NOT EXISTS public.platform_schema_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_key TEXT NOT NULL,
  compatibility TEXT NOT NULL CHECK (compatibility IN ('backward', 'forward', 'full')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_contract_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name TEXT NOT NULL,
  provider_service TEXT NOT NULL,
  consumer_service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  report_url TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_deployment_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  strategy TEXT NOT NULL CHECK (strategy IN ('blue_green', 'canary', 'rolling')),
  traffic_percent INTEGER NOT NULL DEFAULT 100,
  healthy BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_name)
);

CREATE TABLE IF NOT EXISTS public.platform_graceful_shutdown_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  in_flight_jobs INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'forced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_health_probe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  probe_type TEXT NOT NULL CHECK (probe_type IN ('liveness', 'readiness')),
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail')),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_backpressure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  intake_rate INTEGER NOT NULL,
  reduced_rate INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_priority_queue_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  priority_level INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_token_bucket_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  refill_rate_per_sec NUMERIC(12,4) NOT NULL,
  tokens_remaining NUMERIC(14,4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_retry_jitter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name TEXT NOT NULL,
  retry_attempt INTEGER NOT NULL,
  base_delay_ms INTEGER NOT NULL,
  jitter_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_observability_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  span_name TEXT NOT NULL,
  duration_ms NUMERIC(12,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_trace_sampling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  sample_rate NUMERIC(8,4) NOT NULL DEFAULT 0.1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_secure_random_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generator_name TEXT NOT NULL,
  entropy_bits INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'failed')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_side_channel_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vector_name TEXT NOT NULL,
  mitigated BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_memory_guard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  rss_mb NUMERIC(12,3) NOT NULL,
  threshold_mb NUMERIC(12,3) NOT NULL,
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_gc_tuning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  gc_mode TEXT NOT NULL,
  max_heap_mb INTEGER,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_realtime_alert_events_time ON public.platform_realtime_alert_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_priority_queue_jobs_priority ON public.platform_priority_queue_jobs(queue_name, priority_level DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_idempotency_keys_scope_key ON public.platform_idempotency_keys(scope, idem_key);
CREATE INDEX IF NOT EXISTS idx_platform_observability_traces_correlation ON public.platform_observability_traces(correlation_id, created_at DESC);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'platform_timezone_schedules','platform_currency_rates','platform_currency_conversions','platform_tax_rules',
    'platform_tax_compliance_events','platform_cookie_consent_events','platform_session_replay_events','platform_heatmap_points',
    'platform_form_abandon_events','platform_duplicate_merge_events','platform_global_search_index','platform_command_center_snapshots',
    'platform_api_marketplace_plugins','platform_whitelabel_profiles','platform_sla_priority_rules','platform_error_auto_reports',
    'platform_version_changes','platform_data_export_jobs','platform_auto_docs_jobs','platform_notification_priority_events',
    'platform_cost_energy_monitor','platform_business_kpi_snapshots','platform_disaster_recovery_regions','platform_multiregion_sync_events',
    'platform_legal_log_archive','platform_ai_safety_events','platform_prompt_injection_events','platform_zero_trust_access_events',
    'platform_secret_inventory','platform_key_rotation_events','platform_encryption_audit_events','platform_billing_failure_events',
    'platform_subscription_states','platform_feature_usage_quotas','platform_ai_cost_anomaly_events','platform_bot_management_rules',
    'platform_realtime_alert_events','platform_service_dependency_map','platform_feature_rollbacks','platform_user_behavior_ai',
    'platform_sla_monitoring_reports','platform_global_compliance_profiles','platform_clock_sync_events','platform_id_generation_state',
    'platform_distributed_locks','platform_exactly_once_events','platform_idempotency_keys','platform_circuit_breakers',
    'platform_bulkhead_limits','platform_deadlock_events','platform_query_performance_logs','platform_hot_cold_storage_policies',
    'platform_cache_invalidation_events','platform_event_versions','platform_schema_evolution_log','platform_contract_test_results',
    'platform_deployment_strategies','platform_graceful_shutdown_events','platform_health_probe_events','platform_backpressure_events',
    'platform_priority_queue_jobs','platform_token_bucket_limits','platform_retry_jitter_events','platform_observability_traces',
    'platform_trace_sampling_rules','platform_secure_random_audit','platform_side_channel_audit','platform_memory_guard_events',
    'platform_gc_tuning_profiles'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admin full access %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Super admin full access %s" ON public.%I FOR ALL USING (has_role(auth.uid(), ''super_admin''))', t, t);
  END LOOP;
END $$;