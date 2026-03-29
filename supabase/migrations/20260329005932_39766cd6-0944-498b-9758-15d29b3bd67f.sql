-- Update old Hostinger VPS to new DigitalOcean server
UPDATE public.servers 
SET ip_address = '64.226.91.27',
    agent_url = 'http://64.226.91.27/vala-agent',
    name = 'SaaSVala Production (DO)',
    server_type = 'vps',
    status = 'live'
WHERE id = '922e0a5a-7bb0-4a20-92cb-75d24509bc85';

-- Also update the main server record
UPDATE public.servers 
SET ip_address = '64.226.91.27',
    agent_url = 'http://64.226.91.27/vala-agent',
    server_type = 'self',
    status = 'live'
WHERE id = 'e63a0c91-5e8e-49bb-a333-b90978a3414c';