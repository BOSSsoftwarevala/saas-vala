ALTER TABLE public.servers DROP CONSTRAINT servers_server_type_check;
ALTER TABLE public.servers ADD CONSTRAINT servers_server_type_check CHECK (server_type = ANY (ARRAY['vercel'::text, 'self'::text, 'cloud'::text, 'hybrid'::text, 'vps'::text]));

-- Also add ip_address column if missing
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS ip_address text;