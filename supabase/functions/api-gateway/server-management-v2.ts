// Server Management API - Premium Monitoring, Billing, AI Analysis, and Agent System
// Handles: Metrics, SSH, Agents, Logs, Billing, AI Insights

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const anthropic = OPENAI_API_KEY ? new Anthropic({ apiKey: OPENAI_API_KEY }) : null

// ==== Helper Functions ====
function calculateRamPercent(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100 * 100) / 100 : 0
}

function calculateDiskPercent(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100 * 100) / 100 : 0
}

async function analyzeServerHealthWithAI(
  metrics: any,
  logs: any[],
  serverName: string
): Promise<{ analysis: string; recommendations: string[] }> {
  if (!anthropic) return { analysis: 'AI analysis unavailable', recommendations: [] }
  
  try {
    const prompt = `Analyze this server's health and provide insights:
Server: ${serverName}
CPU: ${metrics.cpu_percent}%
RAM: ${calculateRamPercent(metrics.ram_used_mb, metrics.ram_total_mb)}% (${Math.round(metrics.ram_used_mb)}MB/${Math.round(metrics.ram_total_mb)}MB)
Disk: ${calculateDiskPercent(metrics.disk_used_gb, metrics.disk_total_gb)}% (${Math.round(metrics.disk_used_gb)}GB/${Math.round(metrics.disk_total_gb)}GB)
Network In: ${metrics.network_in_mbps} Mbps
Error Rate: ${metrics.error_count}/${metrics.request_count}

Recent errors: ${logs.slice(0, 5).map(l => `[${l.action}] ${l.error_details}`).join('; ')}

Provide:
1. Overall health assessment
2. 3-5 actionable recommendations to improve performance and reliability
3. Security concerns if any`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const recommendations = text.match(/\d\.\s+[^\n]+/g) || []
    
    return {
      analysis: text,
      recommendations: recommendations.map(r => r.replace(/^\d\.\s+/, '')),
    }
  } catch (e) {
    console.error('AI analysis error:', e)
    return { analysis: 'AI analysis failed', recommendations: [] }
  }
}

// ==== Server Metrics Handlers ====
async function handleServerMetrics(method: string, subParts: string[], body: any, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'GET' && action === 'latest') {
    const { data } = await admin
      .from('server_metrics')
      .select('*')
      .eq('server_id', serverId)
      .order('recorded_at', { ascending: false })
      .limit(1)
    return { metrics: data?.[0] }
  }

  if (method === 'GET' && action === 'history') {
    const hours = body.hours || 24
    const { data } = await admin
      .from('server_metrics')
      .select('*')
      .eq('server_id', serverId)
      .gte('recorded_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: true })
    return { metrics: data || [] }
  }

  if (method === 'POST' && action === 'record') {
    // Called by agent to record metrics
    const { data, error } = await admin
      .from('server_metrics')
      .insert([
        {
          server_id: serverId,
          cpu_percent: body.cpu_percent,
          ram_used_mb: body.ram_used_mb,
          ram_total_mb: body.ram_total_mb,
          disk_used_gb: body.disk_used_gb,
          disk_total_gb: body.disk_total_gb,
          network_in_mbps: body.network_in_mbps,
          network_out_mbps: body.network_out_mbps,
          request_count: body.request_count,
          error_count: body.error_count,
          avg_response_time_ms: body.avg_response_time_ms,
          uptime_seconds: body.uptime_seconds,
        },
      ])
    return { success: !error, data }
  }

  return { error: 'Invalid action' }
}

