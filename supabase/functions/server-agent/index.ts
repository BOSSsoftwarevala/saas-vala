import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ServerRecord {
  id: string;
  name: string;
  ip_address: string | null;
  status: string;
  subdomain: string | null;
  server_type: string | null;
  agent_url: string | null;
  agent_token: string | null;
  health_status?: string | null;
}

interface AgentCommand {
  action?: string;
  serverId?: string;
  command?: string;
  params?: Record<string, unknown>;
}

interface AgentProbeResult {
  alive: boolean;
  workingUrl: string | null;
  liveStatus: unknown;
  attempts: Array<{ url: string; method: string; status: number | null; error?: string }>;
}

const AVAILABLE_COMMANDS = [
  'status', 'deploy', 'restart', 'logs', 'backup', 'exec', 'file_upload', 'file_download',
  'service_status', 'disk_usage', 'memory_usage', 'cpu_usage', 'list_processes', 'kill_process',
  'cron_list', 'cron_add', 'nginx_reload', 'ssl_status', 'firewall_status',
  'database_backup', 'database_restore',
];

const HEARTBEAT_SETTLE_STATUSES = new Set(['deploying', 'suspended', 'failed']);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function tokenMatches(stored: string | null, provided: string | null): Promise<boolean> {
  if (!stored || !provided) return false;
  if (stored === provided) return true;

  // Backward compatibility for hashed/plain token mismatches.
  const [storedHash, providedHash] = await Promise.all([sha256Hex(stored), sha256Hex(provided)]);
  return stored === providedHash || provided === storedHash;
}

