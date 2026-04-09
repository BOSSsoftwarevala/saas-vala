import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

type RunAction =
  | 'create_app'
  | 'clone_software'
  | 'generate_ui'
  | 'generate_backend'
  | 'fix_errors'
  | 'build_project'
  | 'deploy_demo'
  | 'publish_marketplace'

const ALLOWED_ACTIONS = new Set<RunAction>([
  'create_app',
  'clone_software',
  'generate_ui',
  'generate_backend',
  'fix_errors',
  'build_project',
  'deploy_demo',
  'publish_marketplace',
])

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, service)
}

function createAuthedClient(authHeader: string) {
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  return createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
}

function normalizeInput(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F]/g, ' ')
    .trim()
}

function sanitizeAppName(value: string): string {
  const normalized = normalizeInput(value)
  return normalized.replace(/[^a-zA-Z0-9\s-_]/g, '').slice(0, 100)
}

function slugify(value: string): string {
  return normalizeInput(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

async function requireRole(admin: any, userId: string): Promise<{ allowed: boolean; roles: string[] }> {
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId)
  const roles = Array.from(new Set((data || []).map((r: any) => String(r.role))))
  const allowed = roles.includes('super_admin') || roles.includes('admin') || roles.includes('developer')
  return { allowed, roles }
}

async function checkRateLimit(admin: any, userId: string): Promise<{ ok: boolean; reason?: string }> {
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count, error } = await admin
    .from('vala_builder_runs')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', userId)
    .gte('created_at', since)

  if (error) return { ok: false, reason: error.message }
  const maxPerMinute = Number(Deno.env.get('VALA_BUILDER_MAX_RUNS_PER_MINUTE') || '8')
  return { ok: Number(count || 0) < maxPerMinute, reason: `Rate limit exceeded (${maxPerMinute}/min)` }
}

async function createRun(admin: any, userId: string, payload: any) {
  const action = String(payload?.action || '').trim() as RunAction
  if (!ALLOWED_ACTIONS.has(action)) return { error: 'Invalid action' }

  const appNameRaw = String(payload?.app_name || '')
  const appName = sanitizeAppName(appNameRaw)
  const appDescription = normalizeInput(String(payload?.app_description || ''))
  const sourceRef = normalizeInput(String(payload?.source_ref || '')) || null

  if (!appName) return { error: 'app_name is required' }
  if (!appDescription && !sourceRef) return { error: 'app_description or source_ref is required' }
  if (appDescription.length > 4000) return { error: 'app_description too long (max 4000 chars)' }

  const appSlug = slugify(appName)
  if (!appSlug) return { error: 'Invalid app name' }

  const environment = String(payload?.environment || 'staging')
  if (!['dev', 'staging', 'production'].includes(environment)) {
    return { error: 'Invalid environment (dev/staging/production)' }
  }

  const templateKey = normalizeInput(String(payload?.template_key || '')) || null
  let finalDescription = appDescription
  let templateModules: any[] = []

  if (templateKey) {
    const { data: tpl } = await admin
      .from('vala_builder_templates')
      .select('template_key, default_prompt, default_modules, is_active')
      .eq('template_key', templateKey)
      .maybeSingle()
    if (!tpl || !tpl.is_active) return { error: 'Template not found or inactive' }

    finalDescription = `${tpl.default_prompt}\n\n${appDescription}`.trim()
    templateModules = Array.isArray(tpl.default_modules) ? tpl.default_modules : []
  }

  const rl = await checkRateLimit(admin, userId)
  if (!rl.ok) return { error: rl.reason || 'Rate limit failed' }

  const projectKey = String(payload?.project_key || appSlug).toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 80)
  const priority = Math.max(1, Math.min(10, Number(payload?.priority || (action === 'create_app' ? 3 : 5))))
  const selectedServerId = payload?.selected_server_id || null
  const fallbackServerId = payload?.fallback_server_id || null
  const safeMode = Boolean(payload?.safe_mode || false)

  const { data: run, error } = await admin
    .from('vala_builder_runs')
    .insert({
      app_name: appName,
      app_description: finalDescription || `Clone source: ${sourceRef}`,
      app_slug: appSlug,
      project_key: projectKey,
      action,
      status: 'pending',
      requested_by: userId,
      selected_server_id: selectedServerId,
      fallback_server_id: fallbackServerId,
      source_ref: sourceRef,
      environment,
      priority,
      safe_mode: safeMode,
      step_timeout_seconds: Number(payload?.step_timeout_seconds || 600),
      max_retries: Number(payload?.max_retries || 2),
      prompt_version: String(payload?.prompt_version || 'v1'),
      metadata: {
        requested_models: ['openai', 'gemini', 'claude'],
        voice_system: ['whisper-stt', 'elevenlabs-tts'],
        infrastructure: ['github', 'vps-agent', 'docker', 'vercel'],
        template_key: templateKey,
        template_modules: templateModules,
        plugin_keys: Array.isArray(payload?.plugin_keys) ? payload.plugin_keys : [],
      },
    })
    .select('*')
    .single()

  if (error || !run) return { error: error?.message || 'Failed to create run' }

  await admin.from('vala_builder_step_logs').insert({
    run_id: run.id,
    step_key: 'system',
    step_order: 0,
    status: 'success',
    message: `Run queued for action: ${action}`,
    details: {
      app_name: appName,
      app_slug: appSlug,
      project_key: projectKey,
      environment,
      priority,
      selected_server_id: selectedServerId,
      source_ref: sourceRef,
      template_key: templateKey,
      correlation_id: run.correlation_id,
    },
  })

  await admin.from('vala_builder_events').insert({
    run_id: run.id,
    event_type: 'run_queued',
    payload: {
      action,
      project_key: projectKey,
      priority,
      environment,
      correlation_id: run.correlation_id,
    },
  })

  await admin.functions.invoke('vala-builder-worker-v2', {
    body: {
      action: 'process_run',
      run_id: run.id,
    },
  }).catch(() => null)

  return { data: run }
}

