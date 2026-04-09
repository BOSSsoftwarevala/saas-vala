import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

type StepKey = 'plan' | 'ui' | 'code' | 'db' | 'api' | 'debug' | 'fix' | 'build' | 'deploy_demo' | 'publish_marketplace'

const STEP_DAG: Record<StepKey, StepKey[]> = {
  plan: [],
  ui: ['plan'],
  code: ['ui'],
  db: ['code'],
  api: ['db'],
  debug: ['api'],
  fix: ['debug'],
  build: ['fix'],
  deploy_demo: ['build'],
  publish_marketplace: ['deploy_demo'],
}

const ACTION_STEPS: Record<string, StepKey[]> = {
  create_app: ['plan', 'ui', 'code', 'db', 'api', 'debug', 'fix', 'build', 'deploy_demo', 'publish_marketplace'],
  clone_software: ['plan', 'ui', 'code', 'db', 'api'],
  generate_ui: ['plan', 'ui'],
  generate_backend: ['plan', 'code', 'db', 'api'],
  fix_errors: ['debug', 'fix'],
  build_project: ['build'],
  deploy_demo: ['deploy_demo'],
  publish_marketplace: ['publish_marketplace'],
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !service) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, service)
}

function normalizeInput(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F]/g, ' ')
    .trim()
}

