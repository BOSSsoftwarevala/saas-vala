-- AI Integrations Database Schema

-- AI Provider Configurations
CREATE TABLE IF NOT EXISTS ai_provider_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI API Keys (encrypted storage)
CREATE TABLE IF NOT EXISTS ai_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    encrypted_key TEXT NOT NULL,
    key_type TEXT NOT NULL DEFAULT 'api_key', -- api_key, token, secret
    is_valid BOOLEAN DEFAULT true,
    last_validated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Model Usage Tracking
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_type TEXT NOT NULL, -- text, image, audio, video, code, embedding
    usage_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0.00,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Requests Log
CREATE TABLE IF NOT EXISTS ai_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    request_type TEXT NOT NULL, -- text_generation, image_generation, voice_synthesis, code_generation
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10, 6) DEFAULT 0.00,
    response_time_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'success', -- success, error, timeout
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Templates
CREATE TABLE IF NOT EXISTS ai_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    category TEXT NOT NULL, -- code, text, image, voice, analysis
    template_type TEXT NOT NULL, -- prompt, system_prompt, instruction
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- Array of variable names
    usage_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Fine-tuning Jobs
CREATE TABLE IF NOT EXISTS ai_finetuning_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    base_model TEXT NOT NULL,
    job_name TEXT NOT NULL,
    training_data TEXT, -- JSON or file reference
    status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed
    progress INTEGER DEFAULT 0, -- 0-100
    fine_tuned_model_id TEXT,
    cost DECIMAL(10, 6) DEFAULT 0.00,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Voice Profiles
CREATE TABLE IF NOT EXISTS ai_voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    profile_name TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}'::jsonb, -- speed, pitch, emotion, etc.
    sample_audio_url TEXT,
    is_custom BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Generated Content Cache
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    content_hash TEXT NOT NULL UNIQUE, -- For deduplication
    content_type TEXT NOT NULL, -- text, image_url, audio_url, code
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    cache_expires_at TIMESTAMP WITH TIME ZONE,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Provider Health Status
CREATE TABLE IF NOT EXISTS ai_provider_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unknown', -- healthy, degraded, down, unknown
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    error_rate DECIMAL(5, 2) DEFAULT 0.00, -- Percentage
    uptime_percentage DECIMAL(5, 2) DEFAULT 100.00,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Cost Tracking
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    date DATE NOT NULL,
    requests_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0.00,
    budget_limit DECIMAL(10, 6),
    budget_alert_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, model_id, date)
);

-- AI Usage Quotas
CREATE TABLE IF NOT EXISTS ai_usage_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    quota_type TEXT NOT NULL, -- daily, weekly, monthly
    quota_limit INTEGER, -- Max requests or tokens
    quota_used INTEGER DEFAULT 0,
    quota_reset_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, model_id, quota_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_provider ON ai_provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_is_active ON ai_provider_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_ai_api_keys_provider ON ai_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_is_valid ON ai_api_keys(is_valid);

