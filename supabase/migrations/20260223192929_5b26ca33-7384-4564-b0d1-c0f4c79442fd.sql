ALTER TABLE public.servers DROP CONSTRAINT IF EXISTS servers_server_type_check;
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'servers'
			AND column_name = 'server_type'
	) THEN
		ALTER TABLE public.servers
		ADD CONSTRAINT servers_server_type_check
		CHECK (server_type = ANY (ARRAY['vercel'::text, 'self'::text, 'cloud'::text, 'hybrid'::text, 'vps'::text]));
	END IF;
END
$$;

-- Also add ip_address column if missing
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS ip_address text;