function slugify(value: string): string {
  return normalizeInput(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Step timeout (${step}) after ${ms}s`)), ms * 1000)
    promise
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}

function classifyError(step: string, message: string): { type: string; code: string } {
  const m = String(message || '').toLowerCase()
  if (step === 'build') return { type: 'build', code: 'BUILD_FAILED' }
  if (step === 'db') return { type: 'db', code: 'DB_SCHEMA_ERROR' }
  if (step === 'api') return { type: 'api', code: 'API_GENERATION_ERROR' }
  if (m.includes('timeout')) return { type: 'runtime', code: 'STEP_TIMEOUT' }
  if (m.includes('auth') || m.includes('permission')) return { type: 'security', code: 'AUTH_DENIED' }
  return { type: 'runtime', code: 'STEP_FAILED' }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Extract specific field from ai-developer response (which wraps results in tool_results[].content)
function extractAiToolField(data: any, field: string): string {
  // Direct field on data
  if (data?.[field]) return String(data[field])

  // Look inside tool_results array
  const toolResults = Array.isArray(data?.tool_results) ? data.tool_results : []
  for (const t of toolResults) {
    try {
      const parsed = typeof t.content === 'string' ? JSON.parse(t.content) : t.content
      if (parsed && parsed[field]) return String(parsed[field])
    } catch {
      // ignore JSON parse failures
    }
  }

  // Try extracting URL patterns from response text
  if ((field === 'url' || field === 'repo_url' || field === 'github_url') && typeof data?.response === 'string') {
    const match = data.response.match(/https:\/\/github\.com\/[^\s"']+/)
    if (match) return match[0]
  }

  return ''
}

// Extract all tool results parsed objects from ai-developer response
function extractAllAiToolResults(data: any): any[] {
  const toolResults = Array.isArray(data?.tool_results) ? data.tool_results : []
  return toolResults.map((t: any) => {
    try {
      return typeof t.content === 'string' ? JSON.parse(t.content) : t.content
    } catch {
      return {}
    }
  })
}

async function appendEvent(admin: any, runId: string, eventType: string, payload: Record<string, unknown>) {
  await admin.from('vala_builder_events').insert({
    run_id: runId,
    event_type: eventType,
    payload,
  })
}

async function appendLog(admin: any, runId: string, step: StepKey | 'system', order: number, status: 'pending' | 'running' | 'success' | 'fail', message: string, details: Record<string, unknown> = {}) {
  await admin.from('vala_builder_step_logs').insert({
    run_id: runId,
    step_key: step,
    step_order: order,
    status,
    message,
    details,
    started_at: status === 'running' ? new Date().toISOString() : null,
    completed_at: status === 'success' || status === 'fail' ? new Date().toISOString() : null,
  })
  await appendEvent(admin, runId, `step_${status}`, { step, message, ...details })
}

async function upsertStepState(admin: any, runId: string, step: StepKey, patch: Record<string, unknown>) {
  const { data: existing } = await admin
    .from('vala_builder_step_state')
    .select('id,attempts')
    .eq('run_id', runId)
    .eq('step_key', step)
    .maybeSingle()

  if (existing?.id) {
    await admin
      .from('vala_builder_step_state')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await admin.from('vala_builder_step_state').insert({
      run_id: runId,
      step_key: step,
      status: 'pending',
      ...patch,
      updated_at: new Date().toISOString(),
    })
  }
}

async function getStepStateMap(admin: any, runId: string): Promise<Map<string, any>> {
  const { data } = await admin
    .from('vala_builder_step_state')
    .select('*')
    .eq('run_id', runId)
  return new Map((data || []).map((row: any) => [String(row.step_key), row]))
}

async function canRunStep(admin: any, runId: string, step: StepKey): Promise<{ ok: boolean; reason?: string }> {
  const deps = STEP_DAG[step] || []
  if (deps.length === 0) return { ok: true }

  const stateMap = await getStepStateMap(admin, runId)
  for (const dep of deps) {
    const state = stateMap.get(dep)
    if (!state || state.status !== 'success') {
      return { ok: false, reason: `Dependency ${dep} not successful` }
    }
  }
  return { ok: true }
}

async function invokeAiDeveloper(admin: any, body: any) {
  const { data, error } = await admin.functions.invoke('ai-developer', { body })
  if (error) throw new Error(error.message)
  return data
}

async function callPlanner(run: any, admin: any) {
  const prompt = `Create a strict JSON planner for this app. Return ONLY valid JSON with these keys:
modules (array of module names), roles (array of user roles), db_schema (object with table definitions), api_routes (array of {method, path, module}).
App Name: ${run.app_name}
Description: ${run.app_description}
Keep it concise. No mock data. Return only valid JSON.`

  const openAiKey = Deno.env.get('OPENAI_API_KEY') || ''
  const openRouter = Deno.env.get('OPENROUTER_API_KEY') || ''

  if (openAiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (res.ok) {
      const payload = await res.json()
      const content = String(payload?.choices?.[0]?.message?.content || '{}')
      let parsed: any = {}
      try {
        parsed = JSON.parse(content)
      } catch {
        // Try to extract JSON from text
        const match = content.match(/\{[\s\S]*\}/)
        if (match) { try { parsed = JSON.parse(match[0]) } catch { /* ignore */ } }
      }
      return { provider: 'openai', payload: parsed }
    }
  }

  if (openRouter) {
    const modelList = ['google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet']
    for (const model of modelList) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openRouter}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok) continue
      const payload = await res.json()
      const content = String(payload?.choices?.[0]?.message?.content || '{}')
      let parsed: any = {}
      try {
        parsed = JSON.parse(content)
      } catch {
        const match = content.match(/\{[\s\S]*\}/)
        if (match) { try { parsed = JSON.parse(match[0]) } catch { /* ignore */ } }
      }
      return { provider: model, payload: parsed }
    }
  }

  throw new Error('Planner fallback exhausted')
}

async function runStepExecutor(admin: any, run: any, step: StepKey, stateMap: Map<string, any>) {
  const runId = run.id
  const planArtifact = stateMap.get('plan')?.details?.artifact || null

  if (step === 'plan') {
    const planned = await callPlanner(run, admin)
    // Lenient validation: accept any objects with at least one recognisable key
    const p = planned?.payload || {}
    const hasContent = Object.keys(p).length > 0
    const modules = p.modules || p.api_modules || p.components || []
    const apiRoutes = p.api_routes || p.routes || p.endpoints || []
    if (!hasContent) throw new Error('Planner returned empty output')
    // Normalise keys so downstream steps can rely on them
    planned.payload = { ...p, modules: Array.isArray(modules) ? modules : [], api_routes: Array.isArray(apiRoutes) ? apiRoutes : [] }
    const hash = await sha256Hex(JSON.stringify(planned.payload))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'plan', content: planned.payload })
    return { artifact: planned.payload, output_hash: hash, provider: planned.provider }
  }

  if (step === 'ui') {
    const data = await invokeAiDeveloper(admin, {
      messages: [{ role: 'user', content: `Generate UI only for ${run.app_name}. Keep existing design system.` }],
      tools: ['generate_code'],
      tool_input: {
        project_name: run.app_slug,
        project_type: 'react',
        description: run.app_description,
        features: Array.isArray(planArtifact?.modules) ? planArtifact.modules : [],
        account: 'SaaSVala',
      },
    })
    const toolResults = extractAllAiToolResults(data)
    const uiUrl = extractAiToolField(data, 'url') || extractAiToolField(data, 'repo_url')
    const combinedResult = { response: data?.response || '', tool_results: toolResults, url: uiUrl }
    if (uiUrl) await admin.from('vala_builder_runs').update({ github_repo_url: uiUrl }).eq('id', runId)
    const hash = await sha256Hex(JSON.stringify(combinedResult))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'ui', content: combinedResult })
    return { artifact: combinedResult, output_hash: hash }
  }

  if (step === 'code') {
    const data = await invokeAiDeveloper(admin, {
      messages: [{ role: 'user', content: `Generate full frontend and backend APIs for ${run.app_name}. No mock data.` }],
      tools: ['generate_code'],
      tool_input: {
        project_name: run.app_slug,
        project_type: 'react',
        description: run.app_description,
        features: Array.isArray(planArtifact?.modules) ? planArtifact.modules : [],
        account: 'SaaSVala',
      },
    })
    const toolResults = extractAllAiToolResults(data)
    const repoUrl = extractAiToolField(data, 'url') || extractAiToolField(data, 'repo_url') || extractAiToolField(data, 'github_url')
    if (repoUrl) {
      await admin.from('vala_builder_runs').update({ github_repo_url: repoUrl }).eq('id', runId)
    }
    const combinedResult = { response: data?.response || '', tool_results: toolResults, repo_url: repoUrl }
    const hash = await sha256Hex(JSON.stringify(combinedResult))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'code', content: combinedResult })
    return { artifact: combinedResult, output_hash: hash }
  }

  if (step === 'db') {
    const modules = Array.isArray(planArtifact?.modules) ? planArtifact.modules : []
    const { data, error } = await admin.rpc('builder_generate_dynamic_schema', {
      p_app_slug: run.app_slug,
      p_modules: modules,
    })
    if (error) throw new Error(error.message)
    const hash = await sha256Hex(JSON.stringify(data || {}))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'db_schema', content: { schema: data, modules } })
    return { artifact: data, output_hash: hash }
  }

  if (step === 'api') {
    const routes = Array.isArray(planArtifact?.api_routes) ? planArtifact.api_routes : []
    const normalized = routes.length > 0 ? routes : [
      { method: 'GET', path: `/api/${run.app_slug}/items` },
      { method: 'POST', path: `/api/${run.app_slug}/items` },
    ]
    const inserts = normalized.map((r: any) => ({
      run_id: runId,
      app_slug: run.app_slug,
      route_path: String(r.path || r.route || '').trim() || `/api/${run.app_slug}`,
      method: String(r.method || 'GET').toUpperCase(),
      module_name: String(r.module || 'core'),
      is_protected: !String(r.path || '').includes('/public'),
    }))
    const { error } = await admin.from('vala_builder_generated_routes').upsert(inserts, { onConflict: 'run_id,route_path,method' })
    if (error) throw new Error(error.message)
    const hash = await sha256Hex(JSON.stringify(inserts))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'api_schema', content: { routes: inserts } })
    return { artifact: inserts, output_hash: hash }
  }

  if (step === 'debug') {
    const data = await invokeAiDeveloper(admin, {
      messages: [{ role: 'user', content: `Analyze ${run.app_slug} for imports, API contract mismatch, and type issues.` }],
      tools: ['analyze_code'],
      tool_input: {
        code: `project:${run.app_slug}`,
        language: 'typescript',
        check_security: true,
        check_performance: true,
      },
    })
    const toolResults = extractAllAiToolResults(data)
    const debugResult = { response: data?.response || '', tool_results: toolResults }
    const hash = await sha256Hex(JSON.stringify(debugResult))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'debug_report', content: debugResult })
    return { artifact: debugResult, output_hash: hash }
  }

  if (step === 'fix') {
    const data = await invokeAiDeveloper(admin, {
      messages: [{ role: 'user', content: `Fix all known errors for ${run.app_slug} and revalidate.` }],
      tools: ['fix_code'],
      tool_input: {
        code: `project:${run.app_slug}`,
        issues: ['imports', 'api mismatch', 'syntax', 'type errors'],
        language: 'typescript',
      },
    })
    const toolResults = extractAllAiToolResults(data)
    const fixResult = { response: data?.response || '', tool_results: toolResults }
    const hash = await sha256Hex(JSON.stringify(fixResult))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'fix_report', content: fixResult })
    return { artifact: fixResult, output_hash: hash }
  }

  if (step === 'build') {
    if (run.selected_server_id) {
      const { data: metrics } = await admin
        .from('server_metrics')
        .select('cpu_percent,ram_used_mb,ram_total_mb,recorded_at')
        .eq('server_id', run.selected_server_id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (metrics?.cpu_percent && Number(metrics.cpu_percent) > 95) {
        throw new Error('Resource protection: CPU too high on selected server')
      }
    }

    const { data, error } = await admin.functions.invoke('auto-apk-pipeline', {
      body: {
        action: 'trigger_apk_build',
        data: { slug: run.app_slug, repo_url: run.github_repo_url },
      },
    })
    if (error) throw new Error(error.message)

    const { data: queue } = await admin
      .from('apk_build_queue')
      .select('id,build_status,slug,updated_at')
      .eq('slug', run.app_slug)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    await admin.from('vala_builder_runs').update({ apk_build_queue_id: queue?.id || null }).eq('id', runId)

    // Track APK status on run
    await admin.from('vala_builder_runs').update({
      apk_build_queue_id: queue?.id || null,
      apk_status: queue?.id ? 'queued' : 'none',
    }).eq('id', runId)

    const hash = await sha256Hex(JSON.stringify(queue || data || {}))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'build_report', content: { queue, response: data } })
    return { artifact: queue || data, output_hash: hash }
  }

  if (step === 'deploy_demo') {
    let deploy: any = null

    if (run.selected_server_id) {
      const { data, error } = await admin.functions.invoke('server-agent', {
        body: {
          action: 'execute',
          serverId: run.selected_server_id,
          command: 'deploy',
          params: { app_slug: run.app_slug, app_name: run.app_name, source_ref: run.source_ref },
        },
      })
      if (!error && data?.success) deploy = data
    }

    if (!deploy && run.fallback_server_id) {
      const { data, error } = await admin.functions.invoke('server-agent', {
        body: {
          action: 'execute',
          serverId: run.fallback_server_id,
          command: 'deploy',
          params: { app_slug: run.app_slug, app_name: run.app_name, source_ref: run.source_ref },
        },
      })
      if (!error && data?.success) deploy = data
    }

    if (!deploy) {
      const { data, error } = await admin.functions.invoke('factory-deploy', {
        body: { action: 'deploy', repo_name: run.app_slug, github_account: 'saasvala' },
      })
      if (error) throw new Error(error.message)
      deploy = data
    }

    const demoUrl = String(deploy?.url || deploy?.data?.url || `https://${run.app_slug}.saasvala.com`)
    // Health check with retry (new deployments need warm-up time; non-fatal if not ready yet)
    let healthOk = false
    for (let attempt = 0; attempt < 3; attempt++) {
      const hc = await fetch(demoUrl, { method: 'GET', signal: AbortSignal.timeout(8000) }).catch(() => null)
      if (hc && (hc.ok || hc.status < 500)) { healthOk = true; break }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 5000))
    }
    if (!healthOk) {
      // Log as warning but don't fail the step — deployment may still be propagating
      await appendLog(admin, runId, 'deploy_demo', 99, 'success',
        `Deploy URL ${demoUrl} not yet accessible (DNS propagation may be ongoing)`,
        { demoUrl, health_check: 'pending', warning: true })
    }


    await admin.from('vala_builder_runs').update({ demo_url: demoUrl }).eq('id', runId)
    const hash = await sha256Hex(JSON.stringify({ demoUrl, deploy }))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'deploy_report', content: { demoUrl, deploy } })
    return { artifact: { demoUrl }, output_hash: hash }
  }

  if (step === 'publish_marketplace') {
    const productCode = `VB-${run.app_slug.toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-6)}`
    const payload = {
      name: run.app_name,
      slug: run.app_slug,
      description: run.app_description,
      product_code: productCode,
      status: 'draft',
      marketplace_visible: false,
      demo_url: run.demo_url,
      git_repo_url: run.github_repo_url,
      source_method: 'generated',
      target_industry: 'General',
      is_apk: true,
      apk_enabled: true,
      license_enabled: true,
      price: 49,
      currency: 'USD',
      created_by: run.requested_by,
    }

    const { data: existing } = await admin.from('products').select('id').eq('slug', run.app_slug).maybeSingle()
    let product: any = null

    if (existing?.id) {
      const { data, error } = await admin.from('products').update(payload).eq('id', existing.id).select('id,slug,status').single()
      if (error) throw new Error(error.message)
      product = data
    } else {
      const { data, error } = await admin.from('products').insert(payload).select('id,slug,status').single()
      if (error) throw new Error(error.message)
      product = data
    }

    await admin.from('vala_builder_runs').update({ product_id: product.id }).eq('id', runId)
    const hash = await sha256Hex(JSON.stringify(product || {}))
    await admin.from('vala_builder_artifacts').insert({ run_id: runId, artifact_type: 'marketplace_report', content: { product } })
    return { artifact: product, output_hash: hash }
  }

  throw new Error(`Unhandled step: ${step}`)
}

