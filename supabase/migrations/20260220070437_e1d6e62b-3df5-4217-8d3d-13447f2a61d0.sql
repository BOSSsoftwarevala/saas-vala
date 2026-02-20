
-- =====================================================
-- AI PERSISTENT MEMORY SYSTEM
-- Long-term memory that survives session/server restart
-- =====================================================

-- Main memory table
CREATE TABLE public.ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type TEXT NOT NULL DEFAULT 'permanent' 
    CHECK (memory_type IN ('permanent', 'project', 'session')),
  category TEXT NOT NULL DEFAULT 'general',
  -- Categories: business_goal, architecture, permission, api_meta, 
  --             product_structure, repo_note, bug, decision, 
  --             deploy_config, current_task, action_log, runtime_log
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'NORMAL' 
    CHECK (priority IN ('HIGH', 'NORMAL', 'TEMP')),
  project_context TEXT,     -- repo name or project slug
  source TEXT DEFAULT 'ai' CHECK (source IN ('user', 'ai', 'system')),
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- only used for TEMP priority
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Memory audit trail - tracks every create/update/recall
CREATE TABLE public.ai_memory_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES public.ai_memories(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'recalled', 'expired')),
  old_content TEXT,
  new_content TEXT,
  session_id TEXT,          -- which chat session triggered this
  recall_reason TEXT,       -- why this memory was retrieved
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory_audit ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin full access ai_memories"
  ON public.ai_memories FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin full access ai_memory_audit"
  ON public.ai_memory_audit FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Indexes for fast retrieval
CREATE INDEX idx_ai_memories_type ON public.ai_memories(memory_type);
CREATE INDEX idx_ai_memories_priority ON public.ai_memories(priority);
CREATE INDEX idx_ai_memories_category ON public.ai_memories(category);
CREATE INDEX idx_ai_memories_active ON public.ai_memories(is_active);
CREATE INDEX idx_ai_memories_expires ON public.ai_memories(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_ai_memories_tags ON public.ai_memories USING GIN(tags);
CREATE INDEX idx_ai_memory_audit_memory_id ON public.ai_memory_audit(memory_id);

-- Auto-update updated_at
CREATE TRIGGER update_ai_memories_updated_at
  BEFORE UPDATE ON public.ai_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed critical permanent memories from existing project knowledge
INSERT INTO public.ai_memories (memory_type, category, title, content, priority, source, tags) VALUES
(
  'permanent', 'business_goal',
  'Platform Overview & Business Goal',
  'SoftwareVala / SaaSVala is an enterprise software marketplace platform. Business goals: 1) Manage 7,000+ software products, 2) Support 5 million+ users, 3) Multi-tenant architecture, 4) Automated GitHub-based product management, 5) AI-powered development & automation. The platform sells software at $5/month per product with APK downloads and license key management.',
  'HIGH', 'system',
  ARRAY['business', 'platform', 'goals', 'overview']
),
(
  'permanent', 'architecture',
  'Tech Stack & Architecture Rules',
  'Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui. Backend: Supabase (Lovable Cloud) - PostgreSQL + Edge Functions + Storage. AI: OpenAI GPT-5 + Lovable AI models. Key rules: 1) Always use HSL color tokens from index.css, 2) Never edit supabase/config.toml or client.ts, 3) Use RLS on all tables, 4) Edge functions deploy automatically, 5) Max 10 message history to avoid token overflow.',
  'HIGH', 'system',
  ARRAY['tech', 'architecture', 'rules', 'stack']
),
(
  'permanent', 'architecture',
  'Database Architecture - 60+ Tables',
  'Enterprise-grade database with RBAC (user_roles, permissions, role_permission_map), multi-tenant isolation (tenants), Git-centric products schema (products with git_repo_url, git_default_branch), AI observability (ai_costs, ai_requests, ai_responses, ai_quotas), wallet system (wallets, transactions), license management (license_keys, license_verification_logs), APK management (apks, apk_versions, apk_downloads), server management (servers, deployments, git_connections), and SEO/leads (leads, seo_backlinks).',
  'HIGH', 'system',
  ARRAY['database', 'tables', 'schema', 'architecture']
),
(
  'permanent', 'github',
  'GitHub Accounts Configuration',
  'Two GitHub accounts are connected: 1) SaaSVala - primary account with 180+ repositories (private). Uses SAASVALA_GITHUB_TOKEN. 2) SoftwareVala - secondary account. Uses SOFTWAREVALA_GITHUB_TOKEN. Both tokens are stored as Supabase Edge Function secrets. GitHub API uses pagination (per_page=100) to fetch all 180+ repos. Repos are private so authenticated endpoints must be used.',
  'HIGH', 'system',
  ARRAY['github', 'accounts', 'saasvala', 'softwarevala', 'tokens']
),
(
  'permanent', 'permission',
  'Role-Based Access Control',
  'Three roles: 1) super_admin - full access to all features and all tables, 2) reseller - limited access to own products, servers, leads, 3) First user automatically becomes super_admin. Role checked via has_role() PostgreSQL function. All tables have RLS policies. Never bypass RLS. Auth handled by Supabase with email verification required.',
  'HIGH', 'system',
  ARRAY['rbac', 'roles', 'super_admin', 'reseller', 'permissions']
),
(
  'permanent', 'api_meta',
  'AI Models & API Configuration',
  'Available AI models (no API key needed via Lovable AI): google/gemini-2.5-pro, google/gemini-2.5-flash, openai/gpt-5, openai/gpt-5-mini, openai/gpt-5-nano, openai/gpt-5.2. Secrets configured: OPENAI_API_KEY, LOVABLE_API_KEY, ELEVENLABS_API_KEY (voice), RESEND_API_KEY (email), GITHUB_CLIENT_ID/SECRET (OAuth). Edge functions: ai-developer, ai-chat, ai-auto-pilot, server-agent, seo-optimize, verify-license, download-apk, elevenlabs-tts, github-connect, source-code-manager.',
  'HIGH', 'system',
  ARRAY['ai', 'models', 'api', 'openai', 'secrets', 'edge-functions']
),
(
  'permanent', 'product_structure',
  'Marketplace Product Structure',
  'Products table has: name, slug, product_code (PRD-XXXXXX auto-generated), price ($5/month), category_id, thumbnail_url, demo_url, demo_login, demo_password, apk_url, license_enabled, device_bind, device_limit, git_repo_url, git_default_branch, target_industry, tech_stack_json, features (JSON), seo_title, seo_description. Product lifecycle: draft -> active -> archived. Marketplace visibility controlled by marketplace_visible flag.',
  'HIGH', 'system',
  ARRAY['products', 'marketplace', 'structure', 'schema']
),
(
  'permanent', 'architecture',
  'AI Developer Agent - 12 Tool Suite',
  'VALA AI has 12 tools: 1) list_github_repos - lists all repos with full pagination (180+ repos), 2) read_github_file - reads any file from any repo, 3) write_github_file - creates/updates files, 4) create_github_repo - new repo creation, 5) delete_github_file - removes files, 6) analyze_code_quality - security/quality scan, 7) check_server_status - server health, 8) deploy_to_server - triggers deployment, 9) list_servers - all servers, 10) send_whatsapp - Meta API messaging, 11) log_client_request - logs business requests, 12) check_github_repos/test_repo_product - health checks. Context limited to 10 messages. Hinglish persona.',
  'HIGH', 'system',
  ARRAY['vala-ai', 'tools', 'agent', 'capabilities', 'developer']
);