// ==== SSH Key Management ====
async function handleServerSSHKeys(method: string, subParts: string[], body: any, userId: string, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'GET') {
    const { data } = await admin
      .from('server_ssh_keys')
      .select('id,key_name,fingerprint,host,port,username,is_active,last_used_at')
      .eq('server_id', serverId)
      .eq('user_id', userId)
    return { keys: data || [] }
  }

  if (method === 'POST' && action === 'add') {
    // In production, use proper SSH key encryption
    const { data, error } = await admin
      .from('server_ssh_keys')
      .insert([
        {
          server_id: serverId,
          user_id: userId,
          key_name: body.key_name,
          private_key_encrypted: body.private_key, // TODO: encrypt
          public_key: body.public_key,
          key_type: body.key_type || 'rsa',
          fingerprint: body.fingerprint,
          host: body.host,
          port: body.port || 22,
          username: body.username || 'root',
        },
      ])
    return { success: !error, data }
  }

  if (method === 'DELETE' && action === 'remove') {
    const { error } = await admin
      .from('server_ssh_keys')
      .delete()
      .eq('id', body.key_id)
      .eq('user_id', userId)
    return { success: !error }
  }

  return { error: 'Invalid action' }
}

// ==== Agent Registration & Heartbeat ====
async function handleServerAgents(method: string, subParts: string[], body: any, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'POST' && action === 'register') {
    // Agent registers itself
    const apiToken = crypto.randomUUID()
    const { data, error } = await admin
      .from('server_agents')
      .insert([
        {
          server_id: serverId,
          agent_name: body.agent_name,
          agent_version: body.agent_version,
          api_token: apiToken,
          ip_address: body.ip_address,
        },
      ])
    return { success: !error, api_token: apiToken, data }
  }

  if (method === 'POST' && action === 'heartbeat') {
    // Agent sends heartbeat
    const { error } = await admin
      .from('server_agents')
      .update({
        last_heartbeat: new Date().toISOString(),
        status: 'online',
        ip_address: body.ip_address,
      })
      .eq('id', body.agent_id)
    return { success: !error }
  }

  if (method === 'GET') {
    const { data } = await admin
      .from('server_agents')
      .select('id,agent_name,agent_version,status,last_heartbeat')
      .eq('server_id', serverId)
    return { agents: data || [] }
  }

  return { error: 'Invalid action' }
}

// ==== Server Logs ====
async function handleServerLogs(method: string, subParts: string[], body: any, userId: string, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'GET') {
    const limit = body.limit || 100
    const { data } = await admin
      .from('server_logs')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return { logs: data || [] }
  }

  if (method === 'POST' && action === 'log') {
    // Log operation
    const { data, error } = await admin
      .from('server_logs')
      .insert([
        {
          server_id: serverId,
          user_id: body.user_id || userId,
          agent_id: body.agent_id,
          action: body.action,
          status: body.status || 'pending',
          message: body.message,
          error_details: body.error_details,
          command: body.command,
          output: body.output,
          duration_seconds: body.duration_seconds,
          metadata: body.metadata || {},
        },
      ])
    return { success: !error, data }
  }

  return { error: 'Invalid action' }
}

// ==== Server Billing ($49/month) ====
async function handleServerBilling(method: string, subParts: string[], body: any, userId: string, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'GET' && action === 'current') {
    const { data } = await admin
      .from('server_billing')
      .select('*')
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single()
    return { billing: data }
  }

  if (method === 'GET' && action === 'history') {
    const { data } = await admin
      .from('server_billing')
      .select('*')
      .eq('server_id', serverId)
      .eq('user_id', userId)
      .order('billing_cycle_start', { ascending: false })
      .limit(12)
    return { billing_history: data || [] }
  }

  if (method === 'POST' && action === 'create-cycle') {
    // Create new billing cycle (called monthly)
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    const { data, error } = await admin
      .from('server_billing')
      .insert([
        {
          server_id: serverId,
          user_id: userId,
          billing_cycle_start: start.toISOString().split('T')[0],
          billing_cycle_end: end.toISOString().split('T')[0],
          base_price: 49.00,
          total_amount: 49.00,
          status: 'pending',
          due_date: new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ])
    return { success: !error, data }
  }

  if (method === 'POST' && action === 'mark-paid') {
    const { error } = await admin
      .from('server_billing')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', body.billing_id)
    return { success: !error }
  }

  return { error: 'Invalid action' }
}