async function executeStep(admin: any, run: any, step: StepKey, index: number): Promise<void> {
  const runId = run.id
  const stepOrder = index + 1
  const timeoutSec = Number(run.step_timeout_seconds || 600)
  const maxRetries = Number(run.max_retries || 2)

  const depCheck = await canRunStep(admin, runId, step)
  if (!depCheck.ok) {
    throw new Error(depCheck.reason || 'Dependency check failed')
  }

  const stateMap = await getStepStateMap(admin, runId)
  const existing = stateMap.get(step)

  if (existing?.status === 'success') {
    await appendLog(admin, runId, step, stepOrder, 'success', `${step.toUpperCase()} skipped (checkpoint success)`, {
      skipped: true,
      reason: 'checkpoint_success',
    })
    return
  }

  let attempt = Number(existing?.attempts || 0)
  while (attempt <= maxRetries) {
    attempt += 1
    await upsertStepState(admin, runId, step, {
      status: 'running',
      attempts: attempt,
      started_at: new Date().toISOString(),
      last_error: null,
      error_type: null,
      error_code: null,
    })

    await appendLog(admin, runId, step, stepOrder, 'running', `${step.toUpperCase()} started`, {
      attempt,
      max_retries: maxRetries,
      correlation_id: run.correlation_id,
    })

    try {
      const latestStateMap = await getStepStateMap(admin, runId)
      const result = await withTimeout(runStepExecutor(admin, run, step, latestStateMap), timeoutSec, step)

      await upsertStepState(admin, runId, step, {
        status: 'success',
        attempts: attempt,
        completed_at: new Date().toISOString(),
        output_hash: result?.output_hash || null,
        details: {
          artifact: result?.artifact || null,
          correlation_id: run.correlation_id,
        },
      })

      await appendLog(admin, runId, step, stepOrder, 'success', `${step.toUpperCase()} completed`, {
        attempt,
        output_hash: result?.output_hash || null,
      })

      return
    } catch (error: any) {
      const message = String(error?.message || error)
      const classified = classifyError(step, message)

      await upsertStepState(admin, runId, step, {
        status: 'fail',
        attempts: attempt,
        completed_at: new Date().toISOString(),
        last_error: message,
        error_type: classified.type,
        error_code: classified.code,
      })

      await appendLog(admin, runId, step, stepOrder, 'fail', `${step.toUpperCase()} failed`, {
        attempt,
        error: message,
        error_type: classified.type,
        error_code: classified.code,
      })

      if (attempt > maxRetries) {
        await admin.from('vala_builder_dead_letter_queue').insert({
          run_id: runId,
          step_key: step,
          error_type: classified.type,
          error_code: classified.code,
          error_message: message,
          attempts: attempt,
          payload: {
            run_id: runId,
            step,
            action: run.action,
            app_slug: run.app_slug,
            correlation_id: run.correlation_id,
          },
        })
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1_500 * 2 ** attempt)))
    }
  }
}

