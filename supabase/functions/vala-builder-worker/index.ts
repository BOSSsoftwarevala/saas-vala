import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const FULL_PIPELINE_STEPS = [
  'plan',
  'ui',
  'code',
  'db',
  'api',
  'debug',
  'fix',
  'build',
] as const

const ACTION_TO_STEPS: Record<string, string[]> = {
  create_app: [...FULL_PIPELINE_STEPS],
  clone_software: ['plan', 'ui', 'code', 'db', 'api'],
  generate_ui: ['ui'],
  generate_backend: ['db', 'api', 'code'],
  fix_errors: ['debug', 'fix'],
  build_project: ['build'],
  deploy_demo: [],
  publish_marketplace: [],
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

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function extractJsonFromText(text: string): any {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = safeJsonParse(trimmed)
    if (parsed) return parsed
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return safeJsonParse(trimmed.slice(start, end + 1))
  }
  return null
}

function estimateCostUSD(model: string, inTokens: number, outTokens: number): number {
  const pricing: Record<string, { inPer1M: number; outPer1M: number }> = {
    openai: { inPer1M: 0.15, outPer1M: 0.6 },
    gemini: { inPer1M: 0.1, outPer1M: 0.4 },
    claude: { inPer1M: 0.25, outPer1M: 1.0 },
  }
  const p = pricing[model] || pricing.openai
  return Number((((inTokens / 1_000_000) * p.inPer1M) + ((outTokens / 1_000_000) * p.outPer1M)).toFixed(6))
}

async function appendLog(
  admin: any,
  runId: string,
  stepKey: string,
  stepOrder: number,
  status: 'pending' | 'running' | 'success' | 'fail',
  message: string,
  details: Record<string, unknown> = {},
) {
  await admin.from('vala_builder_step_logs').insert({
    run_id: runId,
    step_key: stepKey,
    step_order: stepOrder,
    status,
    message,
    details,
    started_at: status === 'running' ? new Date().toISOString() : null,
    completed_at: status === 'success' || status === 'fail' ? new Date().toISOString() : null,
  })
}

async function saveArtifact(admin: any, runId: string, type: string, content: Record<string, unknown>) {
  await admin.from('vala_builder_artifacts').insert({
    run_id: runId,
    artifact_type: type,
    content,
  })
}

async function callPlannerWithFallback(run: any, admin: any): Promise<any> {
  const prompt = `You are a strict software planner. Return only JSON with keys: modules, roles, db_schema, api_routes.
App name: ${run.app_name}
App description: ${run.app_description}
Rules: no mock data, production APIs, include admin/user/reseller if needed.`

  const openAiKey = Deno.env.get('OPENAI_API_KEY') || ''
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY') || ''
  const order = ['openai', 'gemini', 'claude']

  for (const modelName of order) {
    try {
      if (modelName === 'openai' && openAiKey) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        })
        if (!res.ok) throw new Error(`OpenAI failed ${res.status}`)
        const payload = await res.json()
        const text = String(payload?.choices?.[0]?.message?.content || '{}')
        const parsed = extractJsonFromText(text)
        if (!parsed) throw new Error('OpenAI returned non-json plan')

        const usage = payload?.usage || {}
        const inTokens = Number(usage?.prompt_tokens || 0)
        const outTokens = Number(usage?.completion_tokens || 0)
        const cost = estimateCostUSD('openai', inTokens, outTokens)

        await admin.from('ai_usage').insert({
          user_id: run.requested_by,
          model: 'openai:gpt-4o-mini',
          endpoint: 'vala-builder/planner',
          tokens_input: inTokens,
          tokens_output: outTokens,
          cost,
          session_id: run.id,
        })

        return { provider: 'openai', payload: parsed, usage: { inTokens, outTokens, cost } }
      }

      if ((modelName === 'gemini' || modelName === 'claude') && openRouterKey) {
        const model = modelName === 'gemini' ? 'google/gemini-2.5-flash' : 'anthropic/claude-3.5-sonnet'
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          }),
        })
        if (!res.ok) throw new Error(`${modelName} failed ${res.status}`)
        const payload = await res.json()
        const text = String(payload?.choices?.[0]?.message?.content || '{}')
        const parsed = extractJsonFromText(text)
        if (!parsed) throw new Error(`${modelName} returned non-json plan`)

        const usage = payload?.usage || {}
        const inTokens = Number(usage?.prompt_tokens || 0)
        const outTokens = Number(usage?.completion_tokens || 0)
        const cost = estimateCostUSD(modelName, inTokens, outTokens)

        await admin.from('ai_usage').insert({
          user_id: run.requested_by,
          model,
          endpoint: 'vala-builder/planner',
          tokens_input: inTokens,
          tokens_output: outTokens,
          cost,
          session_id: run.id,
        })

        return { provider: modelName, payload: parsed, usage: { inTokens, outTokens, cost } }
      }
    } catch {
      continue
    }
  }

  throw new Error('All planner models failed (OpenAI/Gemini/Claude)')
}

