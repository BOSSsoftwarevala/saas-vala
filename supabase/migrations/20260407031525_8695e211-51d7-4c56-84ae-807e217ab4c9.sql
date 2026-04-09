
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'servers'
      AND column_name = 'server_type'
  ) THEN
    UPDATE public.servers
    SET ip_address = '72.61.236.249',
        agent_url = 'http://72.61.236.249/vala-agent',
        name = 'SaaSVala Production (Hostinger)',
        server_type = 'vps',
        status = 'live'
    WHERE ip_address = '64.226.91.27';
  ELSE
    UPDATE public.servers
    SET ip_address = '72.61.236.249',
        agent_url = 'http://72.61.236.249/vala-agent',
        name = 'SaaSVala Production (Hostinger)',
        status = 'live'
    WHERE ip_address = '64.226.91.27';
  END IF;
END
$$;
