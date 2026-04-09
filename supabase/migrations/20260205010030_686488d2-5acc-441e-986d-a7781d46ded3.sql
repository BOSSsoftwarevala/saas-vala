-- ================================================
-- MISSING BACKEND TABLES FOR ENTERPRISE SYSTEM
-- ================================================

-- 1. TENANTS TABLE (Multi-tenant support)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan_id UUID,
  max_users INTEGER DEFAULT 10,
  max_products INTEGER DEFAULT 100,
  max_servers INTEGER DEFAULT 5,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. ROLE_PERMISSION_MAP TABLE
CREATE TABLE IF NOT EXISTS public.role_permission_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- 4. PLANS TABLE (Subscription plans)
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  billing_period TEXT DEFAULT 'monthly',
  features JSONB DEFAULT '[]'::jsonb,
  limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. RATE_LIMITS TABLE
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  tenant_id UUID,
  endpoint TEXT NOT NULL,
  requests_count INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  window_seconds INTEGER DEFAULT 60,
  max_requests INTEGER DEFAULT 100,
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. DNS_RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.dns_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID,
  record_type TEXT NOT NULL DEFAULT 'A',
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  ttl INTEGER DEFAULT 3600,
  priority INTEGER,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'domains'
  ) THEN
    BEGIN
      ALTER TABLE public.dns_records
      ADD CONSTRAINT dns_records_domain_id_fkey
      FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$$;

-- 7. AI_MODELS TABLE
CREATE TABLE IF NOT EXISTS public.ai_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  description TEXT,
  input_cost_per_1k NUMERIC DEFAULT 0,
  output_cost_per_1k NUMERIC DEFAULT 0,
  max_tokens INTEGER DEFAULT 4096,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  capabilities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. AI_QUOTAS TABLE
CREATE TABLE IF NOT EXISTS public.ai_quotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID,
  daily_limit INTEGER DEFAULT 100,
  monthly_limit INTEGER DEFAULT 3000,
  daily_used INTEGER DEFAULT 0,
  monthly_used INTEGER DEFAULT 0,
  last_reset_daily TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_reset_monthly TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. AI_COSTS TABLE
CREATE TABLE IF NOT EXISTS public.ai_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  request_id UUID REFERENCES public.ai_requests(id) ON DELETE SET NULL,
  model_id UUID REFERENCES public.ai_models(id) ON DELETE SET NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  billed BOOLEAN DEFAULT false,
  billed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. AI_ERRORS TABLE
CREATE TABLE IF NOT EXISTS public.ai_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  request_id UUID,
  model_id UUID,
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_type TEXT DEFAULT 'api_error',
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================
-- ENABLE RLS ON ALL NEW TABLES
-- ================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permission_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_errors ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RLS POLICIES
-- ================================================

-- Tenants
CREATE POLICY "Super admin full access tenants" ON public.tenants FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users view own tenant" ON public.tenants FOR SELECT USING (owner_id = auth.uid());

-- Permissions (read-only for all authenticated)
CREATE POLICY "Authenticated can view permissions" ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Super admin manage permissions" ON public.permissions FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Role Permission Map
CREATE POLICY "Authenticated can view role_permission_map" ON public.role_permission_map FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Super admin manage role_permission_map" ON public.role_permission_map FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Plans (public read)
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING (is_active = true);
CREATE POLICY "Super admin manage plans" ON public.plans FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Rate Limits
CREATE POLICY "Super admin full access rate_limits" ON public.rate_limits FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users view own rate_limits" ON public.rate_limits FOR SELECT USING (user_id = auth.uid());

-- DNS Records
CREATE POLICY "Super admin full access dns_records" ON public.dns_records FOR ALL USING (has_role(auth.uid(), 'super_admin'));
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'domains'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Users view own dns_records"
      ON public.dns_records FOR SELECT
      USING (
        domain_id IN (SELECT id FROM public.domains WHERE created_by = auth.uid())
      )
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE POLICY "Users view own dns_records"
      ON public.dns_records FOR SELECT
      USING (FALSE)
    $sql$;
  END IF;
END
$$;

-- AI Models (public read for active)
CREATE POLICY "Anyone can view active ai_models" ON public.ai_models FOR SELECT USING (is_active = true);
CREATE POLICY "Super admin manage ai_models" ON public.ai_models FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- AI Quotas
CREATE POLICY "Super admin full access ai_quotas" ON public.ai_quotas FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users view own ai_quotas" ON public.ai_quotas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own ai_quotas" ON public.ai_quotas FOR UPDATE USING (user_id = auth.uid());