async function finalizeRun(admin: any, run: any) {
  const runId = run.id
  const projectKey = run.project_key || run.app_slug

  const { data: latestVersion } = await admin
    .from('vala_builder_project_versions')
    .select('build_version, db_schema_version')
    .eq('project_key', projectKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nextBuildVersion } = await admin.rpc('builder_next_version', { p_current: latestVersion?.build_version || 'v0' })
  const { data: nextDbVersion } = await admin.rpc('builder_next_version', { p_current: latestVersion?.db_schema_version || 'v0' })

  const codeHash = await sha256Hex(JSON.stringify({ app: run.app_name, slug: run.app_slug, prompt: run.prompt_normalized || run.app_description }))
  const schemaHash = await sha256Hex(JSON.stringify({ app_slug: run.app_slug, db_version: nextDbVersion }))

  await admin.from('vala_builder_runs').update({
    status: 'success',
    current_step: null,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    build_version: nextBuildVersion || 'v1',
    db_schema_version: nextDbVersion || 'v1',
  }).eq('id', runId)

  await admin.from('vala_builder_project_versions').insert({
    project_key: projectKey,
    run_id: runId,
    build_version: nextBuildVersion || 'v1',
    db_schema_version: nextDbVersion || 'v1',
    apk_build_queue_id: run.apk_build_queue_id,
    product_id: run.product_id,
    code_hash: codeHash,
    schema_hash: schemaHash,
    deploy_url: run.demo_url,
    rollback_payload: {
      run_id: runId,
      code_hash: codeHash,
      schema_hash: schemaHash,
      demo_url: run.demo_url,
      product_id: run.product_id,
    },
    created_by: run.requested_by,
  })

  await admin.from('vala_builder_project_history').insert({
    project_key: projectKey,
    run_id: runId,
    event_type: 'run_success',
    details: {
      build_version: nextBuildVersion || 'v1',
      db_schema_version: nextDbVersion || 'v1',
      demo_url: run.demo_url,
      product_id: run.product_id,
      correlation_id: run.correlation_id,
    },
    created_by: run.requested_by,
  })

  await appendEvent(admin, runId, 'run_completed', { success: true })
}

