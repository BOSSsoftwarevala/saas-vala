-- Create source code catalog table
CREATE TABLE public.source_code_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  file_path TEXT, -- original SSD path
  file_size BIGINT,
  uploaded_to_github BOOLEAN DEFAULT false,
  github_repo_url TEXT,
  github_account TEXT, -- SaaSVala or SoftwareVala
  
  -- AI Analysis fields
  tech_stack JSONB DEFAULT '{}', -- {frontend: [], backend: [], database: [], languages: []}
  detected_features JSONB DEFAULT '[]', -- [{name, description, icon}]
  project_type TEXT, -- billing, crm, pos, ecommerce, etc.
  target_industry TEXT, -- retail, healthcare, education, etc.
  ai_description TEXT,
  ai_generated_readme TEXT,
  complexity_score INT DEFAULT 0, -- 1-10
  
  -- Marketplace fields
  is_on_marketplace BOOLEAN DEFAULT false,
  marketplace_price NUMERIC DEFAULT 5.00,
  marketplace_listing_id UUID,
  sales_count INT DEFAULT 0,
  
  -- Metadata
  status TEXT DEFAULT 'pending', -- pending, analyzing, analyzed, uploaded, listed
  analysis_logs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,
  listed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.source_code_catalog ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view
CREATE POLICY "Anyone can view catalog" 
ON public.source_code_catalog 
FOR SELECT 
USING (true);

-- Only super_admin can modify
CREATE POLICY "Super admins can manage catalog" 
ON public.source_code_catalog 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Create index for faster search
CREATE INDEX idx_catalog_search ON public.source_code_catalog 
USING GIN(to_tsvector('english', project_name || ' ' || COALESCE(ai_description, '') || ' ' || COALESCE(project_type, '')));

CREATE INDEX idx_catalog_status ON public.source_code_catalog(status);
CREATE INDEX idx_catalog_industry ON public.source_code_catalog(target_industry);
CREATE INDEX idx_catalog_github ON public.source_code_catalog(github_account);

-- Update timestamp trigger
CREATE TRIGGER update_source_code_catalog_updated_at
BEFORE UPDATE ON public.source_code_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create bulk upload queue table
CREATE TABLE public.bulk_upload_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id UUID REFERENCES public.source_code_catalog(id) ON DELETE CASCADE,
  upload_type TEXT NOT NULL, -- github, analyze, marketplace
  priority INT DEFAULT 5, -- 1=highest, 10=lowest
  status TEXT DEFAULT 'queued', -- queued, processing, completed, failed
  error_message TEXT,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_upload_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage queue" 
ON public.bulk_upload_queue 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE INDEX idx_queue_status ON public.bulk_upload_queue(status, priority, scheduled_at);