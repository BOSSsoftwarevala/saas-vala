
CREATE TABLE public.tool_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  tool_name text NOT NULL,
  tool_input jsonb DEFAULT '{}',
  tool_output jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  execution_time_ms integer,
  tokens_used integer DEFAULT 0,
  cost numeric(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tool_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tool logs"
  ON public.tool_execution_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert tool logs"
  ON public.tool_execution_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE public.ai_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  model text NOT NULL,
  request_count integer DEFAULT 0,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_cost numeric(10,6) DEFAULT 0,
  tool_calls integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, model)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.ai_usage_daily FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can upsert usage"
  ON public.ai_usage_daily FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update usage"
  ON public.ai_usage_daily FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE public.system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  is_default boolean DEFAULT false,
  is_global boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own prompts"
  ON public.system_prompts FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_global = true OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.system_prompts (name, prompt, is_default, is_global) VALUES
  ('VALA Developer', 'You are VALA AI, an expert full-stack developer and business consultant for SaaSVala. You help with code generation, deployment, security audits, and business automation. Always respond in a professional yet friendly manner, mixing English with Hindi when appropriate.', true, true),
  ('Code Reviewer', 'You are a strict code reviewer. Analyze code for bugs, security vulnerabilities, performance issues, and best practice violations. Provide specific line-by-line feedback.', false, true),
  ('Business Analyst', 'You are a business analyst specializing in SaaS metrics. Analyze revenue, churn, user engagement, and provide actionable growth strategies.', false, true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_execution_logs;
