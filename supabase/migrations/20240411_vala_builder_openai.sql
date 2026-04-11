-- VALA Builder OpenAI Style Database Schema

-- Conversations table for AI chat interactions
CREATE TABLE IF NOT EXISTS vala_builder_conversations (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Builder plans for generated project architectures
CREATE TABLE IF NOT EXISTS vala_builder_plans (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) REFERENCES vala_builder_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    app_name VARCHAR(255) NOT NULL,
    description TEXT,
    architecture JSONB NOT NULL DEFAULT '{}'::jsonb,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    timeline JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated code storage
CREATE TABLE IF NOT EXISTS vala_builder_code (
    id VARCHAR(255) PRIMARY KEY,
    plan_id VARCHAR(255) REFERENCES vala_builder_plans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    component VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL,
    framework VARCHAR(50) NOT NULL,
    files JSONB NOT NULL DEFAULT '[]'::jsonb,
    dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    quality JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Builder templates for quick starts
CREATE TABLE IF NOT EXISTS vala_builder_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    icon VARCHAR(50),
    prompt TEXT,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Builder sessions for tracking user interactions
CREATE TABLE IF NOT EXISTS vala_builder_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) REFERENCES vala_builder_conversations(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Code deployments and builds
CREATE TABLE IF NOT EXISTS vala_builder_deployments (
    id VARCHAR(255) PRIMARY KEY,
    plan_id VARCHAR(255) REFERENCES vala_builder_plans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    environment VARCHAR(20) NOT NULL DEFAULT 'development' CHECK (environment IN ('development', 'staging', 'production')),
    deployment_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deployed', 'failed')),
    build_logs TEXT,
    deployed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User feedback and ratings
CREATE TABLE IF NOT EXISTS vala_builder_feedback (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) REFERENCES vala_builder_conversations(id) ON DELETE CASCADE,
    plan_id VARCHAR(255) REFERENCES vala_builder_plans(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(20) DEFAULT 'general' CHECK (feedback_type IN ('general', 'bug', 'feature', 'improvement')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vala_builder_conversations_user_id ON vala_builder_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_conversations_status ON vala_builder_conversations(status);
CREATE INDEX IF NOT EXISTS idx_vala_builder_conversations_updated_at ON vala_builder_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_vala_builder_plans_user_id ON vala_builder_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_plans_conversation_id ON vala_builder_plans(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_plans_created_at ON vala_builder_plans(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vala_builder_code_plan_id ON vala_builder_code(plan_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_code_user_id ON vala_builder_code(user_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_code_component ON vala_builder_code(component);

CREATE INDEX IF NOT EXISTS idx_vala_builder_templates_category ON vala_builder_templates(category);
CREATE INDEX IF NOT EXISTS idx_vala_builder_templates_is_active ON vala_builder_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_vala_builder_sessions_user_id ON vala_builder_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_sessions_last_activity ON vala_builder_sessions(last_activity DESC);

CREATE INDEX IF NOT EXISTS idx_vala_builder_deployments_plan_id ON vala_builder_deployments(plan_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_deployments_status ON vala_builder_deployments(status);

CREATE INDEX IF NOT EXISTS idx_vala_builder_feedback_user_id ON vala_builder_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_vala_builder_feedback_rating ON vala_builder_feedback(rating);

-- Insert default templates
INSERT INTO vala_builder_templates (id, name, description, category, icon, prompt, tags) VALUES
(
    'web-app',
    'Web Application',
    'Modern web app with React, Node.js, and database',
    'Web',
    'Globe',
    'Create a modern web application with React frontend, Node.js backend, and PostgreSQL database. Include user authentication, dashboard, and responsive design.',
    ARRAY['React', 'Node.js', 'PostgreSQL', 'Auth']
),
(
    'mobile-app',
    'Mobile App',
    'Cross-platform mobile application',
    'Mobile',
    'Smartphone',
    'Build a cross-platform mobile app using React Native with offline support, push notifications, and native device integration.',
    ARRAY['React Native', 'Mobile', 'Offline', 'Push Notifications']
),
(
    'api-service',
    'API Service',
    'RESTful API with microservices architecture',
    'Backend',
    'Server',
    'Design and implement a scalable RESTful API with microservices architecture, authentication, rate limiting, and comprehensive documentation.',
    ARRAY['API', 'Microservices', 'REST', 'Documentation']
),
(
    'ai-tool',
    'AI Tool',
    'AI-powered application with machine learning',
    'AI',
    'Bot',
    'Create an AI-powered tool with machine learning capabilities, data processing pipeline, and intelligent user interface.',
    ARRAY['AI', 'Machine Learning', 'Data Processing', 'ML']
),
(
    'ecommerce',
    'E-commerce Platform',
    'Full-featured online store with payment processing',
    'E-commerce',
    'Store',
    'Build a complete e-commerce platform with product catalog, shopping cart, payment processing, order management, and admin dashboard.',
    ARRAY['E-commerce', 'Payments', 'Inventory', 'Admin']
),
(
    'dashboard',
    'Analytics Dashboard',
    'Real-time analytics and data visualization',
    'Analytics',
    'FileText',
    'Create a comprehensive analytics dashboard with real-time data visualization, custom reports, and interactive charts.',
    ARRAY['Analytics', 'Charts', 'Real-time', 'Reports']
)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security (RLS) Policies
ALTER TABLE vala_builder_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vala_builder_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vala_builder_code ENABLE ROW LEVEL SECURITY;
ALTER TABLE vala_builder_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vala_builder_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vala_builder_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations" ON vala_builder_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON vala_builder_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON vala_builder_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON vala_builder_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for plans
CREATE POLICY "Users can view own plans" ON vala_builder_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans" ON vala_builder_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans" ON vala_builder_plans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans" ON vala_builder_plans
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for code
CREATE POLICY "Users can view own code" ON vala_builder_code
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own code" ON vala_builder_code
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own code" ON vala_builder_code
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own code" ON vala_builder_code
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sessions
CREATE POLICY "Users can view own sessions" ON vala_builder_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON vala_builder_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON vala_builder_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON vala_builder_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for deployments
CREATE POLICY "Users can view own deployments" ON vala_builder_deployments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deployments" ON vala_builder_deployments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deployments" ON vala_builder_deployments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own deployments" ON vala_builder_deployments
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for feedback
CREATE POLICY "Users can view own feedback" ON vala_builder_feedback
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON vala_builder_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback" ON vala_builder_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- Templates are public read-only
ALTER TABLE vala_builder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active templates" ON vala_builder_templates
    FOR SELECT USING (is_active = true);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_vala_builder_conversations_updated_at
    BEFORE UPDATE ON vala_builder_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vala_builder_templates_updated_at
    BEFORE UPDATE ON vala_builder_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