CREATE INDEX IF NOT EXISTS idx_ai_model_usage_user_id ON ai_model_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_provider ON ai_model_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_model_id ON ai_model_usage(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_usage_last_used ON ai_model_usage(last_used DESC);

CREATE INDEX IF NOT EXISTS idx_ai_requests_user_id ON ai_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_provider ON ai_requests(provider);
CREATE INDEX IF NOT EXISTS idx_ai_requests_model_id ON ai_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests(status);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON ai_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_templates_provider ON ai_templates(provider);
CREATE INDEX IF NOT EXISTS idx_ai_templates_category ON ai_templates(category);
CREATE INDEX IF NOT EXISTS idx_ai_templates_is_public ON ai_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_ai_templates_is_active ON ai_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_ai_finetuning_jobs_user_id ON ai_finetuning_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_finetuning_jobs_provider ON ai_finetuning_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_finetuning_jobs_status ON ai_finetuning_jobs(status);

CREATE INDEX IF NOT EXISTS idx_ai_voice_profiles_user_id ON ai_voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_voice_profiles_provider ON ai_voice_profiles(provider);
CREATE INDEX IF NOT EXISTS idx_ai_voice_profiles_is_active ON ai_voice_profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_ai_generated_content_user_id ON ai_generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_provider ON ai_generated_content(provider);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_content_hash ON ai_generated_content(content_hash);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_cache_expires_at ON ai_generated_content(cache_expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_provider_health_provider ON ai_provider_health(provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_health_status ON ai_provider_health(status);
CREATE INDEX IF NOT EXISTS idx_ai_provider_health_last_check ON ai_provider_health(last_check DESC);

CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_user_id ON ai_cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_provider ON ai_cost_tracking(provider);
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_date ON ai_cost_tracking(date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_quotas_user_id ON ai_usage_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_quotas_provider ON ai_usage_quotas(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_quotas_quota_reset_at ON ai_usage_quotas(quota_reset_at);

-- Row Level Security (RLS) Policies
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_finetuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user-specific tables
CREATE POLICY "Users can view own model usage" ON ai_model_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own model usage" ON ai_model_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own model usage" ON ai_model_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON ai_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests" ON ai_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own templates" ON ai_templates
    FOR SELECT USING (auth.uid() = created_by OR is_public = true);

CREATE POLICY "Users can insert own templates" ON ai_templates
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own templates" ON ai_templates
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can view own finetuning jobs" ON ai_finetuning_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own finetuning jobs" ON ai_finetuning_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own finetuning jobs" ON ai_finetuning_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own voice profiles" ON ai_voice_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice profiles" ON ai_voice_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice profiles" ON ai_voice_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own generated content" ON ai_generated_content
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated content" ON ai_generated_content
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own cost tracking" ON ai_cost_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cost tracking" ON ai_cost_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cost tracking" ON ai_cost_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage quotas" ON ai_usage_quotas
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage quotas" ON ai_usage_quotas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage quotas" ON ai_usage_quotas
    FOR UPDATE USING (auth.uid() = user_id);

-- Admin-only policies for sensitive tables
CREATE POLICY "Only admins can manage provider configs" ON ai_provider_configs
    FOR ALL USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid() 
          AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Only admins can manage API keys" ON ai_api_keys
    FOR ALL USING (
        EXISTS (
          SELECT 1 FROM auth.users 
          WHERE auth.users.id = auth.uid() 
          AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Everyone can view provider health" ON ai_provider_health
    FOR SELECT USING (true);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_ai_provider_configs_updated_at
    BEFORE UPDATE ON ai_provider_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_api_keys_updated_at
    BEFORE UPDATE ON ai_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_model_usage_updated_at
    BEFORE UPDATE ON ai_model_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_templates_updated_at
    BEFORE UPDATE ON ai_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_finetuning_jobs_updated_at
    BEFORE UPDATE ON ai_finetuning_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_voice_profiles_updated_at
    BEFORE UPDATE ON ai_voice_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_provider_health_updated_at
    BEFORE UPDATE ON ai_provider_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_cost_tracking_updated_at
    BEFORE UPDATE ON ai_cost_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_usage_quotas_updated_at
    BEFORE UPDATE ON ai_usage_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default AI provider configurations
INSERT INTO ai_provider_configs (provider, config) VALUES
('openai', '{"model": "gpt-4-turbo", "temperature": 0.7, "maxTokens": 4096, "stream": true}'),
('anthropic', '{"model": "claude-3-sonnet", "temperature": 0.7, "maxTokens": 4096, "stream": false}'),
('google', '{"model": "gemini-1.0-pro", "temperature": 0.7, "maxTokens": 4096, "stream": false}'),
('elevenlabs', '{"model": "eleven-multilingual-v2", "voiceId": "rachel", "speed": 1.0}'),
('stability', '{"model": "stable-diffusion-xl", "size": "1024x1024", "quality": "standard"}'),
('cohere', '{"model": "command-r-plus", "temperature": 0.7, "maxTokens": 4096}'),
('mistral', '{"model": "mistral-large", "temperature": 0.7, "maxTokens": 4096}'),
('groq', '{"model": "llama3-70b-8192", "temperature": 0.7, "maxTokens": 8192}'),
('deepseek', '{"model": "deepseek-coder-v2", "temperature": 0.2, "maxTokens": 16384}'),
('zhipu', '{"model": "glm-4", "temperature": 0.7, "maxTokens": 128000}')
ON CONFLICT (provider) DO NOTHING;

-- Insert default AI templates
INSERT INTO ai_templates (name, description, provider, model_id, category, template_type, template_content, variables, is_public) VALUES
(
    'Code Generation',
    'Generate high-quality code with best practices',
    'openai',
    'gpt-4-turbo',
    'code',
    'prompt',
    'Generate {{language}} code{{framework ? " using " + framework : ""}}: {{prompt}}

{{includeTests ? "Include comprehensive unit tests." : ""}}
{{includeDocs ? "Include detailed documentation and comments." : ""}}

Requirements:
- Follow {{language}} best practices
- Use modern syntax and patterns
- Include error handling
- Make code production-ready

Return only the code without explanations.',
    ARRAY['language', 'framework', 'prompt', 'includeTests', 'includeDocs'],
    true
),
(
    'App Architecture Planning',
    'Plan application architecture and technology stack',
    'anthropic',
    'claude-3-sonnet',
    'text',
    'system_prompt',
    'You are an expert software architect helping plan {{appType}} applications.

For the project "{{projectName}}":
{{description}}

Create a comprehensive architecture plan including:
1. Technology stack recommendations
2. System design and components
3. Database schema design
4. API structure
5. Security considerations
6. Scalability planning
7. Development timeline

Provide specific, actionable recommendations with reasoning.',
    ARRAY['appType', 'projectName', 'description'],
    true
),
(
    'Image Generation Prompt',
    'Create detailed prompts for image generation',
    'openai',
    'gpt-4-turbo',
    'image',
    'prompt',
    'Create a detailed image generation prompt for: {{subject}}

Style: {{style}}
Mood: {{mood}}
Details: {{details}}

Generate a comprehensive prompt that includes:
- Subject description
- Artistic style
- Composition
- Lighting
- Color palette
- Additional details for high-quality output

Return only the prompt text.',
    ARRAY['subject', 'style', 'mood', 'details'],
    true
),
(
    'Voice Script Generation',
    'Generate scripts for voice synthesis',
    'elevenlabs',
    'eleven-multilingual-v2',
    'voice',
    'prompt',
    'Create a natural-sounding script for voice synthesis:

Topic: {{topic}}
Tone: {{tone}}
Duration: {{duration}} minutes
Audience: {{audience}}

Requirements:
- Natural, conversational language
- Clear pronunciation
- Appropriate pacing
- Emotion and emphasis where needed
- {{callToAction ? "Include clear call to action" : ""}}

Generate the complete script with timing notes.',
    ARRAY['topic', 'tone', 'duration', 'audience', 'callToAction'],
    true
)
ON CONFLICT DO NOTHING;
