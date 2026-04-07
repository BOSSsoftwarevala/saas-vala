
UPDATE public.servers 
SET ip_address = '72.61.236.249',
    agent_url = 'http://72.61.236.249/vala-agent',
    name = 'SaaSVala Production (Hostinger)',
    server_type = 'vps',
    status = 'live'
WHERE ip_address = '64.226.91.27';