// ==== AI Analysis ====
async function handleServerAIAnalysis(method: string, subParts: string[], body: any, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'GET' && action === 'latest') {
    const { data } = await admin
      .from('server_ai_analysis')
      .select('*')
      .eq('server_id', serverId)
      .order('analyzed_at', { ascending: false })
      .limit(1)
    return { analysis: data?.[0] }
  }

  if (method === 'POST' && action === 'analyze') {
    // Trigger full analysis
    const { data: metrics } = await admin
      .from('server_metrics')
      .select('*')
      .eq('server_id', serverId)
      .order('recorded_at', { ascending: false })
      .limit(1)

    const { data: logs } = await admin
      .from('server_logs')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: server } = await admin
      .from('servers')
      .select('name')
      .eq('id', serverId)
      .single()

    const latestMetric = metrics?.[0]
    if (!latestMetric) return { error: 'No metrics available' }

    const { analysis, recommendations } = await analyzeServerHealthWithAI(
      latestMetric,
      logs || [],
      server?.name || 'Unknown'
    )

    const { data, error } = await admin
      .from('server_ai_analysis')
      .insert([
        {
          server_id: serverId,
          analysis_type: 'performance',
          prompt: `Health analysis for ${server?.name}`,
          response: analysis,
          tokens_used: 1024, // approximate
          confidence_score: 85,
          recommendations,
          actionable_items: { items: recommendations },
        },
      ])

    return { success: !error, analysis, recommendations, data }
  }

  return { error: 'Invalid action' }
}

// ==== SSL Certificate Management ====
async function handleServerSSLCertificates(method: string, subParts: string[], body: any, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'GET') {
    const { data } = await admin
      .from('server_ssl_certificates')
      .select('domain,issuer,issued_at,expires_at,auto_renewal,status')
      .eq('server_id', serverId)
      .order('expires_at', { ascending: true })
    return { certificates: data || [] }
  }

  if (method === 'POST' && action === 'add') {
    const { data, error } = await admin
      .from('server_ssl_certificates')
      .insert([
        {
          server_id: serverId,
          domain: body.domain,
          certificate_data: body.certificate_data,
          private_key_encrypted: body.private_key,
          issuer: body.issuer,
          issued_at: body.issued_at,
          expires_at: body.expires_at,
          auto_renewal: body.auto_renewal !== false,
        },
      ])
    return { success: !error, data }
  }

  return { error: 'Invalid action' }
}

// ==== Server Control (Start/Stop/Restart) ====
async function handleServerControl(method: string, subParts: string[], body: any, admin: any): Promise<any> {
  const [serverId, action] = subParts

  if (method === 'POST' && ['start', 'stop', 'restart', 'deploy'].includes(action)) {
    // Log the action
    await admin.from('server_logs').insert([
      {
        server_id: serverId,
        action,
        status: 'pending',
        message: `${action} initiated`,
      },
    ])

    // TODO: Forward to agent via WebSocket or HTTP callback
    return { success: true, message: `${action} command queued` }
  }

  return { error: 'Invalid action' }
}

export async function handleServersV2(
  method: string,
  subParts: string[],
  body: any,
  userId: string,
  admin: any,
  req: Request
): Promise<any> {
  const [serverId, resource, action] = subParts

  // Check if user owns the server
  const { data: server } = await admin
    .from('servers')
    .select('created_by')
    .eq('id', serverId)
    .single()

  if (!server || server.created_by !== userId) {
    return { error: 'Unauthorized' }
  }

  switch (resource) {
    case 'metrics':
      return await handleServerMetrics(method, subParts.slice(1), body, admin)
    case 'ssh-keys':
      return await handleServerSSHKeys(method, subParts.slice(1), body, userId, admin)
    case 'agents':
      return await handleServerAgents(method, subParts.slice(1), body, admin)
    case 'logs':
      return await handleServerLogs(method, subParts.slice(1), body, userId, admin)
    case 'billing':
      return await handleServerBilling(method, subParts.slice(1), body, userId, admin)
    case 'ai-analysis':
      return await handleServerAIAnalysis(method, subParts.slice(1), body, admin)
    case 'ssl':
      return await handleServerSSLCertificates(method, subParts.slice(1), body, admin)
    case 'control':
      return await handleServerControl(method, subParts.slice(1), body, admin)
    default:
      return { error: 'Unknown resource' }
  }
}