async function invokeAiDeveloper(admin: any, body: any): Promise<any> {
  const { data, error } = await admin.functions.invoke('ai-developer', { body })
  if (error) throw new Error(error.message)
  return data
}

async function runDeploy(admin: any, run: any): Promise<{ demoUrl: string; details: any }> {
  if (run.selected_server_id) {
    const { data, error } = await admin.functions.invoke('server-agent', {
      body: {
        action: 'execute',
        serverId: run.selected_server_id,
        command: 'deploy',
        params: {
          app_slug: run.app_slug,
          app_name: run.app_name,
          source_ref: run.source_ref,
        },
      },
    })
    if (!error && data?.success) {
      const demoUrl = String(data?.data?.url || `https://${run.app_slug}.saasvala.com`)
      return { demoUrl, details: data }
    }
  }

  const { data, error } = await admin.functions.invoke('factory-deploy', {
    body: {
      action: 'deploy',
      repo_name: run.app_slug,
      github_account: 'saasvala',
    },
  })
  if (error) throw new Error(error.message)
  const demoUrl = String(data?.url || `https://${run.app_slug}.saasvala.com`)
  return { demoUrl, details: data }
}

async function runPublish(admin: any, run: any): Promise<{ productId: string; data: any }> {
  const productCode = `VB-${run.app_slug.toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-6)}`
  const upsertPayload = {
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

  const { data: existing } = await admin
    .from('products')
    .select('id')
    .eq('slug', run.app_slug)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await admin
      .from('products')
      .update(upsertPayload)
      .eq('id', existing.id)
      .select('id, slug, status')
      .single()
    if (error) throw new Error(error.message)
    return { productId: data.id, data }
  }

  const { data, error } = await admin
    .from('products')
    .insert(upsertPayload)
    .select('id, slug, status')
    .single()

  if (error) throw new Error(error.message)
  return { productId: data.id, data }
}