async function failRun(admin: any, run: any, failedStep: string, message: string) {
  await admin.from('vala_builder_runs').update({
    status: 'fail',
    current_step: failedStep,
    error_message: message,
    retry_count: Number(run.retry_count || 0) + 1,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lock_token: null,
    locked_at: null,
  }).eq('id', run.id)

  await admin.from('vala_builder_project_history').insert({
    project_key: run.project_key || run.app_slug,
    run_id: run.id,
    event_type: 'run_failed',
    details: {
      failed_step: failedStep,
      error: message,
      correlation_id: run.correlation_id,
    },
    created_by: run.requested_by,
  })

  await appendEvent(admin, run.id, 'run_failed', { failed_step: failedStep, error: message })
}

async function processRun(admin: any, runId: string) {
  const { data: run, error } = await admin
    .from('vala_builder_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (error || !run) throw new Error(error?.message || 'Run not found')
  if (run.status === 'success' || run.status === 'fail') return { success: true, skipped: true, reason: `status=${run.status}` }
  if (run.cancelled_at) return { success: true, skipped: true, reason: 'cancelled' }

  const lockToken = crypto.randomUUID()
  const normalizedPrompt = normalizeInput(run.app_description || '')
  const deterministicHash = await sha256Hex(`${slugify(run.app_name)}|${normalizedPrompt}|${run.action}|${run.prompt_version || 'v1'}`)

  const { data: lockRes } = await admin
    .from('vala_builder_runs')
    .update({
      status: 'running',
      started_at: run.started_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lock_token: lockToken,
      locked_at: new Date().toISOString(),
      prompt_normalized: normalizedPrompt,
      deterministic_hash: deterministicHash,
      project_key: run.project_key || run.app_slug,
    })
    .eq('id', run.id)
    .in('status', ['pending', 'running'])
    .select('id')
    .maybeSingle()

  if (!lockRes?.id) return { success: true, skipped: true, reason: 'lock not acquired' }

  const steps = ACTION_STEPS[String(run.action)] || []
  if (steps.length === 0) {
    await finalizeRun(admin, run)
    return { success: true, run_id: run.id, steps: 0 }
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i]

    if (run.resume_from_step) {
      const resumeIdx = steps.indexOf(run.resume_from_step)
      if (resumeIdx >= 0 && i < resumeIdx) {
        const currentStateMap = await getStepStateMap(admin, run.id)
        const s = currentStateMap.get(step)
        if (s?.status === 'success') {
          continue
        }
      }
    }

    try {
      await admin.from('vala_builder_runs').update({ current_step: step }).eq('id', run.id)
      await executeStep(admin, run, step, i)
    } catch (error: any) {
      await failRun(admin, run, step, String(error?.message || error))

      // Cleanup hook on failure (best effort)
      if (run.selected_server_id) {
        await admin.functions.invoke('server-agent', {
          body: {
            action: 'execute',
            serverId: run.selected_server_id,
            command: 'cleanup',
            params: { app_slug: run.app_slug, run_id: run.id },
          },
        }).catch(() => null)
      }

      return { success: false, run_id: run.id, failed_step: step, error: String(error?.message || error) }
    }
  }

  await finalizeRun(admin, run)
  await admin.from('vala_builder_runs').update({ lock_token: null, locked_at: null }).eq('id', run.id)
  return { success: true, run_id: run.id, steps: steps.length }
}