async function triggerResume(admin: any, userId: string, payload: any) {
  const runId = String(payload?.run_id || '')
  if (!runId) return { error: 'run_id required' }

  const { data: run, error } = await admin
    .from('vala_builder_runs')
    .select('*')
    .eq('id', runId)
    .eq('requested_by', userId)
    .single()

  if (error || !run) return { error: error?.message || 'Run not found' }

  const { data: failed } = await admin
    .from('vala_builder_step_state')
    .select('step_key, status')
    .eq('run_id', run.id)
    .eq('status', 'fail')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const resumeFromStep = String(payload?.resume_from_step || failed?.step_key || run.current_step || '')
  if (!resumeFromStep) return { error: 'No failed step found to resume from' }

  const { data: updated, error: updateErr } = await admin
    .from('vala_builder_runs')
    .update({
      status: 'pending',
      error_message: null,
      completed_at: null,
      resume_from_step: resumeFromStep,
      updated_at: new Date().toISOString(),
      lock_token: null,
      locked_at: null,
    })
    .eq('id', run.id)
    .select('*')
    .single()

  if (updateErr || !updated) return { error: updateErr?.message || 'Failed to resume run' }

  await admin.from('vala_builder_step_logs').insert({
    run_id: run.id,
    step_key: 'system',
    step_order: 0,
    status: 'success',
    message: `Run resumed from step: ${resumeFromStep}`,
    details: { resume_from_step: resumeFromStep },
  })

  await admin.functions.invoke('vala-builder-worker-v2', {
    body: { action: 'process_run', run_id: updated.id },
  }).catch(() => null)

  return { data: updated }
}

async function cancelRun(admin: any, userId: string, runId: string) {
  const { data: run, error } = await admin
    .from('vala_builder_runs')
    .update({
      status: 'fail',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      error_message: 'Cancelled by user',
      updated_at: new Date().toISOString(),
      lock_token: null,
      locked_at: null,
    })
    .eq('id', runId)
    .eq('requested_by', userId)
    .in('status', ['pending', 'running'])
    .select('*')
    .single()

  if (error || !run) return { error: error?.message || 'Run not found or not cancellable' }

  await admin.from('vala_builder_step_logs').insert({
    run_id: run.id,
    step_key: 'system',
    step_order: 999,
    status: 'fail',
    message: 'Pipeline cancelled by user',
    details: { cancelled_by: userId },
  })

  return { data: run }
}

