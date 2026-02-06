-- Add agent columns to servers table for VALA Server Agent
ALTER TABLE public.servers 
ADD COLUMN IF NOT EXISTS agent_url TEXT,
ADD COLUMN IF NOT EXISTS agent_token TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.servers.agent_url IS 'URL of the VALA Server Agent running on this server';
COMMENT ON COLUMN public.servers.agent_token IS 'Secure token for authenticating with the VALA Server Agent';