-- AI Costs
CREATE POLICY "Super admin full access ai_costs" ON public.ai_costs FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users view own ai_costs" ON public.ai_costs FOR SELECT USING (user_id = auth.uid());

-- AI Errors
CREATE POLICY "Super admin full access ai_errors" ON public.ai_errors FOR ALL USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users view own ai_errors" ON public.ai_errors FOR SELECT USING (user_id = auth.uid());

-- ================================================
-- SEED DEFAULT PERMISSIONS
-- ================================================

INSERT INTO public.permissions (name, description, module, action) VALUES
  ('products.view', 'View products', 'products', 'view'),
  ('products.create', 'Create products', 'products', 'create'),
  ('products.edit', 'Edit products', 'products', 'edit'),
  ('products.delete', 'Delete products', 'products', 'delete'),
  ('servers.view', 'View servers', 'servers', 'view'),
  ('servers.create', 'Create servers', 'servers', 'create'),
  ('servers.edit', 'Edit servers', 'servers', 'edit'),
  ('servers.delete', 'Delete servers', 'servers', 'delete'),
  ('servers.deploy', 'Deploy servers', 'servers', 'deploy'),
  ('keys.view', 'View license keys', 'keys', 'view'),
  ('keys.create', 'Create license keys', 'keys', 'create'),
  ('keys.revoke', 'Revoke license keys', 'keys', 'revoke'),
  ('wallet.view', 'View wallet', 'wallet', 'view'),
  ('wallet.add_credits', 'Add credits to wallet', 'wallet', 'add_credits'),
  ('marketplace.view', 'View marketplace', 'marketplace', 'view'),
  ('marketplace.buy', 'Buy from marketplace', 'marketplace', 'buy'),
  ('marketplace.sell', 'Sell on marketplace', 'marketplace', 'sell'),
  ('ai.use', 'Use AI features', 'ai', 'use'),
  ('ai.manage', 'Manage AI settings', 'ai', 'manage'),
  ('audit.view', 'View audit logs', 'audit', 'view'),
  ('settings.view', 'View settings', 'settings', 'view'),
  ('settings.edit', 'Edit settings', 'settings', 'edit'),
  ('users.view', 'View users', 'users', 'view'),
  ('users.manage', 'Manage users', 'users', 'manage'),
  ('resellers.view', 'View resellers', 'resellers', 'view'),
  ('resellers.manage', 'Manage resellers', 'resellers', 'manage')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- SEED DEFAULT AI MODELS
-- ================================================

INSERT INTO public.ai_models (name, provider, model_id, description, input_cost_per_1k, output_cost_per_1k, max_tokens, is_default) VALUES
  ('Gemini 2.5 Flash', 'google', 'google/gemini-2.5-flash', 'Fast balanced model for most tasks', 0.05, 0.15, 8192, true),
  ('Gemini 2.5 Pro', 'google', 'google/gemini-2.5-pro', 'Top-tier for complex reasoning', 0.10, 0.30, 32768, false),
  ('GPT-5', 'openai', 'openai/gpt-5', 'Powerful all-rounder', 0.50, 1.50, 128000, false),
  ('GPT-5 Mini', 'openai', 'openai/gpt-5-mini', 'Cost-effective strong model', 0.10, 0.30, 128000, false)
ON CONFLICT DO NOTHING;

-- ================================================
-- SEED DEFAULT PLANS
-- ================================================

INSERT INTO public.plans (name, slug, description, price, billing_period, features, limits) VALUES
  ('Free', 'free', 'Basic free tier', 0, 'monthly', '["5 products", "1 server", "Basic support"]', '{"products": 5, "servers": 1, "ai_requests": 100}'),
  ('Pro', 'pro', 'Professional tier', 2999, 'monthly', '["50 products", "10 servers", "Priority support", "AI features"]', '{"products": 50, "servers": 10, "ai_requests": 5000}'),
  ('Enterprise', 'enterprise', 'Enterprise tier', 9999, 'monthly', '["Unlimited products", "Unlimited servers", "24/7 support", "Custom AI"]', '{"products": -1, "servers": -1, "ai_requests": -1}')
ON CONFLICT (slug) DO NOTHING;

-- ================================================
-- UPDATE TRIGGERS
-- ================================================

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dns_records_updated_at BEFORE UPDATE ON public.dns_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON public.ai_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_quotas_updated_at BEFORE UPDATE ON public.ai_quotas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();