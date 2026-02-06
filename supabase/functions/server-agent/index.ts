import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServerCredentials {
  id: string;
  name: string;
  agent_url: string;
  agent_token: string;
  status: string;
}

interface AgentCommand {
  action: string;
  params?: Record<string, any>;
}

interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

// Available commands the agent can execute
const AVAILABLE_COMMANDS = [
  'status',           // Get server status
  'deploy',           // Deploy a project
  'restart',          // Restart services
  'logs',             // View logs
  'backup',           // Create backup
  'exec',             // Execute custom command
  'file_upload',      // Upload file
  'file_download',    // Download file
  'service_status',   // Check specific service
  'disk_usage',       // Check disk usage
  'memory_usage',     // Check memory
  'cpu_usage',        // Check CPU
  'list_processes',   // List running processes
  'kill_process',     // Kill a process
  'cron_list',        // List cron jobs
  'cron_add',         // Add cron job
  'nginx_reload',     // Reload nginx
  'ssl_status',       // Check SSL certificates
  'firewall_status',  // Check firewall
  'database_backup',  // Backup database
  'database_restore', // Restore database
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, serverId, command, params } = await req.json();

    console.log(`[VALA Agent] Action: ${action}, Server: ${serverId}, Command: ${command}`);

    switch (action) {
      case 'list_servers': {
        // List all connected servers with agents
        const { data: servers, error } = await supabase
          .from('servers')
          .select('id, name, ip_address, status, subdomain, agent_url, agent_token')
          .not('agent_url', 'is', null);

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          servers: servers?.map(s => ({
            id: s.id,
            name: s.name,
            ip: s.ip_address,
            status: s.status,
            subdomain: s.subdomain,
            agent_connected: !!s.agent_url
          })) || [],
          total: servers?.length || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'register_agent': {
        // Register a new server agent
        const { name, ip_address, agent_url, agent_token } = params;
        
        if (!name || !agent_url || !agent_token) {
          throw new Error('Missing required fields: name, agent_url, agent_token');
        }

        const { data: server, error } = await supabase
          .from('servers')
          .insert({
            name,
            ip_address: ip_address || 'auto-detected',
            agent_url,
            agent_token,
            status: 'live',
            server_type: 'vps'
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          message: 'Server agent registered successfully',
          server_id: server.id,
          server_name: server.name
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'execute': {
        // Execute command on server via agent
        if (!serverId) throw new Error('Server ID required');
        if (!command) throw new Error('Command required');
        if (!AVAILABLE_COMMANDS.includes(command)) {
          throw new Error(`Invalid command. Available: ${AVAILABLE_COMMANDS.join(', ')}`);
        }

        // Get server agent details
        const { data: server, error: serverError } = await supabase
          .from('servers')
          .select('id, name, agent_url, agent_token')
          .eq('id', serverId)
          .single();

        if (serverError || !server) {
          throw new Error('Server not found or agent not configured');
        }

        if (!server.agent_url || !server.agent_token) {
          throw new Error('Server agent not configured. Please install VALA Agent on this server.');
        }

        // Call the agent
        console.log(`[VALA Agent] Calling agent at ${server.agent_url}`);
        
        const agentResponse = await fetch(server.agent_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${server.agent_token}`,
            'X-VALA-Command': command
          },
          body: JSON.stringify({
            command,
            params: params || {},
            timestamp: new Date().toISOString()
          })
        });

        if (!agentResponse.ok) {
          const errorText = await agentResponse.text();
          throw new Error(`Agent error: ${agentResponse.status} - ${errorText}`);
        }

        const result = await agentResponse.json();

        // Log the activity
        await supabase.from('activity_logs').insert({
          entity_type: 'server',
          entity_id: serverId,
          action: `agent_${command}`,
          details: { command, params, result: result.success ? 'success' : 'failed' }
        });

        return new Response(JSON.stringify({
          success: true,
          server_name: server.name,
          command,
          result: result.data,
          executed_at: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'quick_status': {
        // Get quick status of a server
        if (!serverId) throw new Error('Server ID required');

        const { data: server, error } = await supabase
          .from('servers')
          .select('*')
          .eq('id', serverId)
          .single();

        if (error || !server) throw new Error('Server not found');

        // If agent is configured, try to get live status
        let liveStatus = null;
        if (server.agent_url && server.agent_token) {
          try {
            const statusResponse = await fetch(server.agent_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${server.agent_token}`
              },
              body: JSON.stringify({ command: 'status' })
            });
            
            if (statusResponse.ok) {
              liveStatus = await statusResponse.json();
            }
          } catch (e) {
            console.log('[VALA Agent] Could not reach agent for live status');
          }
        }

        return new Response(JSON.stringify({
          success: true,
          server: {
            id: server.id,
            name: server.name,
            ip: server.ip_address,
            status: server.status,
            type: server.server_type,
            subdomain: server.subdomain,
            agent_connected: !!server.agent_url
          },
          live_status: liveStatus
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'available_commands': {
        return new Response(JSON.stringify({
          success: true,
          commands: AVAILABLE_COMMANDS,
          description: {
            status: 'Get full server status (CPU, RAM, Disk, Uptime)',
            deploy: 'Deploy a project to the server',
            restart: 'Restart a service (nginx, pm2, mysql, etc.)',
            logs: 'View logs (system, nginx, application)',
            backup: 'Create full server backup',
            exec: 'Execute custom shell command',
            service_status: 'Check status of a specific service',
            disk_usage: 'Check disk space usage',
            memory_usage: 'Check RAM usage',
            cpu_usage: 'Check CPU load',
            list_processes: 'List all running processes',
            kill_process: 'Kill a process by PID or name',
            nginx_reload: 'Reload nginx configuration',
            ssl_status: 'Check SSL certificate expiry',
            database_backup: 'Backup MySQL/PostgreSQL database'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('[VALA Agent] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