function getCandidateUrls(server: ServerRecord): string[] {
  const urls = new Set<string>();

  if (server.agent_url) {
    urls.add(normalizeUrl(server.agent_url));
  }

  if (server.ip_address) {
    urls.add(`http://${server.ip_address}:9876`);
  }

  return Array.from(urls);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeAgent(server: ServerRecord, tokenOverride?: string): Promise<AgentProbeResult> {
  const attempts: AgentProbeResult['attempts'] = [];
  const urls = getCandidateUrls(server);
  const token = tokenOverride ?? server.agent_token ?? '';

  if (!token || urls.length === 0) {
    return { alive: false, workingUrl: null, liveStatus: null, attempts };
  }

  for (const baseUrl of urls) {
    const healthUrl = `${baseUrl}/health`;
    try {
      const healthResp = await fetchWithTimeout(
        healthUrl,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
        8000,
      );
      attempts.push({ url: healthUrl, method: 'GET', status: healthResp.status });

      if (healthResp.ok) {
        const healthPayload = await healthResp.json().catch(() => null);
        return { alive: true, workingUrl: baseUrl, liveStatus: healthPayload, attempts };
      }
      await healthResp.text();
    } catch (error) {
      attempts.push({
        url: healthUrl,
        method: 'GET',
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const statusResp = await fetchWithTimeout(
        baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-VALA-Command': 'status',
          },
          body: JSON.stringify({ command: 'status', timestamp: new Date().toISOString() }),
        },
        8000,
      );
      attempts.push({ url: baseUrl, method: 'POST', status: statusResp.status });

      if (statusResp.ok) {
        const payload = await statusResp.json().catch(async () => {
          const raw = await statusResp.text();
          return { raw };
        });
        return { alive: true, workingUrl: baseUrl, liveStatus: payload, attempts };
      }
      await statusResp.text();
    } catch (error) {
      attempts.push({
        url: baseUrl,
        method: 'POST',
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { alive: false, workingUrl: null, liveStatus: null, attempts };
}

async function executeCommandOnAgent(server: ServerRecord, command: string, params: Record<string, unknown>): Promise<{ result: unknown; usedUrl: string; attempts: AgentProbeResult['attempts'] }> {
  const attempts: AgentProbeResult['attempts'] = [];
  const urls = getCandidateUrls(server);

  if (!server.agent_token || urls.length === 0) {
    throw new Error('Server agent not configured. Please install and register VALA Agent.');
  }

  for (const url of urls) {
    try {
      const resp = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${server.agent_token}`,
            'X-VALA-Command': command,
          },
          body: JSON.stringify({ command, params, timestamp: new Date().toISOString() }),
        },
        12000,
      );
      attempts.push({ url, method: 'POST', status: resp.status });

      if (resp.ok) {
        const result = await resp.json().catch(async () => ({ raw: await resp.text() }));
        return { result, usedUrl: url, attempts };
      }

      const errorText = await resp.text();
      attempts[attempts.length - 1].error = errorText.slice(0, 400);
    } catch (error) {
      attempts.push({
        url,
        method: 'POST',
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(`Agent command failed on all endpoints. Attempts: ${JSON.stringify(attempts)}`);
}

async function getServerByIdOrIp(supabase: any, serverId: string): Promise<ServerRecord | null> {
  if (!serverId) return null;

  let query = supabase.from('servers').select('*');
  query = isUuid(serverId) ? query.eq('id', serverId) : query.eq('ip_address', serverId);

  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as unknown as ServerRecord;
}

async function logServerActivity(
  supabase: any,
  entityId: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    entity_type: 'server',
    entity_id: entityId,
    action,
    details,
  });

  if (error) {
    console.error('[VALA Agent] Failed to write activity log:', error.message);
  }
}

function getEnvAudit() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const optional = ['AGENT_TOKEN', 'SERVER_API_KEY'];

  return {
    required: Object.fromEntries(required.map((k) => [k, !!Deno.env.get(k)])),
    optional: Object.fromEntries(optional.map((k) => [k, !!Deno.env.get(k)])),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const envAudit = getEnvAudit();

    if (!supabaseUrl || !supabaseKey) {
      console.error('[VALA Agent] Missing required backend env vars:', envAudit);
      return jsonResponse({
        success: false,
        error: 'Server configuration error: required environment variables missing',
        env_audit: envAudit,
      }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = (await req.json().catch(() => ({}))) as AgentCommand;

    const action = body.action;
    const serverId = body.serverId;
    const command = body.command;
    const params = body.params ?? {};

    console.log(`[VALA Agent] Action=${action} Server=${serverId ?? 'n/a'} Command=${command ?? 'n/a'}`);

    switch (action) {
      case 'env_audit':
        return jsonResponse({ success: true, env_audit: envAudit, timestamp: new Date().toISOString() });

      case 'list_servers': {
        const { data: servers, error } = await supabase
          .from('servers')
          .select('id, name, ip_address, status, subdomain, agent_url, health_status')
          .not('agent_url', 'is', null);

        if (error) throw error;

        return jsonResponse({
          success: true,
          servers: (servers ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            ip: s.ip_address,
            status: s.status,
            subdomain: s.subdomain,
            health_status: s.health_status,
            agent_connected: !!s.agent_url,
          })),
          total: servers?.length ?? 0,
        });
      }

      case 'register':
      case 'register_agent': {
        const name = String(params.name ?? '').trim();
        const ip_address = params.ip_address ? String(params.ip_address) : null;
        const agent_url = params.agent_url ? normalizeUrl(String(params.agent_url)) : null;
        const agent_token = params.agent_token ? String(params.agent_token) : null;

        if (!name) {
          throw new Error('Missing required field: name');
        }

        // Try probe but DON'T fail if agent is unreachable - allow offline registration
        let probe: AgentProbeResult = { alive: false, workingUrl: null, liveStatus: null, attempts: [] };
        if (agent_url && agent_token) {
          probe = await probeAgent({
            id: 'temp',
            name,
            ip_address,
            status: 'stopped',
            subdomain: null,
            server_type: 'vps',
            agent_url,
            agent_token,
          });
        }

        const resolvedStatus = probe.alive ? 'live' : 'stopped';
        const resolvedHealth = probe.alive ? 'healthy' : 'pending';

        let existing: ServerRecord | null = null;
        if (ip_address) {
          const { data: byIp } = await supabase.from('servers').select('*').eq('ip_address', ip_address).maybeSingle();
          existing = (byIp as ServerRecord | null) ?? null;
        }

        let savedServer: ServerRecord;
        if (existing) {
          const { data, error } = await supabase
            .from('servers')
            .update({
              name,
              agent_url: probe.workingUrl ?? agent_url,
              agent_token: agent_token ?? existing.agent_token,
              status: resolvedStatus,
              health_status: resolvedHealth,
              server_type: 'vps',
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (error || !data) throw error ?? new Error('Failed to update existing server');
          savedServer = data as ServerRecord;
        } else {
          const { data, error } = await supabase
            .from('servers')
            .insert({
              name,
              ip_address,
              agent_url: probe.workingUrl ?? agent_url,
              agent_token,
              status: resolvedStatus,
              health_status: resolvedHealth,
              server_type: 'vps',
            })
            .select('*')
            .single();

          if (error || !data) throw error ?? new Error('Failed to register server');
          savedServer = data as ServerRecord;
        }

        await logServerActivity(supabase, savedServer.id, 'agent_register', {
          ip_address,
          agent_url: probe.workingUrl ?? agent_url,
          agent_alive: probe.alive,
          attempts: probe.attempts,
        });

        return jsonResponse({
          success: true,
          message: probe.alive
            ? 'Server registered and agent verified successfully'
            : 'Server registered (agent offline — fix Nginx proxy, then verify)',
          server_id: savedServer.id,
          server_name: savedServer.name,
          status: resolvedStatus,
          agent_alive: probe.alive,
          verified: probe.alive,
          fix_instructions: probe.alive ? null : 'Run on your VPS: curl -sSL https://softwarevala.net/vala-agent/fix-proxy.sh | sudo bash',
        });
      }

      case 'verify':
      case 'verify_agent': {
        if (!serverId) throw new Error('Server ID or IP required');
        const server = await getServerByIdOrIp(supabase, serverId);
        if (!server) throw new Error('Server not found');

        const incomingToken = params.agent_token ? String(params.agent_token) : server.agent_token;
        if (!incomingToken) throw new Error('Agent token missing');

        const probe = await probeAgent(server, incomingToken);

        if (!probe.alive) {
          await logServerActivity(supabase, server.id, 'agent_verify_failed', { attempts: probe.attempts });
          throw new Error(`Agent verification failed. Attempts: ${JSON.stringify(probe.attempts)}`);
        }

        await supabase
          .from('servers')
          .update({
            status: 'live',
            health_status: 'healthy',
            agent_url: probe.workingUrl,
            agent_token: incomingToken,
          })
          .eq('id', server.id);

        await logServerActivity(supabase, server.id, 'agent_verify_success', {
          used_url: probe.workingUrl,
          attempts: probe.attempts,
        });

        return jsonResponse({
          success: true,
          verified: true,
          server_id: server.id,
          server_name: server.name,
          status: 'live',
          used_url: probe.workingUrl,
        });
      }

      case 'ping':
      case 'agent_ping': {
        const inputServerId = params.serverId ? String(params.serverId) : serverId;
        const ip = params.ip_address ? String(params.ip_address) : null;
        const providedToken = params.agent_token ? String(params.agent_token) : null;

        let server: ServerRecord | null = null;
        if (inputServerId) {
          server = await getServerByIdOrIp(supabase, String(inputServerId));
        } else if (ip) {
          const { data } = await supabase.from('servers').select('*').eq('ip_address', ip).maybeSingle();
          server = (data as ServerRecord | null) ?? null;
        }

        if (!server) {
          throw new Error('Server not found for heartbeat ping');
        }

        const isValidToken = await tokenMatches(server.agent_token, providedToken);
        if (!isValidToken) {
          await logServerActivity(supabase, server.id, 'agent_ping_rejected', {
            reason: 'token_mismatch',
            ip_address: ip,
          });
          return jsonResponse({ success: false, error: 'Invalid agent token' }, 403);
        }

        await supabase
          .from('servers')
          .update({
            status: 'live',
            health_status: 'healthy',
            updated_at: new Date().toISOString(),
          })
          .eq('id', server.id);

        await logServerActivity(supabase, server.id, 'agent_ping_ok', {
          ip_address: ip,
          at: new Date().toISOString(),
        });

        return jsonResponse({ success: true, server_id: server.id, status: 'live', heartbeat: 'accepted' });
      }

      case 'status':
      case 'agent_status':
      case 'quick_status': {
        if (!serverId) throw new Error('Server ID or IP required');
        const server = await getServerByIdOrIp(supabase, serverId);
        if (!server) throw new Error('Server not found');

        const probe = await probeAgent(server);

        if (probe.alive && probe.workingUrl && probe.workingUrl !== normalizeUrl(server.agent_url ?? '')) {
          await supabase.from('servers').update({ agent_url: probe.workingUrl }).eq('id', server.id);
        }

        if (probe.alive) {
          await supabase
            .from('servers')
            .update({ status: 'live', health_status: 'healthy', updated_at: new Date().toISOString() })
            .eq('id', server.id);
        } else if (server.agent_url && !HEARTBEAT_SETTLE_STATUSES.has(server.status)) {
          await supabase
            .from('servers')
            .update({ status: 'stopped', health_status: 'offline', updated_at: new Date().toISOString() })
            .eq('id', server.id);
        }

        await logServerActivity(supabase, server.id, probe.alive ? 'agent_heartbeat_ok' : 'agent_heartbeat_failed', {
          attempts: probe.attempts,
          used_url: probe.workingUrl,
        });

        return jsonResponse({
          success: true,
          server: {
            id: server.id,
            name: server.name,
            ip: server.ip_address,
            status: probe.alive ? 'live' : (HEARTBEAT_SETTLE_STATUSES.has(server.status) ? server.status : 'stopped'),
            type: server.server_type,
            subdomain: server.subdomain,
            agent_connected: !!server.agent_url,
            agent_alive: probe.alive,
          },
          live_status: probe.liveStatus,
          diagnostics: {
            attempts: probe.attempts,
            env_audit: envAudit,
          },
        });
      }

      case 'execute': {
        if (!serverId) throw new Error('Server ID required');
        if (!command) throw new Error('Command required');
        if (!AVAILABLE_COMMANDS.includes(command)) {
          throw new Error(`Invalid command. Available: ${AVAILABLE_COMMANDS.join(', ')}`);
        }

        const server = await getServerByIdOrIp(supabase, serverId);
        if (!server) {
          throw new Error('Server not found or agent not configured');
        }

        if (!server.agent_url || !server.agent_token) {
          throw new Error('Server agent not configured. Please install VALA Agent on this server.');
        }

        const commandResult = await executeCommandOnAgent(server, command, params as Record<string, unknown>);

        if (commandResult.usedUrl !== normalizeUrl(server.agent_url)) {
          await supabase.from('servers').update({ agent_url: commandResult.usedUrl }).eq('id', server.id);
        }

        await logServerActivity(supabase, server.id, `agent_${command}`, {
          command,
          params,
          used_url: commandResult.usedUrl,
          attempts: commandResult.attempts,
        });

        return jsonResponse({
          success: true,
          server_name: server.name,
          command,
          result: (commandResult.result as { data?: unknown })?.data ?? commandResult.result,
          executed_at: new Date().toISOString(),
          diagnostics: { attempts: commandResult.attempts },
        });
      }

      case 'health':
      case 'system_health': {
        const { data: allServers, error } = await supabase
          .from('servers')
          .select('id, name, ip_address, status, agent_url, agent_token, server_type');

        if (error) throw error;

        const checks = await Promise.all((allServers ?? []).map(async (raw) => {
          const server = raw as ServerRecord;
          const probe = await probeAgent(server);
          return {
            id: server.id,
            name: server.name,
            ip: server.ip_address,
            status: server.status,
            type: server.server_type,
            agent_configured: !!server.agent_url,
            agent_alive: probe.alive,
            attempts: probe.attempts,
          };
        }));

        return jsonResponse({ success: true, servers: checks, timestamp: new Date().toISOString() });
      }

      case 'available_commands':
        return jsonResponse({
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
            database_backup: 'Backup MySQL/PostgreSQL database',
          },
        });

      default:
        throw new Error(
          `Unknown action: ${action}. Available: env_audit, list_servers, register, register_agent, verify, verify_agent, ping, agent_ping, status, agent_status, quick_status, execute, health, available_commands`,
        );
    }
  } catch (error) {
    console.error('[VALA Agent] Error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 400);
  }
});
