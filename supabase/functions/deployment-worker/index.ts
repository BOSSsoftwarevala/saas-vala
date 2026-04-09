import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

async function appendLog(admin: any, deploymentId: string, level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}) {
  const payload = {
    deployment_id: deploymentId,
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  }

  const insertResult = await admin.from('deployment_logs').insert(payload)
  if (!insertResult.error) return

  const { data } = await admin.from('deployments').select('build_logs').eq('id', deploymentId).maybeSingle()
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
  const current = String(data?.build_logs || '').trim()
  const next = current ? `${current}\n${line}` : line
  await admin.from('deployments').update({ build_logs: next }).eq('id', deploymentId)
}

async function processDeployment(admin: any, deploymentId: string) {
  const { data: deployment, error: deploymentErr } = await admin
    .from('deployments')
    .select('id, server_id, status, branch, commit_sha, commit_message, retry_count, max_retries, last_error, servers(*)')
    .eq('id', deploymentId)
    .maybeSingle()

  if (deploymentErr) throw deploymentErr
  if (!deployment) throw new Error('Deployment not found')

  const status = String(deployment.status || '').toLowerCase()
  if (!['queued', 'failed'].includes(status)) {
    return { deployment_id: deploymentId, skipped: true, reason: `status:${status}` }
  }

  const retryCount = Number((deployment as any).retry_count || 0)
  const maxRetries = Math.max(0, Number((deployment as any).max_retries || 3))
  if (status === 'failed' && retryCount >= maxRetries) {
    return { deployment_id: deploymentId, skipped: true, reason: 'max_retries_reached' }
  }

  await admin.from('deployments').update({
    status: 'building',
    last_error: null,
  }).eq('id', deploymentId)

  await appendLog(admin, deploymentId, 'info', 'Worker picked deployment', {
    server_id: deployment.server_id,
    retry_count: retryCount,
  })

  const server = (deployment as any).servers
  if (!server?.id) {
    await admin.from('deployments').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      last_error: 'Server not found',
    }).eq('id', deploymentId)
    await appendLog(admin, deploymentId, 'error', 'Server not found for deployment')
    return { deployment_id: deploymentId, success: false, error: 'server_not_found' }
  }

  const envVars = (server && typeof server.env_vars === 'object' && server.env_vars) ? server.env_vars : {}
  const buildSettings = {
    installCommand: envVars.installCommand || null,
    buildCommand: envVars.buildCommand || null,
    outputDirectory: envVars.outputDirectory || null,
    rootDirectory: envVars.rootDirectory || null,
    nodeVersion: envVars.nodeVersion || null,
    framework: envVars.framework || null,
  }

  await appendLog(admin, deploymentId, 'info', 'Build settings resolved', {
    ...buildSettings,
  })

  const { data: agentResult, error: agentErr } = await admin.functions.invoke('server-agent', {
    body: {
      action: 'execute',
      serverId: deployment.server_id,
      command: 'deploy',
      params: {
        deploymentId,
        repository: server.git_repo || null,
        branch: deployment.branch || server.git_branch || 'main',
        commitSha: deployment.commit_sha || null,
        build: buildSettings,
      },
    },
  })

  if (agentErr || !agentResult?.success) {
    const nextRetry = retryCount + 1
    const shouldRetry = nextRetry < maxRetries
    const reason = agentErr?.message || agentResult?.error || 'Agent deploy command failed'

    await admin.from('deployments').update({
      status: shouldRetry ? 'queued' : 'failed',
      retry_count: nextRetry,
      last_error: reason,
      next_retry_at: shouldRetry ? new Date(Date.now() + Math.min(300000, 15000 * (2 ** nextRetry))).toISOString() : null,
      completed_at: shouldRetry ? null : new Date().toISOString(),
    }).eq('id', deploymentId)

    if (!shouldRetry) {
      await admin.from('servers').update({ status: 'failed' }).eq('id', deployment.server_id)
    }

    await appendLog(admin, deploymentId, shouldRetry ? 'warn' : 'error', reason, {
      retry_count: nextRetry,
      max_retries: maxRetries,
      will_retry: shouldRetry,
    })

    return {
      deployment_id: deploymentId,
      success: false,
      error: reason,
      retry_count: nextRetry,
      will_retry: shouldRetry,
    }
  }

  await appendLog(admin, deploymentId, 'info', 'Agent accepted deployment command', {
    result: agentResult?.result || null,
  })

  return { deployment_id: deploymentId, success: true, status: 'building' }
}

async function processQueue(admin: any, limit: number) {
  const nowIso = new Date().toISOString()
  const { data: pending, error } = await admin
    .from('deployments')
    .select('id, status, next_retry_at, retry_count, max_retries, created_at')
    .in('status', ['queued', 'failed'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  const items = pending || []
  const results: any[] = []
  for (const item of items) {
    try {
      const result = await processDeployment(admin, item.id)
      results.push(result)
    } catch (e: any) {
      results.push({ deployment_id: item.id, success: false, error: String(e?.message || e) })
    }
  }

  return {
    scanned: items.length,
    results,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const admin = createAdmin()
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'process_queue')

    if (action === 'process_deployment') {
      const deploymentId = String(body?.deployment_id || '')
      if (!deploymentId) return json({ success: false, error: 'deployment_id is required' }, 400)
      const result = await processDeployment(admin, deploymentId)
      return json({ success: true, ...result })
    }

    const limit = Math.min(20, Math.max(1, Number(body?.limit || 5)))
    const queueResult = await processQueue(admin, limit)
    return json({ success: true, ...queueResult })
  } catch (error: any) {
    console.error('[deployment-worker] error', error)
    return json({ success: false, error: String(error?.message || error) }, 500)
  }
})