async function getHealth(admin: any) {
  const openai = Boolean(Deno.env.get('OPENAI_API_KEY'))
  const openrouter = Boolean(Deno.env.get('OPENROUTER_API_KEY'))

  const [{ count: pending }, { count: running }, { count: failed }] = await Promise.all([
    admin.from('vala_builder_runs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('vala_builder_runs').select('id', { count: 'exact', head: true }).eq('status', 'running'),
    admin.from('vala_builder_runs').select('id', { count: 'exact', head: true }).eq('status', 'fail'),
  ])

  return {
    ai: {
      openai,
      openrouter,
      healthy: openai || openrouter,
    },
    queue: {
      pending: Number(pending || 0),
      running: Number(running || 0),
      failed: Number(failed || 0),
    },
    worker: {
      max_concurrency: Number(Deno.env.get('VALA_BUILDER_MAX_CONCURRENCY') || '2'),
      global_lock: String(Deno.env.get('VALA_BUILDER_GLOBAL_LOCK') || '').toLowerCase() === 'true',
    },
    timestamp: new Date().toISOString(),
  }
}

async function listRuns(admin: any, userId: string, url: URL) {
  const status = String(url.searchParams.get('status') || '').trim()
  const project = String(url.searchParams.get('project_key') || '').trim()
  const env = String(url.searchParams.get('environment') || '').trim()
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20)))

  let query = admin.from('vala_builder_runs').select('*').eq('requested_by', userId)
  if (status) query = query.eq('status', status)
  if (project) query = query.eq('project_key', project)
  if (env) query = query.eq('environment', env)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) return { error: error.message }
  return { data: data || [] }
}

async function getRun(admin: any, userId: string, runId: string) {
  const { data, error } = await admin
    .from('vala_builder_runs')
    .select('*')
    .eq('id', runId)
    .eq('requested_by', userId)
    .single()
  if (error) return { error: error.message }
  return { data }
}

async function getRunLogs(admin: any, userId: string, runId: string, url: URL) {
  const step = String(url.searchParams.get('step') || '').trim()
  const status = String(url.searchParams.get('log_status') || '').trim()

  const { data: run } = await admin
    .from('vala_builder_runs')
    .select('id')
    .eq('id', runId)
    .eq('requested_by', userId)
    .maybeSingle()
  if (!run) return { error: 'Run not found' }

  let query = admin
    .from('vala_builder_step_logs')
    .select('*')
    .eq('run_id', runId)

  if (step) query = query.eq('step_key', step)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) return { error: error.message }
  return { data: data || [] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, 401)

    const authed = createAuthedClient(authHeader)
    const admin = createAdmin()

    const { data: authData, error: authError } = await authed.auth.getUser()
    if (authError || !authData?.user) return json({ success: false, error: 'Unauthorized' }, 401)

    const userId = authData.user.id
    const roleCheck = await requireRole(admin, userId)
    if (!roleCheck.allowed) return json({ success: false, error: 'Admin/developer access required' }, 403)

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const operation = String(body?.operation || '').trim()

      if (operation === 'start_run') {
        const result = await createRun(admin, userId, body)
        if (result.error) return json({ success: false, error: result.error }, 400)
        return json({ success: true, run: result.data })
      }

      if (operation === 'retry_run' || operation === 'resume_run') {
        const result = await triggerResume(admin, userId, body)
        if (result.error) return json({ success: false, error: result.error }, 400)
        return json({ success: true, run: result.data })
      }

      if (operation === 'cancel_run') {
        const runId = String(body?.run_id || '')
        if (!runId) return json({ success: false, error: 'run_id required' }, 400)
        const result = await cancelRun(admin, userId, runId)
        if (result.error) return json({ success: false, error: result.error }, 400)
        return json({ success: true, run: result.data })
      }

      if (operation === 'trigger_worker') {
        const limit = Math.max(1, Math.min(10, Number(body?.limit || 2)))
        const { data, error } = await admin.functions.invoke('vala-builder-worker-v2', {
          body: { action: 'process_queue', limit },
        })
        if (error) return json({ success: false, error: error.message }, 500)
        return json({ success: true, worker: data })
      }

      return json({ success: false, error: 'Unknown operation' }, 404)
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const operation = String(url.searchParams.get('operation') || '').trim()
      const runId = String(url.searchParams.get('run_id') || '').trim()
      const logs = url.searchParams.get('logs') === '1'

      if (operation === 'health') {
        const health = await getHealth(admin)
        return json({ success: true, health })
      }

      if (!runId) {
        const result = await listRuns(admin, userId, url)
        if (result.error) return json({ success: false, error: result.error }, 500)
        return json({ success: true, runs: result.data })
      }

      if (logs) {
        const result = await getRunLogs(admin, userId, runId, url)
        if (result.error) return json({ success: false, error: result.error }, 404)
        return json({ success: true, logs: result.data })
      }

      const result = await getRun(admin, userId, runId)
      if (result.error) return json({ success: false, error: result.error }, 404)
      return json({ success: true, run: result.data })
    }

    return json({ success: false, error: 'Not found' }, 404)
  } catch (error: any) {
    return json({ success: false, error: String(error?.message || error) }, 500)
  }
})
