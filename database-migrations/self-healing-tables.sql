-- Required tables for Self-Healing System
-- Run these migrations on Supabase SQL editor

-- Error Detection Logs
CREATE TABLE IF NOT EXISTS error_detection_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL,
  details JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_error_detection_logs_type ON error_detection_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_detection_logs_user ON error_detection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_detection_logs_detected ON error_detection_logs(detected_at);

-- System Health Logs
CREATE TABLE IF NOT EXISTS system_health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy')),
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  component_results JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_logs_checked ON system_health_logs(checked_at);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_status ON system_health_logs(overall_status);

-- Heal Logs
CREATE TABLE IF NOT EXISTS heal_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  component TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  actions JSONB NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heal_logs_performed ON heal_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_heal_logs_component ON heal_logs(component);

-- Heal Alerts
CREATE TABLE IF NOT EXISTS heal_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  component TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_heal_alerts_created ON heal_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_heal_alerts_resolved ON heal_alerts(resolved);

-- DB Health Logs
CREATE TABLE IF NOT EXISTS db_health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy')),
  table_health JSONB NOT NULL,
  relation_health JSONB NOT NULL,
  issues JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_health_logs_checked ON db_health_logs(checked_at);

-- DB Health Issues
CREATE TABLE IF NOT EXISTS db_health_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_type TEXT NOT NULL,
  table_name TEXT,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  requires_manual_intervention BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_db_health_issues_type ON db_health_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_db_health_issues_resolved ON db_health_issues(resolved);

-- Job Monitor Logs
CREATE TABLE IF NOT EXISTS job_monitor_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_monitor_logs_job ON job_monitor_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_monitor_logs_type ON job_monitor_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_job_monitor_logs_created ON job_monitor_logs(created_at);

-- Job Monitor Reports
CREATE TABLE IF NOT EXISTS job_monitor_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  total_jobs INTEGER NOT NULL,
  stuck_jobs INTEGER NOT NULL,
  running_jobs INTEGER NOT NULL,
  pending_jobs INTEGER NOT NULL,
  job_details JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_monitor_reports_checked ON job_monitor_reports(checked_at);

-- Module Health Logs
CREATE TABLE IF NOT EXISTS module_health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_name TEXT NOT NULL,
  status_before TEXT NOT NULL,
  score_before INTEGER NOT NULL,
  issues JSONB NOT NULL,
  repair_attempted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_health_logs_module ON module_health_logs(module_name);
CREATE INDEX IF NOT EXISTS idx_module_health_logs_created ON module_health_logs(created_at);

-- Module Health Reports
CREATE TABLE IF NOT EXISTS module_health_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_health JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_module_health_reports_checked ON module_health_reports(checked_at);

-- Module Health Issues
CREATE TABLE IF NOT EXISTS module_health_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_name TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  requires_manual_intervention BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_module_health_issues_module ON module_health_issues(module_name);
CREATE INDEX IF NOT EXISTS idx_module_health_issues_resolved ON module_health_issues(resolved);

-- Self Clean Logs
CREATE TABLE IF NOT EXISTS self_clean_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  results JSONB NOT NULL,
  total_cleaned INTEGER NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_clean_logs_performed ON self_clean_logs(performed_at);