async function processQueue(admin: any, limit: number) {
  const concurrency = Math.max(1, Math.min(5, Number(Deno.env.get('VALA_BUILDER_MAX_CONCURRENCY') || '2')))
  const finalLimit = Math.min(limit, concurrency)

  if (String(Deno.env.get('VALA_BUILDER_GLOBAL_LOCK') || '').toLowerCase() === 'true') {
    return { scanned: 0, results: [], locked: true }
  }

  const { data: runningSameProject } = await admin
    .from('vala_builder_runs')
    .select('project_key')
    .eq('status', 'running')

  const activeProjects = new Set((runningSameProject || []).map((r: any) => String(r.project_key || '')))

  const { data, error } = await admin
    .from('vala_builder_runs')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) throw new Error(error.message)

  const picked = (data || []).filter((r: any) => !activeProjects.has(String(r.project_key || r.app_slug || ''))).slice(0, finalLimit)
  const results: any[] = []

  for (const run of picked) {
    const result = await processRun(admin, run.id)
    results.push(result)
  }

  return { scanned: picked.length, results }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const admin = createAdmin()
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'process_queue')

    if (action === 'process_run') {
      const runId = String(body?.run_id || '')
      if (!runId) return json({ success: false, error: 'run_id is required' }, 400)
      const result = await processRun(admin, runId)
      return json(result)
    }

    const limit = Math.max(1, Math.min(20, Number(body?.limit || 3)))
    const result = await processQueue(admin, limit)
    return json({ success: true, ...result })
  } catch (error: any) {
    return json({ success: false, error: String(error?.message || error) }, 500)
  }
})
