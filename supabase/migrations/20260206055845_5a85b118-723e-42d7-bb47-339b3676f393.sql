-- Create user_violations table for fraud tracking
CREATE TABLE public.user_violations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  violation_type TEXT NOT NULL DEFAULT 'fraud',
  violation_count INTEGER NOT NULL DEFAULT 1,
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_fines_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_at TIMESTAMP WITH TIME ZONE,
  last_violation_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_violations ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own violations
CREATE POLICY "Users can view their own violations" 
ON public.user_violations 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow system to insert/update violations
CREATE POLICY "System can manage violations" 
ON public.user_violations 
FOR ALL 
USING (true);

-- Add apk_url and download_url columns to products table for APK tracking
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS apk_url TEXT,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_apk BOOLEAN DEFAULT false;

-- Create apk_downloads table for tracking downloads and transaction-based keys
CREATE TABLE public.apk_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  license_key TEXT NOT NULL,
  download_ip TEXT,
  device_info JSONB,
  is_verified BOOLEAN DEFAULT false,
  verification_attempts INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.apk_downloads ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own downloads
CREATE POLICY "Users can view their own APK downloads" 
ON public.apk_downloads 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for fast lookup
CREATE INDEX idx_apk_downloads_license ON public.apk_downloads(license_key);
CREATE INDEX idx_apk_downloads_user ON public.apk_downloads(user_id);
CREATE INDEX idx_user_violations_email ON public.user_violations(email);
CREATE INDEX idx_user_violations_user ON public.user_violations(user_id);