async function executeRun(admin: any, run: any) {
  const runId = run.id
  const steps = ACTION_TO_STEPS[String(run.action)] || []

  await admin.from('vala_builder_runs').update({
    status: 'running',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_message: null,
  }).eq('id', runId)

  let planPayload: any = null

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i]
    const stepOrder = i + 1

    await admin.from('vala_builder_runs').update({
      current_step: step,
      updated_at: new Date().toISOString(),
    }).eq('id', runId)

    await appendLog(admin, runId, step, stepOrder, 'running', `${step.toUpperCase()} started`)

    try {
      if (step === 'plan') {
        const plan = await callPlannerWithFallback(run, admin)
        planPayload = plan.payload
        await saveArtifact(admin, runId, 'plan', {
          provider: plan.provider,
          usage: plan.usage,
          ...plan.payload,
        })
        await appendLog(admin, runId, step, stepOrder, 'success', 'Planner completed', {
          provider: plan.provider,
          modules: Array.isArray(plan.payload?.modules) ? plan.payload.modules.length : 0,
          routes: Array.isArray(plan.payload?.api_routes) ? plan.payload.api_routes.length : 0,
        })
        continue
      }

      if (step === 'ui') {
        const data = await invokeAiDeveloper(admin, {
          messages: [{ role: 'user', content: `Generate production UI only for ${run.app_name}: ${run.app_description}. Follow existing design system. Include admin/user/reseller dashboards as needed.` }],
          tools: ['generate_code'],
          tool_input: {
            tool: 'generate_code',
            project_name: run.app_slug,
            description: run.app_description,
            features: JSON.stringify(planPayload?.modules || []),
            tech_stack: 'react',
          },
        })
        await saveArtifact(admin, runId, 'ui', { response: data })
        await appendLog(admin, runId, step, stepOrder, 'success', 'UI generation completed')
        continue
      }

      if (step === 'code') {
        const data = await invokeAiDeveloper(admin, {
          messages: [{ role: 'user', content: `Generate complete frontend + backend APIs for ${run.app_name}. No mock/fake data. Must wire UI to APIs.` }],
          tools: ['generate_code'],
          tool_input: {
            tool: 'generate_code',
            project_name: run.app_slug,
            description: run.app_description,
            features: JSON.stringify(planPayload || {}),
            tech_stack: 'react',
          },
        })

        const maybeRepo = String(data?.repo_url || data?.github_url || '')
        if (maybeRepo) {
          await admin.from('vala_builder_runs').update({ github_repo_url: maybeRepo }).eq('id', runId)
        }

        await saveArtifact(admin, runId, 'code', { response: data })
        await appendLog(admin, runId, step, stepOrder, 'success', 'Code generation completed', {
          github_repo_url: maybeRepo || null,
        })
        continue
      }

      if (step === 'db') {
        const modules = Array.isArray(planPayload?.modules) ? planPayload.modules : []
        const { data, error } = await admin.rpc('builder_generate_dynamic_schema', {
          p_app_slug: run.app_slug,
          p_modules: modules,
        })
        if (error) throw new Error(error.message)

        await saveArtifact(admin, runId, 'db_schema', { schema_result: data, modules })
        await appendLog(admin, runId, step, stepOrder, 'success', 'Database schema generated', {
          schema: data,
        })
        continue
      }

      if (step === 'api') {
        const routes = Array.isArray(planPayload?.api_routes) && planPayload.api_routes.length > 0
          ? planPayload.api_routes
          : [
              { method: 'GET', path: `/api/${run.app_slug}/items` },
              { method: 'POST', path: `/api/${run.app_slug}/items` },
              { method: 'PUT', path: `/api/${run.app_slug}/items/:id` },
              { method: 'DELETE', path: `/api/${run.app_slug}/items/:id` },
            ]

        const inserts = routes.map((r: any) => ({
          run_id: runId,
          app_slug: run.app_slug,
          route_path: String(r.path || r.route || '').trim() || `/api/${run.app_slug}`,
          method: String(r.method || 'GET').toUpperCase(),
          module_name: String(r.module || 'core'),
          is_protected: !String(r.path || '').includes('/public'),
        }))

        if (inserts.length > 0) {
          const { error } = await admin.from('vala_builder_generated_routes').upsert(inserts, { onConflict: 'run_id,route_path,method' })
          if (error) throw new Error(error.message)
        }

        await saveArtifact(admin, runId, 'api_schema', { routes })
        await appendLog(admin, runId, step, stepOrder, 'success', 'API routes generated', { total_routes: inserts.length })
        continue
      }

      if (step === 'debug') {
        const { data: codeArtifact } = await admin
          .from('vala_builder_artifacts')
          .select('content')
          .eq('run_id', runId)
          .eq('artifact_type', 'code')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const scanInput = JSON.stringify(codeArtifact?.content || {}).slice(0, 10000)
        const data = await invokeAiDeveloper(admin, {
          messages: [{ role: 'user', content: `Analyze for type/import/api issues in this generated code snapshot: ${scanInput}` }],
          tools: ['analyze_code'],
        })

        await saveArtifact(admin, runId, 'debug_report', { response: data })
        await appendLog(admin, runId, step, stepOrder, 'success', 'Debug scan completed')
        continue
      }

      if (step === 'fix') {
        const { data: debugArtifact } = await admin
          .from('vala_builder_artifacts')
          .select('content')
          .eq('run_id', runId)
          .eq('artifact_type', 'debug_report')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const issues = JSON.stringify(debugArtifact?.content || {}).slice(0, 10000)
        const fixData = await invokeAiDeveloper(admin, {
          messages: [{ role: 'user', content: `Fix all issues from this debug report: ${issues}` }],
          tools: ['fix_code'],
          tool_input: {
            tool: 'fix_code',
            code: issues,
            issues: ['missing imports', 'broken api calls', 'type errors'],
            language: 'typescript',
          },
        })

        const validateData = await invokeAiDeveloper(admin, {
          messages: [{ role: 'user', content: 'Revalidate after fix and return remaining errors count only.' }],
          tools: ['analyze_code'],
        })

        await saveArtifact(admin, runId, 'fix_report', { fix: fixData, revalidate: validateData })
        await appendLog(admin, runId, step, stepOrder, 'success', 'Auto-fix completed and revalidated')
        continue
      }

      if (step === 'build') {
        const { data: apkResult, error: apkError } = await admin.functions.invoke('auto-apk-pipeline', {
          body: {
            action: 'trigger_apk_build',
            data: {
              slug: run.app_slug,
              repo_url: run.github_repo_url,
            },
          },
        })
        if (apkError) throw new Error(apkError.message)

        const { data: buildQueue } = await admin
          .from('apk_build_queue')
          .select('id, build_status, slug')
          .eq('slug', run.app_slug)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        await admin.from('vala_builder_runs').update({
          apk_build_queue_id: buildQueue?.id || null,
          updated_at: new Date().toISOString(),
        }).eq('id', runId)

        await saveArtifact(admin, runId, 'build_report', {
          build: apkResult,
          queue: buildQueue,
        })

        await appendLog(admin, runId, step, stepOrder, 'success', 'Build queued/executed', {
          queue_id: buildQueue?.id || null,
          status: buildQueue?.build_status || apkResult?.build?.status || null,
        })
        continue
      }
    } catch (error: any) {
      const errorMessage = String(error?.message || error)
      await appendLog(admin, runId, step, stepOrder, 'fail', `${step.toUpperCase()} failed`, { error: errorMessage })
      await admin.from('vala_builder_runs').update({
        status: 'fail',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', runId)
      return { success: false, run_id: runId, failed_step: step, error: errorMessage }
    }
  }

  // Post-build execution for full pipeline and dedicated actions
  try {
    if (run.action === 'create_app' || run.action === 'deploy_demo') {
      await appendLog(admin, runId, 'deploy_demo', 90, 'running', 'Deploy demo started')
      const deploy = await runDeploy(admin, run)
      await admin.from('vala_builder_runs').update({
        demo_url: deploy.demoUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', runId)
      await saveArtifact(admin, runId, 'deploy_report', deploy.details || {})
      await appendLog(admin, runId, 'deploy_demo', 90, 'success', 'Deploy demo completed', {
        demo_url: deploy.demoUrl,
      })
    }

    const { data: refreshedRun } = await admin
      .from('vala_builder_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (run.action === 'create_app' || run.action === 'publish_marketplace') {
      await appendLog(admin, runId, 'publish_marketplace', 91, 'running', 'Marketplace draft creation started')
      const publish = await runPublish(admin, refreshedRun || run)
      await admin.from('vala_builder_runs').update({
        product_id: publish.productId,
        updated_at: new Date().toISOString(),
      }).eq('id', runId)
      await saveArtifact(admin, runId, 'marketplace_report', publish.data || {})
      await appendLog(admin, runId, 'publish_marketplace', 91, 'success', 'Marketplace draft created', {
        product_id: publish.productId,
      })
    }
  } catch (postError: any) {
    const errorMessage = String(postError?.message || postError)
    await appendLog(admin, runId, 'post_pipeline', 92, 'fail', 'Post pipeline action failed', { error: errorMessage })
    await admin.from('vala_builder_runs').update({
      status: 'fail',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', runId)
    return { success: false, run_id: runId, failed_step: 'post_pipeline', error: errorMessage }
  }

  await admin.from('vala_builder_runs').update({
    status: 'success',
    current_step: null,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', runId)

  await appendLog(admin, runId, 'done', 100, 'success', 'Pipeline completed successfully')
  return { success: true, run_id: runId }
}

async function processSingleRun(admin: any, runId: string) {
  const { data: run, error } = await admin
    .from('vala_builder_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (error || !run) throw new Error(error?.message || 'Run not found')
  if (!['pending', 'running'].includes(String(run.status))) {
    return { success: true, run_id: runId, skipped: true, reason: `status=${run.status}` }
  }

  return await executeRun(admin, run)
}

async function processQueue(admin: any, limit: number) {
  const { data, error } = await admin
    .from('vala_builder_runs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const runs = data || []
  const results: any[] = []
  for (const run of runs) {
    const result = await executeRun(admin, run)
    results.push(result)
  }

  return { scanned: runs.length, results }
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
      const result = await processSingleRun(admin, runId)
      return json(result)
    }

    const limit = Math.max(1, Math.min(10, Number(body?.limit || 2)))
    const result = await processQueue(admin, limit)
    return json({ success: true, ...result })
  } catch (error: any) {
    return json({ success: false, error: String(error?.message || error) }, 500)
  }
})
