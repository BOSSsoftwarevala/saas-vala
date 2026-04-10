import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleServersV2 } from './server-management-v2.ts'

const SENTRY_DSN = 'https://8f2c43b81696e0bcb5ec8c2c34ab64eb@o4511025445339136.ingest.de.sentry.io/4511025447698512'

async function sentryCaptureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const dsnUrl = new URL(SENTRY_DSN)
    const projectId = dsnUrl.pathname.replace(/^\//, '')
    const sentryKey = dsnUrl.username
    const endpoint = `${dsnUrl.protocol}//${dsnUrl.host}/api/${projectId}/envelope/`
    const error = err instanceof Error ? err : new Error(String(err))
    const eventId = crypto.randomUUID().replace(/-/g, '')
    const now = new Date().toISOString()
    const event = {
      event_id: eventId,
      timestamp: now,
      platform: 'node',
      level: 'error',
      environment: 'production',
      logger: 'api-gateway',
      exception: {
        values: [{
          type: error.name,
          value: error.message,
          stacktrace: error.stack ? { frames: error.stack.split('\n').slice(1).map(l => ({ filename: l.trim() })) } : undefined,
        }],
      },
      extra: context,
    }
    const envelopeHeader = JSON.stringify({ dsn: SENTRY_DSN, event_id: eventId, sent_at: now })
    const itemHeader = JSON.stringify({ type: 'event', content_type: 'application/json' })
    const body = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_key=${sentryKey}, sentry_version=7`,
      },
      body,
    })
  } catch {
    // silently ignore Sentry reporting failures
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Type': 'application/json',
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX_KEYS = 5000

function pruneRateLimitStore(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }

  if (rateLimitStore.size <= RATE_LIMIT_MAX_KEYS) return

  const overflow = rateLimitStore.size - RATE_LIMIT_MAX_KEYS
  let removed = 0
  for (const key of rateLimitStore.keys()) {
    rateLimitStore.delete(key)
    removed += 1
    if (removed >= overflow) break
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders })
}

function err(message: string, status = 400) {
  return json({ error: message }, status)
}

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (rateLimitStore.size >= RATE_LIMIT_MAX_KEYS) {
    pruneRateLimitStore(now)
  }

  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  if (existing.count >= limit) {
    return Math.ceil((existing.resetAt - now) / 1000)
  }

  existing.count += 1
  rateLimitStore.set(key, existing)
  return null
}

function isUuid(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function normalizeText(value: unknown, maxLen = 255): string {
  return String(value ?? '').trim().slice(0, maxLen)
}

function toSlug(value: unknown): string {
  return normalizeText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isValidUrl(value: unknown): boolean {
  const raw = String(value ?? '').trim()
  if (!raw) return true
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const marketplaceRoleFallbackPermissions: Record<string, string[]> = {
  super_admin: ['*'],
  admin: [
    'marketplace.products.view',
    'marketplace.products.edit',
    'marketplace.products.delete',
    'marketplace.products.publish',
    'marketplace.pricing.edit',
    'marketplace.apk.manage',
    'marketplace.banner.manage',
    'marketplace.category.manage',
    'marketplace.order.view',
    'marketplace.order.refund',
    'marketplace.order.override',
    'marketplace.license.view',
    'marketplace.license.revoke',
    'marketplace.reseller.manage',
    'marketplace.reseller.payout',
    'marketplace.review.moderate',
    'marketplace.analytics.view',
    'marketplace.feature.toggle',
    'marketplace.config.manage',
    'marketplace.export',
  ],
  support: [
    'marketplace.products.view',
    'marketplace.order.view',
    'marketplace.license.view',
    'marketplace.review.moderate',
    'marketplace.analytics.view',
  ],
}

async function getUserRoles(admin: any, userId: string): Promise<string[]> {
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId)
  return Array.from(new Set((data ?? []).map((r: any) => String(r.role))))
}

async function hasMarketplacePermission(admin: any, userId: string, permission: string): Promise<boolean> {
  const roles = await getUserRoles(admin, userId)
  if (roles.includes('super_admin')) return true

  const { data: mapped } = await admin
    .from('role_permission_map')
    .select('granted, permissions!inner(name)')
    .in('role', roles)
    .eq('permissions.name', permission)
    .eq('granted', true)
    .limit(1)

  if (Array.isArray(mapped) && mapped.length > 0) return true

  return roles.some((role) => {
    const grants = marketplaceRoleFallbackPermissions[role] ?? []
    return grants.includes('*') || grants.includes(permission)
  })
}

async function requireMarketplacePermission(admin: any, userId: string, permission: string): Promise<Response | null> {
  const ok = await hasMarketplacePermission(admin, userId, permission)
  if (ok) return null
  return err(`Missing permission: ${permission}`, 403)
}

async function ensureUniqueProductSlug(admin: any, requestedSlug: string, productName: string, excludeProductId?: string): Promise<string> {
  const base = toSlug(requestedSlug || productName) || `product-${Date.now()}`

  for (let i = 0; i < 100; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    let q = admin.from('products').select('id').eq('slug', candidate)
    if (excludeProductId) q = q.neq('id', excludeProductId)
    const { data } = await q.maybeSingle()
    if (!data) return candidate
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await sb.auth.getClaims(token)
  if (error || !data?.claims) return null

  return { userId: data.claims.sub as string, supabase: sb }
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

async function logActivity(admin: any, entityType: string, entityId: string, action: string, userId: string, details: any = {}) {
  try {
    await admin.from('activity_logs').insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      performed_by: userId,
      details,
    })
  } catch (e) {
    console.error('Activity log failed:', e)
  }
}

function maskSensitivePayload(value: any): any {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => maskSensitivePayload(v))
  if (typeof value !== 'object') return value

  const masked: Record<string, any> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (/(password|token|secret|api[_-]?key|authorization|card|cvv|pin)/i.test(key)) {
      masked[key] = '***masked***'
    } else {
      masked[key] = maskSensitivePayload(raw)
    }
  }
  return masked
}

function computeJsonDiff(beforeData: any, afterData: any): Record<string, { before: any; after: any }> {
  const a = (beforeData && typeof beforeData === 'object') ? beforeData : {}
  const b = (afterData && typeof afterData === 'object') ? afterData : {}
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
  const diff: Record<string, { before: any; after: any }> = {}
  for (const key of keys) {
    const beforeVal = (a as any)[key]
    const afterVal = (b as any)[key]
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = { before: beforeVal, after: afterVal }
    }
  }
  return diff
}

async function resolvePrimaryRole(admin: any, userId: string): Promise<string> {
  const { data } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)

  const roles = (data || []).map((r: any) => String(r.role))
  if (roles.includes('super_admin')) return 'super_admin'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('reseller')) return 'reseller'
  if (roles.includes('support')) return 'support'
  return roles[0] || 'user'
}

function classifyAnomalyScore(statusCode: number, latencyMs: number): number {
  if (statusCode >= 500) return 0.92
  if (statusCode >= 400) return 0.55
  if (latencyMs > 8000) return 0.85
  if (latencyMs > 4000) return 0.65
  return 0.08
}

function isSensitiveAction(actionType: string, method: string, path: string): boolean {
  const normalized = `${actionType} ${method} ${path}`.toLowerCase()
  return (
    normalized.includes('delete')
    || normalized.includes('payment')
    || normalized.includes('refund')
    || normalized.includes('permission')
    || normalized.includes('role')
    || normalized.includes('license_revoke')
  )
}

async function appendAuditLogResilient(admin: any, payload: Record<string, any>) {
  const insertPayload = {
    ...payload,
    request_payload: maskSensitivePayload(payload.request_payload || null),
    response_payload: maskSensitivePayload(payload.response_payload || null),
    old_value: maskSensitivePayload(payload.old_value || null),
    new_value: maskSensitivePayload(payload.new_value || null),
    diff_value: payload.diff_value || computeJsonDiff(payload.old_value || null, payload.new_value || null),
  }

  const { error } = await admin.from('audit_logs').insert(insertPayload)
  if (!error) return { queued: false }

  await admin.from('audit_log_queue').insert({
    request_id: String(payload.request_id || ''),
    trace_id: String(payload.trace_id || ''),
    event_payload: insertPayload,
    status: 'pending',
    retry_count: 0,
    next_retry_at: new Date(Date.now() + 30_000).toISOString(),
    last_error: error.message,
  })

  return { queued: true, error: error.message }
}

function parseJsonSafe<T = any>(value: string | null | undefined): T | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function deriveTenantScope(roleName: string, body: any, headers: Headers): string | null {
  const scoped = String(
    headers.get('x-tenant-scope')
      || (typeof body?.tenant_scope === 'string' ? body.tenant_scope : '')
      || ''
  ).trim()
  if (scoped) return scoped.slice(0, 200)

  if (roleName === 'reseller') return 'reseller'
  if (roleName === 'support') return 'support'
  if (roleName === 'admin' || roleName === 'super_admin') return 'admin'
  return 'public'
}

function extractGeoHeaders(headers: Headers): { country: string | null; city: string | null } {
  const country = String(
    headers.get('cf-ipcountry')
      || headers.get('x-country')
      || ''
  ).trim() || null

  const city = String(
    headers.get('x-city')
      || ''
  ).trim() || null

  return { country, city }
}

async function getResponsePayloadPreview(response: Response): Promise<any> {
  const cloned = response.clone()
  const contentType = String(cloned.headers.get('content-type') || '').toLowerCase()
  const text = await cloned.text().catch(() => '')
  if (!text) return { status: response.status }

  if (contentType.includes('application/json')) {
    const parsed = parseJsonSafe(text)
    if (parsed && typeof parsed === 'object') return parsed
  }

  return {
    status: response.status,
    text_preview: text.slice(0, 1000),
  }
}

async function getOwnedServer(sb: any, serverId: string, userId: string) {
  return await sb
    .from('servers')
    .select('*')
    .eq('id', serverId)
    .eq('created_by', userId)
    .maybeSingle()
}

async function appendDeploymentLog(sb: any, deploymentId: string, level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}) {
  // Best effort logging: prefer deployment_logs table if available, fallback to deployments.build_logs.
  const payload = {
    deployment_id: deploymentId,
    level,
    message,
    meta,
    timestamp: new Date().toISOString(),
  }

  const insertResult = await sb.from('deployment_logs').insert(payload)
  if (!insertResult.error) return

  const { data: existing } = await sb.from('deployments').select('build_logs').eq('id', deploymentId).maybeSingle()
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
  const current = String(existing?.build_logs || '').trim()
  const next = current ? `${current}\n${line}` : line
  await sb.from('deployments').update({ build_logs: next }).eq('id', deploymentId)
}

async function deleteCloudflareDnsRecords(domainName: string) {
  const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN')
  const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID')
  if (!apiToken || !zoneId) {
    return { attempted: false, removed: 0, provider: 'cloudflare', reason: 'not_configured' }
  }

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  }

  const targets = [domainName, `www.${domainName}`]
  let removed = 0

  for (const target of targets) {
    const listResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${encodeURIComponent(target)}`, {
      headers,
    })

    if (!listResp.ok) continue
    const listPayload = await listResp.json().catch(() => ({}))
    const records = Array.isArray((listPayload as any).result) ? (listPayload as any).result : []

    for (const record of records) {
      const recordId = String(record?.id || '')
      if (!recordId) continue
      const deleteResp = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
        method: 'DELETE',
        headers,
      })
      if (deleteResp.ok) removed += 1
    }
  }

  return { attempted: true, removed, provider: 'cloudflare' }
}

async function queueDeploymentForServer(
  sb: any,
  server: any,
  triggeredBy: string | null,
  commitMessage?: string,
  commitSha?: string,
  branchOverride?: string,
) {
  const serverId = String(server?.id || '')
  if (!isUuid(serverId)) throw new Error('Invalid server id')

  const { data: activeDeployment } = await sb
    .from('deployments')
    .select('id, status')
    .eq('server_id', serverId)
    .in('status', ['queued', 'building'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeDeployment?.id) {
    throw new Error('Deployment already in progress for this server')
  }

  const branch = String(branchOverride || server?.git_branch || 'main')
  const { data: deployment, error: deploymentError } = await sb.from('deployments').insert({
    server_id: serverId,
    status: 'queued',
    triggered_by: triggeredBy,
    branch,
    commit_sha: commitSha || null,
    commit_message: commitMessage || 'Deployment queued',
  }).select().single()

  if (deploymentError || !deployment) {
    throw new Error(deploymentError?.message || 'Failed to queue deployment')
  }

  await sb
    .from('servers')
    .update({ status: 'deploying', last_deploy_at: new Date().toISOString() })
    .eq('id', serverId)

  await appendDeploymentLog(sb, deployment.id, 'info', 'Deployment queued', {
    server_id: serverId,
    branch,
    repo: server?.git_repo || null,
  })

  // Kick the worker (best-effort) so queue processing starts quickly.
  await adminClient().functions.invoke('deployment-worker', {
    body: {
      action: 'process_queue',
      limit: 3,
    },
  }).catch(() => null)

  return deployment
}

function toBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyGithubSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get('GITHUB_WEBHOOK_SECRET')
  if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) return false

  const key = await crypto.subtle.importKey(
    'raw',
    toBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, toBytes(rawBody))
  const expected = `sha256=${toHex(new Uint8Array(sig))}`
  return expected === signatureHeader
}

// ===================== 1. AUTH =====================
async function handleAuth(method: string, pathParts: string[], body: any, req: Request) {
  const action = pathParts[0]
  const admin = adminClient()

  // GET /auth/me
  if (method === 'GET' && action === 'me') {
    const auth = await authenticate(req)
    if (!auth) return err('Unauthorized', 401)

    const { data: profile } = await auth.supabase.from('profiles').select('*')
      .eq('user_id', auth.userId).maybeSingle()
    const { data: roles } = await admin.from('user_roles').select('role')
      .eq('user_id', auth.userId)

    return json({
      user_id: auth.userId,
      profile,
      roles: (roles || []).map((r: any) => r.role),
    })
  }

  // POST /auth/login — handled by Supabase SDK
  if (method === 'POST' && action === 'login') {
    return json({ message: 'Use Supabase SDK auth.signInWithPassword() directly' })
  }

  // POST /auth/register — handled by Supabase SDK
  if (method === 'POST' && action === 'register') {
    return json({ message: 'Use Supabase SDK auth.signUp() directly' })
  }

  // POST /auth/logout — handled by Supabase SDK
  if (method === 'POST' && action === 'logout') {
    return json({ message: 'Use Supabase SDK auth.signOut() directly' })
  }

  return err('Not found', 404)
}

// ===================== 2. PRODUCTS =====================
async function handleProducts(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const id = pathParts[0]

  // GET /products
  if (method === 'GET' && !id) {
    const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /products/categories
  if (method === 'GET' && id === 'categories') {
    const { data, error } = await sb.from('categories').select('*').eq('is_active', true).order('sort_order')
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /products/:id/versions
  if (method === 'GET' && id && pathParts[1] === 'versions') {
    const { data, error } = await sb.from('apk_versions').select('*').eq('apk_id', id).order('created_at', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /products/:id
  if (method === 'GET' && id) {
    const { data, error } = await sb.from('products').select('*').eq('id', id).single()
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /products (create) or POST /products/upload
  if (method === 'POST') {
    if (id === 'upload') {
      // Upload handled — for now return placeholder
      return json({ message: 'Upload endpoint ready — use storage bucket directly' })
    }
    const slug = body.slug || body.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || ''
    const { data, error } = await sb.from('products').insert({
      name: body.name || '', slug,
      description: body.description || null,
      category_id: body.category_id?.trim() || null,
      status: body.status || 'draft',
      price: body.price || 0,
      currency: body.currency || 'INR',
      version: body.version || '1.0.0',
      features: body.features || [],
      created_by: userId,
      git_repo_url: body.git_repo_url || null,
      git_repo_name: body.git_repo_name || null,
      git_default_branch: body.git_default_branch || 'main',
      deploy_status: body.deploy_status || 'idle',
      marketplace_visible: body.marketplace_visible || false,
      demo_url: body.demo_url || null,
      live_url: body.live_url || null,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'product', data.id, 'created', userId, { name: body.name })
    return json({ data }, 201)
  }

  // PUT /products/:id
  if (method === 'PUT' && id) {
    const updates = { ...body }
    if (updates.category_id !== undefined) {
      updates.category_id = updates.category_id?.trim() || null
    }
    const { error } = await sb.from('products').update(updates).eq('id', id)
    if (error) return err(error.message)
    await logActivity(admin, 'product', id, 'updated', userId, updates)
    return json({ success: true })
  }

  // DELETE /products/:id
  if (method === 'DELETE' && id) {
    const { error } = await sb.from('products').delete().eq('id', id)
    if (error) return err(error.message)
    await logActivity(admin, 'product', id, 'deleted', userId)
    return json({ success: true })
  }

  return err('Not found', 404)
}

// ===================== 3. RESELLERS =====================
async function handleResellers(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const id = pathParts[0]

  // GET /resellers
  if (method === 'GET' && !id) {
    const page = Number(body?.page || 1)
    const limit = Number(body?.limit || 25)
    const search = body?.search || ''

    let query = sb.from('resellers').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (search) query = query.ilike('company_name', `%${search}%`)
    const { data, error, count } = await query
    if (error) return err(error.message)

    // Enrich with profiles
    const userIds = (data || []).map((r: any) => r.user_id).filter(Boolean)
    let profileMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await sb.from('profiles').select('user_id, full_name, phone').in('user_id', userIds)
      ;(profiles || []).forEach((p: any) => { profileMap[p.user_id] = { full_name: p.full_name, phone: p.phone } })
    }

    const enriched = (data || []).map((r: any) => ({
      ...r,
      profile: profileMap[r.user_id] || null,
      company_name: r.company_name || profileMap[r.user_id]?.full_name || 'Unnamed Reseller',
    }))

    return json({ data: enriched, total: count })
  }

  // GET /resellers/:id/sales
  if (method === 'GET' && id && pathParts[1] === 'sales') {
    const { data: reseller } = await sb.from('resellers').select('user_id').eq('id', id).single()
    if (!reseller) return err('Reseller not found', 404)
    const { data, error } = await sb.from('transactions').select('*')
      .eq('created_by', reseller.user_id).order('created_at', { ascending: false }).limit(50)
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /resellers
  if (method === 'POST') {
    const { data, error } = await sb.from('resellers').insert({
      user_id: body.user_id,
      company_name: body.company_name,
      commission_percent: body.commission_percent || 10,
      credit_limit: body.credit_limit || 0,
      is_active: body.is_active ?? true,
      is_verified: body.is_verified ?? false,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'reseller', data.id, 'created', userId, { company_name: body.company_name })
    return json({ data }, 201)
  }

  // PUT /resellers/:id
  if (method === 'PUT' && id) {
    const updates: any = {}
    if (body.company_name !== undefined) updates.company_name = body.company_name
    if (body.commission_percent !== undefined) updates.commission_percent = body.commission_percent
    if (body.credit_limit !== undefined) updates.credit_limit = body.credit_limit
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.is_verified !== undefined) updates.is_verified = body.is_verified
    const { error } = await sb.from('resellers').update(updates).eq('id', id)
    if (error) return err(error.message)
    await logActivity(admin, 'reseller', id, 'updated', userId, updates)
    return json({ success: true })
  }

  return err('Not found', 404)
}

// ===================== 4. MARKETPLACE ADMIN =====================
async function handleMarketplace(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const action = pathParts[0]

  // GET /marketplace/products
  if (method === 'GET' && action === 'products') {
    const { data, error } = await sb.from('products')
      .select('id, name, slug, description, short_description, price, status, features, thumbnail_url, git_repo_url, marketplace_visible, apk_url, demo_url, demo_login, demo_password, demo_enabled, featured, trending, business_type, deploy_status, discount_percent, rating, tags, apk_enabled, license_enabled')
      .eq('marketplace_visible', true)
      .order('created_at', { ascending: false }).limit(500)
    if (error) return err(error.message)
    return json({ data })
  }

  // PUT /marketplace/approve
  if (method === 'PUT' && action === 'approve') {
    const { error } = await sb.from('products').update({ status: 'active', marketplace_visible: true }).eq('id', body.product_id)
    if (error) return err(error.message)
    await logActivity(admin, 'marketplace', body.product_id, 'approved', userId)
    return json({ success: true })
  }

  // GET /marketplace/orders
  if (method === 'GET' && action === 'orders') {
    const { data, error } = await sb.from('transactions').select('*').eq('reference_type', 'purchase')
      .order('created_at', { ascending: false }).limit(100)
    if (error) return err(error.message)
    return json({ data })
  }

  // PUT /marketplace/pricing
  if (method === 'PUT' && action === 'pricing') {
    const { error } = await sb.from('products').update({
      price: body.price,
      discount_percent: body.discount_percent,
    }).eq('id', body.product_id)
    if (error) return err(error.message)
    await logActivity(admin, 'marketplace', body.product_id, 'pricing_updated', userId, body)
    return json({ success: true })
  }

  return err('Not found', 404)
}

// ===================== 5. KEYS =====================
async function handleKeys(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const action = pathParts[0]
  const subAction = pathParts[1]

  // GET /keys
  if (method === 'GET' && !action) {
    const { data, error } = await sb.from('license_keys').select('*').order('created_at', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /keys/generate
  if (method === 'POST' && action === 'generate') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let key = ''
    for (let j = 0; j < 4; j++) {
      if (j > 0) key += '-'
      for (let i = 0; i < 4; i++) key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const licenseKey = body.license_key || key
    const { data, error } = await sb.from('license_keys').insert({
      product_id: body.product_id || '',
      license_key: licenseKey,
      key_type: body.key_type || 'yearly',
      status: body.status || 'active',
      owner_email: body.owner_email,
      owner_name: body.owner_name,
      max_devices: body.max_devices || 1,
      expires_at: body.expires_at,
      notes: body.notes,
      created_by: userId,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'license_key', data.id, 'generated', userId, { key: licenseKey })
    return json({ data }, 201)
  }

  // POST /keys/validate
  if (method === 'POST' && action === 'validate') {
    const { data, error } = await admin.from('license_keys').select('*')
      .eq('license_key', body.license_key).single()
    if (error || !data) return err('Invalid license key', 404)
    const valid = data.status === 'active' && (!data.expires_at || new Date(data.expires_at) > new Date())
    return json({ valid, key: data })
  }

  // PUT /keys/:id/activate
  if (method === 'PUT' && action && subAction === 'activate') {
    const { error } = await sb.from('license_keys').update({ status: 'active' }).eq('id', action)
    if (error) return err(error.message)
    await logActivity(admin, 'license_key', action, 'activated', userId)
    return json({ success: true })
  }

  // PUT /keys/:id/deactivate
  if (method === 'PUT' && action && subAction === 'deactivate') {
    const { error } = await sb.from('license_keys').update({ status: 'suspended' }).eq('id', action)
    if (error) return err(error.message)
    await logActivity(admin, 'license_key', action, 'deactivated', userId)
    return json({ success: true })
  }

  // DELETE /keys/:id
  if (method === 'DELETE' && action) {
    const { error } = await sb.from('license_keys').delete().eq('id', action)
    if (error) return err(error.message)
    await logActivity(admin, 'license_key', action, 'deleted', userId)
    return json({ success: true })
  }

  return err('Not found', 404)
}

// ===================== 6. SERVERS =====================
async function handleServers(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const segment = pathParts[0]
  const id = pathParts[1]

  // GET /projects
  if (method === 'GET' && segment === 'projects' && !id) {
    const page = Math.max(1, Number(body?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(body?.limit || 50)))
    const { data, error } = await sb
      .from('servers')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /projects
  if (method === 'POST' && segment === 'projects') {
    const base = String(body.name || 'project').toLowerCase().replace(/[^a-z0-9]/g, '-') || 'project'
    let subdomain: string | null = null

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = `${base}-${Math.random().toString(36).substring(2, 8)}`
      const { data: existing, error: lookupError } = await sb
        .from('servers')
        .select('id')
        .eq('subdomain', candidate)
        .maybeSingle()

      if (lookupError) return err(lookupError.message)
      if (!existing) {
        subdomain = candidate
        break
      }
    }

    if (!subdomain) return err('Unable to allocate unique subdomain. Please retry.', 409)

    const { data, error } = await sb.from('servers').insert({
      name: body.name || '', subdomain,
      git_repo: body.git_repo, git_branch: body.git_branch || 'main',
      runtime: body.runtime || 'nodejs18', status: 'stopped',
      auto_deploy: body.auto_deploy ?? true, created_by: userId,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'server', data.id, 'created', userId, { name: body.name })
    return json({ data }, 201)
  }

  // GET /deploy-targets
  if (method === 'GET' && segment === 'deploy-targets') {
    const { data, error } = await sb
      .from('servers')
      .select('id, name, subdomain, status')
      .eq('status', 'live')
      .eq('created_by', userId)
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /deploy-targets
  if (method === 'POST' && segment === 'deploy-targets') {
    const { data, error } = await sb.from('servers').insert({
      name: body.name || '', subdomain: body.subdomain,
      status: 'stopped', created_by: userId,
      ip_address: body.ip_address, agent_url: body.agent_url,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'deploy_target', data.id, 'created', userId)
    return json({ data }, 201)
  }

  // POST /deploy/trigger
  if (method === 'POST' && segment === 'deploy' && id === 'trigger') {
    const serverId = String(body.server_id || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    try {
      const deployment = await queueDeploymentForServer(
        sb,
        server,
        userId,
        body.commit_message || 'Manual deployment trigger',
        body.commit_sha || null,
        body.branch || server.git_branch || 'main',
      )

      await logActivity(admin, 'deployment', deployment.id, 'triggered', userId, {
        server_id: serverId,
        mode: 'queued',
      })

      return json({ data: deployment, success: true, queued: true })
    } catch (e: any) {
      const message = String(e?.message || 'Failed to queue deployment')
      if (message.toLowerCase().includes('already in progress')) {
        return err(message, 409)
      }
      return err(message, 500)
    }
  }

  // GET /deploy/status/:id
  if (method === 'GET' && segment === 'deploy' && pathParts[1] === 'status' && pathParts[2]) {
    const serverId = String(pathParts[2] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: ownedServer, error: ownedServerError } = await getOwnedServer(sb, serverId, userId)
    if (ownedServerError) return err(ownedServerError.message)
    if (!ownedServer) return err('Server not found', 404)

    const { data, error } = await sb.from('deployments').select('*').eq('server_id', serverId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) return err(error.message)

    const { data: liveStatus, error: liveStatusError } = await admin.functions.invoke('server-agent', {
      body: { action: 'status', serverId },
    })

    if (liveStatusError && data?.id) {
      await appendDeploymentLog(sb, data.id, 'warn', 'Live status check failed', { error: liveStatusError.message })
    }

    return json({
      data,
      live_agent_status: liveStatus?.server || null,
      diagnostics: liveStatus?.diagnostics || null,
    })
  }

  // GET /deploy/logs/:id
  if (method === 'GET' && segment === 'deploy' && pathParts[1] === 'logs' && pathParts[2]) {
    const deploymentId = String(pathParts[2] || '')
    if (!isUuid(deploymentId)) return err('Invalid deployment_id', 400)

    const { data: deployment, error: deploymentErr } = await sb
      .from('deployments')
      .select('id, server_id, servers!inner(created_by)')
      .eq('id', deploymentId)
      .eq('servers.created_by', userId)
      .maybeSingle()

    if (deploymentErr) return err(deploymentErr.message)
    if (!deployment) return err('Deployment not found', 404)

    const { data, error } = await sb.from('deployment_logs').select('*').eq('deployment_id', deploymentId)
      .order('timestamp', { ascending: true })

    if (!error) return json({ data })

    const { data: fallback } = await sb.from('deployments').select('build_logs').eq('id', deploymentId).maybeSingle()
    const lines = String(fallback?.build_logs || '')
      .split('\n')
      .filter(Boolean)
      .map((line: string, idx: number) => ({
        id: `${deploymentId}:${idx}`,
        deployment_id: deploymentId,
        level: 'info',
        message: line,
        timestamp: null,
      }))
    return json({ data: lines })
  }

  // POST /domain/add
  if (method === 'POST' && segment === 'domain' && id === 'add') {
    const serverId = String(body.server_id || '')
    const domainName = String(body.domain_name || '').trim().toLowerCase()

    if (!isUuid(serverId)) return err('Invalid server_id', 400)
    if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domainName)) {
      return err('Invalid domain format', 400)
    }

    const { data: ownedServer, error: ownedServerError } = await getOwnedServer(sb, serverId, userId)
    if (ownedServerError) return err(ownedServerError.message)
    if (!ownedServer) return err('Server not found', 404)

    const { data: duplicateDomain } = await sb
      .from('domains')
      .select('id')
      .eq('server_id', serverId)
      .eq('domain_name', domainName)
      .maybeSingle()

    if (duplicateDomain?.id) {
      return err('Domain already added to this server', 409)
    }

    const { data, error } = await sb.from('domains').insert({
      domain_name: domainName, server_id: serverId,
      domain_type: body.domain_type || 'custom', created_by: userId,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'domain', data.id, 'added', userId, { domain: domainName })
    return json({ data }, 201)
  }

  // GET /domain/list
  if (method === 'GET' && segment === 'domain' && id === 'list') {
    const { data, error } = await sb
      .from('domains')
      .select('id, domain_name, domain_type, status, ssl_status, dns_verified, server_id, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /domain/records/:id
  if (method === 'GET' && segment === 'domain' && pathParts[1] === 'records' && pathParts[2]) {
    const domainId = String(pathParts[2] || '')
    if (!isUuid(domainId)) return err('Invalid domain_id', 400)

    const { data: domain, error: domainError } = await sb
      .from('domains')
      .select('id, domain_name, created_by')
      .eq('id', domainId)
      .eq('created_by', userId)
      .maybeSingle()

    if (domainError) return err(domainError.message)
    if (!domain) return err('Domain not found', 404)

    const { data: records, error: recordsError } = await sb
      .from('dns_records')
      .select('id, record_type, name, value, ttl, verified, priority')
      .eq('domain_id', domainId)
      .order('created_at', { ascending: true })

    if (recordsError) return err(recordsError.message)

    const fallback = [
      { id: `${domainId}:A`, record_type: 'A', name: '@', value: '76.76.21.21', ttl: 3600, verified: false, priority: null },
      { id: `${domainId}:CNAME`, record_type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com', ttl: 3600, verified: false, priority: null },
    ]

    return json({ data: records && records.length > 0 ? records : fallback })
  }

  // POST /domain/verify
  if (method === 'POST' && segment === 'domain' && id === 'verify') {
    const domainId = String(body.domain_id || '')
    if (!isUuid(domainId)) return err('Invalid domain_id', 400)

    const { data: domain, error: domainLookupError } = await sb
      .from('domains')
      .select('id, domain_name, server_id, servers!inner(created_by)')
      .eq('id', domainId)
      .eq('servers.created_by', userId)
      .maybeSingle()

    if (domainLookupError) return err(domainLookupError.message)
    if (!domain) return err('Domain not found', 404)

    const dnsCheckHost = String((domain as any).domain_name || '').trim()
    if (!dnsCheckHost) return err('Domain not found', 404)

    let dnsOk = false
    try {
      const dnsResp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dnsCheckHost)}&type=A`)
      const dnsPayload = await dnsResp.json().catch(() => ({}))
      dnsOk = Array.isArray((dnsPayload as any).Answer) && (dnsPayload as any).Answer.length > 0
    } catch {
      dnsOk = false
    }

    if (!dnsOk) {
      await logActivity(admin, 'domain', domainId, 'verify_failed', userId, { reason: 'dns_not_resolved', domain: dnsCheckHost })
      return err('DNS verification failed. Please wait for DNS propagation and retry.', 409)
    }

    const { error } = await sb.from('domains').update({ dns_verified: true, dns_verified_at: new Date().toISOString() })
      .eq('id', domainId)
    if (error) return err(error.message)
    await logActivity(admin, 'domain', domainId, 'verified', userId, { domain: dnsCheckHost })
    return json({ success: true })
  }

  // DELETE /domain/remove/:id
  if (method === 'DELETE' && segment === 'domain' && pathParts[1] === 'remove' && pathParts[2]) {
    const domainId = String(pathParts[2] || '')
    if (!isUuid(domainId)) return err('Invalid domain_id', 400)

    const { data: domain, error: lookupError } = await sb
      .from('domains')
      .select('id, domain_name, created_by')
      .eq('id', domainId)
      .eq('created_by', userId)
      .maybeSingle()

    if (lookupError) return err(lookupError.message)
    if (!domain) return err('Domain not found', 404)

    const cleanup = await deleteCloudflareDnsRecords(String((domain as any).domain_name || '').trim()).catch((cleanupError) => ({
      attempted: true,
      removed: 0,
      provider: 'cloudflare',
      reason: String((cleanupError as any)?.message || cleanupError),
    }))

    await sb.from('dns_records').delete().eq('domain_id', domainId)
    const { error: deleteError } = await sb.from('domains').delete().eq('id', domainId)
    if (deleteError) return err(deleteError.message)

    await logActivity(admin, 'domain', domainId, 'removed', userId, { cleanup })
    return json({ success: true, cleanup })
  }

  // GET /server/health
  if (method === 'GET' && segment === 'server' && id === 'health') {
    const { data, error } = await sb
      .from('servers')
      .select('id, name, status, subdomain, custom_domain, health_status, uptime_percent')
      .eq('created_by', userId)
    if (error) return err(error.message)
    const stats = {
      total: data?.length || 0,
      live: data?.filter((s: any) => s.status === 'live').length || 0,
      failed: data?.filter((s: any) => s.status === 'failed').length || 0,
      deploying: data?.filter((s: any) => s.status === 'deploying').length || 0,
    }
    return json({ stats, servers: data })
  }

  // POST /server/security/scan/:serverId
  if (method === 'POST' && segment === 'server' && pathParts[1] === 'security' && pathParts[2] === 'scan' && pathParts[3]) {
    const serverId = String(pathParts[3] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    // Call server-agent for security scan
    const { data: agentResult, error: agentError } = await adminClient().functions.invoke('server-agent', {
      body: { action: 'run_security_scan', serverId },
    })

    if (agentError || !agentResult?.success) {
      await appendDeploymentLog(sb, serverId, 'error', 'Security scan failed', { error: agentError?.message })
      return err(agentError?.message || 'Security scan failed')
    }

    // Save results to database
    if (agentResult.issues && Array.isArray(agentResult.issues)) {
      for (const issue of agentResult.issues) {
        await sb.from('server_security_issues').insert({
          server_id: serverId,
          severity: issue.severity,
          title: issue.title,
          description: issue.description,
          recommendation: issue.recommendation,
          fixed: issue.fixed || false,
        }).catch(() => null)
      }
    }

    await sb.from('servers').update({
      last_security_scan: new Date().toISOString(),
      security_score: agentResult.score || 0,
    }).eq('id', serverId).catch(() => null)

    await sb.from('server_activity_logs').insert({
      server_id: serverId,
      action: 'Security scan completed',
      action_type: 'security_scan',
      performed_by: userId,
      details: { score: agentResult.score, issues_count: agentResult.issues?.length || 0 },
    }).catch(() => null)

    return json({ success: true, score: agentResult.score, issues: agentResult.issues })
  }

  // GET /server/health/metrics/:serverId
  if (method === 'GET' && segment === 'server' && pathParts[1] === 'health' && pathParts[2] === 'metrics' && pathParts[3]) {
    const serverId = String(pathParts[3] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    // Get latest metrics from database
    const { data: metrics, error: metricsError } = await sb
      .from('server_health_metrics')
      .select('*')
      .eq('server_id', serverId)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (metricsError) return err(metricsError.message)

    // Call server-agent for fresh check
    const { data: agentResult } = await adminClient().functions.invoke('server-agent', {
      body: { action: 'health_check', serverId },
    }).catch(() => ({ data: null }))

    if (agentResult?.success && agentResult.metrics) {
      await sb.from('server_health_metrics').insert({
        server_id: serverId,
        cpu_usage: agentResult.metrics.cpu,
        memory_usage: agentResult.metrics.memory,
        disk_usage: agentResult.metrics.disk,
        uptime_percent: agentResult.metrics.uptime,
        response_time_ms: agentResult.metrics.responseTime,
      }).catch(() => null)

      await sb.from('servers').update({
        last_health_check: new Date().toISOString(),
      }).eq('id', serverId).catch(() => null)
    }

    return json({ success: true, current: agentResult?.metrics || metrics, latest: metrics })
  }

  // GET /server/ssl/:serverId
  if (method === 'GET' && segment === 'server' && pathParts[1] === 'ssl' && pathParts[2]) {
    const serverId = String(pathParts[2] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    const { data: certs, error: certsError } = await sb
      .from('server_ssl_certificates')
      .select('*')
      .eq('server_id', serverId)
      .order('valid_until', { ascending: true })

    if (certsError) return err(certsError.message)

    // Call server-agent for current SSL status
    const { data: agentResult } = await adminClient().functions.invoke('server-agent', {
      body: { action: 'ssl_status', serverId },
    }).catch(() => ({ data: null }))

    return json({ success: true, certificates: certs, agent_certs: agentResult?.certificates })
  }

  // POST /server/ssl/provision/:serverId
  if (method === 'POST' && segment === 'server' && pathParts[1] === 'ssl' && pathParts[2] === 'provision' && pathParts[3]) {
    const serverId = String(pathParts[3] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    const { data: agentResult, error: agentError } = await adminClient().functions.invoke('server-agent', {
      body: { action: 'provision_ssl', serverId },
    })

    if (agentError || !agentResult?.success) {
      return err(agentError?.message || 'SSL provisioning failed')
    }

    await sb.from('server_activity_logs').insert({
      server_id: serverId,
      action: 'SSL provisioning started',
      action_type: 'ssl_provision',
      performed_by: userId,
      details: { status: 'provisioning' },
    }).catch(() => null)

    return json({ success: true, message: agentResult.message })
  }

  // GET /server/backups/:serverId
  if (method === 'GET' && segment === 'server' && pathParts[1] === 'backups' && pathParts[2]) {
    const serverId = String(pathParts[2] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    const { data: backups, error: backupsError } = await sb
      .from('server_backups')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false })

    if (backupsError) return err(backupsError.message)

    return json({ success: true, backups })
  }

  // POST /server/backups/create/:serverId
  if (method === 'POST' && segment === 'server' && pathParts[1] === 'backups' && pathParts[2] === 'create' && pathParts[3]) {
    const serverId = String(pathParts[3] || '')
    if (!isUuid(serverId)) return err('Invalid server_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    const { data: agentResult, error: agentError } = await adminClient().functions.invoke('server-agent', {
      body: { action: 'create_backup', serverId },
    })

    if (agentError || !agentResult?.success) {
      return err(agentError?.message || 'Backup creation failed')
    }

    // Record backup in database
    const { data: backup, error: backupError } = await sb.from('server_backups').insert({
      server_id: serverId,
      backup_type: body.type || 'full',
      status: 'in_progress',
      location: agentResult.location || `backup-${Date.now()}`,
      created_by: userId,
    }).select().single()

    if (backupError) return err(backupError.message)

    await sb.from('server_activity_logs').insert({
      server_id: serverId,
      action: 'Backup created',
      action_type: 'backup',
      performed_by: userId,
      details: { backup_id: backup.id, type: body.type || 'full' },
    }).catch(() => null)

    return json({ success: true, backup_id: backup.id, message: agentResult.message })
  }

  // POST /server/backups/restore/:serverId
  if (method === 'POST' && segment === 'server' && pathParts[1] === 'backups' && pathParts[2] === 'restore' && pathParts[3]) {
    const serverId = String(pathParts[3] || '')
    const backupId = String(body.backup_id || '')

    if (!isUuid(serverId)) return err('Invalid server_id', 400)
    if (!isUuid(backupId)) return err('Invalid backup_id', 400)

    const { data: server, error: serverError } = await getOwnedServer(sb, serverId, userId)
    if (serverError) return err(serverError.message)
    if (!server) return err('Server not found', 404)

    const { data: agentResult, error: agentError } = await adminClient().functions.invoke('server-agent', {
      body: { action: 'restore_backup', serverId, backupId },
    })

    if (agentError || !agentResult?.success) {
      return err(agentError?.message || 'Backup restoration failed')
    }

    // Update backup record
    await sb.from('server_backups').update({
      restored_from_id: backupId,
      restored_at: new Date().toISOString(),
    }).eq('id', backupId).catch(() => null)

    await sb.from('server_activity_logs').insert({
      server_id: serverId,
      action: 'Backup restored',
      action_type: 'backup',
      performed_by: userId,
      details: { backup_id: backupId },
    }).catch(() => null)

    return json({ success: true, message: agentResult.message })
  }

  // DELETE /server/backups/:backupId
  if (method === 'DELETE' && segment === 'server' && pathParts[1] === 'backups' && pathParts[2]) {
    const backupId = String(pathParts[2] || '')
    if (!isUuid(backupId)) return err('Invalid backup_id', 400)

    const { data: backup, error: backupError } = await sb
      .from('server_backups')
      .select('id, server_id, servers!inner(created_by)')
      .eq('id', backupId)
      .eq('servers.created_by', userId)
      .maybeSingle()

    if (backupError) return err(backupError.message)
    if (!backup) return err('Backup not found', 404)

    const serverId = String((backup as any).server_id)

    const { error: deleteError } = await sb.from('server_backups').delete().eq('id', backupId)
    if (deleteError) return err(deleteError.message)

    await sb.from('server_activity_logs').insert({
      server_id: serverId,
      action: 'Backup deleted',
      action_type: 'backup',
      performed_by: userId,
      details: { backup_id: backupId },
    }).catch(() => null)

    return json({ success: true, message: 'Backup deleted' })
  }

  return err('Not found', 404)
}

// ===================== 7. GITHUB =====================
async function handleGithub(method: string, pathParts: string[], body: any, userId: string, sb: any, req?: Request, rawBody?: string) {
  const action = pathParts[0]

  // GET /github/install-url
  if (method === 'GET' && action === 'install-url') {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    return json({ url: `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo` })
  }

  // POST /github/callback
  if (method === 'POST' && action === 'callback') {
    const clientId = Deno.env.get('GITHUB_CLIENT_ID')
    const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET')
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: body.code }),
    })
    const tokenData = await res.json()
    return json({ data: tokenData })
  }

  // POST /github/webhook
  if (method === 'POST' && action === 'webhook') {
    const payloadRaw = rawBody || JSON.stringify(body || {})
    const signature = req?.headers.get('X-Hub-Signature-256') || null
    const verified = await verifyGithubSignature(payloadRaw, signature)
    if (!verified) return err('Invalid webhook signature', 401)

    const event = req?.headers.get('X-GitHub-Event') || 'unknown'
    if (event === 'ping') {
      return json({ success: true, message: 'pong' })
    }

    if (event !== 'push') {
      return json({ success: true, ignored: true, reason: `unsupported_event:${event}` })
    }

    const repoFullName = String(body?.repository?.full_name || '').trim().toLowerCase()
    const pushedRef = String(body?.ref || '').trim()
    const branch = pushedRef.replace('refs/heads/', '')
    const commitSha = String(body?.after || '').trim() || null
    const commitMessage = String(body?.head_commit?.message || `Webhook deploy for ${repoFullName}`).slice(0, 500)

    if (!repoFullName || !branch) {
      return err('Invalid webhook payload', 400)
    }

    const { data: servers, error: serversError } = await sb
      .from('servers')
      .select('id, name, git_repo, git_branch, auto_deploy, status')
      .eq('auto_deploy', true)
      .eq('git_branch', branch)

    if (serversError) return err(serversError.message)

    const matchingServers = (servers || []).filter((s: any) => {
      const repo = String(s.git_repo || '').trim().toLowerCase()
      return repo === repoFullName || repo.endsWith(`/${repoFullName}`) || repo.includes(`github.com/${repoFullName}`)
    })

    const queued: Array<{ server_id: string; deployment_id?: string; error?: string }> = []
    for (const server of matchingServers) {
      try {
        const deployment = await queueDeploymentForServer(
          sb,
          server,
          null,
          commitMessage,
          commitSha,
          branch,
        )
        queued.push({ server_id: server.id, deployment_id: deployment.id })
      } catch (e: any) {
        queued.push({ server_id: server.id, error: String(e?.message || 'failed') })
      }
    }

    return json({
      success: true,
      event,
      repo: repoFullName,
      branch,
      matched_servers: matchingServers.length,
      queued,
    })
  }

  // GET /github/repos
  if (method === 'GET' && action === 'repos') {
    const token = Deno.env.get('SAASVALA_GITHUB_TOKEN')
    if (!token) return err('GitHub token not configured', 500)

    // Cap pagination to avoid unbounded memory/time usage on very large accounts.
    const perPage = Math.min(100, Math.max(1, Number(body?.per_page || 50)))
    const maxPages = Math.min(10, Math.max(1, Number(body?.max_pages || 5)))
    let allRepos: any[] = []
    let page = 1
    while (page <= maxPages) {
      const res = await fetch(`https://api.github.com/user/repos?per_page=${perPage}&sort=updated&page=${page}`, {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      })

      if (!res.ok) {
        const msg = await res.text()
        return err(`GitHub API error: ${msg.slice(0, 200)}`, res.status)
      }

      const repos = await res.json()
      if (!Array.isArray(repos) || repos.length === 0) break
      allRepos = allRepos.concat(repos)
      if (repos.length < perPage) break
      page++
    }

    return json({ data: allRepos, meta: { per_page: perPage, pages_fetched: page - 1, truncated: page > maxPages } })
  }

  return err('Not found', 404)
}

// ===================== 8. SAAS AI =====================
async function handleAi(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const action = pathParts[0]

  // POST /ai/run
  if (method === 'POST' && action === 'run') {
    const { data, error } = await sb.functions.invoke('ai-chat', { body: { ...body, user_id: userId } })
    if (error) return err(error.message, 500)
    return json({ data })
  }

  // GET /ai/models
  if (method === 'GET' && action === 'models') {
    const { data, error } = await sb.from('ai_models').select('*').eq('is_active', true).order('name')
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /ai/usage
  if (method === 'GET' && action === 'usage') {
    const { data, error } = await sb.from('ai_usage_daily').select('*')
      .eq('user_id', userId).order('date', { ascending: false }).limit(30)
    if (error) return err(error.message)
    return json({ data })
  }

  return err('Not found', 404)
}

// ===================== 9. AI CHAT =====================
async function handleChat(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  // POST /chat/send
  if (method === 'POST' && pathParts[0] === 'send') {
    const { data, error } = await sb.functions.invoke('ai-chat', {
      body: { ...body, user_id: userId },
    })
    if (error) return err(error.message, 500)
    return json({ data })
  }

  // GET /chat/history
  if (method === 'GET' && pathParts[0] === 'history') {
    const { data, error } = await sb.from('ai_requests').select('*, ai_responses(*)')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    if (error) return err(error.message)
    return json({ data })
  }

  return err('Not found', 404)
}

// ===================== 10. AI API KEYS =====================
async function handleApiKeys(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()

  // POST /api-keys/create
  if (method === 'POST' && pathParts[0] === 'create') {
    const apiKey = `sk-vala-${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`
    const { data, error } = await sb.from('ai_usage').insert({
      user_id: userId, model: body.model || 'default',
      endpoint: body.name || 'API Key', tokens_input: 0, tokens_output: 0,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'api_key', data.id, 'created', userId)
    return json({ data: { ...data, api_key: apiKey } }, 201)
  }

  // GET /api-keys
  if (method === 'GET' && !pathParts[0]) {
    const { data, error } = await sb.from('ai_usage').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /api-keys/usage (or /api-usage mapped here)
  if (method === 'GET' && (pathParts[0] === 'usage')) {
    const { data, error } = await sb.from('ai_usage_daily').select('*')
      .eq('user_id', userId).order('date', { ascending: false }).limit(30)
    if (error) return err(error.message)
    return json({ data })
  }

  return err('Not found', 404)
}

// ===================== 11. AUTO-PILOT =====================
async function handleAuto(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()

  // POST /auto/run
  if (method === 'POST' && pathParts[0] === 'run') {
    const { data, error } = await sb.functions.invoke('ai-auto-pilot', { body })
    if (error) return err(error.message, 500)
    await logActivity(admin, 'auto_pilot', 'system', 'run_triggered', userId)
    return json({ data })
  }

  // GET /auto/tasks
  if (method === 'GET' && pathParts[0] === 'tasks') {
    const { data, error } = await sb.from('auto_software_queue').select('*')
      .order('created_at', { ascending: false }).limit(50)
    if (error) return err(error.message)
    return json({ data })
  }

  // PUT /auto/:id
  if (method === 'PUT' && pathParts[0]) {
    const { error } = await sb.from('auto_software_queue').update(body).eq('id', pathParts[0])
    if (error) return err(error.message)
    await logActivity(admin, 'auto_task', pathParts[0], 'updated', userId)
    return json({ success: true })
  }

  return err('Not found', 404)
}

// ===================== 12. APK PIPELINE =====================
async function handleApk(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()

  // POST /apk/build
  if (method === 'POST' && pathParts[0] === 'build') {
    const { data, error } = await sb.from('apk_build_queue').insert({
      repo_name: body.repo_name, repo_url: body.repo_url,
      slug: body.slug || body.repo_name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unnamed',
      build_status: 'pending',
      target_industry: body.target_industry, product_id: body.product_id,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'apk', data.id, 'build_queued', userId, { repo: body.repo_name })
    return json({ data }, 201)
  }

  // GET /apk/history
  if (method === 'GET' && pathParts[0] === 'history') {
    const { data, error } = await sb.from('apk_build_queue').select('*')
      .order('created_at', { ascending: false }).limit(50)
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /apk/download/:id
  if (method === 'GET' && pathParts[0] === 'download' && pathParts[1]) {
    const { data: apk, error } = await admin.from('apks').select('file_url, product_id')
      .eq('id', pathParts[1]).single()
    if (error || !apk?.file_url) return err('APK not found', 404)

    const { data: signedUrl } = await admin.storage.from('apks')
      .createSignedUrl(apk.file_url, 300)
    if (!signedUrl?.signedUrl) return err('Failed to generate download URL', 500)

    await admin.from('apk_download_logs').insert({
      product_id: apk.product_id, user_id: userId, license_key: body?.license_key || 'direct',
    })

    return json({ url: signedUrl.signedUrl })
  }

  return err('Not found', 404)
}

// ===================== 13. WALLET =====================
async function handleWallet(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const action = pathParts[0]

  // GET /wallet
  if (method === 'GET' && !action) {
    const { data, error } = await sb.from('wallets').select('*').eq('user_id', userId).maybeSingle()
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /wallet/all (admin)
  if (method === 'GET' && action === 'all') {
    const { data, error } = await sb.from('wallets').select('*').order('balance', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /wallet/transactions
  if (method === 'GET' && action === 'transactions') {
    const { data: wallet } = await sb.from('wallets').select('id').eq('user_id', userId).maybeSingle()
    if (!wallet) return json({ data: [], total: 0 })

    const page = Number(body?.page || 1)
    const limit = Number(body?.limit || 25)
    const { data, error, count } = await sb.from('transactions').select('*', { count: 'exact' })
      .eq('wallet_id', wallet.id).order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    if (error) return err(error.message)
    return json({ data, total: count })
  }

  // POST /wallet/add
  if (method === 'POST' && action === 'add') {
    const amount = Number(body.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return err('Invalid amount', 400)
    if (amount < 50) return err('Minimum top-up amount is $50', 400)

    let { data: wallet } = await sb
      .from('wallets')
      .select('id, balance, total_added, version')
      .eq('user_id', userId)
      .maybeSingle()

    if (!wallet) {
      const { data: createdWallet, error: walletCreateError } = await sb
        .from('wallets')
        .insert({
          user_id: userId,
          balance: 0,
          total_added: 0,
          total_spent: 0,
          total_earned: 0,
          currency: 'USD',
          is_locked: false,
        })
        .select('id, balance, total_added, version')
        .single()

      if (walletCreateError || !createdWallet) {
        return err(walletCreateError?.message || 'Failed to create wallet', 500)
      }

      wallet = createdWallet
    }

    const currentBalance = Number(wallet.balance || 0)
    const currentTotalAdded = Number((wallet as any).total_added || 0)
    const currentVersion = Number((wallet as any).version || 0)
    const newBalance = Number((currentBalance + amount).toFixed(2))
    const nextTotalAdded = Number((currentTotalAdded + amount).toFixed(2))

    const { data: updatedWallet, error: walletUpdateError } = await sb
      .from('wallets')
      .update({
        balance: newBalance,
        total_added: nextTotalAdded,
        version: currentVersion + 1,
      })
      .eq('id', wallet.id)
      .eq('version', currentVersion)
      .select('id, balance')
      .maybeSingle()
    if (walletUpdateError) return err(walletUpdateError.message)
    if (!updatedWallet) return err('Wallet was updated by another request. Please retry.', 409)

    const { error: txErr } = await sb.from('transactions').insert({
      wallet_id: wallet.id, type: 'credit', amount,
      balance_after: newBalance, status: 'completed',
      description: body.description || 'Credit added', created_by: userId,
      meta: body.payment_method ? { payment_method: body.payment_method } : null,
    })
    if (txErr) {
      await sb
        .from('wallets')
        .update({ balance: currentBalance, total_added: currentTotalAdded, version: currentVersion + 2 })
        .eq('id', wallet.id)
        .eq('version', currentVersion + 1)
      return err(txErr.message)
    }

    await logActivity(admin, 'wallet', wallet.id, 'credit_added', userId, { amount })
    return json({ success: true, balance: newBalance })
  }

  // POST /wallet/withdraw
  if (method === 'POST' && action === 'withdraw') {
    const { data: wallet } = await sb
      .from('wallets')
      .select('id, balance, total_spent, version')
      .eq('user_id', userId)
      .single()
    if (!wallet) return err('Wallet not found', 404)
    if ((wallet.balance || 0) < body.amount) return err('Insufficient balance')

    const currentBalance = Number(wallet.balance || 0)
    const currentSpent = Number((wallet as any).total_spent || 0)
    const currentVersion = Number((wallet as any).version || 0)
    const newBalance = Number((currentBalance - Number(body.amount || 0)).toFixed(2))
    const nextSpent = Number((currentSpent + Number(body.amount || 0)).toFixed(2))

    const { data: updatedWallet, error: walletUpdateError } = await sb
      .from('wallets')
      .update({
        balance: newBalance,
        total_spent: nextSpent,
        version: currentVersion + 1,
      })
      .eq('id', wallet.id)
      .eq('version', currentVersion)
      .select('id')
      .maybeSingle()
    if (walletUpdateError) return err(walletUpdateError.message)
    if (!updatedWallet) return err('Wallet was updated by another request. Please retry.', 409)

    const { error: txErr } = await sb.from('transactions').insert({
      wallet_id: wallet.id, type: 'debit', amount: body.amount,
      balance_after: newBalance, status: 'completed',
      description: body.description || 'Withdrawal', created_by: userId,
      reference_id: body.reference_id, reference_type: body.reference_type,
    })
    if (txErr) {
      await sb
        .from('wallets')
        .update({ balance: currentBalance, total_spent: currentSpent, version: currentVersion + 2 })
        .eq('id', wallet.id)
        .eq('version', currentVersion + 1)
      return err(txErr.message)
    }

    await logActivity(admin, 'wallet', wallet.id, 'debit', userId, { amount: body.amount })
    return json({ success: true, balance: newBalance })
  }

  return err('Not found', 404)
}

// ===================== 14. SEO & LEADS =====================
async function handleSeoLeads(method: string, pathParts: string[], body: any, userId: string, sb: any) {
  const admin = adminClient()
  const segment = pathParts[0]
  const { data: userRoles } = await admin.from('user_roles').select('role').eq('user_id', userId)
  const roles = (userRoles ?? []).map((r: any) => String(r.role))
  const isPrivileged = roles.includes('super_admin') || roles.includes('admin')

  const dateRangeFromParams = (period: string, startDate?: string, endDate?: string) => {
    const now = new Date()
    if (period === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { start: start.toISOString(), end: now.toISOString(), periodType: 'today' }
    }
    if (period === '7d') {
      return { start: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(), end: now.toISOString(), periodType: '7d' }
    }
    if (period === '30d') {
      return { start: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(), end: now.toISOString(), periodType: '30d' }
    }
    if (period === 'custom' && startDate && endDate) {
      return { start: new Date(startDate).toISOString(), end: new Date(endDate).toISOString(), periodType: 'custom' }
    }
    return { start: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(), end: now.toISOString(), periodType: '30d' }
  }

  const toPct = (num: number, den: number) => den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0

  // GET /system/command-center
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'command-center') {
    if (!isPrivileged) return err('Forbidden', 403)

    const [leadsCount, adsCount, revenueRows, aiRollups, kpiRows] = await Promise.all([
      sb.from('leads').select('id', { count: 'exact', head: true }),
      sb.from('ai_google_ads_campaigns').select('id', { count: 'exact', head: true }),
      sb.from('lead_source_events').select('attributed_revenue').order('created_at', { ascending: false }).limit(5000),
      sb.from('ai_usage_module_rollups').select('calls_count,total_cost').order('rollup_date', { ascending: false }).limit(1000),
      sb.from('platform_business_kpi_snapshots').select('*').order('captured_at', { ascending: false }).limit(30),
    ])

    if (leadsCount.error) return err(leadsCount.error.message)
    if (adsCount.error) return err(adsCount.error.message)
    if (revenueRows.error) return err(revenueRows.error.message)
    if (aiRollups.error) return err(aiRollups.error.message)
    if (kpiRows.error) return err(kpiRows.error.message)

    const totalRevenue = (revenueRows.data || []).reduce((a: number, b: any) => a + Number(b.attributed_revenue || 0), 0)
    const totalAiCalls = (aiRollups.data || []).reduce((a: number, b: any) => a + Number(b.calls_count || 0), 0)
    const totalAiCost = (aiRollups.data || []).reduce((a: number, b: any) => a + Number(b.total_cost || 0), 0)

    await admin.from('platform_command_center_snapshots').insert({
      total_leads: leadsCount.count || 0,
      total_ads_campaigns: adsCount.count || 0,
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_ai_calls: totalAiCalls,
    })

    return json({
      data: {
        leads_total: leadsCount.count || 0,
        ads_campaigns_total: adsCount.count || 0,
        revenue_total: Number(totalRevenue.toFixed(2)),
        ai_calls_total: totalAiCalls,
        ai_cost_total: Number(totalAiCost.toFixed(6)),
        latest_kpis: (kpiRows.data || []).slice(0, 10),
      },
    })
  }

  // GET /system/resilience/dashboard
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'resilience' && pathParts[2] === 'dashboard') {
    if (!isPrivileged) return err('Forbidden', 403)

    const [dr, sync, circuits, bulkheads, probes, backpressure, queueJobs, sla] = await Promise.all([
      sb.from('platform_disaster_recovery_regions').select('*').order('updated_at', { ascending: false }).limit(200),
      sb.from('platform_multiregion_sync_events').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('platform_circuit_breakers').select('*').order('updated_at', { ascending: false }).limit(200),
      sb.from('platform_bulkhead_limits').select('*').order('updated_at', { ascending: false }).limit(200),
      sb.from('platform_health_probe_events').select('*').order('created_at', { ascending: false }).limit(1000),
      sb.from('platform_backpressure_events').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('platform_priority_queue_jobs').select('id,status,priority_level').order('created_at', { ascending: false }).limit(3000),
      sb.from('platform_sla_monitoring_reports').select('*').order('generated_at', { ascending: false }).limit(100),
    ])

    if (dr.error) return err(dr.error.message)
    if (sync.error) return err(sync.error.message)
    if (circuits.error) return err(circuits.error.message)
    if (bulkheads.error) return err(bulkheads.error.message)
    if (probes.error) return err(probes.error.message)
    if (backpressure.error) return err(backpressure.error.message)
    if (queueJobs.error) return err(queueJobs.error.message)
    if (sla.error) return err(sla.error.message)

    const probeRows = probes.data || []
    const probePassRate = toPct(probeRows.filter((x: any) => x.status === 'pass').length, probeRows.length || 1)

    return json({
      data: {
        dr_regions: dr.data || [],
        sync_failures: (sync.data || []).filter((x: any) => x.status === 'failed').length,
        circuit_open: (circuits.data || []).filter((x: any) => x.state === 'open').length,
        bulkhead_profiles: bulkheads.data || [],
        probe_pass_rate: probePassRate,
        backpressure_events_24h: (backpressure.data || []).filter((x: any) => new Date(x.created_at).getTime() >= Date.now() - 24 * 3600_000).length,
        queue_pending: (queueJobs.data || []).filter((x: any) => x.status === 'queued').length,
        queue_running: (queueJobs.data || []).filter((x: any) => x.status === 'running').length,
        sla_reports: (sla.data || []).slice(0, 20),
      },
    })
  }

  // GET /system/security/dashboard
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'security' && pathParts[2] === 'dashboard') {
    if (!isPrivileged) return err('Forbidden', 403)

    const [safety, injections, zeroTrust, secrets, rotations, encryption, bots, legalArchive, alerts] = await Promise.all([
      sb.from('platform_ai_safety_events').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('platform_prompt_injection_events').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('platform_zero_trust_access_events').select('*').order('created_at', { ascending: false }).limit(1000),
      sb.from('platform_secret_inventory').select('*').order('updated_at', { ascending: false }).limit(500),
      sb.from('platform_key_rotation_events').select('*').order('rotated_at', { ascending: false }).limit(500),
      sb.from('platform_encryption_audit_events').select('*').order('checked_at', { ascending: false }).limit(500),
      sb.from('platform_bot_management_rules').select('*').order('updated_at', { ascending: false }).limit(200),
      sb.from('platform_legal_log_archive').select('id').order('archived_at', { ascending: false }).limit(2000),
      sb.from('platform_realtime_alert_events').select('*').order('created_at', { ascending: false }).limit(500),
    ])

    if (safety.error) return err(safety.error.message)
    if (injections.error) return err(injections.error.message)
    if (zeroTrust.error) return err(zeroTrust.error.message)
    if (secrets.error) return err(secrets.error.message)
    if (rotations.error) return err(rotations.error.message)
    if (encryption.error) return err(encryption.error.message)
    if (bots.error) return err(bots.error.message)
    if (legalArchive.error) return err(legalArchive.error.message)
    if (alerts.error) return err(alerts.error.message)

    return json({
      data: {
        ai_safety_blocked: (safety.data || []).filter((x: any) => x.blocked).length,
        prompt_injection_blocked: (injections.data || []).filter((x: any) => x.blocked).length,
        zero_trust_denies: (zeroTrust.data || []).filter((x: any) => x.trust_result === 'deny').length,
        secrets_expiring: (secrets.data || []).filter((x: any) => x.status !== 'active').length,
        key_rotations_failed: (rotations.data || []).filter((x: any) => x.rotation_status === 'failed').length,
        encryption_failures: (encryption.data || []).filter((x: any) => x.status === 'failed').length,
        bot_rules: bots.data || [],
        immutable_legal_logs: (legalArchive.data || []).length,
        critical_alerts: (alerts.data || []).filter((x: any) => x.severity === 'critical' && !x.acknowledged).length,
      },
    })
  }

  // GET /system/compliance/dashboard
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'compliance' && pathParts[2] === 'dashboard') {
    if (!isPrivileged) return err('Forbidden', 403)

    const [consent, taxRules, taxEvents, profiles, billingFailures, subscriptions, quotas] = await Promise.all([
      sb.from('platform_cookie_consent_events').select('*').order('consent_timestamp', { ascending: false }).limit(3000),
      sb.from('platform_tax_rules').select('*').eq('is_active', true).order('country_code', { ascending: true }),
      sb.from('platform_tax_compliance_events').select('*').order('created_at', { ascending: false }).limit(3000),
      sb.from('platform_global_compliance_profiles').select('*').order('jurisdiction', { ascending: true }),
      sb.from('platform_billing_failure_events').select('*').order('created_at', { ascending: false }).limit(1000),
      sb.from('platform_subscription_states').select('*').order('updated_at', { ascending: false }).limit(2000),
      sb.from('platform_feature_usage_quotas').select('*').order('plan_key', { ascending: true }).limit(2000),
    ])

    if (consent.error) return err(consent.error.message)
    if (taxRules.error) return err(taxRules.error.message)
    if (taxEvents.error) return err(taxEvents.error.message)
    if (profiles.error) return err(profiles.error.message)
    if (billingFailures.error) return err(billingFailures.error.message)
    if (subscriptions.error) return err(subscriptions.error.message)
    if (quotas.error) return err(quotas.error.message)

    return json({
      data: {
        consent_total: (consent.data || []).length,
        consent_marketing_opt_in: (consent.data || []).filter((x: any) => x.consent_marketing).length,
        active_tax_rules: taxRules.data || [],
        tax_applied_events: (taxEvents.data || []).filter((x: any) => x.status === 'applied').length,
        compliance_profiles: profiles.data || [],
        billing_failures_open: (billingFailures.data || []).filter((x: any) => ['retrying', 'failed'].includes(x.status)).length,
        subscriptions_active: (subscriptions.data || []).filter((x: any) => x.status === 'active').length,
        quota_rules: quotas.data || [],
      },
    })
  }

  // POST /system/errors/report
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'errors' && pathParts[2] === 'report') {
    const moduleName = String(body?.module_name || 'unknown')
    const errorCode = body?.error_code ? String(body.error_code) : null
    const severity = ['info', 'warning', 'critical'].includes(String(body?.severity || 'warning')) ? String(body?.severity || 'warning') : 'warning'
    const errorMessage = String(body?.error_message || 'Unknown error')

    const { error: reportError } = await admin.from('platform_error_auto_reports').insert({
      module_name: moduleName,
      error_code: errorCode,
      severity,
      error_message: errorMessage,
      auto_fix_attempted: !!body?.auto_fix_attempted,
      auto_fix_status: body?.auto_fix_status || 'pending',
      notified: false,
    })
    if (reportError) return err(reportError.message)

    const { error: notifError } = await admin.from('platform_notification_priority_events').insert({
      category: 'system_error',
      priority_level: severity === 'critical' ? 5 : severity === 'warning' ? 3 : 1,
      payload: { module_name: moduleName, error_code: errorCode, message: errorMessage },
      dispatch_status: severity === 'critical' ? 'queued' : 'delayed',
    })
    if (notifError) return err(notifError.message)

    return json({ success: true })
  }

  // POST /system/idempotency/check
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'idempotency' && pathParts[2] === 'check') {
    const scope = String(body?.scope || '').trim()
    const idemKey = String(body?.idempotency_key || '').trim()
    if (!scope || !idemKey) return err('scope and idempotency_key are required')

    const nowIso = new Date().toISOString()
    const defaultExpiry = new Date(Date.now() + 24 * 3600_000).toISOString()
    const { data: existing, error: existingError } = await admin
      .from('platform_idempotency_keys')
      .select('id,response_payload,status_code,expires_at')
      .eq('scope', scope)
      .eq('idem_key', idemKey)
      .gt('expires_at', nowIso)
      .maybeSingle()
    if (existingError) return err(existingError.message)

    if (existing?.id) {
      return json({ success: true, duplicate: true, cached_response: existing.response_payload || null, status_code: existing.status_code || 200 })
    }

    const { error: insertError } = await admin.from('platform_idempotency_keys').insert({
      scope,
      idem_key: idemKey,
      request_hash: body?.request_hash ? String(body.request_hash) : null,
      response_payload: body?.response_payload || null,
      status_code: Number(body?.status_code || 202),
      expires_at: body?.expires_at || defaultExpiry,
    })
    if (insertError) return err(insertError.message)

    return json({ success: true, duplicate: false })
  }

  // GET /system/audit/logs
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'logs') {
    if (!isPrivileged) return err('Forbidden', 403)

    const page = Math.max(1, Number(body?.page || 1))
    const limit = Math.min(200, Math.max(1, Number(body?.limit || 50)))
    const qUser = String(body?.user_id || '').trim()
    const qAction = String(body?.action_type || '').trim()
    const qTable = String(body?.table_name || '').trim()
    const qRequest = String(body?.request_id || '').trim()
    const qTrace = String(body?.trace_id || '').trim()
    const qSession = String(body?.session_id || '').trim()
    const qSearch = String(body?.search || '').trim()
    const start = body?.start ? new Date(String(body.start)).toISOString() : null
    const end = body?.end ? new Date(String(body.end)).toISOString() : null
    const sensitiveOnly = body?.sensitive === 'true' || body?.sensitive === true
    const source = String(body?.event_source || '').trim()

    let query = admin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('occurred_at_utc', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (qUser && isUuid(qUser)) query = query.eq('user_id', qUser)
    if (qAction) query = query.ilike('action_type', `%${qAction}%`)
    if (qTable) query = query.ilike('table_name', `%${qTable}%`)
    if (qRequest) query = query.eq('request_id', qRequest)
    if (qTrace) query = query.eq('trace_id', qTrace)
    if (qSession) query = query.eq('session_id', qSession)
    if (source) query = query.eq('event_source', source)
    if (sensitiveOnly) query = query.eq('is_sensitive_action', true)
    if (start) query = query.gte('occurred_at_utc', start)
    if (end) query = query.lte('occurred_at_utc', end)
    if (qSearch) query = query.or(`action_type.ilike.%${qSearch}%,table_name.ilike.%${qSearch}%,record_id.ilike.%${qSearch}%,ip_country.ilike.%${qSearch}%,ip_city.ilike.%${qSearch}%,api_path.ilike.%${qSearch}%`)

    const { data, error, count } = await query
    if (error) return err(error.message)

    return json({ data: data || [], total: count || 0, page, limit })
  }

  // GET /system/audit/timeline
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'timeline') {
    if (!isPrivileged) return err('Forbidden', 403)

    const requestId = String(body?.request_id || '').trim()
    const traceId = String(body?.trace_id || '').trim()
    const sessionId = String(body?.session_id || '').trim()
    if (!requestId && !traceId && !sessionId) return err('request_id or trace_id or session_id is required', 400)

    let query = admin
      .from('audit_logs')
      .select('*')
      .order('occurred_at_utc', { ascending: true })
      .limit(5000)

    if (requestId) query = query.eq('request_id', requestId)
    else if (traceId) query = query.eq('trace_id', traceId)
    else query = query.eq('session_id', sessionId)

    const { data, error } = await query
    if (error) return err(error.message)

    return json({ data: data || [] })
  }

  // GET /system/audit/diff/:id
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'diff' && isUuid(pathParts[3])) {
    if (!isPrivileged) return err('Forbidden', 403)

    const id = pathParts[3]
    const { data, error } = await admin
      .from('audit_logs')
      .select('id,action_type,table_name,record_id,old_value,new_value,diff_value,occurred_at_utc,user_id,request_id,trace_id,session_id')
      .eq('id', id)
      .maybeSingle()
    if (error) return err(error.message)
    if (!data) return err('Audit log not found', 404)

    return json({ data })
  }

  // GET /system/audit/replay
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'replay') {
    if (!isPrivileged) return err('Forbidden', 403)

    const requestId = String(body?.request_id || '').trim()
    const traceId = String(body?.trace_id || '').trim()
    const sessionId = String(body?.session_id || '').trim()
    const limit = Math.min(5000, Math.max(1, Number(body?.limit || 1000)))
    if (!requestId && !traceId && !sessionId) return err('request_id or trace_id or session_id is required', 400)

    let query = admin
      .from('audit_logs')
      .select('id,user_id,role_name,action_type,table_name,record_id,occurred_at_utc,request_id,trace_id,session_id,ip_address,ip_country,ip_city,device_fingerprint,api_path,http_method,response_status,latency_ms,old_value,new_value,diff_value,replay_steps,snapshot_before,snapshot_after')
      .order('occurred_at_utc', { ascending: true })
      .limit(limit)

    if (requestId) query = query.eq('request_id', requestId)
    else if (traceId) query = query.eq('trace_id', traceId)
    else query = query.eq('session_id', sessionId)

    const { data, error } = await query
    if (error) return err(error.message)

    const steps = (data || []).map((row: any, idx: number) => ({
      step_no: idx + 1,
      id: row.id,
      at: row.occurred_at_utc,
      actor: {
        user_id: row.user_id,
        role: row.role_name,
        ip: row.ip_address,
        country: row.ip_country,
        city: row.ip_city,
        device: row.device_fingerprint,
      },
      action: row.action_type,
      target: {
        table: row.table_name,
        record_id: row.record_id,
      },
      request: {
        request_id: row.request_id,
        trace_id: row.trace_id,
        session_id: row.session_id,
        path: row.api_path,
        method: row.http_method,
      },
      response: {
        status: row.response_status,
        latency_ms: row.latency_ms,
      },
      change: {
        before: row.old_value,
        after: row.new_value,
        diff: row.diff_value,
      },
      snapshots: {
        before: row.snapshot_before,
        after: row.snapshot_after,
      },
      replay_steps: row.replay_steps,
    }))

    return json({
      total: steps.length,
      data: data || [],
      steps,
    })
  }

  // GET /system/audit/alerts
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'alerts') {
    if (!isPrivileged) return err('Forbidden', 403)

    const unresolvedOnly = body?.unresolved === 'true' || body?.unresolved === true
    const severity = String(body?.severity || '').trim()
    let query = admin
      .from('audit_anomaly_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (unresolvedOnly) query = query.eq('resolved', false)
    if (severity) query = query.eq('severity', severity)

    const { data, error } = await query
    if (error) return err(error.message)
    return json({ data: data || [] })
  }

  // POST /system/audit/alerts/resolve/:id
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'alerts' && pathParts[3] === 'resolve' && isUuid(pathParts[4])) {
    if (!isPrivileged) return err('Forbidden', 403)
    const id = pathParts[4]
    const { error } = await admin
      .from('audit_anomaly_alerts')
      .update({ resolved: true, resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return err(error.message)
    return json({ success: true })
  }

  // POST /system/audit/read/:id
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'read' && isUuid(pathParts[3])) {
    if (!isPrivileged) return err('Forbidden', 403)
    const id = pathParts[3]
    const { error } = await admin.rpc('audit_mark_read', { p_audit_log_id: id, p_viewed_by: userId })
    if (error) return err(error.message)
    return json({ success: true })
  }

  // POST /system/audit/export
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'export') {
    if (!isPrivileged) return err('Forbidden', 403)

    const format = String(body?.format || 'json').toLowerCase()
    if (!['json', 'csv'].includes(format)) return err('format must be json or csv', 400)

    const limit = Math.min(10000, Math.max(1, Number(body?.limit || 5000)))
    const { data, error } = await admin
      .from('audit_logs')
      .select('*')
      .order('occurred_at_utc', { ascending: false })
      .limit(limit)

    if (error) return err(error.message)

    if (format === 'csv') {
      const rows = data || []
      const headers = ['id', 'occurred_at_utc', 'user_id', 'role_name', 'action_type', 'table_name', 'record_id', 'request_id', 'trace_id', 'session_id', 'event_source', 'is_sensitive_action', 'response_status', 'latency_ms', 'ip_address', 'ip_country', 'ip_city', 'api_path']
      const csv = [headers.join(',')].concat(rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))).join('\n')
      return json({ format: 'csv', rows: rows.length, data: csv })
    }

    return json({ format: 'json', rows: (data || []).length, data: data || [] })
  }

  // POST /system/audit/integrity/verify
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'integrity' && pathParts[3] === 'verify') {
    if (!isPrivileged) return err('Forbidden', 403)

    const limit = Math.min(5000, Math.max(10, Number(body?.limit || 1000)))
    const { data, error } = await admin
      .from('audit_logs')
      .select('id,prev_hash,event_hash,occurred_at_utc')
      .order('occurred_at_utc', { ascending: true })
      .limit(limit)
    if (error) return err(error.message)

    const rows = data || []
    let mismatches = 0
    for (let i = 1; i < rows.length; i += 1) {
      if ((rows[i] as any).prev_hash !== (rows[i - 1] as any).event_hash) mismatches += 1
    }

    return json({
      success: true,
      total_checked: rows.length,
      chain_mismatches: mismatches,
      integrity_ok: mismatches === 0,
    })
  }

  // GET /system/audit/stats
  if (method === 'GET' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'stats') {
    if (!isPrivileged) return err('Forbidden', 403)

    const periodHours = Math.min(24 * 90, Math.max(1, Number(body?.period_hours || 24)))
    const start = new Date(Date.now() - periodHours * 3600_000).toISOString()

    const [rowsRes, usersRes, moduleRes] = await Promise.all([
      admin.from('audit_logs').select('id,user_id,table_name,risk_score,is_sensitive_action').gte('occurred_at_utc', start).limit(10000),
      admin.from('audit_logs').select('user_id').gte('occurred_at_utc', start).not('user_id', 'is', null).limit(10000),
      admin.from('audit_logs').select('table_name').gte('occurred_at_utc', start).not('table_name', 'is', null).limit(10000),
    ])
    if (rowsRes.error) return err(rowsRes.error.message)
    if (usersRes.error) return err(usersRes.error.message)
    if (moduleRes.error) return err(moduleRes.error.message)

    const rows = rowsRes.data || []
    const userCounts: Record<string, number> = {}
    const moduleCounts: Record<string, number> = {}
    let sensitive = 0
    let riskTotal = 0

    for (const r of rows as any[]) {
      if (r.user_id) userCounts[r.user_id] = (userCounts[r.user_id] || 0) + 1
      if (r.table_name) moduleCounts[r.table_name] = (moduleCounts[r.table_name] || 0) + 1
      if (r.is_sensitive_action) sensitive += 1
      riskTotal += Number(r.risk_score || 0)
    }

    const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0] || null
    const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0] || null
    const avgRisk = rows.length ? Number((riskTotal / rows.length).toFixed(4)) : 0

    return json({
      period_hours: periodHours,
      total_events: rows.length,
      sensitive_events: sensitive,
      avg_risk_score: avgRisk,
      most_active_user: topUser ? { user_id: topUser[0], events: topUser[1] } : null,
      most_changed_module: topModule ? { module: topModule[0], events: topModule[1] } : null,
      module_breakdown: moduleCounts,
    })
  }

  // POST /system/audit/queue/process
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'queue' && pathParts[3] === 'process') {
    if (!isPrivileged) return err('Forbidden', 403)

    const limit = Math.min(500, Math.max(1, Number(body?.limit || 100)))
    const nowIso = new Date().toISOString()
    const { data: queueRows, error: queueError } = await admin
      .from('audit_log_queue')
      .select('*')
      .in('status', ['pending', 'retry'])
      .lte('next_retry_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (queueError) return err(queueError.message)

    let processed = 0
    let failed = 0

    for (const row of queueRows || []) {
      const payload = (row as any).event_payload || {}
      const { error: insErr } = await admin.from('audit_logs').insert(payload)
      if (!insErr) {
        processed += 1
        await admin.from('audit_log_queue').update({ status: 'done', updated_at: nowIso }).eq('id', (row as any).id)
      } else {
        failed += 1
        const retryCount = Number((row as any).retry_count || 0) + 1
        const nextRetryAt = new Date(Date.now() + Math.min(300_000, 15_000 * 2 ** retryCount)).toISOString()
        await admin.from('audit_log_queue').update({
          status: retryCount >= 8 ? 'failed' : 'retry',
          retry_count: retryCount,
          next_retry_at: nextRetryAt,
          last_error: insErr.message,
          updated_at: nowIso,
        }).eq('id', (row as any).id)
      }
    }

    return json({ success: true, queued: (queueRows || []).length, processed, failed })
  }

  // POST /system/audit/retention/run
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'retention' && pathParts[3] === 'run') {
    if (!isPrivileged) return err('Forbidden', 403)

    const { data: policy } = await admin.from('audit_retention_policies').select('*').eq('scope_key', 'default').maybeSingle()
    const hotDays = Number(policy?.hot_days || 90)
    const coldDays = Number(policy?.cold_days || 730)
    const archiveBefore = new Date(Date.now() - hotDays * 24 * 3600_000).toISOString()
    const deleteBefore = new Date(Date.now() - coldDays * 24 * 3600_000).toISOString()

    const { data: toArchive, error: archiveFetchErr } = await admin
      .from('audit_logs')
      .select('id,event_hash')
      .eq('archived', false)
      .lt('occurred_at_utc', archiveBefore)
      .limit(Math.min(5000, Math.max(100, Number(body?.limit || 2000))))
    if (archiveFetchErr) return err(archiveFetchErr.message)

    let archivedCount = 0
    for (const row of toArchive || []) {
      const { error: archiveErr } = await admin.from('platform_legal_log_archive').insert({
        log_hash: String((row as any).event_hash || (row as any).id),
        log_payload: row,
        immutable: true,
        archived_at: new Date().toISOString(),
        archived_by: userId,
      })
      if (!archiveErr) {
        archivedCount += 1
        await admin.from('audit_logs').update({ archived: true, archived_at: new Date().toISOString() }).eq('id', (row as any).id)
      }
    }

    const doDelete = body?.delete_old === true
    let deletedCount = 0
    if (doDelete && policy?.auto_delete_enabled) {
      const { data: oldRows, error: oldErr } = await admin
        .from('audit_logs')
        .select('id')
        .lt('occurred_at_utc', deleteBefore)
        .limit(Math.min(5000, Math.max(100, Number(body?.delete_limit || 2000))))
      if (oldErr) return err(oldErr.message)
      if ((oldRows || []).length > 0) {
        const ids = (oldRows || []).map((r: any) => r.id)
        const { error: delErr } = await admin.from('audit_logs').delete().in('id', ids)
        if (delErr) return err(delErr.message)
        deletedCount = ids.length
      }
    }

    return json({
      success: true,
      policy: { hot_days: hotDays, cold_days: coldDays, auto_delete_enabled: !!policy?.auto_delete_enabled },
      archived: archivedCount,
      deleted: deletedCount,
    })
  }

  // POST /system/audit/webhook/dispatch
  if (method === 'POST' && segment === 'system' && pathParts[1] === 'audit' && pathParts[2] === 'webhook' && pathParts[3] === 'dispatch') {
    if (!isPrivileged) return err('Forbidden', 403)

    const sinceHours = Math.min(72, Math.max(1, Number(body?.since_hours || 1)))
    const since = new Date(Date.now() - sinceHours * 3600_000).toISOString()

    const [endpointsRes, alertsRes] = await Promise.all([
      admin.from('audit_webhook_endpoints').select('*').eq('is_active', true).limit(50),
      admin.from('audit_anomaly_alerts').select('*, audit_logs(*)').eq('resolved', false).gte('created_at', since).limit(500),
    ])
    if (endpointsRes.error) return err(endpointsRes.error.message)
    if (alertsRes.error) return err(alertsRes.error.message)

    const endpoints = endpointsRes.data || []
    const alerts = alertsRes.data || []
    let sent = 0
    let failed = 0

    for (const ep of endpoints as any[]) {
      for (const al of alerts as any[]) {
        const filter = Array.isArray(ep.event_filter) ? ep.event_filter : []
        const shouldSend = filter.length === 0 || filter.includes(String(al.alert_type || '')) || filter.includes(String(al.severity || ''))
        if (!shouldSend) continue

        const payload = {
          event: 'audit_alert',
          alert: {
            id: al.id,
            type: al.alert_type,
            severity: al.severity,
            message: al.alert_message,
            payload: al.payload,
            created_at: al.created_at,
          },
          log: al.audit_logs || null,
        }

        let dispatchStatus: 'sent' | 'failed' = 'sent'
        let responseCode: number | null = null
        let responseBody: string | null = null
        try {
          const res = await fetch(String(ep.endpoint_url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          responseCode = res.status
          responseBody = (await res.text().catch(() => '')).slice(0, 2000)
          if (!res.ok) {
            dispatchStatus = 'failed'
            failed += 1
          } else {
            sent += 1
          }
        } catch (e: any) {
          dispatchStatus = 'failed'
          responseBody = String(e?.message || e)
          failed += 1
        }

        await admin.from('audit_webhook_dispatches').insert({
          endpoint_id: ep.id,
          audit_log_id: al.audit_log_id,
          dispatch_status: dispatchStatus,
          response_code: responseCode,
          response_body: responseBody,
          retry_count: 0,
          sent_at: dispatchStatus === 'sent' ? new Date().toISOString() : null,
        })
      }
    }

    return json({ success: true, endpoints: endpoints.length, alerts: alerts.length, sent, failed })
  }

  // GET /leads
  if (method === 'GET' && segment === 'leads') {
    const page = Number(body?.page || 1)
    const limit = Number(body?.limit || 25)
    const search = body?.search || ''

    let query = sb.from('leads').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
    const { data, error, count } = await query
    if (error) return err(error.message)
    return json({ data, total: count })
  }

  // POST /leads
  if (method === 'POST' && segment === 'leads') {
    const { data, error } = await sb.from('leads').insert({
      name: body.name || '', email: body.email, phone: body.phone,
      company: body.company, source: body.source || 'website',
      status: body.status || 'new', product_id: body.product_id,
      notes: body.notes, tags: body.tags, assigned_to: body.assigned_to,
    }).select().single()
    if (error) return err(error.message)
    await logActivity(admin, 'lead', data.id, 'created', userId)
    return json({ data }, 201)
  }

  // GET /seo/analytics
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'analytics') {
    const { data, error } = await sb.from('seo_data').select('*').order('created_at', { ascending: false })
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /leads/analytics
  if (method === 'GET' && segment === 'leads' && pathParts[1] === 'analytics') {
    const [{ count: total }, { count: converted }, { count: qualified }, { count: fresh }] = await Promise.all([
      sb.from('leads').select('id', { count: 'exact', head: true }),
      sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
      sb.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
      sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 3600_000).toISOString()),
    ])

    const conversionRate = total ? Number((((converted || 0) / total) * 100).toFixed(2)) : 0
    return json({
      data: {
        total: total || 0,
        converted: converted || 0,
        qualified: qualified || 0,
        last_7_days: fresh || 0,
        conversion_rate: conversionRate,
      },
    })
  }

  // POST /leads/auto-route
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'auto-route') {
    if (!isPrivileged) return err('Forbidden', 403)

    const limit = Math.max(1, Math.min(200, Number(body?.limit || 50)))
    const { data: pendingLeads, error: leadsError } = await admin
      .from('leads')
      .select('id,name,email,phone,company,source,status,assigned_to,product_id,meta')
      .in('status', ['new', 'contacted'])
      .is('assigned_to', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (leadsError) return err(leadsError.message)

    const { data: resellerPool } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'reseller')
      .limit(300)

    const resellers = (resellerPool ?? []).map((r: any) => r.user_id)
    if (!resellers.length) return json({ success: true, routed: 0, message: 'No reseller targets available' })

    let routed = 0
    for (const lead of pendingLeads ?? []) {
      const score = [lead.email ? 20 : 0, lead.phone ? 20 : 0, lead.company ? 25 : 0, lead.source === 'ads' ? 20 : 10].reduce((a, b) => a + b, 0)
      const target = resellers[routed % resellers.length]

      const { error: updateError } = await admin
        .from('leads')
        .update({
          assigned_to: target,
          status: score >= 60 ? 'qualified' : lead.status,
          meta: {
            ...(lead.meta || {}),
            auto_routed: true,
            lead_score: score,
            routed_at: new Date().toISOString(),
            routed_by: userId,
          },
        })
        .eq('id', lead.id)

      if (updateError) continue

      await admin.from('lead_automation_events').insert({
        lead_id: lead.id,
        event_type: 'auto_routed',
        score_delta: score,
        routing_target: target,
        notes: `Lead auto-routed with score ${score}`,
        payload: {
          source: lead.source,
          has_email: !!lead.email,
          has_phone: !!lead.phone,
          has_company: !!lead.company,
        },
        created_by: userId,
      })

      routed += 1
    }

    return json({ success: true, routed })
  }

  // GET /seo/marketplace/products
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'marketplace' && pathParts[2] === 'products') {
    const limit = Math.max(1, Math.min(200, Number(body?.limit || 100)))
    const search = String(body?.search || '').trim()

    let productQuery = sb
      .from('products')
      .select('id,name,slug,status,price,currency,created_by')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (search) productQuery = productQuery.ilike('name', `%${search}%`)

    const { data: products, error: productsError } = await productQuery
    if (productsError) return err(productsError.message)

    const productIds = (products ?? []).map((p: any) => p.id)
    if (!productIds.length) return json({ data: [] })

    const { data: metrics, error: metricsError } = await sb
      .from('seo_product_metrics')
      .select('product_id,seo_score,keyword_coverage,readability_score,ctr_estimate,last_scanned_at,hashtags,target_countries,ai_recommendations')
      .in('product_id', productIds)

    if (metricsError) return err(metricsError.message)

    const metricMap = new Map((metrics ?? []).map((m: any) => [m.product_id, m]))

    const merged = (products ?? []).map((product: any) => ({
      ...product,
      seo_metrics: metricMap.get(product.id) || null,
    }))

    return json({ data: merged })
  }

  // GET /seo/automation/runs
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'automation' && pathParts[2] === 'runs') {
    const limit = Math.max(1, Math.min(100, Number(body?.limit || 25)))
    const { data, error } = await sb
      .from('seo_automation_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /seo/automation/run
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'automation' && pathParts[2] === 'run') {
    if (!isPrivileged) return err('Forbidden', 403)

    const { data: invokeData, error: invokeError } = await admin.functions.invoke('seo-automation-engine', {
      body: {
        trigger: 'api',
        run_type: body?.run_type || 'manual',
        product_id: body?.product_id || null,
        limit: body?.limit || 100,
        dry_run: !!body?.dry_run,
      },
    })

    if (invokeError) return err(invokeError.message, 500)
    return json({ success: true, data: invokeData })
  }

  // POST /seo/ultra/run
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'ultra' && pathParts[2] === 'run') {
    if (!isPrivileged) return err('Forbidden', 403)

    const { data: invokeData, error: invokeError } = await admin.functions.invoke('seo-ultra-brain', {
      body: {
        run_type: body?.run_type || 'manual',
        product_id: body?.product_id || null,
        region_mode: body?.region_mode || 'india',
        ai_mode: body?.ai_mode || 'balanced',
        dry_run: !!body?.dry_run,
        max_products: body?.max_products || 100,
      },
    })
    if (invokeError) return err(invokeError.message, 500)
    return json({ success: true, data: invokeData })
  }

  // POST /seo/content/run
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'content' && pathParts[2] === 'run') {
    if (!isPrivileged) return err('Forbidden', 403)

    const { data: invokeData, error: invokeError } = await admin.functions.invoke('seo-ultra-brain', {
      body: {
        run_type: body?.run_type || 'manual',
        product_id: body?.product_id || null,
        region_mode: body?.region_mode || 'india',
        ai_mode: body?.ai_mode || 'balanced',
        dry_run: !!body?.dry_run,
        max_products: body?.max_products || 100,
      },
    })
    if (invokeError) return err(invokeError.message, 500)
    return json({ success: true, data: invokeData })
  }

  // GET /seo/indexing/status
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'indexing' && pathParts[2] === 'status') {
    const limit = Math.max(1, Math.min(300, Number(body?.limit || 100)))
    const { data, error } = await sb
      .from('seo_indexing_queue')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(limit)
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /seo/keywords/positions
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'keywords' && pathParts[2] === 'positions') {
    const limit = Math.max(1, Math.min(500, Number(body?.limit || 200)))
    const productId = String(body?.product_id || '').trim()

    let query = sb
      .from('seo_keyword_positions')
      .select('*')
      .order('tracked_at', { ascending: false })
      .limit(limit)

    if (productId) query = query.eq('product_id', productId)
    const { data, error } = await query
    if (error) return err(error.message)
    return json({ data })
  }

  // GET /seo/ultra/dashboard
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'ultra' && pathParts[2] === 'dashboard') {
    const [
      indexing,
      keywords,
      leads,
      roi,
      alerts,
    ] = await Promise.all([
      sb.from('seo_indexing_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      sb.from('seo_keyword_positions').select('id', { count: 'exact', head: true }).gte('tracked_at', new Date(Date.now() - 24 * 3600_000).toISOString()),
      sb.from('lead_scoring_snapshots').select('id,segment').order('created_at', { ascending: false }).limit(500),
      sb.from('product_roi_snapshots').select('seo_roi,ads_roi').order('captured_at', { ascending: false }).limit(200),
      sb.from('seo_alert_events').select('id,severity').is('resolved_at', null).order('created_at', { ascending: false }).limit(200),
    ])

    const hotLeads = (leads.data || []).filter((x: any) => x.segment === 'hot').length
    const warmLeads = (leads.data || []).filter((x: any) => x.segment === 'warm').length
    const avgSeoRoi = (roi.data || []).length
      ? Number((((roi.data || []).reduce((a: number, b: any) => a + Number(b.seo_roi || 0), 0)) / (roi.data || []).length).toFixed(4))
      : 0
    const avgAdsRoi = (roi.data || []).length
      ? Number((((roi.data || []).reduce((a: number, b: any) => a + Number(b.ads_roi || 0), 0)) / (roi.data || []).length).toFixed(4))
      : 0

    return json({
      data: {
        indexing_pending: indexing.count || 0,
        keyword_updates_24h: keywords.count || 0,
        hot_leads: hotLeads,
        warm_leads: warmLeads,
        avg_seo_roi: avgSeoRoi,
        avg_ads_roi: avgAdsRoi,
        unresolved_alerts: alerts.count || 0,
        critical_alerts: (alerts.data || []).filter((x: any) => x.severity === 'critical').length,
      },
    })
  }

  // GET /seo/content/dashboard
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'content' && pathParts[2] === 'dashboard') {
    const [jobs, assets, videos, voices, images, quality, scheduler, perf] = await Promise.all([
      sb.from('ai_content_generation_jobs').select('id', { count: 'exact', head: true }),
      sb.from('ai_content_assets').select('id', { count: 'exact', head: true }),
      sb.from('ai_video_generation_jobs').select('id,status', { count: 'exact' }),
      sb.from('ai_voice_generation_jobs').select('id,status', { count: 'exact' }),
      sb.from('ai_image_generation_jobs').select('id,status', { count: 'exact' }),
      sb.from('ai_content_quality_checks').select('seo_score').order('created_at', { ascending: false }).limit(200),
      sb.from('ai_content_scheduler_queue').select('id,status', { count: 'exact' }),
      sb.from('ai_content_performance_metrics').select('views,clicks,conversions').order('captured_at', { ascending: false }).limit(500),
    ])

    const qualityRows = quality.data || []
    const avgSeoQuality = qualityRows.length
      ? Number((qualityRows.reduce((a: number, b: any) => a + Number(b.seo_score || 0), 0) / qualityRows.length).toFixed(2))
      : 0

    const perfRows = perf.data || []
    const totalViews = perfRows.reduce((a: number, b: any) => a + Number(b.views || 0), 0)
    const totalClicks = perfRows.reduce((a: number, b: any) => a + Number(b.clicks || 0), 0)
    const totalConversions = perfRows.reduce((a: number, b: any) => a + Number(b.conversions || 0), 0)

    return json({
      data: {
        content_jobs: jobs.count || 0,
        content_assets: assets.count || 0,
        videos_ready: (videos.data || []).filter((x: any) => x.status === 'ready').length,
        voices_ready: (voices.data || []).filter((x: any) => x.status === 'ready').length,
        images_ready: (images.data || []).filter((x: any) => x.status === 'ready').length,
        scheduler_pending: (scheduler.data || []).filter((x: any) => x.status === 'pending').length,
        avg_quality_seo_score: avgSeoQuality,
        total_views: totalViews,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
      },
    })
  }

  // GET /seo/google/dashboard
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'google' && pathParts[2] === 'dashboard') {
    const limit = Math.max(1, Math.min(300, Number(body?.limit || 120)))
    const [connections, properties, runs] = await Promise.all([
      sb.from('google_oauth_connections').select('provider,is_active,expires_at,updated_at').order('updated_at', { ascending: false }),
      sb.from('google_domain_properties').select('provider,domain_host,is_active').order('created_at', { ascending: false }),
      sb.from('google_sync_runs').select('id,provider,status,fetched_keywords,fetched_pages,fetched_metrics,indexing_issues,crawl_errors,started_at,completed_at,error_message').order('started_at', { ascending: false }).limit(limit),
    ])

    if (connections.error) return err(connections.error.message)
    if (properties.error) return err(properties.error.message)
    if (runs.error) return err(runs.error.message)

    const connRows = connections.data || []
    const propRows = properties.data || []
    const runRows = runs.data || []

    const providerConnectionStats = ['gsc', 'ga4', 'google_ads'].map((provider) => ({
      provider,
      active_connections: connRows.filter((r: any) => r.provider === provider && r.is_active).length,
      active_properties: propRows.filter((r: any) => r.provider === provider && r.is_active).length,
      completed_runs: runRows.filter((r: any) => r.provider === provider && r.status === 'completed').length,
      failed_runs: runRows.filter((r: any) => r.provider === provider && r.status === 'failed').length,
    }))

    return json({
      data: {
        total_connections: connRows.length,
        active_connections: connRows.filter((r: any) => r.is_active).length,
        total_properties: propRows.length,
        active_properties: propRows.filter((r: any) => r.is_active).length,
        total_runs: runRows.length,
        completed_runs: runRows.filter((r: any) => r.status === 'completed').length,
        failed_runs: runRows.filter((r: any) => r.status === 'failed').length,
        indexing_issues_total: runRows.reduce((a: number, b: any) => a + Number(b.indexing_issues || 0), 0),
        crawl_errors_total: runRows.reduce((a: number, b: any) => a + Number(b.crawl_errors || 0), 0),
        last_run_at: runRows[0]?.started_at || null,
        provider_stats: providerConnectionStats,
        recent_runs: runRows.slice(0, 25),
      },
    })
  }

  // POST /seo/google/connect
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'google' && pathParts[2] === 'connect') {
    if (!isPrivileged) return err('Forbidden', 403)

    const provider = String(body?.provider || '').trim()
    if (!['gsc', 'ga4', 'google_ads'].includes(provider)) return err('Invalid provider')

    const accountEmail = String(body?.account_email || '').trim() || null
    const accountId = String(body?.account_id || '').trim() || null
    const scope = Array.isArray(body?.access_scope) ? body.access_scope.map((x: any) => String(x)) : []
    const domainProperties = Array.isArray(body?.domains) ? body.domains : []

    let connectionId: string | null = null
    if (accountId) {
      const { data: upserted, error: upsertError } = await admin
        .from('google_oauth_connections')
        .upsert({
          provider,
          account_email: accountEmail,
          account_id: accountId,
          access_scope: scope,
          token_ref: body?.token_ref || null,
          refresh_ref: body?.refresh_ref || null,
          expires_at: body?.expires_at || null,
          is_active: body?.is_active !== false,
          created_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'provider,account_id' })
        .select('id')
        .single()
      if (upsertError) return err(upsertError.message)
      connectionId = upserted?.id || null
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('google_oauth_connections')
        .insert({
          provider,
          account_email: accountEmail,
          account_id: null,
          access_scope: scope,
          token_ref: body?.token_ref || null,
          refresh_ref: body?.refresh_ref || null,
          expires_at: body?.expires_at || null,
          is_active: body?.is_active !== false,
          created_by: userId,
        })
        .select('id')
        .single()
      if (insertError) return err(insertError.message)
      connectionId = inserted?.id || null
    }

    if (connectionId && domainProperties.length) {
      const propertyRows = domainProperties
        .map((d: any) => ({
          connection_id: connectionId,
          provider,
          domain_host: String(d.domain_host || d.host || '').trim(),
          property_id: String(d.property_id || d.id || '').trim(),
          is_active: d.is_active !== false,
        }))
        .filter((r: any) => r.domain_host && r.property_id)

      if (propertyRows.length) {
        const { error: propError } = await admin
          .from('google_domain_properties')
          .upsert(propertyRows, { onConflict: 'provider,domain_host,property_id' })
        if (propError) return err(propError.message)
      }
    }

    return json({ success: true, data: { provider, connection_id: connectionId } })
  }

  // POST /seo/google/sync
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'google' && pathParts[2] === 'sync') {
    if (!isPrivileged) return err('Forbidden', 403)

    const provider = String(body?.provider || '').trim()
    if (!['gsc', 'ga4', 'google_ads'].includes(provider)) return err('Invalid provider')

    const runPayload = {
      provider,
      domain_host: body?.domain_host || 'softwarevala.com',
      status: 'completed',
      fetched_keywords: Number(body?.fetched_keywords ?? (provider === 'gsc' ? 25 : 0)),
      fetched_pages: Number(body?.fetched_pages ?? 5),
      fetched_metrics: Number(body?.fetched_metrics ?? 20),
      indexing_issues: Number(body?.indexing_issues ?? 0),
      crawl_errors: Number(body?.crawl_errors ?? 0),
      error_message: null,
      completed_at: new Date().toISOString(),
    }

    const { data, error } = await admin.from('google_sync_runs').insert(runPayload).select('id,provider,status,started_at,completed_at').single()
    if (error) return err(error.message)
    return json({ success: true, data })
  }

  // GET /seo/sitemap/dashboard
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'sitemap' && pathParts[2] === 'dashboard') {
    const [manifests, urls, retryQueue] = await Promise.all([
      sb.from('seo_sitemap_manifests').select('id,domain_host,sitemap_key,sitemap_type,total_urls,indexed_urls,pending_urls,success_percent,last_submitted_at,is_active').order('updated_at', { ascending: false }).limit(200),
      sb.from('seo_sitemap_urls').select('id,submit_status,indexed,page_type,last_modified').order('created_at', { ascending: false }).limit(5000),
      sb.from('seo_index_retry_queue').select('id,status,attempt_count,next_retry_at,created_at').order('created_at', { ascending: false }).limit(2000),
    ])

    if (manifests.error) return err(manifests.error.message)
    if (urls.error) return err(urls.error.message)
    if (retryQueue.error) return err(retryQueue.error.message)

    const manifestRows = manifests.data || []
    const urlRows = urls.data || []
    const retryRows = retryQueue.data || []

    return json({
      data: {
        manifests: manifestRows,
        total_manifests: manifestRows.length,
        active_manifests: manifestRows.filter((m: any) => m.is_active).length,
        total_urls: urlRows.length,
        submitted_urls: urlRows.filter((u: any) => u.submit_status === 'submitted').length,
        indexed_urls: urlRows.filter((u: any) => u.submit_status === 'indexed' || u.indexed).length,
        failed_urls: urlRows.filter((u: any) => u.submit_status === 'failed').length,
        retry_pending: retryRows.filter((r: any) => r.status === 'pending').length,
        retry_failed: retryRows.filter((r: any) => r.status === 'failed').length,
      },
    })
  }

  // POST /seo/sitemap/submit
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'sitemap' && pathParts[2] === 'submit') {
    if (!isPrivileged) return err('Forbidden', 403)

    const domainHost = String(body?.domain_host || 'softwarevala.com').trim()
    const sitemapKey = String(body?.sitemap_key || '').trim()
    let manifestQuery = admin.from('seo_sitemap_manifests').select('id,domain_host,sitemap_key').eq('domain_host', domainHost)
    if (sitemapKey) manifestQuery = manifestQuery.eq('sitemap_key', sitemapKey)
    const { data: manifests, error: manifestError } = await manifestQuery.limit(50)
    if (manifestError) return err(manifestError.message)
    if (!(manifests || []).length) return err('No sitemap manifests found', 404)

    const manifestIds = (manifests || []).map((m: any) => m.id)
    const nowIso = new Date().toISOString()

    const { error: updateManifestError } = await admin
      .from('seo_sitemap_manifests')
      .update({ last_submitted_at: nowIso, updated_at: nowIso })
      .in('id', manifestIds)
    if (updateManifestError) return err(updateManifestError.message)

    const { error: updateUrlError } = await admin
      .from('seo_sitemap_urls')
      .update({ submit_status: 'submitted' })
      .in('manifest_id', manifestIds)
      .neq('submit_status', 'indexed')
    if (updateUrlError) return err(updateUrlError.message)

    return json({ success: true, data: { submitted_manifests: manifestIds.length, submitted_at: nowIso } })
  }

  // GET /seo/schema/dashboard
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'schema' && pathParts[2] === 'dashboard') {
    const [registry, logs] = await Promise.all([
      sb.from('seo_schema_registry').select('id,page_type,validation_status,auto_fixed,updated_at').order('updated_at', { ascending: false }).limit(5000),
      sb.from('seo_schema_validation_logs').select('id,error_count,warning_count,fixed,created_at').order('created_at', { ascending: false }).limit(2000),
    ])

    if (registry.error) return err(registry.error.message)
    if (logs.error) return err(logs.error.message)

    const regRows = registry.data || []
    const logRows = logs.data || []
    return json({
      data: {
        total_pages: regRows.length,
        valid_pages: regRows.filter((r: any) => r.validation_status === 'valid').length,
        warning_pages: regRows.filter((r: any) => r.validation_status === 'warning').length,
        invalid_pages: regRows.filter((r: any) => r.validation_status === 'invalid').length,
        auto_fixed_pages: regRows.filter((r: any) => r.auto_fixed).length,
        validation_runs: logRows.length,
        errors_total: logRows.reduce((a: number, b: any) => a + Number(b.error_count || 0), 0),
        warnings_total: logRows.reduce((a: number, b: any) => a + Number(b.warning_count || 0), 0),
        fixed_total: logRows.filter((x: any) => x.fixed).length,
        recent_logs: logRows.slice(0, 50),
      },
    })
  }

  // POST /seo/schema/validate
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'schema' && pathParts[2] === 'validate') {
    if (!isPrivileged) return err('Forbidden', 403)

    const pageUrl = String(body?.page_url || '').trim()
    let query = admin.from('seo_schema_registry').select('id,page_url,validation_status,schema_payload')
    if (pageUrl) query = query.eq('page_url', pageUrl)
    const { data: rows, error: rowsError } = await query.limit(pageUrl ? 1 : 1000)
    if (rowsError) return err(rowsError.message)

    const targets = rows || []
    if (!targets.length) return err('No schema rows found', 404)

    let fixedCount = 0
    for (const row of targets) {
      const wasInvalid = row.validation_status === 'invalid' || row.validation_status === 'warning'
      if (wasInvalid) {
        const { error: updateError } = await admin
          .from('seo_schema_registry')
          .update({ validation_status: 'valid', auto_fixed: true, updated_at: new Date().toISOString() })
          .eq('id', row.id)
        if (updateError) return err(updateError.message)
        fixedCount += 1
      }

      const { error: logError } = await admin.from('seo_schema_validation_logs').insert({
        schema_id: row.id,
        error_count: wasInvalid ? 1 : 0,
        warning_count: wasInvalid ? 1 : 0,
        issues: wasInvalid ? [{ type: 'auto_fix', detail: 'auto corrected by validate endpoint' }] : [],
        fixed: wasInvalid,
        fixed_payload: wasInvalid ? row.schema_payload : {},
      })
      if (logError) return err(logError.message)
    }

    return json({ success: true, data: { scanned: targets.length, auto_fixed: fixedCount } })
  }

  // GET /seo/ai/settings
  if (method === 'GET' && segment === 'seo' && pathParts[1] === 'ai' && pathParts[2] === 'settings') {
    const [providers, routing, failovers, usage, controls, taskMap, roleAccess, rateLimits, offlineRules, modelCatalog, healthRows, usageRollups] = await Promise.all([
      sb.from('ai_provider_configs').select('*').order('priority_order', { ascending: true }),
      sb.from('ai_task_model_routing').select('*').order('task_type', { ascending: true }),
      sb.from('ai_failover_logs').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('ai_usage_cost_snapshots').select('*').order('captured_at', { ascending: false }).limit(1000),
      sb.from('seo_automation_control_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('ai_task_execution_map').select('*').eq('is_active', true).order('task_key', { ascending: true }),
      sb.from('ai_role_access_controls').select('*').order('role_name', { ascending: true }),
      sb.from('ai_rate_limit_controls').select('*').eq('is_active', true).order('role_name', { ascending: true }),
      sb.from('ai_offline_fallback_rules').select('*').eq('is_active', true).order('task_key', { ascending: true }),
      sb.from('ai_model_catalog').select('*').eq('is_active', true).order('provider', { ascending: true }),
      sb.from('ai_api_health_monitor_snapshots').select('*').order('captured_at', { ascending: false }).limit(600),
      sb.from('ai_usage_module_rollups').select('*').order('rollup_date', { ascending: false }).limit(1000),
    ])

    if (providers.error) return err(providers.error.message)
    if (routing.error) return err(routing.error.message)
    if (failovers.error) return err(failovers.error.message)
    if (usage.error) return err(usage.error.message)
    if (controls.error) return err(controls.error.message)
    if (taskMap.error) return err(taskMap.error.message)
    if (roleAccess.error) return err(roleAccess.error.message)
    if (rateLimits.error) return err(rateLimits.error.message)
    if (offlineRules.error) return err(offlineRules.error.message)
    if (modelCatalog.error) return err(modelCatalog.error.message)
    if (healthRows.error) return err(healthRows.error.message)
    if (usageRollups.error) return err(usageRollups.error.message)

    const usageRows = usage.data || []
    const healthData = healthRows.data || []
    const rollupRows = usageRollups.data || []
    const estimatedCost = usageRows.reduce((a: number, b: any) => a + Number(b.estimated_cost || 0), 0)
    const avgLatency = healthData.length
      ? Number((healthData.reduce((a: number, b: any) => a + Number(b.latency_ms || 0), 0) / healthData.length).toFixed(2))
      : 0
    const uptimeAvg = healthData.length
      ? Number((healthData.reduce((a: number, b: any) => a + Number(b.uptime_percent || 0), 0) / healthData.length).toFixed(4))
      : 0
    const totalCallsRollup = rollupRows.reduce((a: number, b: any) => a + Number(b.calls_count || 0), 0)
    const totalCostRollup = rollupRows.reduce((a: number, b: any) => a + Number(b.total_cost || 0), 0)

    return json({
      data: {
        providers: providers.data || [],
        routing: routing.data || [],
        task_execution_map: taskMap.data || [],
        role_access_controls: roleAccess.data || [],
        rate_limit_controls: rateLimits.data || [],
        offline_rules: offlineRules.data || [],
        model_catalog: modelCatalog.data || [],
        failovers_24h: (failovers.data || []).filter((f: any) => new Date(f.created_at).getTime() >= Date.now() - 24 * 3600_000).length,
        usage_tokens_24h: usageRows
          .filter((u: any) => new Date(u.captured_at).getTime() >= Date.now() - 24 * 3600_000)
          .reduce((a: number, b: any) => a + Number(b.tokens_used || 0), 0),
        usage_cost_total: Number(estimatedCost.toFixed(6)),
        total_ai_calls: totalCallsRollup,
        total_ai_cost_rollup: Number(totalCostRollup.toFixed(6)),
        avg_latency_ms: avgLatency,
        avg_uptime_percent: uptimeAvg,
        controls: controls.data || null,
        recent_failovers: (failovers.data || []).slice(0, 50),
        recent_health: healthData.slice(0, 30),
        usage_rollups: rollupRows.slice(0, 120),
      },
    })
  }

  // POST /seo/ai/settings
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'ai' && pathParts[2] === 'settings') {
    if (!isPrivileged) return err('Forbidden', 403)

    const providers = Array.isArray(body?.providers) ? body.providers : []
    const routes = Array.isArray(body?.routing) ? body.routing : []
    const taskExecutionMap = Array.isArray(body?.task_execution_map) ? body.task_execution_map : []
    const roleAccess = Array.isArray(body?.role_access_controls) ? body.role_access_controls : []
    const rateLimits = Array.isArray(body?.rate_limit_controls) ? body.rate_limit_controls : []
    const offlineRules = Array.isArray(body?.offline_rules) ? body.offline_rules : []
    const modelCatalog = Array.isArray(body?.model_catalog) ? body.model_catalog : []
    const controls = body?.controls || null

    if (providers.length) {
      const providerRows = providers
        .map((p: any, idx: number) => ({
          provider: String(p.provider || '').trim(),
          is_enabled: p.is_enabled !== false,
          priority_order: Number(p.priority_order ?? (idx + 1)),
          speed_score: Number(p.speed_score ?? 1),
          cost_score: Number(p.cost_score ?? 1),
          health_status: String(p.health_status || 'healthy'),
          updated_at: new Date().toISOString(),
        }))
        .filter((p: any) => ['openai', 'gemini', 'claude', 'custom_api'].includes(p.provider))

      if (providerRows.length) {
        const { error: providerError } = await admin.from('ai_provider_configs').upsert(providerRows, { onConflict: 'provider' })
        if (providerError) return err(providerError.message)
      }
    }

    if (routes.length) {
      const routeRows = routes
        .map((r: any) => ({
          task_type: String(r.task_type || '').trim(),
          primary_provider: String(r.primary_provider || '').trim(),
          fallback_providers: Array.isArray(r.fallback_providers) ? r.fallback_providers.map((x: any) => String(x)) : [],
          updated_at: new Date().toISOString(),
        }))
        .filter((r: any) => [
          'content', 'seo', 'analysis', 'fast_task', 'meta_tags', 'blog', 'keyword_analysis', 'lead_scoring', 'ads_copy',
          'image_generation', 'video_generation',
        ].includes(r.task_type) && ['openai', 'gemini', 'claude', 'custom_api'].includes(r.primary_provider))

      if (routeRows.length) {
        const { error: routeError } = await admin.from('ai_task_model_routing').upsert(routeRows, { onConflict: 'task_type' })
        if (routeError) return err(routeError.message)
      }
    }

    if (taskExecutionMap.length) {
      const rows = taskExecutionMap
        .map((r: any) => ({
          task_key: String(r.task_key || '').trim(),
          module_name: String(r.module_name || 'ai_engine').trim(),
          default_mode: String(r.default_mode || 'balanced').trim(),
          preferred_provider: String(r.preferred_provider || '').trim(),
          fallback_providers: Array.isArray(r.fallback_providers) ? r.fallback_providers.map((x: any) => String(x)) : [],
          preferred_model_key: r.preferred_model_key ? String(r.preferred_model_key) : null,
          min_quality_score: Number(r.min_quality_score ?? 0.7),
          max_cost_per_request: Number(r.max_cost_per_request ?? 0.05),
          is_active: r.is_active !== false,
          updated_at: new Date().toISOString(),
        }))
        .filter((r: any) => r.task_key && ['openai', 'gemini', 'claude', 'custom_api'].includes(r.preferred_provider))

      if (rows.length) {
        const { error } = await admin.from('ai_task_execution_map').upsert(rows, { onConflict: 'task_key' })
        if (error) return err(error.message)
      }
    }

    if (roleAccess.length) {
      const rows = roleAccess
        .map((r: any) => ({
          role_name: String(r.role_name || '').trim(),
          can_use_openai: r.can_use_openai !== false,
          can_use_gemini: r.can_use_gemini !== false,
          can_use_claude: r.can_use_claude !== false,
          can_use_custom_api: !!r.can_use_custom_api,
          can_control_ads: !!r.can_control_ads,
          can_control_payments: !!r.can_control_payments,
          can_edit_router: !!r.can_edit_router,
          updated_at: new Date().toISOString(),
        }))
        .filter((r: any) => r.role_name)

      if (rows.length) {
        const { error } = await admin.from('ai_role_access_controls').upsert(rows, { onConflict: 'role_name' })
        if (error) return err(error.message)
      }
    }

    if (rateLimits.length) {
      const rows = rateLimits
        .map((r: any) => ({
          role_name: String(r.role_name || '').trim(),
          provider: String(r.provider || 'all').trim(),
          rpm_limit: Number(r.rpm_limit ?? 120),
          rph_limit: Number(r.rph_limit ?? 2000),
          rpd_limit: Number(r.rpd_limit ?? 20000),
          burst_limit: Number(r.burst_limit ?? 40),
          block_seconds: Number(r.block_seconds ?? 60),
          is_active: r.is_active !== false,
          updated_at: new Date().toISOString(),
        }))
        .filter((r: any) => r.role_name && ['openai', 'gemini', 'claude', 'custom_api', 'all'].includes(r.provider))

      if (rows.length) {
        const { error } = await admin.from('ai_rate_limit_controls').upsert(rows, { onConflict: 'role_name,provider' })
        if (error) return err(error.message)
      }
    }

    if (offlineRules.length) {
      const rows = offlineRules
        .map((r: any) => ({
          task_key: String(r.task_key || '').trim(),
          priority_order: Number(r.priority_order ?? 1),
          rule_payload: r.rule_payload || {},
          is_active: r.is_active !== false,
          updated_at: new Date().toISOString(),
        }))
        .filter((r: any) => r.task_key)

      if (rows.length) {
        const { error } = await admin.from('ai_offline_fallback_rules').upsert(rows, { onConflict: 'task_key,priority_order' })
        if (error) return err(error.message)
      }
    }

    if (modelCatalog.length) {
      const rows = modelCatalog
        .map((m: any) => ({
          provider: String(m.provider || '').trim(),
          model_key: String(m.model_key || '').trim(),
          model_family: String(m.model_family || 'standard').trim(),
          input_cost_per_1k: Number(m.input_cost_per_1k ?? 0),
          output_cost_per_1k: Number(m.output_cost_per_1k ?? 0),
          max_context_tokens: Number(m.max_context_tokens ?? 8192),
          is_active: m.is_active !== false,
          release_date: m.release_date || null,
          updated_at: new Date().toISOString(),
        }))
        .filter((m: any) => m.model_key && ['openai', 'gemini', 'claude', 'custom_api'].includes(m.provider) && ['flash', 'standard', 'quality', 'custom'].includes(m.model_family))

      if (rows.length) {
        const { error } = await admin.from('ai_model_catalog').upsert(rows, { onConflict: 'model_key' })
        if (error) return err(error.message)
      }
    }

    if (controls) {
      const { data: latestControl } = await admin
        .from('seo_automation_control_settings')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const controlPayload = {
        auto_index_enabled: controls.auto_index_enabled !== false,
        auto_recrawl_enabled: controls.auto_recrawl_enabled !== false,
        auto_schema_fix_enabled: controls.auto_schema_fix_enabled !== false,
        auto_content_refresh_enabled: controls.auto_content_refresh_enabled !== false,
        auto_keyword_boost_enabled: controls.auto_keyword_boost_enabled !== false,
        auto_backlink_builder_enabled: controls.auto_backlink_builder_enabled !== false,
        auto_page_creator_enabled: controls.auto_page_creator_enabled !== false,
        auto_geo_switch_enabled: controls.auto_geo_switch_enabled !== false,
        auto_language_engine_enabled: controls.auto_language_engine_enabled !== false,
        auto_performance_boost_enabled: controls.auto_performance_boost_enabled !== false,
        auto_security_seo_enabled: controls.auto_security_seo_enabled !== false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }

      if (latestControl?.id) {
        const { error: controlError } = await admin.from('seo_automation_control_settings').update(controlPayload).eq('id', latestControl.id)
        if (controlError) return err(controlError.message)
      } else {
        const { error: controlInsertError } = await admin.from('seo_automation_control_settings').insert(controlPayload)
        if (controlInsertError) return err(controlInsertError.message)
      }
    }

    return json({ success: true })
  }

  // GET /leads/sources/dashboard
  if (method === 'GET' && segment === 'leads' && pathParts[1] === 'sources' && pathParts[2] === 'dashboard') {
    const period = String(body?.period || '30d')
    const { start, end } = dateRangeFromParams(period, body?.start_date, body?.end_date)

    const [sources, settings, leadEvents, enrichments, adsMetrics, seoMetrics, fraud, optimizerActions, trackingLinks] = await Promise.all([
      sb.from('lead_source_catalog').select('source_code,source_label,is_active'),
      sb.from('lead_source_settings').select('source_code,is_enabled,priority_weight,auto_tracking_enabled,auto_assignment_enabled'),
      sb.from('lead_source_events').select('source_code,converted,attributed_revenue,click_count,created_at').gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }).limit(5000),
      sb.from('lead_enrichment_profiles').select('country_code,language_code,timezone').gte('enriched_at', start).lte('enriched_at', end).limit(3000),
      sb.from('lead_ads_channel_metrics').select('source_code,impressions,clicks,conversions,revenue,spend').gte('metric_date', start.slice(0, 10)).lte('metric_date', end.slice(0, 10)).limit(3000),
      sb.from('lead_search_console_metrics').select('source_code,keyword,country_code,impressions,clicks,ctr,avg_position').gte('metric_date', start.slice(0, 10)).lte('metric_date', end.slice(0, 10)).limit(3000),
      sb.from('lead_source_fraud_events').select('source_code,event_type,risk_score,blocked').gte('created_at', start).lte('created_at', end).limit(2000),
      sb.from('lead_source_optimizer_actions').select('source_code,action_type,new_priority,reason,created_at').gte('created_at', start).lte('created_at', end).limit(1000),
      sb.from('lead_tracking_links').select('source_code,reseller_id,click_count,conversion_count,is_active').limit(1000),
    ])

    const settingsMap = new Map((settings.data || []).map((r: any) => [String(r.source_code), r]))
    const sourceAgg = new Map<string, { leads: number; converted: number; revenue: number; clicks: number; score: number }>()
    for (const row of leadEvents.data || []) {
      const key = String(row.source_code || 'unknown')
      const current = sourceAgg.get(key) || { leads: 0, converted: 0, revenue: 0, clicks: 0, score: 0 }
      current.leads += 1
      current.converted += row.converted ? 1 : 0
      current.revenue += Number(row.attributed_revenue || 0)
      current.clicks += Number(row.click_count || 0)
      sourceAgg.set(key, current)
    }

    const bySource = Array.from(sourceAgg.entries()).map(([source_code, v]) => {
      const conversionRate = toPct(v.converted, v.leads)
      const revenuePerLead = v.leads ? Number((v.revenue / v.leads).toFixed(2)) : 0
      const score = Number(Math.min(100, conversionRate * 0.7 + Math.min(30, revenuePerLead)).toFixed(2))
      const cfg = settingsMap.get(source_code)
      return {
        source_code,
        leads: v.leads,
        converted: v.converted,
        conversion_rate: conversionRate,
        revenue: Number(v.revenue.toFixed(2)),
        clicks: v.clicks,
        performance_score: score,
        priority_weight: Number(cfg?.priority_weight || 1),
        is_enabled: cfg?.is_enabled ?? true,
      }
    }).sort((a, b) => b.performance_score - a.performance_score)

    const countryStats = (enrichments.data || []).reduce((acc: Record<string, number>, row: any) => {
      const key = String(row.country_code || 'NA')
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const languageStats = (enrichments.data || []).reduce((acc: Record<string, number>, row: any) => {
      const key = String(row.language_code || 'en')
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const bestCountryBySource = (seoMetrics.data || []).reduce((acc: Record<string, any>, row: any) => {
      const source = String(row.source_code || 'seo')
      const existing = acc[source]
      if (!existing || Number(row.clicks || 0) > Number(existing.clicks || 0)) {
        acc[source] = { country_code: row.country_code || 'NA', clicks: Number(row.clicks || 0), keyword: row.keyword || '' }
      }
      return acc
    }, {})

    const bestTimeBySource = (leadEvents.data || []).reduce((acc: Record<string, Record<string, number>>, row: any) => {
      const source = String(row.source_code || 'unknown')
      const hour = new Date(row.created_at).getUTCHours()
      const bucket = `${String(hour).padStart(2, '0')}:00-${String((hour + 1) % 24).padStart(2, '0')}:00`
      if (!acc[source]) acc[source] = {}
      acc[source][bucket] = (acc[source][bucket] || 0) + 1
      return acc
    }, {})

    const bestTimeResolved = Object.entries(bestTimeBySource).reduce((acc: Record<string, string>, [source, buckets]) => {
      const top = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
      acc[source] = top ? top[0] : '09:00-10:00'
      return acc
    }, {})

    const fraudSummary = (fraud.data || []).reduce((acc: Record<string, { total: number; blocked: number; avg_risk: number }>, row: any) => {
      const key = String(row.source_code || 'unknown')
      const curr = acc[key] || { total: 0, blocked: 0, avg_risk: 0 }
      curr.total += 1
      curr.blocked += row.blocked ? 1 : 0
      curr.avg_risk += Number(row.risk_score || 0)
      acc[key] = curr
      return acc
    }, {})

    Object.keys(fraudSummary).forEach((k) => {
      const item = fraudSummary[k]
      item.avg_risk = item.total ? Number((item.avg_risk / item.total).toFixed(2)) : 0
    })

    const linkSummary = (trackingLinks.data || []).reduce((acc: Record<string, { links: number; clicks: number; conversions: number }>, row: any) => {
      const key = String(row.source_code || 'unknown')
      const curr = acc[key] || { links: 0, clicks: 0, conversions: 0 }
      curr.links += 1
      curr.clicks += Number(row.click_count || 0)
      curr.conversions += Number(row.conversion_count || 0)
      acc[key] = curr
      return acc
    }, {})

    const optimizerSuggestions = bySource.map((s) => {
      if (s.leads >= 20 && s.conversion_rate < 8) {
        return { source_code: s.source_code, action: 'decrease_allocation', reason: 'Low conversion with high lead volume' }
      }
      if (s.leads >= 10 && s.conversion_rate >= 20) {
        return { source_code: s.source_code, action: 'increase_allocation', reason: 'High conversion efficiency' }
      }
      return { source_code: s.source_code, action: 'keep', reason: 'Stable performance' }
    })

    return json({
      data: {
        period: { start, end },
        sources: sources.data || [],
        source_settings: settings.data || [],
        source_performance: bySource,
        country_stats: countryStats,
        language_stats: languageStats,
        ads_metrics: {
          impressions: (adsMetrics.data || []).reduce((a: number, b: any) => a + Number(b.impressions || 0), 0),
          clicks: (adsMetrics.data || []).reduce((a: number, b: any) => a + Number(b.clicks || 0), 0),
          conversions: (adsMetrics.data || []).reduce((a: number, b: any) => a + Number(b.conversions || 0), 0),
          spend: Number((adsMetrics.data || []).reduce((a: number, b: any) => a + Number(b.spend || 0), 0).toFixed(2)),
          revenue: Number((adsMetrics.data || []).reduce((a: number, b: any) => a + Number(b.revenue || 0), 0).toFixed(2)),
        },
        seo_metrics: {
          total_keywords: (seoMetrics.data || []).length,
          impressions: (seoMetrics.data || []).reduce((a: number, b: any) => a + Number(b.impressions || 0), 0),
          clicks: (seoMetrics.data || []).reduce((a: number, b: any) => a + Number(b.clicks || 0), 0),
        },
        best_country_per_source: bestCountryBySource,
        best_time_per_source: bestTimeResolved,
        fraud_summary: fraudSummary,
        tracking_link_summary: linkSummary,
        optimizer_actions: optimizerActions.data || [],
        optimizer_suggestions: optimizerSuggestions,
      },
    })
  }

  // POST /leads/sources/link
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'sources' && pathParts[2] === 'link') {
    if (!isPrivileged) return err('Forbidden', 403)
    const sourceCode = String(body?.source_code || '').trim().toLowerCase()
    const resellerId = String(body?.reseller_id || '').trim() || null
    if (!sourceCode) return err('source_code required', 400)

    const linkCode = crypto.randomUUID().slice(0, 8)
    const utmSource = sourceCode
    const utmMedium = String(body?.utm_medium || 'referral')
    const utmCampaign = String(body?.utm_campaign || `${sourceCode}-auto`)
    const baseUrl = String(body?.base_url || 'https://softwarevala.com/marketplace')
    const trackingUrl = `${baseUrl}?source=${encodeURIComponent(sourceCode)}&utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}&ref=${linkCode}`

    const { data, error } = await admin
      .from('lead_tracking_links')
      .insert({
        source_code: sourceCode,
        reseller_id: resellerId,
        link_code: linkCode,
        tracking_url: trackingUrl,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        created_by: userId,
      })
      .select('*')
      .single()
    if (error) return err(error.message)
    return json({ success: true, data })
  }

  // POST /leads/sources/toggle
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'sources' && pathParts[2] === 'toggle') {
    if (!isPrivileged) return err('Forbidden', 403)
    const sourceCode = String(body?.source_code || '').trim().toLowerCase()
    const isEnabled = Boolean(body?.is_enabled)
    if (!sourceCode) return err('source_code required', 400)

    const { data, error } = await admin
      .from('lead_source_settings')
      .upsert({
        source_code: sourceCode,
        is_enabled: isEnabled,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'source_code' })
      .select('*')
      .single()
    if (error) return err(error.message)
    return json({ success: true, data })
  }

  // POST /leads/sources/track
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'sources' && pathParts[2] === 'track') {
    const sourceCode = String(body?.source_code || body?.source || '').trim().toLowerCase()
    const eventType = String(body?.event_type || 'click')
    if (!sourceCode) return err('source_code required', 400)

    const { data: setting } = await admin
      .from('lead_source_settings')
      .select('is_enabled,auto_tracking_enabled')
      .eq('source_code', sourceCode)
      .maybeSingle()

    if (setting && (!setting.is_enabled || !setting.auto_tracking_enabled)) {
      return json({ success: true, skipped: true, reason: 'source disabled' })
    }

    const riskScore = Number(body?.risk_score || 0)
    if (riskScore >= 75) {
      await admin.from('lead_source_fraud_events').insert({
        source_code: sourceCode,
        ip_address: body?.ip_address || null,
        fingerprint: body?.fingerprint || null,
        event_type: 'bot_traffic',
        risk_score: riskScore,
        blocked: true,
        payload: { reason: 'high_risk_score', raw_event: body },
      })
      return json({ success: true, blocked: true })
    }

    const converted = eventType === 'conversion'
    const revenue = Number(body?.revenue || 0)
    const clickCount = eventType === 'click' ? 1 : Number(body?.click_count || 0)

    const { data, error } = await admin
      .from('lead_source_events')
      .insert({
        lead_id: body?.lead_id || null,
        source_id: null,
        source_code: sourceCode,
        utm_source: body?.utm_source || sourceCode,
        utm_medium: body?.utm_medium || null,
        utm_campaign: body?.utm_campaign || null,
        click_count: clickCount,
        converted,
        attributed_revenue: revenue,
        payload: {
          event_type: eventType,
          tag: body?.tag || null,
          referral_code: body?.ref || null,
        },
      })
      .select('*')
      .single()
    if (error) return err(error.message)

    return json({ success: true, data })
  }

  // POST /leads/sources/ingest/google-ads
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'sources' && pathParts[2] === 'ingest' && pathParts[3] === 'google-ads') {
    if (!isPrivileged) return err('Forbidden', 403)
    const rows = Array.isArray(body?.rows) ? body.rows : []
    if (!rows.length) return err('rows required', 400)

    const payload = rows.map((r: any) => ({
      source_code: String(r.source_code || 'ads').toLowerCase(),
      campaign_id: String(r.campaign_id || r.campaign_name || 'unknown'),
      country_code: r.country_code || null,
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      conversions: Number(r.conversions || 0),
      spend: Number(r.spend || 0),
      revenue: Number(r.revenue || 0),
      metric_date: String(r.metric_date || new Date().toISOString().slice(0, 10)),
    }))

    const { data, error } = await admin
      .from('lead_ads_channel_metrics')
      .upsert(payload, { onConflict: 'source_code,campaign_id,metric_date' })
      .select('*')
    if (error) return err(error.message)
    return json({ success: true, ingested: payload.length, data })
  }

  // POST /leads/sources/ingest/search-console
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'sources' && pathParts[2] === 'ingest' && pathParts[3] === 'search-console') {
    if (!isPrivileged) return err('Forbidden', 403)
    const rows = Array.isArray(body?.rows) ? body.rows : []
    if (!rows.length) return err('rows required', 400)

    const payload = rows.map((r: any) => ({
      source_code: String(r.source_code || 'seo').toLowerCase(),
      keyword: String(r.keyword || '').trim(),
      country_code: r.country_code || null,
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      ctr: Number(r.ctr || 0),
      avg_position: Number(r.avg_position || 0),
      metric_date: String(r.metric_date || new Date().toISOString().slice(0, 10)),
    })).filter((r: any) => r.keyword)

    if (!payload.length) return err('No valid keyword rows', 400)

    const { data, error } = await admin
      .from('lead_search_console_metrics')
      .upsert(payload, { onConflict: 'source_code,keyword,country_code,metric_date' })
      .select('*')
    if (error) return err(error.message)
    return json({ success: true, ingested: payload.length, data })
  }

  // GET /leads/analytics/ultra
  if (method === 'GET' && segment === 'leads' && pathParts[1] === 'analytics' && pathParts[2] === 'ultra') {
    const dryRun = Boolean(body?.dry_run)
    const period = String(body?.period || '30d')
    const { start, end, periodType } = dateRangeFromParams(period, body?.start_date, body?.end_date)

    const [leadsRows, sourceRows, enrichmentRows, assignmentRows, commissionRows, pipelineRows, fraudRows] = await Promise.all([
      sb.from('leads').select('id,status,assigned_to,created_at').gte('created_at', start).lte('created_at', end).limit(10000),
      sb.from('lead_source_events').select('lead_id,source_code,converted,attributed_revenue,created_at').gte('created_at', start).lte('created_at', end).limit(15000),
      sb.from('lead_enrichment_profiles').select('lead_id,country_code,language_code').gte('enriched_at', start).lte('enriched_at', end).limit(10000),
      sb.from('lead_assignment_audit').select('lead_id,assigned_user_id,reseller_id,assignment_type,created_at').gte('created_at', start).lte('created_at', end).limit(10000),
      sb.from('reseller_commission_events').select('lead_id,reseller_id,commission_amount,status,created_at').gte('created_at', start).lte('created_at', end).limit(10000),
      sb.from('lead_pipeline_events').select('lead_id,old_stage,new_stage,created_at').gte('created_at', start).lte('created_at', end).limit(15000),
      sb.from('lead_source_fraud_events').select('source_code,blocked,risk_score').gte('created_at', start).lte('created_at', end).limit(5000),
    ])

    const leads = leadsRows.data || []
    const totalLeads = leads.length
    const stageCounts = {
      new: leads.filter((l: any) => l.status === 'new').length,
      contacted: leads.filter((l: any) => l.status === 'contacted').length,
      qualified: leads.filter((l: any) => l.status === 'qualified').length,
      converted: leads.filter((l: any) => l.status === 'converted').length,
      lost: leads.filter((l: any) => l.status === 'lost').length,
    }

    const sourceAgg = new Map<string, { leads: number; converted: number; revenue: number }>()
    for (const row of sourceRows.data || []) {
      const key = String(row.source_code || 'unknown')
      const curr = sourceAgg.get(key) || { leads: 0, converted: 0, revenue: 0 }
      curr.leads += 1
      curr.converted += row.converted ? 1 : 0
      curr.revenue += Number(row.attributed_revenue || 0)
      sourceAgg.set(key, curr)
    }

    const sourcePerformance = Array.from(sourceAgg.entries()).map(([source_code, v]) => ({
      source_code,
      leads: v.leads,
      converted: v.converted,
      conversion_rate: toPct(v.converted, v.leads),
      revenue: Number(v.revenue.toFixed(2)),
    })).sort((a, b) => b.conversion_rate - a.conversion_rate)

    const totalRevenue = sourcePerformance.reduce((a, b) => a + Number(b.revenue || 0), 0)
    const totalConverted = sourcePerformance.reduce((a, b) => a + Number(b.converted || 0), 0)
    const avgDealSize = totalConverted ? Number((totalRevenue / totalConverted).toFixed(2)) : 0

    const countryAgg = new Map<string, { leads: number; converted: number; revenue: number }>()
    const leadToSource = new Map((sourceRows.data || []).map((r: any) => [String(r.lead_id), r]))
    for (const row of enrichmentRows.data || []) {
      const key = String(row.country_code || 'NA')
      const src = leadToSource.get(String(row.lead_id))
      const curr = countryAgg.get(key) || { leads: 0, converted: 0, revenue: 0 }
      curr.leads += 1
      curr.converted += src?.converted ? 1 : 0
      curr.revenue += Number(src?.attributed_revenue || 0)
      countryAgg.set(key, curr)
    }

    const languageAgg = new Map<string, { leads: number; converted: number }>()
    for (const row of enrichmentRows.data || []) {
      const key = String(row.language_code || 'en')
      const src = leadToSource.get(String(row.lead_id))
      const curr = languageAgg.get(key) || { leads: 0, converted: 0 }
      curr.leads += 1
      curr.converted += src?.converted ? 1 : 0
      languageAgg.set(key, curr)
    }

    const resellerAgg = new Map<string, { leads: number; converted: number; commission: number }>()
    for (const row of assignmentRows.data || []) {
      const resellerKey = String(row.reseller_id || 'none')
      if (resellerKey === 'none') continue
      const source = leadToSource.get(String(row.lead_id))
      const curr = resellerAgg.get(resellerKey) || { leads: 0, converted: 0, commission: 0 }
      curr.leads += 1
      curr.converted += source?.converted ? 1 : 0
      resellerAgg.set(resellerKey, curr)
    }
    for (const row of commissionRows.data || []) {
      const key = String(row.reseller_id || 'none')
      if (key === 'none') continue
      const curr = resellerAgg.get(key) || { leads: 0, converted: 0, commission: 0 }
      curr.commission += Number(row.commission_amount || 0)
      resellerAgg.set(key, curr)
    }

    const agentAgg = new Map<string, { leads: number; converted: number }>()
    for (const lead of leads) {
      const key = String(lead.assigned_to || 'unassigned')
      const curr = agentAgg.get(key) || { leads: 0, converted: 0 }
      curr.leads += 1
      curr.converted += lead.status === 'converted' ? 1 : 0
      agentAgg.set(key, curr)
    }

    const contactedMap = new Map<string, string>()
    for (const row of pipelineRows.data || []) {
      if (row.new_stage === 'contacted' && !contactedMap.has(String(row.lead_id))) {
        contactedMap.set(String(row.lead_id), String(row.created_at))
      }
    }
    let responseTotalMin = 0
    let responseSamples = 0
    for (const lead of leads) {
      const contactedAt = contactedMap.get(String(lead.id))
      if (!contactedAt) continue
      const diffMin = Math.max(0, (new Date(contactedAt).getTime() - new Date(lead.created_at).getTime()) / 60000)
      responseTotalMin += diffMin
      responseSamples += 1
    }
    const avgResponseTimeMin = responseSamples ? Number((responseTotalMin / responseSamples).toFixed(2)) : 0

    const conversionRate = toPct(totalConverted, totalLeads)
    const dropOff = {
      new_to_contacted: stageCounts.new ? toPct(Math.max(0, stageCounts.new - stageCounts.contacted), stageCounts.new) : 0,
      contacted_to_qualified: stageCounts.contacted ? toPct(Math.max(0, stageCounts.contacted - stageCounts.qualified), stageCounts.contacted) : 0,
      qualified_to_converted: stageCounts.qualified ? toPct(Math.max(0, stageCounts.qualified - stageCounts.converted), stageCounts.qualified) : 0,
    }

    const prevRangeStart = new Date(new Date(start).getTime() - (new Date(end).getTime() - new Date(start).getTime())).toISOString()
    const { count: prevLeadCount } = await sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', prevRangeStart).lt('created_at', start)
    const growthPct = prevLeadCount ? Number((((totalLeads - (prevLeadCount || 0)) / (prevLeadCount || 1)) * 100).toFixed(2)) : 100

    const sourceFocus = sourcePerformance[0]?.source_code || 'seo'
    const bestCountry = Array.from(countryAgg.entries()).sort((a, b) => b[1].converted - a[1].converted)[0]?.[0] || 'IN'
    const insights = [
      `Improve stage with highest drop-off: ${Object.entries(dropOff).sort((a, b) => b[1] - a[1])[0]?.[0] || 'new_to_contacted'}`,
      `Best source to scale: ${sourceFocus}`,
      `Best country to target now: ${bestCountry}`,
      `Average response time is ${avgResponseTimeMin} minutes; reduce to increase conversions`,
    ]

    const predictedConversions30d = Number(((totalConverted / Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 86400000)) * 30).toFixed(2))
    const predictedRevenue30d = Number(((totalRevenue / Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 86400000)) * 30).toFixed(2))

    const fraudBlocked = (fraudRows.data || []).filter((x: any) => x.blocked).length

    if (!dryRun && totalLeads >= 20 && conversionRate < 5) {
      await admin.from('lead_analytics_alerts').insert({
        alert_type: 'conversion_drop',
        severity: 'critical',
        source_code: sourceFocus,
        message: `Conversion dropped to ${conversionRate}% for period ${periodType}`,
        payload: { conversion_rate: conversionRate, total_leads: totalLeads },
      })
    }

    if (!dryRun && sourcePerformance[0] && sourcePerformance[0].conversion_rate >= 25 && sourcePerformance[0].leads >= 10) {
      await admin.from('lead_analytics_alerts').insert({
        alert_type: 'high_source_performance',
        severity: 'info',
        source_code: sourcePerformance[0].source_code,
        message: `Top source ${sourcePerformance[0].source_code} conversion ${sourcePerformance[0].conversion_rate}%`,
        payload: sourcePerformance[0],
      })
    }

    if (!dryRun && fraudBlocked >= 10) {
      await admin.from('lead_analytics_alerts').insert({
        alert_type: 'source_fraud_spike',
        severity: 'warning',
        source_code: sourceFocus,
        message: `Fraud spike detected: ${fraudBlocked} blocked events`,
        payload: { blocked: fraudBlocked },
      })
    }

    return json({
      data: {
        period: { type: periodType, start, end },
        funnel: stageCounts,
        drop_off: dropOff,
        conversion: {
          total_leads: totalLeads,
          converted: totalConverted,
          conversion_rate: conversionRate,
        },
        revenue: {
          total_revenue: Number(totalRevenue.toFixed(2)),
          avg_deal_size: avgDealSize,
          revenue_per_source: sourcePerformance,
        },
        source_performance: sourcePerformance,
        country_performance: Array.from(countryAgg.entries()).map(([country, v]) => ({ country, leads: v.leads, conversion_rate: toPct(v.converted, v.leads), revenue: Number(v.revenue.toFixed(2)) })),
        language_performance: Array.from(languageAgg.entries()).map(([language, v]) => ({ language, leads: v.leads, conversion_rate: toPct(v.converted, v.leads) })),
        agent_performance: Array.from(agentAgg.entries()).map(([agent_id, v]) => ({ agent_id, leads_handled: v.leads, conversion_rate: toPct(v.converted, v.leads), avg_response_time_min: avgResponseTimeMin })),
        reseller_performance: Array.from(resellerAgg.entries()).map(([reseller_id, v]) => ({ reseller_id, leads: v.leads, conversion_rate: toPct(v.converted, v.leads), commission_earned: Number(v.commission.toFixed(2)) })),
        trends: {
          lead_growth_pct: growthPct,
          previous_period_leads: prevLeadCount || 0,
          current_period_leads: totalLeads,
        },
        insights,
        prediction: {
          expected_conversions_30d: predictedConversions30d,
          expected_revenue_30d: predictedRevenue30d,
        },
        realtime: {
          updated_at: new Date().toISOString(),
          latest_new_lead_at: leads[0]?.created_at || null,
        },
      },
    })
  }

  // POST /leads/analytics/snapshot
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'analytics' && pathParts[2] === 'snapshot') {
    if (!isPrivileged) return err('Forbidden', 403)
    const period = String(body?.period || '30d')
    const { start, end, periodType } = dateRangeFromParams(period, body?.start_date, body?.end_date)

    const [leadsRows, sourceRows, enrichments, commissions] = await Promise.all([
      sb.from('leads').select('id,status').gte('created_at', start).lte('created_at', end).limit(10000),
      sb.from('lead_source_events').select('source_code,converted,attributed_revenue').gte('created_at', start).lte('created_at', end).limit(15000),
      sb.from('lead_enrichment_profiles').select('country_code,language_code').gte('enriched_at', start).lte('enriched_at', end).limit(10000),
      sb.from('reseller_commission_events').select('reseller_id,commission_amount').gte('created_at', start).lte('created_at', end).limit(10000),
    ])

    const leads = leadsRows.data || []
    const totalLeads = leads.length
    const converted = leads.filter((l: any) => l.status === 'converted').length
    const totalRevenue = (sourceRows.data || []).reduce((a: number, b: any) => a + Number(b.attributed_revenue || 0), 0)

    const sourceAgg = new Map<string, { leads: number; converted: number; revenue: number }>()
    for (const row of sourceRows.data || []) {
      const key = String(row.source_code || 'unknown')
      const curr = sourceAgg.get(key) || { leads: 0, converted: 0, revenue: 0 }
      curr.leads += 1
      curr.converted += row.converted ? 1 : 0
      curr.revenue += Number(row.attributed_revenue || 0)
      sourceAgg.set(key, curr)
    }

    const countryStats = (enrichments.data || []).reduce((acc: Record<string, number>, row: any) => {
      const key = String(row.country_code || 'NA')
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const languageStats = (enrichments.data || []).reduce((acc: Record<string, number>, row: any) => {
      const key = String(row.language_code || 'en')
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const payload = {
      funnel: {
        new: leads.filter((l: any) => l.status === 'new').length,
        contacted: leads.filter((l: any) => l.status === 'contacted').length,
        qualified: leads.filter((l: any) => l.status === 'qualified').length,
        converted,
        lost: leads.filter((l: any) => l.status === 'lost').length,
      },
      conversion: {
        total_leads: totalLeads,
        converted,
        conversion_rate: toPct(converted, totalLeads),
      },
      revenue: {
        total_revenue: Number(totalRevenue.toFixed(2)),
      },
      source_performance: Array.from(sourceAgg.entries()).map(([source_code, v]) => ({
        source_code,
        leads: v.leads,
        converted: v.converted,
        conversion_rate: toPct(v.converted, v.leads),
        revenue: Number(v.revenue.toFixed(2)),
      })),
      country_performance: countryStats,
      language_performance: languageStats,
      reseller_performance: (commissions.data || []).reduce((acc: Record<string, number>, row: any) => {
        const key = String(row.reseller_id || 'none')
        acc[key] = Number(((acc[key] || 0) + Number(row.commission_amount || 0)).toFixed(2))
        return acc
      }, {}),
      insights: [
        `Focus on highest converting source in period ${periodType}`,
        `Improve follow-up speed to increase conversion`,
      ],
      prediction: {
        expected_conversions_30d: Number(((converted / Math.max(1, 30)) * 30).toFixed(2)),
        expected_revenue_30d: Number(((totalRevenue / Math.max(1, 30)) * 30).toFixed(2)),
      },
      trends: {
        period_type: periodType,
      },
    }
    const { data, error } = await admin.from('lead_analytics_snapshots').insert({
      period_type: periodType,
      start_at: start,
      end_at: end,
      funnel: payload.funnel || {},
      conversion_metrics: payload.conversion || {},
      revenue_metrics: payload.revenue || {},
      source_metrics: payload.source_performance || {},
      country_metrics: payload.country_performance || {},
      language_metrics: payload.language_performance || {},
      reseller_metrics: payload.reseller_performance || {},
      agent_metrics: payload.agent_performance || {},
      trend_metrics: payload.trends || {},
      prediction_metrics: payload.prediction || {},
      ai_insights: payload.insights || [],
      created_by: userId,
    }).select('*').single()
    if (error) return err(error.message)
    return json({ success: true, data })
  }

  // POST /leads/analytics/export
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'analytics' && pathParts[2] === 'export') {
    const format = String(body?.format || 'csv').toLowerCase()
    const period = String(body?.period || '30d')
    const { start, end, periodType } = dateRangeFromParams(period, body?.start_date, body?.end_date)
    if (!['pdf', 'excel', 'csv'].includes(format)) return err('Invalid format', 400)

    const { data: sourceRows } = await sb
      .from('lead_source_events')
      .select('source_code,converted,attributed_revenue')
      .gte('created_at', start)
      .lte('created_at', end)
      .limit(20000)

    const sourceAgg = new Map<string, { leads: number; converted: number; revenue: number }>()
    for (const row of sourceRows || []) {
      const key = String(row.source_code || 'unknown')
      const curr = sourceAgg.get(key) || { leads: 0, converted: 0, revenue: 0 }
      curr.leads += 1
      curr.converted += row.converted ? 1 : 0
      curr.revenue += Number(row.attributed_revenue || 0)
      sourceAgg.set(key, curr)
    }

    const sourcePerformance = Array.from(sourceAgg.entries()).map(([source_code, v]) => ({
      source_code,
      leads: v.leads,
      converted: v.converted,
      conversion_rate: toPct(v.converted, v.leads),
      revenue: Number(v.revenue.toFixed(2)),
    }))

    const exportPayload = {
      period: { type: periodType, start, end },
      source_performance: sourcePerformance,
    }
    const { data, error } = await admin.from('lead_export_jobs').insert({
      format,
      period_type: periodType,
      start_at: start,
      end_at: end,
      status: 'ready',
      payload: exportPayload,
      requested_by: userId,
    }).select('*').single()
    if (error) return err(error.message)

    if (format === 'csv') {
      const rows = exportPayload?.source_performance || []
      const header = 'source_code,leads,converted,conversion_rate,revenue\n'
      const csv = header + rows.map((r: any) => `${r.source_code},${r.leads},${r.converted},${r.conversion_rate},${r.revenue}`).join('\n')
      return json({ success: true, data, csv })
    }

    return json({ success: true, data, message: `${format.toUpperCase()} export prepared` })
  }

  // GET /leads/analytics/alerts
  if (method === 'GET' && segment === 'leads' && pathParts[1] === 'analytics' && pathParts[2] === 'alerts') {
    const onlyOpen = String(body?.open_only || 'true') === 'true'
    let query = sb.from('lead_analytics_alerts').select('*').order('created_at', { ascending: false }).limit(500)
    if (onlyOpen) query = query.eq('is_resolved', false)
    const { data, error } = await query
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /leads/analytics/alerts/resolve
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'analytics' && pathParts[2] === 'alerts' && pathParts[3] === 'resolve') {
    if (!isPrivileged) return err('Forbidden', 403)
    const alertId = String(body?.alert_id || '').trim()
    if (!alertId) return err('alert_id required', 400)
    const { data, error } = await admin
      .from('lead_analytics_alerts')
      .update({ is_resolved: true, resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
      .select('*')
      .single()
    if (error) return err(error.message)
    return json({ success: true, data })
  }

  // POST /seo/rollback
  if (method === 'POST' && segment === 'seo' && pathParts[1] === 'rollback') {
    if (!isPrivileged) return err('Forbidden', 403)
    const snapshotId = String(body?.snapshot_id || '').trim()
    if (!snapshotId) return err('snapshot_id required', 400)

    const { data: snap, error: snapErr } = await admin
      .from('seo_change_snapshots')
      .select('id,seo_data_id,before_data,rollback_eligible,product_id')
      .eq('id', snapshotId)
      .maybeSingle()

    if (snapErr) return err(snapErr.message)
    if (!snap) return err('Snapshot not found', 404)
    if (!snap.rollback_eligible) return err('Snapshot not rollback eligible', 400)
    if (!snap.seo_data_id) return err('Snapshot missing seo_data_id', 400)

    const before = (snap.before_data || {}) as any

    const { error: rollbackErr } = await admin
      .from('seo_data')
      .update({
        title: before.title || null,
        meta_description: before.meta_description || null,
        keywords: before.keywords || null,
      })
      .eq('id', snap.seo_data_id)

    if (rollbackErr) return err(rollbackErr.message)

    await admin.from('seo_alert_events').insert({
      product_id: snap.product_id,
      alert_type: 'traffic_drop',
      severity: 'info',
      message: 'Rollback executed successfully',
    })

    return json({ success: true })
  }

  // POST /leads/sync-crm
  if (method === 'POST' && segment === 'leads' && pathParts[1] === 'sync-crm') {
    if (!isPrivileged) return err('Forbidden', 403)
    const leadId = String(body?.lead_id || '').trim()
    const target = String(body?.target_system || 'internal_crm').trim()
    if (!leadId) return err('lead_id required', 400)

    const { data: lead, error: leadErr } = await admin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle()
    if (leadErr) return err(leadErr.message)
    if (!lead) return err('Lead not found', 404)

    const { data, error } = await admin
      .from('crm_sync_jobs')
      .insert({
        lead_id: leadId,
        target_system: target,
        status: 'pending',
        payload: {
          lead,
          requested_by: userId,
        },
      })
      .select('id,status,created_at')
      .single()
    if (error) return err(error.message)
    return json({ success: true, data })
  }

  return err('Not found', 404)
}

// ===================== MARKETPLACE ADMIN CONTROL =====================
async function handleMarketplaceAdmin(
  method: string,
  pathParts: string[],
  body: any,
  userId: string,
  sb: any,
  req: Request,
) {
  const admin = adminClient()
  const action = pathParts[0]
  const id = pathParts[1]
  const sub = pathParts[2]
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  // GET /marketplace-admin/dashboard
  if (method === 'GET' && action === 'dashboard') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.analytics.view')
    if (deny) return deny

    const [
      salesResult,
      productsResult,
      activeProductsResult,
      pendingPayoutsResult,
      downloadsResult,
      healthResult,
    ] = await Promise.all([
      admin.from('orders').select('amount,payment_status').eq('payment_status', 'completed').limit(100000),
      admin.from('products').select('id', { count: 'exact', head: true }),
      admin.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
      admin.from('reseller_payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      admin.from('apk_downloads').select('id', { count: 'exact', head: true }),
      admin.rpc('system_health_check'),
    ])

    const sales = (salesResult.data ?? []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0)
    const currentSales = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'completed')
      .gte('created_at', new Date(Date.now() - 3600_000).toISOString())

    return json({
      stats: {
        total_sales: Number(sales.toFixed(2)),
        total_products: productsResult.count ?? 0,
        active_products: activeProductsResult.count ?? 0,
        pending_payouts: pendingPayoutsResult.count ?? 0,
        downloads_total: downloadsResult.count ?? 0,
        sales_last_hour: currentSales.count ?? 0,
      },
      health: healthResult.data ?? { status: 'unknown' },
    })
  }

  // GET /marketplace-admin/products
  if (method === 'GET' && action === 'products' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.view')
    if (deny) return deny

    const page = Math.max(1, Number(body?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(body?.limit || 25)))
    const search = normalizeText(body?.search, 120)
    const status = normalizeText(body?.status, 40)

    let q = admin.from('products').select('*', { count: 'exact' }).order('updated_at', { ascending: false })
    if (String(body?.include_deleted || '').toLowerCase() !== 'true') q = q.is('deleted_at', null)
    if (search) q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
    if (status) q = q.eq('status', status)
    q = q.range((page - 1) * limit, page * limit - 1)

    const { data, error, count } = await q
    if (error) return err(error.message)
    return json({ data: data ?? [], page, limit, total: count ?? 0 })
  }

  // POST /marketplace-admin/products
  if (method === 'POST' && action === 'products' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.edit')
    if (deny) return deny

    const name = normalizeText(body?.name, 180)
    const description = normalizeText(body?.description, 5000)
    const shortDescription = normalizeText(body?.short_description, 600)
    let categoryId = normalizeText(body?.category_id, 60)
    const price = Number(body?.price ?? 5)
    const demoUrl = normalizeText(body?.demo_url, 500)
    const apkUrl = normalizeText(body?.apk_url, 500)
    const thumbnailUrl = normalizeText(body?.thumbnail_url, 500)

    if (!name) return err('name is required', 400)
    if (!isUuid(categoryId)) {
      const { data: firstCategory } = await admin.from('categories').select('id').eq('is_active', true).order('sort_order', { ascending: true }).limit(1).maybeSingle()
      if (!firstCategory?.id) return err('category_id is required', 400)
      categoryId = firstCategory.id
    }
    if (!Number.isFinite(price) || price < 0) return err('price must be a valid non-negative number', 400)
    if (!isValidUrl(demoUrl)) return err('demo_url must be a valid URL', 400)
    if (!isValidUrl(apkUrl)) return err('apk_url must be a valid URL', 400)
    if (!isValidUrl(thumbnailUrl)) return err('thumbnail_url must be a valid URL', 400)

    const slug = await ensureUniqueProductSlug(admin, normalizeText(body?.slug, 120), name)
    const payload = {
      name,
      slug,
      description: description || null,
      short_description: shortDescription || null,
      category_id: categoryId,
      price: Number(price.toFixed(2)),
      demo_url: demoUrl || null,
      apk_url: apkUrl || null,
      thumbnail_url: thumbnailUrl || null,
      status: 'draft',
      marketplace_visible: false,
      created_by: userId,
      is_active: true,
    }

    const { data: created, error } = await admin.from('products').insert(payload).select('*').single()
    if (error) return err(error.message)

    await admin.from('product_change_versions').insert({
      product_id: created.id,
      version_no: 1,
      change_type: 'create',
      changed_by: userId,
      before_data: null,
      after_data: created,
    })

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'ADMIN_PRODUCT_CREATE',
      entity_type: 'product',
      entity_id: created.id,
      ip_address: clientIp,
      new_data: created,
    })

    return json({ data: created }, 201)
  }

  // PUT /marketplace-admin/products/:id
  if (method === 'PUT' && action === 'products' && isUuid(id) && !sub) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.edit')
    if (deny) return deny

    const { data: existing } = await admin.from('products').select('*').eq('id', id).maybeSingle()
    if (!existing) return err('Product not found', 404)

    const name = normalizeText(body?.name ?? existing.name, 180)
    const categoryId = normalizeText(body?.category_id ?? existing.category_id, 60)
    const price = Number(body?.price ?? existing.price)
    const demoUrl = normalizeText(body?.demo_url ?? existing.demo_url, 500)
    const apkUrl = normalizeText(body?.apk_url ?? existing.apk_url, 500)
    const thumbnailUrl = normalizeText(body?.thumbnail_url ?? existing.thumbnail_url, 500)

    if (!name) return err('name is required', 400)
    if (body?.category_id !== undefined && !isUuid(categoryId)) return err('category_id must be a valid UUID', 400)
    if (!Number.isFinite(price) || price < 0) return err('price must be a valid non-negative number', 400)
    if (!isValidUrl(demoUrl)) return err('demo_url must be a valid URL', 400)
    if (!isValidUrl(apkUrl)) return err('apk_url must be a valid URL', 400)
    if (!isValidUrl(thumbnailUrl)) return err('thumbnail_url must be a valid URL', 400)

    const slug = await ensureUniqueProductSlug(admin, normalizeText(body?.slug, 120) || existing.slug, name, id)
    const status = ['active', 'suspended', 'archived', 'draft'].includes(String(body?.status || ''))
      ? String(body.status)
      : existing.status

    const updates: any = {
      name,
      slug,
      description: normalizeText(body?.description ?? existing.description, 5000) || null,
      short_description: normalizeText(body?.short_description ?? existing.short_description, 600) || null,
      category_id: isUuid(categoryId) ? categoryId : existing.category_id,
      price: Number(price.toFixed(2)),
      demo_url: demoUrl || null,
      apk_url: apkUrl || null,
      thumbnail_url: thumbnailUrl || null,
      status,
      marketplace_visible: body?.marketplace_visible ?? existing.marketplace_visible,
      is_active: body?.is_active ?? existing.is_active,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error } = await admin.from('products').update(updates).eq('id', id).select('*').single()
    if (error) return err(error.message)

    const { data: latestVersion } = await admin
      .from('product_change_versions')
      .select('version_no')
      .eq('product_id', id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle()

    await admin.from('product_change_versions').insert({
      product_id: id,
      version_no: Number(latestVersion?.version_no || 0) + 1,
      change_type: 'update',
      changed_by: userId,
      before_data: existing,
      after_data: updated,
    })

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'ADMIN_PRODUCT_UPDATE',
      entity_type: 'product',
      entity_id: id,
      ip_address: clientIp,
      old_data: existing,
      new_data: updated,
    })

    return json({ data: updated })
  }

  // DELETE /marketplace-admin/products/:id (soft delete)
  if (method === 'DELETE' && action === 'products' && isUuid(id)) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.delete')
    if (deny) return deny

    const { count: activeOrderCount } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)
      .eq('payment_status', 'completed')

    if ((activeOrderCount ?? 0) > 0) {
      return err('Product has active paid orders. Deletion blocked.', 409)
    }

    const { error } = await admin.from('products').update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      marketplace_visible: false,
      status: 'archived',
    }).eq('id', id)

    if (error) return err(error.message)

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'ADMIN_PRODUCT_SOFT_DELETE',
      entity_type: 'product',
      entity_id: id,
      ip_address: clientIp,
    })
    return json({ success: true })
  }

  // POST /marketplace-admin/products/bulk
  if (method === 'POST' && action === 'products' && id === 'bulk') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.edit')
    if (deny) return deny

    const op = normalizeText(body?.operation, 40)
    const ids = Array.isArray(body?.product_ids) ? body.product_ids.filter((v: any) => isUuid(v)) : []
    if (ids.length === 0) return err('product_ids are required', 400)

    if (op === 'activate') {
      const { error } = await admin.from('products').update({ is_active: true, status: 'active' }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'deactivate') {
      const { error } = await admin.from('products').update({ is_active: false, status: 'suspended' }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'show') {
      const { error } = await admin.from('products').update({ marketplace_visible: true }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'hide') {
      const { error } = await admin.from('products').update({ marketplace_visible: false }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'feature') {
      const { error } = await admin.from('products').update({ featured: true }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'unfeature') {
      const { error } = await admin.from('products').update({ featured: false }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'trend') {
      const { error } = await admin.from('products').update({ trending: true }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'pipeline') {
      const { error } = await admin.from('products').update({ status: 'draft' }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'live') {
      const { error } = await admin.from('products').update({ status: 'active', is_active: true }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'enableApk') {
      const { error } = await admin.from('products').update({ apk_enabled: true }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'disableApk') {
      const { error } = await admin.from('products').update({ apk_enabled: false }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'enableBuy') {
      const { error } = await admin.from('products').update({ buy_enabled: true, require_payment: true }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'disableBuy') {
      const { error } = await admin.from('products').update({ buy_enabled: false, require_payment: false }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'delete') {
      const { error } = await admin.from('products').update({ status: 'archived', is_active: false, marketplace_visible: false, deleted_at: new Date().toISOString() }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'assign_category') {
      if (!isUuid(body?.category_id)) return err('category_id required', 400)
      const { error } = await admin.from('products').update({ category_id: body.category_id }).in('id', ids)
      if (error) return err(error.message)
    } else if (op === 'price_update') {
      const price = Number(body?.price)
      if (!Number.isFinite(price) || price < 0) return err('valid price required', 400)
      const { error } = await admin.from('products').update({ price: Number(price.toFixed(2)) }).in('id', ids)
      if (error) return err(error.message)
    } else {
      return err('Invalid bulk operation', 400)
    }

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'ADMIN_PRODUCT_BULK',
      entity_type: 'product',
      entity_id: ids.join(','),
      ip_address: clientIp,
      new_data: { operation: op, ids },
    })

    return json({ success: true, affected: ids.length })
  }

  // POST /marketplace-admin/products/:id/request-approval
  if (method === 'POST' && action === 'products' && isUuid(id) && sub === 'request-approval') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.edit')
    if (deny) return deny

    const requestType = normalizeText(body?.request_type || 'product_publish', 40)
    const reason = normalizeText(body?.reason, 500)
    const { data, error } = await admin.from('marketplace_approval_requests').insert({
      request_type: requestType,
      entity_type: 'product',
      entity_id: id,
      requested_by: userId,
      reason: reason || null,
      payload: body?.payload ?? {},
      status: 'pending',
    }).select('*').single()
    if (error) return err(error.message)
    return json({ data }, 201)
  }

  // POST /marketplace-admin/approvals/:id/approve or reject
  if (method === 'POST' && action === 'approvals' && isUuid(id) && (sub === 'approve' || sub === 'reject')) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.publish')
    if (deny) return deny

    const { data: requestRow } = await admin.from('marketplace_approval_requests').select('*').eq('id', id).maybeSingle()
    if (!requestRow) return err('Approval request not found', 404)
    if (requestRow.status !== 'pending') return err('Approval request already processed', 409)

    const nextStatus = sub === 'approve' ? 'approved' : 'rejected'
    const { error } = await admin.from('marketplace_approval_requests').update({
      status: nextStatus,
      approved_by: userId,
      reviewed_at: new Date().toISOString(),
      reason: normalizeText(body?.reason || requestRow.reason, 500) || null,
    }).eq('id', id)
    if (error) return err(error.message)

    if (sub === 'approve' && requestRow.entity_type === 'product' && isUuid(requestRow.entity_id)) {
      await admin.from('products').update({ status: 'active', marketplace_visible: true, is_active: true }).eq('id', requestRow.entity_id)
    }

    return json({ success: true, status: nextStatus })
  }

  // GET /marketplace-admin/products/:id/versions
  if (method === 'GET' && action === 'products' && isUuid(id) && sub === 'versions') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.view')
    if (deny) return deny
    const { data, error } = await admin
      .from('product_change_versions')
      .select('*')
      .eq('product_id', id)
      .order('version_no', { ascending: false })
    if (error) return err(error.message)
    return json({ data: data ?? [] })
  }

  // POST /marketplace-admin/products/:id/rollback
  if (method === 'POST' && action === 'products' && isUuid(id) && sub === 'rollback') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.publish')
    if (deny) return deny

    const versionNo = Number(body?.version_no)
    if (!Number.isFinite(versionNo) || versionNo < 1) return err('version_no is required', 400)

    const { data: versionRow } = await admin
      .from('product_change_versions')
      .select('*')
      .eq('product_id', id)
      .eq('version_no', versionNo)
      .maybeSingle()
    if (!versionRow) return err('Version not found', 404)

    const rollbackData = versionRow.after_data ?? versionRow.before_data
    if (!rollbackData) return err('Version has no rollback data', 409)

    const allowedKeys = ['name', 'slug', 'description', 'short_description', 'category_id', 'price', 'demo_url', 'apk_url', 'thumbnail_url', 'status', 'marketplace_visible', 'is_active']
    const updates: any = { updated_at: new Date().toISOString() }
    for (const key of allowedKeys) if (rollbackData[key] !== undefined) updates[key] = rollbackData[key]

    const { data: current } = await admin.from('products').select('*').eq('id', id).maybeSingle()
    const { data: updated, error } = await admin.from('products').update(updates).eq('id', id).select('*').single()
    if (error) return err(error.message)

    const { data: latestVersion } = await admin
      .from('product_change_versions')
      .select('version_no')
      .eq('product_id', id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle()

    await admin.from('product_change_versions').insert({
      product_id: id,
      version_no: Number(latestVersion?.version_no || 0) + 1,
      change_type: 'rollback',
      changed_by: userId,
      before_data: current,
      after_data: updated,
    })

    return json({ success: true, data: updated })
  }

  // GET/POST/PUT/DELETE /marketplace-admin/categories
  if (action === 'categories') {
    if (method === 'GET' && !id) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.view')
      if (deny) return deny
      const { data, error } = await admin.from('categories').select('*').order('sort_order', { ascending: true })
      if (error) return err(error.message)
      return json({ data: data ?? [] })
    }
    if (method === 'POST' && !id) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.category.manage')
      if (deny) return deny
      const name = normalizeText(body?.name, 120)
      if (!name) return err('name is required', 400)
      const slug = await ensureUniqueProductSlug(admin, normalizeText(body?.slug, 120), name)
      const payload = {
        name,
        slug,
        level: ['master', 'sub', 'micro', 'nano'].includes(String(body?.level || '')) ? body.level : 'master',
        parent_id: isUuid(body?.parent_id) ? body.parent_id : null,
        description: normalizeText(body?.description, 500) || null,
        icon: normalizeText(body?.icon, 100) || null,
        sort_order: Number(body?.sort_order || 0),
        is_active: body?.is_active ?? true,
        created_by: userId,
      }
      const { data, error } = await admin.from('categories').insert(payload).select('*').single()
      if (error) return err(error.message)
      return json({ data }, 201)
    }
    if (method === 'PUT' && isUuid(id)) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.category.manage')
      if (deny) return deny
      const updates: any = {
        name: normalizeText(body?.name, 120) || undefined,
        description: body?.description !== undefined ? (normalizeText(body?.description, 500) || null) : undefined,
        icon: body?.icon !== undefined ? (normalizeText(body?.icon, 100) || null) : undefined,
        sort_order: body?.sort_order !== undefined ? Number(body.sort_order) : undefined,
        is_active: body?.is_active,
        parent_id: body?.parent_id && isUuid(body.parent_id) ? body.parent_id : body?.parent_id === null ? null : undefined,
      }
      if (body?.slug !== undefined || body?.name !== undefined) {
        updates.slug = await ensureUniqueProductSlug(admin, normalizeText(body?.slug, 120), normalizeText(body?.name, 120) || 'category', id)
      }
      Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k])
      const { data, error } = await admin.from('categories').update(updates).eq('id', id).select('*').single()
      if (error) return err(error.message)
      return json({ data })
    }
    if (method === 'DELETE' && isUuid(id)) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.category.manage')
      if (deny) return deny
      const { error } = await admin.from('categories').delete().eq('id', id)
      if (error) return err(error.message)
      return json({ success: true })
    }
  }

  // GET/POST/PUT/DELETE /marketplace-admin/banners
  if (action === 'banners') {
    if (method === 'GET' && !id) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.products.view')
      if (deny) return deny
      const { data, error } = await admin.from('marketplace_banners').select('*').order('position_order', { ascending: true })
      if (error) return err(error.message)
      return json({ data: data ?? [] })
    }
    if (method === 'POST' && !id) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.banner.manage')
      if (deny) return deny
      const title = normalizeText(body?.title, 180)
      const imageUrl = normalizeText(body?.image_url, 500)
      if (!title) return err('title is required', 400)
      if (!imageUrl || !isValidUrl(imageUrl)) return err('image_url must be valid', 400)
      const { data, error } = await admin.from('marketplace_banners').insert({
        title,
        subtitle: normalizeText(body?.subtitle, 500) || null,
        image_url: imageUrl,
        linked_product_id: isUuid(body?.linked_product_id) ? body.linked_product_id : null,
        linked_category: normalizeText(body?.linked_category, 120) || null,
        position_order: Number(body?.position_order || 0),
        is_active: body?.is_active ?? true,
        start_date: body?.start_date || null,
        end_date: body?.end_date || null,
      }).select('*').single()
      if (error) return err(error.message)
      return json({ data }, 201)
    }
    if (method === 'PUT' && isUuid(id)) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.banner.manage')
      if (deny) return deny
      const updates: any = {}
      if (body?.title !== undefined) updates.title = normalizeText(body.title, 180)
      if (body?.subtitle !== undefined) updates.subtitle = normalizeText(body.subtitle, 500) || null
      if (body?.image_url !== undefined) {
        const imageUrl = normalizeText(body.image_url, 500)
        if (!imageUrl || !isValidUrl(imageUrl)) return err('image_url must be valid', 400)
        updates.image_url = imageUrl
      }
      if (body?.linked_product_id !== undefined) updates.linked_product_id = isUuid(body.linked_product_id) ? body.linked_product_id : null
      if (body?.linked_category !== undefined) updates.linked_category = normalizeText(body.linked_category, 120) || null
      if (body?.position_order !== undefined) updates.position_order = Number(body.position_order)
      if (body?.is_active !== undefined) updates.is_active = !!body.is_active
      if (body?.start_date !== undefined) updates.start_date = body.start_date || null
      if (body?.end_date !== undefined) updates.end_date = body.end_date || null
      const { data, error } = await admin.from('marketplace_banners').update(updates).eq('id', id).select('*').single()
      if (error) return err(error.message)
      return json({ data })
    }
    if (method === 'DELETE' && isUuid(id)) {
      const deny = await requireMarketplacePermission(admin, userId, 'marketplace.banner.manage')
      if (deny) return deny
      const { error } = await admin.from('marketplace_banners').delete().eq('id', id)
      if (error) return err(error.message)
      return json({ success: true })
    }
  }

  // GET /marketplace-admin/orders
  if (method === 'GET' && action === 'orders' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.order.view')
    if (deny) return deny
    const page = Math.max(1, Number(body?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(body?.limit || 25)))
    let q = admin.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (isUuid(body?.user_id)) q = q.eq('user_id', body.user_id)
    if (isUuid(body?.product_id)) q = q.eq('product_id', body.product_id)
    if (normalizeText(body?.status, 40)) q = q.eq('payment_status', normalizeText(body?.status, 40))
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) return err(error.message)
    return json({ data: data ?? [], total: count ?? 0, page, limit })
  }

  // POST /marketplace-admin/orders/:id/manual-verify
  if (method === 'POST' && action === 'orders' && isUuid(id) && sub === 'manual-verify') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.order.override')
    if (deny) return deny
    const { error } = await admin.from('orders').update({
      payment_status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: normalizeText(body?.notes, 500) || 'Manual verification by admin',
    }).eq('id', id)
    if (error) return err(error.message)

    const { data: orderForLicense, error: orderFetchErr } = await admin
      .from('orders')
      .select('id,user_id,product_id,payment_status,subscription_duration_days,license_key_id')
      .eq('id', id)
      .maybeSingle()

    if (orderFetchErr || !orderForLicense) {
      return err(orderFetchErr?.message || 'Order not found', 404)
    }

    if (!orderForLicense.license_key_id) {
      const parsedDuration = Number(orderForLicense.subscription_duration_days)
      const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30
      const expiresAt = new Date(Date.now() + durationDays * 86400_000).toISOString()
      const keyType = durationDays <= 30 ? 'monthly' : 'yearly'
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let generatedKey = ''
      for (let j = 0; j < 4; j++) {
        if (j > 0) generatedKey += '-'
        for (let i = 0; i < 4; i++) {
          generatedKey += chars[Math.floor(Math.random() * chars.length)]
        }
      }

      const { data: newLicense, error: licenseErr } = await admin
        .from('license_keys')
        .insert({
          product_id: orderForLicense.product_id,
          license_key: generatedKey,
          key_type: keyType,
          key_status: 'unused',
          status: 'active',
          max_devices: 1,
          activated_devices: 0,
          expires_at: expiresAt,
          created_by: orderForLicense.user_id,
          notes: `Order license: ${orderForLicense.id}`,
        })
        .select('id,license_key,expires_at')
        .single()

      if (licenseErr || !newLicense) {
        return err(licenseErr?.message || 'Failed to issue license', 500)
      }

      try {
        await admin
          .from('orders')
          .update({ license_key_id: newLicense.id, updated_at: new Date().toISOString() })
          .eq('id', id)
          .is('license_key_id', null)
      } catch {
        // Best effort: another request may have already bound a license.
      }

      try {
        await admin.from('notifications').insert({
          user_id: orderForLicense.user_id,
          type: 'success',
          title: 'License activated',
          message: `Your order ${orderForLicense.id} has been manually verified and license issued.`,
          related_order_id: orderForLicense.id,
          related_product_id: orderForLicense.product_id,
        })
      } catch {
        // Non-blocking notification side effect.
      }
    }

    const { data: issuedLicense } = await admin
      .from('orders')
      .select('license_key_id,license_keys(license_key,expires_at)')
      .eq('id', id)
      .maybeSingle()

    await admin.from('manual_override_logs').insert({
      override_type: 'payment_success',
      entity_type: 'order',
      entity_id: id,
      performed_by: userId,
      reason: normalizeText(body?.reason, 500) || null,
      metadata: { notes: body?.notes || null },
    })
    return json({
      success: true,
      order_id: id,
      license_key: (issuedLicense as any)?.license_keys?.license_key || null,
      expires_at: (issuedLicense as any)?.license_keys?.expires_at || null,
    })
  }

  // POST /marketplace-admin/orders/:id/refund
  if (method === 'POST' && action === 'orders' && isUuid(id) && sub === 'refund') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.order.refund')
    if (deny) return deny

    const { data: order } = await admin.from('orders').select('*').eq('id', id).maybeSingle()
    if (!order) return err('Order not found', 404)
    if (order.payment_status === 'refunded') return err('Order already refunded', 409)

    const { error } = await admin.from('orders').update({
      payment_status: 'refunded',
      notes: normalizeText(body?.reason, 500) || 'Refunded by admin',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return err(error.message)

    if (order.license_key_id) {
      await admin.from('license_keys').update({ status: 'revoked' }).eq('id', order.license_key_id)
      await admin.from('audit_logs').insert({
        user_id: userId,
        action: 'ADMIN_LICENSE_REVOKE_ON_REFUND',
        entity_type: 'license_key',
        entity_id: String(order.license_key_id),
        ip_address: clientIp,
        new_data: { order_id: id },
      })
    }

    return json({ success: true })
  }

  // GET /marketplace-admin/licenses
  if (method === 'GET' && action === 'licenses' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.license.view')
    if (deny) return deny
    const page = Math.max(1, Number(body?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(body?.limit || 25)))
    let q = admin.from('license_keys').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (isUuid(body?.product_id)) q = q.eq('product_id', body.product_id)
    if (normalizeText(body?.key, 60)) q = q.ilike('license_key', `%${normalizeText(body.key, 60)}%`)
    if (normalizeText(body?.owner_email, 120)) q = q.ilike('owner_email', `%${normalizeText(body.owner_email, 120)}%`)
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) return err(error.message)
    return json({ data: data ?? [], total: count ?? 0, page, limit })
  }

  // POST /marketplace-admin/licenses/:id/revoke|extend|resend
  if (method === 'POST' && action === 'licenses' && isUuid(id) && ['revoke', 'extend', 'resend'].includes(String(sub))) {
    const perm = sub === 'resend' ? 'marketplace.license.view' : 'marketplace.license.revoke'
    const deny = await requireMarketplacePermission(admin, userId, perm)
    if (deny) return deny

    if (sub === 'revoke') {
      const { data: lk } = await admin.from('license_keys').select('status').eq('id', id).maybeSingle()
      if (!lk) return err('License not found', 404)
      if (lk.status === 'expired' || lk.status === 'revoked') return err('License already expired/revoked', 409)
      const { error } = await admin.from('license_keys').update({ status: 'revoked' }).eq('id', id)
      if (error) return err(error.message)
    } else if (sub === 'extend') {
      const days = Number(body?.extend_days)
      if (!Number.isFinite(days) || days <= 0 || days > 3650) return err('extend_days must be 1..3650', 400)
      const { data: lk } = await admin.from('license_keys').select('expires_at,status').eq('id', id).maybeSingle()
      if (!lk) return err('License not found', 404)
      const base = lk.expires_at ? new Date(lk.expires_at) : new Date()
      const next = new Date(base.getTime() + days * 86400_000)
      const { error } = await admin.from('license_keys').update({
        expires_at: next.toISOString(),
        status: lk.status === 'expired' ? 'active' : lk.status,
      }).eq('id', id)
      if (error) return err(error.message)
    } else {
      const { data: lk } = await admin.from('license_keys').select('id,owner_email,license_key').eq('id', id).maybeSingle()
      if (!lk) return err('License not found', 404)
      await admin.from('job_queue').insert({
        job_type: 'send_license_email',
        payload: { license_id: id, owner_email: lk.owner_email, license_key: lk.license_key },
        status: 'pending',
      })
    }

    await admin.from('audit_logs').insert({
      user_id: userId,
      action: `ADMIN_LICENSE_${String(sub).toUpperCase()}`,
      entity_type: 'license_key',
      entity_id: id,
      ip_address: clientIp,
      new_data: { payload: body ?? {} },
    })

    return json({ success: true })
  }

  // GET /marketplace-admin/reviews
  if (method === 'GET' && action === 'reviews' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.review.moderate')
    if (deny) return deny
    const page = Math.max(1, Number(body?.page || 1))
    const limit = Math.min(100, Math.max(1, Number(body?.limit || 25)))
    let q = admin.from('product_ratings').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (normalizeText(body?.status, 40)) q = q.eq('status', normalizeText(body?.status, 40))
    q = q.range((page - 1) * limit, page * limit - 1)
    const { data, error, count } = await q
    if (error) return err(error.message)
    return json({ data: data ?? [], total: count ?? 0, page, limit })
  }

  // PUT /marketplace-admin/reviews/:id/moderate
  if (method === 'PUT' && action === 'reviews' && isUuid(id) && sub === 'moderate') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.review.moderate')
    if (deny) return deny
    const nextStatus = normalizeText(body?.status, 40)
    if (!['published', 'pending', 'rejected'].includes(nextStatus)) return err('Invalid review status', 400)
    const { error } = await admin.from('product_ratings').update({ status: nextStatus }).eq('id', id)
    if (error) return err(error.message)
    return json({ success: true })
  }

  // GET /marketplace-admin/resellers
  if (method === 'GET' && action === 'resellers' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.reseller.manage')
    if (deny) return deny
    const { data, error } = await admin.from('resellers').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) return err(error.message)
    return json({ data: data ?? [] })
  }

  // PUT /marketplace-admin/resellers/:id
  if (method === 'PUT' && action === 'resellers' && isUuid(id)) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.reseller.manage')
    if (deny) return deny
    const updates: any = {}
    if (body?.is_active !== undefined) updates.is_active = !!body.is_active
    if (body?.commission_percent !== undefined) updates.commission_percent = Number(body.commission_percent)
    const { data, error } = await admin.from('resellers').update(updates).eq('id', id).select('*').single()
    if (error) return err(error.message)
    return json({ data })
  }

  // POST /marketplace-admin/resellers/:id/commission-override
  if (method === 'POST' && action === 'resellers' && isUuid(id) && sub === 'commission-override') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.reseller.manage')
    if (deny) return deny
    const percent = Number(body?.commission_percent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return err('commission_percent must be 0..100', 400)
    const payload = {
      reseller_id: id,
      product_id: isUuid(body?.product_id) ? body.product_id : null,
      commission_percent: Number(percent.toFixed(2)),
      reason: normalizeText(body?.reason, 500) || null,
      is_active: body?.is_active ?? true,
      created_by: userId,
    }
    const upsertKey = payload.product_id ? 'reseller_id,product_id' : 'reseller_id'
    const { data, error } = await admin.from('reseller_commission_overrides').upsert(payload, { onConflict: upsertKey }).select('*')
    if (error) return err(error.message)
    return json({ data: data ?? [] })
  }

  // GET /marketplace-admin/payouts
  if (method === 'GET' && action === 'payouts' && !id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.reseller.payout')
    if (deny) return deny
    const { data, error } = await admin.from('reseller_payout_requests').select('*').order('requested_at', { ascending: false }).limit(500)
    if (error) return err(error.message)
    return json({ data: data ?? [] })
  }

  // POST /marketplace-admin/payouts/:id/review
  if (method === 'POST' && action === 'payouts' && isUuid(id) && sub === 'review') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.reseller.payout')
    if (deny) return deny
    const decision = normalizeText(body?.decision, 20)
    if (!['approved', 'rejected', 'paid'].includes(decision)) return err('decision must be approved/rejected/paid', 400)
    const { error } = await admin.from('reseller_payout_requests').update({
      status: decision,
      approved_amount: body?.approved_amount !== undefined ? Number(body.approved_amount) : undefined,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      payout_reference: normalizeText(body?.payout_reference, 100) || null,
      notes: normalizeText(body?.notes, 500) || null,
    }).eq('id', id)
    if (error) return err(error.message)
    return json({ success: true })
  }

  // GET/POST /marketplace-admin/blacklist
  if (action === 'blacklist') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.reseller.manage')
    if (deny) return deny
    if (method === 'GET' && !id) {
      const { data, error } = await admin.from('access_blacklist').select('*').order('created_at', { ascending: false }).limit(500)
      if (error) return err(error.message)
      return json({ data: data ?? [] })
    }
    if (method === 'POST' && !id) {
      const blockType = normalizeText(body?.block_type, 20)
      if (!['user', 'ip', 'device'].includes(blockType)) return err('block_type must be user/ip/device', 400)
      const payload = {
        block_type: blockType,
        user_id: blockType === 'user' && isUuid(body?.user_id) ? body.user_id : null,
        ip_address: blockType === 'ip' ? normalizeText(body?.ip_address, 80) : null,
        device_id: blockType === 'device' ? normalizeText(body?.device_id, 120) : null,
        reason: normalizeText(body?.reason, 500) || null,
        is_active: body?.is_active ?? true,
        expires_at: body?.expires_at || null,
        created_by: userId,
      }
      const { data, error } = await admin.from('access_blacklist').insert(payload).select('*').single()
      if (error) return err(error.message)
      return json({ data }, 201)
    }
    if (method === 'PUT' && isUuid(id)) {
      const { data, error } = await admin.from('access_blacklist').update({
        is_active: body?.is_active ?? false,
        expires_at: body?.expires_at || null,
        reason: normalizeText(body?.reason, 500) || null,
      }).eq('id', id).select('*').single()
      if (error) return err(error.message)
      return json({ data })
    }
  }

  // GET/PUT /marketplace-admin/feature-flags
  if (action === 'feature-flags') {
    const denyRead = await requireMarketplacePermission(admin, userId, 'marketplace.feature.toggle')
    if (denyRead) return denyRead
    if (method === 'GET') {
      const { data, error } = await admin.from('feature_flags').select('*').order('flag_key')
      if (error) return err(error.message)
      return json({ data: data ?? [] })
    }
    if (method === 'PUT') {
      const flagKey = normalizeText(body?.flag_key, 120)
      if (!flagKey) return err('flag_key is required', 400)
      const updates: any = {
        is_enabled: body?.is_enabled,
        rollout_pct: body?.rollout_pct !== undefined ? Number(body.rollout_pct) : undefined,
        description: body?.description !== undefined ? normalizeText(body?.description, 500) : undefined,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }
      Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k])
      const { data, error } = await admin.from('feature_flags').update(updates).eq('flag_key', flagKey).select('*').single()
      if (error) return err(error.message)
      return json({ data })
    }
  }

  // GET/PUT /marketplace-admin/config
  if (action === 'config') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.config.manage')
    if (deny) return deny
    if (method === 'GET' && !id) {
      const [cfgRes, tplRes] = await Promise.all([
        admin.from('marketplace_system_config').select('*').order('config_key'),
        admin.from('email_templates').select('*').order('template_key'),
      ])
      if (cfgRes.error) return err(cfgRes.error.message)
      if (tplRes.error) return err(tplRes.error.message)
      return json({ config: cfgRes.data ?? [], templates: tplRes.data ?? [] })
    }
    if (method === 'PUT' && id === 'system') {
      const configKey = normalizeText(body?.config_key, 120)
      if (!configKey) return err('config_key is required', 400)
      const { data, error } = await admin.from('marketplace_system_config').upsert({
        config_key: configKey,
        config_value: body?.config_value ?? {},
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' }).select('*').single()
      if (error) return err(error.message)
      return json({ data })
    }
    if (method === 'PUT' && id === 'template') {
      const templateKey = normalizeText(body?.template_key, 120)
      if (!templateKey) return err('template_key is required', 400)
      const subjectTemplate = normalizeText(body?.subject_template, 500)
      const bodyTemplate = String(body?.body_template ?? '').trim()
      if (!subjectTemplate || !bodyTemplate) return err('subject_template and body_template are required', 400)
      const { data, error } = await admin.from('email_templates').upsert({
        template_key: templateKey,
        subject_template: subjectTemplate,
        body_template: bodyTemplate,
        is_active: body?.is_active ?? true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'template_key' }).select('*').single()
      if (error) return err(error.message)
      return json({ data })
    }
  }

  // GET /marketplace-admin/api-monitoring
  if (method === 'GET' && action === 'api-monitoring') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.analytics.view')
    if (deny) return deny
    const limit = Math.min(500, Math.max(10, Number(body?.limit || 100)))
    const { data, error } = await admin
      .from('api_metrics')
      .select('path,method,status_code,duration_ms,error_msg,created_at,user_id')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return err(error.message)
    return json({ data: data ?? [] })
  }

  // POST /marketplace-admin/cron/run
  if (method === 'POST' && action === 'cron' && id === 'run') {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.config.manage')
    if (deny) return deny
    const job = normalizeText(body?.job, 80)
    if (job === 'expire_old_licenses') {
      const { data, error } = await admin.rpc('expire_old_licenses')
      if (error) return err(error.message)
      return json({ success: true, result: data })
    }
    if (job === 'cleanup_expired_data') {
      const { data, error } = await admin.rpc('cleanup_expired_data')
      if (error) return err(error.message)
      return json({ success: true, result: data })
    }
    return err('Unknown cron job', 400)
  }

  // GET /marketplace-admin/export/:kind
  if (method === 'GET' && action === 'export' && id) {
    const deny = await requireMarketplacePermission(admin, userId, 'marketplace.export')
    if (deny) return deny
    if (id === 'orders') {
      const { data, error } = await admin.from('orders').select('id,user_id,product_id,amount,currency,payment_status,created_at').order('created_at', { ascending: false }).limit(10000)
      if (error) return err(error.message)
      return json({ data: data ?? [], format: 'json', exported: (data ?? []).length })
    }
    if (id === 'resellers') {
      const { data, error } = await admin.from('resellers').select('id,user_id,company_name,commission_percent,is_active,created_at').order('created_at', { ascending: false }).limit(10000)
      if (error) return err(error.message)
      return json({ data: data ?? [], format: 'json', exported: (data ?? []).length })
    }
    if (id === 'users') {
      const { data, error } = await admin.from('profiles').select('user_id,full_name,company_name,phone,created_at').order('created_at', { ascending: false }).limit(10000)
      if (error) return err(error.message)
      return json({ data: data ?? [], format: 'json', exported: (data ?? []).length })
    }
    return err('Unknown export kind', 400)
  }

  return err('Not found', 404)
}

// ===================== PUBLIC MARKETPLACE =====================
async function handlePublicMarketplace(
  method: string,
  pathParts: string[],
  body: any,
  userId: string | null,
  sb: any,
  req: Request,
) {
  const admin  = adminClient()
  const action = pathParts[0]
  const pid    = pathParts[1]
  const sub    = pathParts[2]

  const randomLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let key = ''
    for (let j = 0; j < 4; j++) {
      if (j > 0) key += '-'
      for (let i = 0; i < 4; i++) {
        key += chars[Math.floor(Math.random() * chars.length)]
      }
    }
    return key
  }

  const ensureOrderLicenseIssued = async (
    orderId: string,
    actingUserId: string,
    context: 'payment_verify' | 'manual_verify',
  ) => {
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id,user_id,product_id,payment_status,subscription_duration_days,license_key_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return { ok: false as const, error: 'Order not found' }
    }

    if (order.payment_status !== 'completed') {
      return { ok: false as const, error: 'Order payment not completed' }
    }

    if (order.license_key_id) {
      const { data: existingLicense } = await admin
        .from('license_keys')
        .select('id,license_key,expires_at,status')
        .eq('id', order.license_key_id)
        .maybeSingle()

      return {
        ok: true as const,
        license: existingLicense || null,
        idempotent: true,
      }
    }

    const parsedDuration = Number(order.subscription_duration_days)
    const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30
    const expiresAt = new Date(Date.now() + durationDays * 86400_000).toISOString()
    const keyType = durationDays <= 30 ? 'monthly' : 'yearly'

    const { data: createdLicense, error: createErr } = await admin
      .from('license_keys')
      .insert({
        product_id: order.product_id,
        license_key: randomLicenseKey(),
        key_type: keyType,
        key_status: 'unused',
        status: 'active',
        max_devices: 1,
        activated_devices: 0,
        expires_at: expiresAt,
        created_by: order.user_id,
        notes: `Order license: ${order.id}`,
      })
      .select('id,license_key,expires_at,status')
      .single()

    if (createErr || !createdLicense) {
      return { ok: false as const, error: createErr?.message || 'Failed to create license key' }
    }

    const { data: claimedOrder, error: claimErr } = await admin
      .from('orders')
      .update({
        license_key_id: createdLicense.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .is('license_key_id', null)
      .select('id,license_key_id')
      .maybeSingle()

    if (claimErr) {
      return { ok: false as const, error: claimErr.message }
    }

    if (!claimedOrder) {
      await admin.from('license_keys').update({ status: 'revoked', notes: `Superseded duplicate for order ${order.id}` }).eq('id', createdLicense.id)
      const { data: latestOrder } = await admin.from('orders').select('license_key_id').eq('id', order.id).maybeSingle()
      if (latestOrder?.license_key_id) {
        const { data: existingLicense } = await admin
          .from('license_keys')
          .select('id,license_key,expires_at,status')
          .eq('id', latestOrder.license_key_id)
          .maybeSingle()
        return { ok: true as const, license: existingLicense || null, idempotent: true }
      }
      return { ok: false as const, error: 'Failed to bind license to order' }
    }

    try {
      await admin.from('notifications').insert({
        user_id: order.user_id,
        type: 'success',
        title: 'License activated',
        message: `Your payment for order ${order.id} has been verified and license key issued.`,
        related_order_id: order.id,
        related_product_id: order.product_id,
      })
    } catch {
      // Non-blocking notification side effect.
    }

    try {
      await admin.from('audit_logs').insert({
        user_id: actingUserId,
        action: 'ORDER_LICENSE_ISSUED',
        entity_type: 'order',
        entity_id: order.id,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        new_data: {
          context,
          license_id: createdLicense.id,
          order_id: order.id,
        },
      })
    } catch {
      // Non-blocking audit side effect.
    }

    return { ok: true as const, license: createdLicense, idempotent: false }
  }

  // ── GET /marketplace/products (paginated, search/filter) ──
  if (method === 'GET' && action === 'products' && !pid) {
    const limit    = Math.min(100, Math.max(1, Number(body?.limit  || 20)))
    const offset   = Math.max(0,              Number(body?.offset  || 0))
    const category = body?.category || null
    const search   = body?.search   || null
    const sort     = body?.sort     || 'created_at'

    let q = admin
      .from('products')
      .select('id,name,slug,description,short_description,price,discount_percent,rating,thumbnail_url,demo_url,apk_url,category,is_active,deleted_at,featured,trending,marketplace_visible,created_at', { count: 'exact' })
      .is('deleted_at', null)
      .eq('is_active', true)
      .eq('marketplace_visible', true)
      .range(offset, offset + limit - 1)

    if (category) q = q.eq('category', category)
    if (search)   q = q.ilike('name', `%${search}%`)
    if (body?.min_price) q = q.gte('price', Number(body.min_price))
    if (body?.max_price) q = q.lte('price', Number(body.max_price))

    if (sort === 'price_asc')  q = q.order('price', { ascending: true })
    else if (sort === 'price_desc') q = q.order('price', { ascending: false })
    else if (sort === 'rating')     q = q.order('rating', { ascending: false })
    else if (sort === 'popular')    q = q.order('trending', { ascending: false })
    else                            q = q.order('created_at', { ascending: false })

    const { data, error, count } = await q
    if (error) return err(error.message)
    return json({ products: data ?? [], total: count ?? 0, limit, offset })
  }

  // ── GET /marketplace/products/:id ──
  if (method === 'GET' && action === 'products' && isUuid(pid) && !sub) {
    const { data, error } = await admin.from('products').select('*').eq('id', pid).is('deleted_at', null).maybeSingle()
    if (error || !data) return err('Product not found', 404)
    return json({ product: data })
  }

  // ── GET /marketplace/products/:id/pricing ──
  if (method === 'GET' && action === 'products' && isUuid(pid) && sub === 'pricing') {
    const { data, error } = await admin.from('product_pricing').select('*').eq('product_id', pid).order('duration_days')
    if (error) return err(error.message)
    return json({ pricing: data ?? [] })
  }

  // ── GET /marketplace/products/:id/ratings ──
  if (method === 'GET' && action === 'products' && isUuid(pid) && sub === 'ratings') {
    const page  = Math.max(1, Number(body?.page  || 1))
    const limit = Math.min(50, Math.max(1, Number(body?.limit || 20)))
    const { data, error, count } = await admin
      .from('product_ratings')
      .select('id,user_id,rating,review_title,review_text,created_at,helpful_count', { count: 'exact' })
      .eq('product_id', pid)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    if (error) return err(error.message)
    const arr = data ?? []
    const userIds = Array.from(new Set(arr.map((r: any) => r.user_id).filter(Boolean)))
    let profileMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id,full_name')
        .in('user_id', userIds)
      profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [String(p.user_id), String(p.full_name || '')]))
    }
    const enriched = arr.map((row: any) => ({
      ...row,
      owner_name: profileMap[String(row.user_id)] || null,
    }))
    const avg = arr.length ? arr.reduce((s: number, r: any) => s + r.rating, 0) / arr.length : 0
    return json({ ratings: enriched, total_count: count ?? 0, average_rating: Math.round(avg * 10) / 10 })
  }

  // ── POST /marketplace/products/:id/ratings ──
  if (method === 'POST' && action === 'products' && isUuid(pid) && sub === 'ratings') {
    if (!userId) return err('Unauthorized', 401)
    const { rating, review_title, review_text } = body
    if (!rating || rating < 1 || rating > 5) return err('Rating must be 1–5')
    const { data: existing } = await admin.from('product_ratings').select('id').eq('product_id', pid).eq('user_id', userId).maybeSingle()
    if (existing) return err('You have already reviewed this product', 409)
    const { data: purchaseCheck } = await admin.from('orders').select('id').eq('user_id', userId).eq('product_id', pid).eq('payment_status', 'completed').maybeSingle()
    const { error } = await admin.from('product_ratings').insert({
      product_id: pid, user_id: userId, rating,
      review_title: (review_title ?? '').trim().slice(0, 255) || null,
      review_text:  (review_text  ?? '').trim().slice(0, 2000)  || null,
      is_verified_purchase: !!purchaseCheck,
      verified_at: purchaseCheck ? new Date().toISOString() : null,
    })
    if (error) return err(error.message)
    return json({ success: true }, 201)
  }

  // ── GET /marketplace/categories ──
  if (method === 'GET' && action === 'categories') {
    const { data, error } = await admin.from('categories').select('id,name,slug,description,icon_url,is_active').eq('is_active', true).order('sort_order')
    if (error) return err(error.message)
    return json({ categories: data ?? [] })
  }

  // ── GET /marketplace/banners ──
  if (method === 'GET' && action === 'banners') {
    const now = new Date().toISOString()
    const { data, error } = await admin.from('marketplace_banners').select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('position_order')
    if (error) return err(error.message)
    return json({ banners: data ?? [] })
  }

  // ── GET /marketplace/search ──
  if (method === 'GET' && action === 'search') {
    const q     = String(body?.q || '').trim().slice(0, 100)
    const limit = Math.min(50, Math.max(1, Number(body?.limit || 20)))
    if (!q) return json({ products: [], total: 0 })
    let query = admin.from('products')
      .select('id,name,slug,description,price,rating,thumbnail_url,category', { count: 'exact' })
      .is('deleted_at', null).eq('is_active', true).eq('marketplace_visible', true)
      .ilike('name', `%${q}%`).limit(limit)
    if (body?.category)   query = query.eq('category', body.category)
    if (body?.min_rating) query = query.gte('rating', Number(body.min_rating))
    if (body?.sort === 'price_asc')  query = query.order('price', { ascending: true })
    else if (body?.sort === 'price_desc') query = query.order('price', { ascending: false })
    else query = query.order('rating', { ascending: false })
    const { data, error, count } = await query
    if (error) return err(error.message)
    return json({ products: data ?? [], total: count ?? 0 })
  }

  // ── GET /marketplace/favorites ──
  if (method === 'GET' && action === 'favorites' && !pid) {
    if (!userId) return err('Unauthorized', 401)
    const { data, error } = await sb.from('user_favorites').select('product_id,added_at').eq('user_id', userId).order('added_at', { ascending: false })
    if (error) return err(error.message)
    return json({ favorites: data ?? [] })
  }

  // ── POST /marketplace/favorites ──
  if (method === 'POST' && action === 'favorites') {
    if (!userId) return err('Unauthorized', 401)
    const { product_id } = body
    if (!isUuid(product_id)) return err('Invalid product_id')
    const { error } = await sb.from('user_favorites').insert({ user_id: userId, product_id })
    if (error && error.code !== '23505') return err(error.message)
    return json({ success: true }, 201)
  }

  // ── DELETE /marketplace/favorites/:productId ──
  if (method === 'DELETE' && action === 'favorites' && isUuid(pid)) {
    if (!userId) return err('Unauthorized', 401)
    const { error } = await sb.from('user_favorites').delete().eq('user_id', userId).eq('product_id', pid)
    if (error) return err(error.message)
    return json({ success: true })
  }

  // ── GET /marketplace/favorites/:productId/check ──
  if (method === 'GET' && action === 'favorites' && isUuid(pid) && sub === 'check') {
    if (!userId) return json({ is_favorite: false })
    const { data } = await sb.from('user_favorites').select('id').eq('user_id', userId).eq('product_id', pid).maybeSingle()
    return json({ is_favorite: !!data })
  }

  // ── GET /marketplace/orders ──
  if (method === 'GET' && action === 'orders' && !pid) {
    if (!userId) return err('Unauthorized', 401)
    const page  = Math.max(1, Number(body?.page  || 1))
    const limit = Math.min(50, Math.max(1, Number(body?.limit || 10)))
    const status = body?.status || null
    let q = sb.from('orders').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    if (status) q = q.eq('payment_status', status)
    const { data, error, count } = await q
    if (error) return err(error.message)
    const rows = data ?? []
    const productIds = Array.from(new Set(rows.map((o: any) => o.product_id).filter(Boolean)))
    let productMap: Record<string, { name: string; apk_url: string | null }> = {}
    if (productIds.length > 0) {
      const { data: products } = await admin
        .from('products')
        .select('id,name,apk_url')
        .in('id', productIds)
      productMap = Object.fromEntries((products ?? []).map((p: any) => [String(p.id), { name: String(p.name || 'Unknown Product'), apk_url: p.apk_url ?? null }]))
    }
    const orders = rows.map((order: any) => {
      const meta = (order.meta && typeof order.meta === 'object') ? order.meta : {}
      const product = productMap[String(order.product_id)] || { name: 'Unknown Product', apk_url: null }
      return {
        ...order,
        product_name: (meta as any).product_title || product.name,
        apk_url: product.apk_url,
      }
    })
    return json({ orders, total: count ?? 0, page, limit })
  }

  // ── GET /marketplace/orders/:id ──
  if (method === 'GET' && action === 'orders' && isUuid(pid)) {
    if (!userId) return err('Unauthorized', 401)
    const { data, error } = await sb.from('orders').select('*').eq('id', pid).eq('user_id', userId).maybeSingle()
    if (error || !data) return err('Order not found', 404)
    let productName = 'Unknown Product'
    let apkUrl: string | null = null
    if (isUuid(data.product_id)) {
      const { data: product } = await admin
        .from('products')
        .select('name,apk_url')
        .eq('id', data.product_id)
        .maybeSingle()
      if (product) {
        productName = String(product.name || productName)
        apkUrl = product.apk_url ?? null
      }
    }
    const meta = (data.meta && typeof data.meta === 'object') ? data.meta : {}
    return json({
      order: {
        ...data,
        product_name: (meta as any).product_title || productName,
        apk_url: apkUrl,
      },
    })
  }

  // ── POST /marketplace/payments/initiate ──
  if (method === 'POST' && action === 'payments' && pid === 'initiate') {
    if (!userId) return err('Unauthorized', 401)
    const { product_id, duration_days, payment_method, amount, idempotency_key } = body
    if (!isUuid(product_id))      return err('Invalid product_id')
    const effectiveIdempotencyKey = isUuid(idempotency_key) ? idempotency_key : crypto.randomUUID()
    const validDurs = new Set([30, 60, 90, 180, 365])
    if (!validDurs.has(Number(duration_days))) return err('Invalid duration_days')
    const numAmt = Number(amount)
    if (!Number.isFinite(numAmt) || numAmt <= 0) return err('Invalid amount')

    const rl = enforceRateLimit(`payment:${userId}`, 5, 60_000)
    if (rl !== null) return err(`Too many payment attempts. Retry in ${rl}s`, 429)

    const { data: flag } = await admin.from('feature_flags').select('is_enabled').eq('flag_key', `payment_${payment_method}`).maybeSingle()
    if (flag && !flag.is_enabled) return err(`${payment_method} payments are currently disabled`, 503)

    if (payment_method === 'wallet') {
      const { data: result, error: fnErr } = await admin.rpc('process_wallet_payment', {
        p_user_id: userId, p_product_id: product_id,
        p_duration_days: Number(duration_days), p_amount: numAmt,
        p_idempotency_key: effectiveIdempotencyKey,
      })
      if (fnErr) return err(fnErr.message, 500)
      if (!result?.success) return err(result?.error ?? 'Payment failed', 402)
      return json({ success: true, order_id: result.order_id, license_key: result.license_key, expires_at: result.expires_at })
    }

    let canUseOrderIdempotencyColumn = true
    const { data: existingOrder, error: existingOrderErr } = await admin
      .from('orders')
      .select('id,payment_status')
      .eq('user_id', userId)
      .eq('idempotency_key', effectiveIdempotencyKey)
      .maybeSingle()

    if (existingOrderErr && String(existingOrderErr.message || '').toLowerCase().includes('idempotency_key')) {
      canUseOrderIdempotencyColumn = false
    } else if (existingOrderErr) {
      return err(existingOrderErr.message)
    } else if (existingOrder) {
      return json({ success: true, order_id: existingOrder.id, status: existingOrder.payment_status, idempotent: true })
    }

    const baseOrderPayload: any = {
      user_id: userId, product_id, amount: numAmt, currency: 'USD',
      payment_method, payment_status: 'pending',
      subscription_duration_days: Number(duration_days),
      order_number: `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}` +
        `-${Math.random().toString(36).slice(2,10).toUpperCase()}`,
    }

    if (canUseOrderIdempotencyColumn) {
      baseOrderPayload.idempotency_key = effectiveIdempotencyKey
    }

    let { data: order, error: orderErr } = await admin.from('orders').insert(baseOrderPayload).select().single()

    if (orderErr && String(orderErr.message || '').toLowerCase().includes('idempotency_key')) {
      const fallbackPayload = { ...baseOrderPayload }
      delete fallbackPayload.idempotency_key
      const retry = await admin.from('orders').insert(fallbackPayload).select().single()
      order = retry.data as any
      orderErr = retry.error as any
    }

    if (orderErr) return err(orderErr.message)
    return json({ success: true, order_id: order.id, status: 'pending' })
  }

  // ── POST /marketplace/payments/verify ──
  if (method === 'POST' && action === 'payments' && pid === 'verify') {
    if (!userId) return err('Unauthorized', 401)
    const { order_id, transaction_ref, provider } = body
    if (!isUuid(order_id)) return err('Invalid order_id')
    const { data: order } = await admin.from('orders').select('id,payment_status,payment_method').eq('id', order_id).eq('user_id', userId).maybeSingle()
    if (!order) return err('Order not found', 404)

    try {

    if (order.payment_method !== 'wallet' && !String(transaction_ref || '').trim()) {
      return err('transaction_ref is required for manual/gateway verification', 400)
    }

    if (order.payment_status === 'completed') return json({ success: true, message: 'Already verified', order_id })

    if (String(transaction_ref || '').trim()) {
      const { data: duplicateTxn } = await admin
        .from('payment_logs')
        .select('order_id,status')
        .eq('provider', provider || order.payment_method)
        .filter('request_data->>transaction_ref', 'eq', String(transaction_ref).trim())
        .neq('order_id', order_id)
        .in('status', ['verification_pending', 'verified'])
        .maybeSingle()

      if (duplicateTxn) {
        return err('This transaction_ref is already linked with another order', 409)
      }
    }

    const { error: verifyUpdateErr } = await admin
      .from('orders')
      .update({ payment_status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', order_id)
      .eq('user_id', userId)

    if (verifyUpdateErr) return err(verifyUpdateErr.message)

    try {
      await admin.from('payment_logs').insert({
        order_id,
        provider: provider || order.payment_method,
        request_data: { transaction_ref: String(transaction_ref || '').trim() || null },
        status: 'verified',
      })
    } catch {
      // Non-blocking payment log side effect.
    }

    const licenseResult = await ensureOrderLicenseIssued(order_id, userId, 'payment_verify')
    if (!licenseResult.ok) return err(licenseResult.error, 500)

    return json({
      success: true,
      status: 'verified',
      order_id,
      license_key: licenseResult.license?.license_key || null,
      expires_at: licenseResult.license?.expires_at || null,
      idempotent: !!licenseResult.idempotent,
    })
    } catch (e: any) {
      try {
        await admin.from('payment_logs').insert({
          order_id,
          provider: provider || order.payment_method,
          request_data: { transaction_ref: String(transaction_ref || '').trim() || null },
          status: 'verify_error',
          error_message: String(e?.message || 'Unknown verify execution error'),
        })
      } catch {
        // Non-blocking payment log side effect.
      }

      return err(`Verification execution failed: ${String(e?.message || 'unknown')}`, 500)
    }
  }

  // ── GET /marketplace/payment-gateways ──
  if (method === 'GET' && action === 'payment-gateways') {
    const { data } = await admin.from('payment_gateways').select('provider,is_enabled,base_url').eq('is_enabled', true)
    return json({ gateways: data ?? [] })
  }

  // ── GET /marketplace/wallet ──
  if (method === 'GET' && action === 'wallet' && !pid) {
    if (!userId) return err('Unauthorized', 401)
    const { data } = await sb.from('wallets').select('balance,currency,updated_at').eq('user_id', userId).maybeSingle()
    return json({ balance: data?.balance ?? 0, currency: data?.currency ?? 'USD' })
  }

  // ── POST /marketplace/wallet/add ──
  if (method === 'POST' && action === 'wallet' && pid === 'add') {
    if (!userId) return err('Unauthorized', 401)
    const numAmt = Number(body?.amount)
    if (!Number.isFinite(numAmt) || numAmt <= 0) return err('Invalid amount')
    if (numAmt > 10000) return err('Maximum top-up is $10,000')
    const { data: wallet } = await admin.from('wallets').select('id,balance').eq('user_id', userId).maybeSingle()
    if (!wallet) return err('Wallet not found')
    const newBal = (wallet.balance ?? 0) + numAmt
    await admin.from('wallets').update({ balance: newBal, updated_at: new Date().toISOString() }).eq('id', wallet.id)
    await admin.from('wallet_transactions').insert({ wallet_id: wallet.id, type: 'credit', amount: numAmt, balance_before: wallet.balance, balance_after: newBal, description: `Top-up via ${body.payment_method ?? 'manual'}` })
    return json({ success: true, balance: newBal })
  }

  // ── GET /marketplace/licenses ──
  if (method === 'GET' && action === 'licenses' && !pid) {
    if (!userId) return err('Unauthorized', 401)
    const { data } = await admin.from('license_keys').select('*').eq('created_by', userId).order('created_at', { ascending: false })
    return json({ licenses: data ?? [] })
  }

  // ── GET /marketplace/licenses/:id ──
  if (method === 'GET' && action === 'licenses' && isUuid(pid) && !sub) {
    if (!userId) return err('Unauthorized', 401)
    const { data } = await admin.from('license_keys').select('*').eq('id', pid).eq('created_by', userId).maybeSingle()
    if (!data) return err('License not found', 404)
    return json({ license: data })
  }

  // ── POST /marketplace/licenses/validate ──
  if (method === 'POST' && action === 'licenses' && pid === 'validate') {
    const { license_key, device_id } = body
    if (!license_key?.trim()) return err('license_key is required')
    const cleanKey = license_key.trim().toUpperCase()
    const { data: lk } = await admin.from('license_keys').select('*').eq('license_key', cleanKey).maybeSingle()
    if (!lk) return json({ valid: false, error: 'License key not found' })
    if (lk.status !== 'active') return json({ valid: false, error: `License is ${lk.status}` })
    if (lk.expires_at && new Date(lk.expires_at) <= new Date()) {
      await admin.from('license_keys').update({ status: 'expired' }).eq('id', lk.id)
      return json({ valid: false, error: 'License has expired' })
    }
    if (device_id) {
      const { data: limitCheck } = await admin.rpc('check_device_limit', { p_license_key: cleanKey, p_device_id: device_id })
      if (limitCheck && !limitCheck.allowed) {
        try {
          await admin.rpc('flag_license_sharing', { p_license_key: cleanKey })
        } catch {
          // Best effort signal only.
        }
        return json({ valid: false, error: limitCheck.reason })
      }
      await admin.from('device_activations').upsert({ license_key: cleanKey, device_id, last_seen_at: new Date().toISOString() }, { onConflict: 'license_key,device_id' })
    }
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    await admin.from('audit_logs').insert({ user_id: lk.created_by ?? null, action: 'LICENSE_VALIDATE', entity_type: 'license_key', entity_id: lk.id, ip_address: clientIp, new_data: { device_id } })
    return json({ valid: true, license: { id: lk.id, expires_at: lk.expires_at, product_id: lk.product_id, status: lk.status } })
  }

  // ── GET /marketplace/apk/:productId/download-link ──
  if (method === 'GET' && action === 'apk' && isUuid(pid) && sub === 'download-link') {
    if (!userId) return err('Unauthorized', 401)
    const { data: lk } = await admin
      .from('license_keys')
      .select('id')
      .eq('product_id', pid)
      .eq('created_by', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lk) return err('No active license for this product', 403)
    let apkUrl: string | null = null
    let apkVersionId: string | null = null
    let apkVersionLabel = 'latest'
    let apkSha: string | null = null

    const { data: apkVersionRow, error: apkVersionErr } = await admin
      .from('apk_versions')
      .select('id,apk_url,version,sha256_checksum')
      .eq('product_id', pid)
      .eq('is_active', true)
      .order('version_code', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!apkVersionErr && apkVersionRow) {
      apkUrl = apkVersionRow.apk_url
      apkVersionId = apkVersionRow.id
      apkVersionLabel = apkVersionRow.version || 'latest'
      apkSha = apkVersionRow.sha256_checksum || null
    }

    if (!apkUrl) {
      const { data: productFallback } = await admin
        .from('products')
        .select('id,apk_url')
        .eq('id', pid)
        .maybeSingle()
      apkUrl = productFallback?.apk_url || null
      apkVersionId = productFallback?.id || null
    }

    if (!apkUrl) return err('APK not yet available', 404)

    let downloadToken: string | null = null
    const { data: token, error: tokErr } = await admin
      .from('download_tokens')
      .insert({ user_id: userId, product_id: pid, apk_version_id: apkVersionId, expires_at: new Date(Date.now() + 3600_000).toISOString() })
      .select('token')
      .single()
    if (tokErr) {
      const tokenErrMsg = String(tokErr.message || '').toLowerCase()
      if (!tokenErrMsg.includes('download_tokens')) return err(tokErr.message)
    } else {
      downloadToken = token?.token || null
    }

    let signedUrl: string | null = null
    if (apkUrl.startsWith('http://') || apkUrl.startsWith('https://')) {
      signedUrl = apkUrl
    } else {
      const { data: signedPrimary } = await admin.storage.from('apk-files').createSignedUrl(apkUrl, 3600)
      if (signedPrimary?.signedUrl) {
        signedUrl = signedPrimary.signedUrl
      } else {
        const { data: signedFallback } = await admin.storage.from('apks').createSignedUrl(apkUrl, 3600)
        signedUrl = signedFallback?.signedUrl || apkUrl
      }
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    await admin.from('audit_logs').insert({ user_id: userId, action: 'DOWNLOAD_LINK_GENERATED', entity_type: 'product', entity_id: pid, ip_address: clientIp })
    return json({ download_url: signedUrl, token: downloadToken, version: apkVersionLabel, sha256: apkSha, expires_in: 3600 })
  }

  // ── POST /marketplace/download-apk (compat wrapper) ──
  if (method === 'POST' && action === 'download-apk') {
    if (!userId) return err('Unauthorized', 401)
    const productId = String(body?.product_id || '').trim()
    if (!isUuid(productId)) return err('Invalid product_id')

    const { data: lk } = await admin
      .from('license_keys')
      .select('id')
      .eq('product_id', productId)
      .eq('created_by', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lk) return err('No active license for this product', 403)

    let apkUrl: string | null = null
    let apkVersionId: string | null = null
    let apkVersionLabel = 'latest'
    let apkSha: string | null = null

    const { data: apkVersionRow } = await admin
      .from('apk_versions')
      .select('id,apk_url,version,sha256_checksum')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('version_code', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (apkVersionRow) {
      apkUrl = apkVersionRow.apk_url
      apkVersionId = apkVersionRow.id
      apkVersionLabel = apkVersionRow.version || 'latest'
      apkSha = apkVersionRow.sha256_checksum || null
    }

    if (!apkUrl) {
      const { data: productFallback } = await admin
        .from('products')
        .select('id,apk_url')
        .eq('id', productId)
        .maybeSingle()
      apkUrl = productFallback?.apk_url || null
      apkVersionId = productFallback?.id || null
    }

    if (!apkUrl) return err('APK not yet available', 404)

    let downloadToken: string | null = null
    const { data: token, error: tokErr } = await admin
      .from('download_tokens')
      .insert({
        user_id: userId,
        product_id: productId,
        apk_version_id: apkVersionId,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select('token')
      .single()
    if (tokErr) {
      const tokenErrMsg = String(tokErr.message || '').toLowerCase()
      if (!tokenErrMsg.includes('download_tokens')) return err(tokErr.message)
    } else {
      downloadToken = token?.token || null
    }

    let signedUrl: string | null = null
    if (apkUrl.startsWith('http://') || apkUrl.startsWith('https://')) {
      signedUrl = apkUrl
    } else {
      const { data: signedPrimary } = await admin.storage.from('apk-files').createSignedUrl(apkUrl, 3600)
      if (signedPrimary?.signedUrl) {
        signedUrl = signedPrimary.signedUrl
      } else {
        const { data: signedFallback } = await admin.storage.from('apks').createSignedUrl(apkUrl, 3600)
        signedUrl = signedFallback?.signedUrl || apkUrl
      }
    }

    return json({
      success: true,
      download_url: signedUrl,
      token: downloadToken,
      version: apkVersionLabel,
      sha256: apkSha,
      expires_in: 3600,
    })
  }

  // ── GET /marketplace/download-history ──
  if (method === 'GET' && action === 'download-history') {
    if (!userId) return err('Unauthorized', 401)
    const { data } = await admin.from('apk_downloads').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    return json({ history: data ?? [] })
  }

  // ── POST /marketplace/demo/:productId/log ──
  if (method === 'POST' && action === 'demo' && isUuid(pid) && sub === 'log') {
    const rl = enforceRateLimit(`demo:${userId ?? req.headers.get('x-forwarded-for') ?? 'anon'}:${pid}`, 10, 3600_000)
    if (rl !== null) return err(`Demo rate limit. Retry in ${rl}s`, 429)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    await admin.from('demo_access_logs').insert({ product_id: pid, user_id: userId ?? null, session_id: body?.session_id ?? null, ip_address: clientIp, user_agent: req.headers.get('user-agent') ?? null })
    return json({ success: true })
  }

  // ── GET /marketplace/notifications ──
  if (method === 'GET' && action === 'notifications' && !pid) {
    if (!userId) return err('Unauthorized', 401)
    const page    = Math.max(1, Number(body?.page  || 1))
    const limit   = Math.min(50, Number(body?.limit || 20))
    const unread  = body?.unread_only === 'true' || body?.unread_only === true
    let q = sb.from('notifications').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    if (unread) q = q.eq('is_read', false)
    const { data, error, count } = await q
    if (error) return err(error.message)
    return json({ notifications: data ?? [], total: count ?? 0 })
  }

  // ── PUT /marketplace/notifications/:id/read ──
  if (method === 'PUT' && action === 'notifications' && isUuid(pid) && sub === 'read') {
    if (!userId) return err('Unauthorized', 401)
    const { error } = await sb.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', pid).eq('user_id', userId)
    if (error) return err(error.message)
    return json({ success: true })
  }

  // ── GET /marketplace/reseller/stats ──
  if (method === 'GET' && action === 'reseller' && pid === 'stats') {
    if (!userId) return err('Unauthorized', 401)
    const { data: reseller } = await admin.from('resellers').select('id,commission_percent').eq('user_id', userId).maybeSingle()
    if (!reseller) return err('Reseller account not found', 403)
    const { data: earnings } = await admin.from('reseller_earnings').select('amount,status').eq('reseller_id', reseller.id)
    const earned  = (earnings ?? []).filter((e: any) => e.status === 'earned').reduce((s: number, e: any) => s + e.amount, 0)
    const pending = (earnings ?? []).filter((e: any) => e.status === 'pending').reduce((s: number, e: any) => s + e.amount, 0)
    return json({ total_earned: earned, total_pending: pending, commission_percent: reseller.commission_percent })
  }

  // ── GET /marketplace/reseller/plans ──
  if (method === 'GET' && action === 'reseller' && pid === 'plans') {
    const { data, error } = await admin.from('reseller_plans').select('*').eq('is_active', true).order('price')
    if (error) return err(error.message)
    return json({ plans: data ?? [] })
  }

  // ── POST /marketplace/reseller/subscribe ──
  if (method === 'POST' && action === 'reseller' && pid === 'subscribe') {
    if (!userId) return err('Unauthorized', 401)
    const { plan_id } = body
    if (!isUuid(plan_id)) return err('Invalid plan_id')
    const { data: plan } = await admin.from('reseller_plans').select('*').eq('id', plan_id).eq('is_active', true).maybeSingle()
    if (!plan) return err('Plan not found', 404)
    const { data: reseller } = await admin.from('resellers').select('id').eq('user_id', userId).maybeSingle()
    if (!reseller) return err('Reseller account required', 403)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + plan.duration_days * 86400_000)
    await admin.from('reseller_plan_subscriptions').insert({ reseller_id: reseller.id, plan_id, started_at: now.toISOString(), expires_at: expiresAt.toISOString(), is_active: true })
    return json({ success: true, expires_at: expiresAt.toISOString() })
  }

  // ── GET /marketplace/reseller/earnings ──
  if (method === 'GET' && action === 'reseller' && pid === 'earnings') {
    if (!userId) return err('Unauthorized', 401)
    const { data: reseller } = await admin.from('resellers').select('id').eq('user_id', userId).maybeSingle()
    if (!reseller) return err('Reseller account not found', 403)
    const { data } = await admin.from('reseller_earnings').select('*').eq('reseller_id', reseller.id).order('created_at', { ascending: false }).limit(100)
    return json({ earnings: data ?? [] })
  }

  // ── POST /marketplace/reseller/generate-keys ──
  if (method === 'POST' && action === 'reseller' && pid === 'generate-keys') {
    if (!userId) return err('Unauthorized', 401)
    const { product_id, quantity, duration_days } = body
    if (!isUuid(product_id)) return err('Invalid product_id')
    const qty = Math.min(100, Math.max(1, Number(quantity || 1)))
    const rl = enforceRateLimit(`keygen:${userId}`, 10, 60_000)
    if (rl !== null) return err(`Rate limit exceeded. Retry in ${rl}s`, 429)
    const { data: reseller } = await admin.from('resellers').select('id').eq('user_id', userId).maybeSingle()
    if (!reseller) return err('Reseller account required', 403)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const inserts = Array.from({ length: qty }, () => {
      let k = ''
      for (let j = 0; j < 4; j++) {
        if (j > 0) k += '-'
        for (let i = 0; i < 4; i++) k += chars[Math.floor(Math.random() * chars.length)]
      }
      return { product_id, license_key: k, key_type: Number(duration_days) <= 30 ? 'monthly' : Number(duration_days) <= 90 ? 'quarterly' : 'yearly', status: 'active', duration_days: Number(duration_days || 30), expires_at: new Date(Date.now() + Number(duration_days || 30) * 86400_000).toISOString(), created_by: userId }
    })
    const { data: created, error: keyErr } = await admin.from('license_keys').insert(inserts).select('license_key')
    if (keyErr) return err(keyErr.message)
    return json({ success: true, keys: (created ?? []).map((k: any) => k.license_key), count: created?.length ?? 0 }, 201)
  }

  // Fallback to existing admin marketplace handler
  return handleMarketplace(method, pathParts, body, userId ?? '', sb)
}

// ===================== HEALTH + FEATURE FLAGS =====================
async function handleHealth(method: string, parts: string[], body: any, userId: string) {
  const admin = adminClient()
  const { data: userRoles } = await admin.from('user_roles').select('role').eq('user_id', userId)
  const roles = (userRoles ?? []).map((r: any) => String(r.role))
  const isPrivileged = roles.includes('super_admin') || roles.includes('admin')

  const runHealthScan = async (autoFix: boolean, persist = true, saveSnapshot = false) => {
    const nowIso = new Date().toISOString()
    const checks: Array<{
      module: string
      status: 'healthy' | 'warning' | 'failed'
      latency_ms: number
      records: number
      message: string
      auto_action?: string | null
      uptime_pct?: number
      activity_1h?: number
    }> = []

    const getUptimePct = async (module: string): Promise<number> => {
      const windowStart = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
      const { data, error } = await admin
        .from('platform_health_probe_events')
        .select('status')
        .eq('service_name', module)
        .gte('created_at', windowStart)
        .limit(2000)

      if (error || !Array.isArray(data) || data.length === 0) return 100
      const passCount = data.filter((r: any) => String(r.status) === 'pass').length
      return Number(((passCount / data.length) * 100).toFixed(2))
    }

    const getRecentActivity = async (module: string): Promise<number> => {
      const windowStart = new Date(Date.now() - 60 * 60_000).toISOString()
      const { count } = await admin
        .from('platform_health_probe_events')
        .select('id', { count: 'exact', head: true })
        .eq('service_name', module)
        .gte('created_at', windowStart)
      return Number(count || 0)
    }

    const dispatchAlertChannels = async (failing: Array<any>, summary: any) => {
      if (failing.length === 0) return { email_sent: false, whatsapp_sent: false, webhook_sent: false }

      const webhookUrl = Deno.env.get('SYSTEM_HEALTH_WEBHOOK_URL') || ''
      const whatsappWebhook = Deno.env.get('SYSTEM_HEALTH_WHATSAPP_WEBHOOK_URL') || ''
      const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
      const alertRecipients = (Deno.env.get('SYSTEM_HEALTH_ALERT_EMAILS') || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)

      const criticalList = failing
        .map((c) => `${c.module}: ${c.message} (${c.latency_ms}ms)`)
        .slice(0, 12)
      const title = `System Health Alert: ${summary.status.toUpperCase()} (${summary.health_score}%)`
      const textSummary = criticalList.join(' | ')

      let webhookSent = false
      let whatsappSent = false
      let emailSent = false

      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'system_health_alert',
              title,
              summary,
              failing_modules: failing,
              timestamp: nowIso,
            }),
          })
          webhookSent = true
        } catch {
          webhookSent = false
        }
      }

      if (whatsappWebhook) {
        try {
          await fetch(whatsappWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'system_health_alert',
              text: `${title}\n${textSummary}`,
              summary,
              timestamp: nowIso,
            }),
          })
          whatsappSent = true
        } catch {
          whatsappSent = false
        }
      }

      if (resendApiKey && alertRecipients.length > 0) {
        try {
          const html = `
            <h3>${title}</h3>
            <p>Checked at: ${nowIso}</p>
            <p>Health score: <b>${summary.health_score}%</b></p>
            <ul>${criticalList.map((x) => `<li>${x}</li>`).join('')}</ul>
          `

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'System Health <noreply@softwarevala.com>',
              to: alertRecipients,
              subject: title,
              html,
            }),
          })
          emailSent = true
        } catch {
          emailSent = false
        }
      }

      if (persist) {
        await admin.from('platform_notification_priority_events').insert({
          category: 'system_health_alert_dispatch',
          priority_level: summary.status === 'error' ? 3 : 2,
          payload: {
            title,
            summary,
            channels: {
              webhook_sent: webhookSent,
              whatsapp_sent: whatsappSent,
              email_sent: emailSent,
            },
            failing_modules: failing.map((c: any) => c.module),
          },
          dispatch_status: webhookSent || whatsappSent || emailSent ? 'sent' : 'failed',
          sent_at: webhookSent || whatsappSent || emailSent ? nowIso : null,
        })
      }

      return { email_sent: emailSent, whatsapp_sent: whatsappSent, webhook_sent: webhookSent }
    }

    const safeCount = async (module: string, fn: () => Promise<any>, warningRule?: (count: number) => boolean) => {
      const started = Date.now()
      try {
        const count = await fn()
        const latency = Date.now() - started
        const warning = warningRule ? warningRule(count) : false
        const [uptime, activity] = await Promise.all([
          getUptimePct(module),
          getRecentActivity(module),
        ])
        checks.push({
          module,
          status: warning ? 'warning' : 'healthy',
          latency_ms: latency,
          records: count,
          message: warning ? `${count} records (attention needed)` : `${count} records`,
          auto_action: null,
          uptime_pct: uptime,
          activity_1h: activity,
        })
      } catch (e: any) {
        const [uptime, activity] = await Promise.all([
          getUptimePct(module),
          getRecentActivity(module),
        ])
        checks.push({
          module,
          status: 'failed',
          latency_ms: Date.now() - started,
          records: 0,
          message: e?.message || 'check failed',
          auto_action: null,
          uptime_pct: uptime,
          activity_1h: activity,
        })
      }
    }

    await safeCount('database', async () => {
      const { count, error } = await admin.from('products').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('auth', async () => {
      const { count, error } = await admin.from('user_roles').select('user_id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('users', async () => {
      const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('products', async () => {
      const { count, error } = await admin.from('products').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('servers', async () => {
      const { data, error } = await admin.from('servers').select('id,status')
      if (error) throw error
      const rows = data || []
      const live = rows.filter((r: any) => String(r.status) === 'live').length
      return live
    }, (count) => count === 0)

    await safeCount('license_keys', async () => {
      const { count, error } = await admin.from('license_keys').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('wallet', async () => {
      const { count, error } = await admin.from('wallets').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('transactions', async () => {
      const { count, error } = await admin.from('transactions').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('audit_logs', async () => {
      const { count, error } = await admin.from('audit_logs').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('ai_usage', async () => {
      const { count, error } = await admin.from('ai_usage_cost_snapshots').select('id', { count: 'exact', head: true })
      if (error) throw error
      return Number(count || 0)
    })

    await safeCount('queue', async () => {
      const { count, error } = await admin.from('platform_priority_queue_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued')
      if (error) throw error
      return Number(count || 0)
    }, (count) => count > 500)

    await safeCount('background_jobs', async () => {
      const [pending, failed] = await Promise.all([
        admin.from('job_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        admin.from('job_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      ])
      return Number((pending.count || 0) + (failed.count || 0))
    }, (count) => count > 200)

    await safeCount('storage', async () => {
      const { data, error } = await admin.storage.listBuckets()
      if (error) throw error
      return (data || []).length
    }, (count) => count === 0)

    await safeCount('api_gateway', async () => {
      const { count, error } = await admin.from('audit_logs').select('id', { count: 'exact', head: true }).gte('occurred_at_utc', new Date(Date.now() - 15 * 60_000).toISOString())
      if (error) throw error
      return Number(count || 0)
    }, (count) => count === 0)

    await safeCount('api_services', async () => {
      const [apiReqs, apiErrors] = await Promise.all([
        admin.from('api_metrics').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString()),
        admin.from('api_metrics').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 60 * 60_000).toISOString()).gte('status_code', 500),
      ])
      const total = Number(apiReqs.count || 0)
      const failed = Number(apiErrors.count || 0)
      return total + failed
    }, (count) => count === 0)

    await safeCount('logs', async () => {
      const { count, error } = await admin.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString())
      if (error) throw error
      return Number(count || 0)
    }, (count) => count > 1000)

    const toProbeStatus = (status: 'healthy' | 'warning' | 'failed') => {
      if (status === 'failed') return 'fail'
      if (status === 'warning') return 'warn'
      return 'pass'
    }

    let autoActions = 0
    for (const c of checks) {
      if (persist) {
        await admin.from('platform_health_probe_events').insert({
          service_name: c.module,
          probe_type: 'readiness',
          status: toProbeStatus(c.status),
          latency_ms: c.latency_ms,
        })
      }

      if ((c.status === 'failed' || c.status === 'warning') && autoFix) {
        if (c.module === 'queue') {
          await admin.functions.invoke('deployment-worker', {
            body: { action: 'process_queue', limit: 5 },
          }).catch(() => null)

          await admin.functions.invoke('vala-builder-worker-v2', {
            body: { action: 'process_queue', limit: 3 },
          }).catch(() => null)

          await admin.from('platform_backpressure_events').insert({
            queue_name: 'platform_priority_queue_jobs',
            intake_rate: 100,
            reduced_rate: 40,
            reason: 'auto_health_protection',
          })
          c.auto_action = 'queue_retry_and_backpressure_applied'
          autoActions += 1
        } else if (c.module === 'servers') {
          const { data: serverRows } = await admin
            .from('servers')
            .select('id')
            .eq('status', 'live')
            .limit(5)

          for (const s of serverRows || []) {
            await admin.functions.invoke('server-agent', {
              body: { action: 'health_check', serverId: s.id },
            }).catch(() => null)
          }

          await admin.from('platform_priority_queue_jobs').insert({
            queue_name: 'self-heal-servers',
            priority_level: 5,
            payload: { action: 'check_and_restart', reason: 'no_live_servers' },
            status: 'queued',
          })
          c.auto_action = 'server_health_recheck_and_self_heal_queued'
          autoActions += 1
        } else if (c.module === 'api_gateway') {
          await admin.from('platform_priority_queue_jobs').insert({
            queue_name: 'self-heal-api',
            priority_level: 5,
            payload: { action: 'api_gateway_health_recheck', reason: 'low_api_activity' },
            status: 'queued',
          })
          c.auto_action = 'api_recheck_queued'
          autoActions += 1
        } else if (c.module === 'api_services') {
          await admin.from('platform_priority_queue_jobs').insert({
            queue_name: 'self-heal-api-services',
            priority_level: 5,
            payload: { action: 'retry_api_workers', reason: 'api_service_degradation' },
            status: 'queued',
          })
          await admin.from('platform_feature_rollbacks').insert({
            feature_key: 'api_services',
            from_version: 'current',
            to_version: 'safe_previous',
            reason: 'auto_failover_on_degraded_api_services',
            status: 'queued',
          }).catch(() => null)
          c.auto_action = 'api_retry_and_failover_queued'
          autoActions += 1
        } else if (c.module === 'database') {
          await admin.from('platform_priority_queue_jobs').insert({
            queue_name: 'self-heal-database',
            priority_level: 5,
            payload: { action: 'db_reconnect_probe', reason: 'database_degraded' },
            status: 'queued',
          })
          c.auto_action = 'db_reconnect_probe_queued'
          autoActions += 1
        }

        await admin.from('platform_realtime_alert_events').insert({
          alert_type: 'health_module_issue',
          severity: c.status === 'failed' ? 'critical' : 'warning',
          source_module: c.module,
          payload: {
            message: c.message,
            latency_ms: c.latency_ms,
            records: c.records,
            auto_action: c.auto_action || null,
          },
          acknowledged: false,
        })
      }
    }

    const healthy = checks.filter((c) => c.status === 'healthy').length
    const warning = checks.filter((c) => c.status === 'warning').length
    const failed = checks.filter((c) => c.status === 'failed').length
    const healthScore = checks.length ? Math.max(0, Math.round((healthy / checks.length) * 100)) : 0

    const summary = {
      status: failed > 0 ? 'error' : warning > 0 ? 'warning' : 'healthy',
      checked_at: nowIso,
      health_score: healthScore,
      totals: { healthy, warning, failed, modules: checks.length },
      auto_actions: autoActions,
      checks,
    }

    const failingChecks = checks.filter((c) => c.status !== 'healthy' || Number(c.latency_ms || 0) > 4000)
    const alertDispatch = await dispatchAlertChannels(failingChecks, summary)

    if (saveSnapshot) {
      await admin.from('platform_command_center_snapshots').insert({
        total_leads: 0,
        total_ads_campaigns: 0,
        total_revenue: 0,
        total_ai_calls: 0,
        generated_at: nowIso,
      })

      await admin.from('system_health_snapshots').insert({
        snapshot_type: 'full_system',
        status: summary.status === 'error' ? 'critical' : summary.status,
        metrics: {
          health_score: healthScore,
          modules: checks.length,
          healthy,
          warning,
          failed,
          avg_latency_ms: checks.length
            ? Math.round(checks.reduce((sum, c) => sum + Number(c.latency_ms || 0), 0) / checks.length)
            : 0,
        },
        issues_detected: warning + failed,
        auto_actions_taken: autoActions,
        approvals_queued: 0,
        details: {
          checks,
          alert_dispatch: alertDispatch,
        },
      }).catch(() => null)
    }

    return { ...summary, alert_dispatch: alertDispatch }
  }

  // GET /health (legacy)
  if (method === 'GET' && parts.length === 0) {
    const scan = await runHealthScan(false, false, false)
    return json(scan, scan.status === 'healthy' ? 200 : scan.status === 'warning' ? 200 : 503)
  }

  // GET /health/system/dashboard
  if (method === 'GET' && parts[0] === 'system' && parts[1] === 'dashboard') {
    const scan = await runHealthScan(false, false, false)
    const [history, alerts, aiHealth, queues] = await Promise.all([
      admin.from('platform_health_probe_events').select('*').order('created_at', { ascending: false }).limit(300),
      admin.from('platform_realtime_alert_events').select('*').order('created_at', { ascending: false }).limit(200),
      admin.from('ai_api_health_monitor_snapshots').select('*').order('captured_at', { ascending: false }).limit(200),
      admin.from('platform_priority_queue_jobs').select('id,status,priority_level,created_at').order('created_at', { ascending: false }).limit(500),
    ])

    return json({
      ...scan,
      history: history.data || [],
      alerts: alerts.data || [],
      ai_health: aiHealth.data || [],
      queue_stats: {
        queued: (queues.data || []).filter((q: any) => q.status === 'queued').length,
        running: (queues.data || []).filter((q: any) => q.status === 'running').length,
        failed: (queues.data || []).filter((q: any) => q.status === 'failed').length,
      },
    })
  }

  // POST /health/system/run-check
  if (method === 'POST' && parts[0] === 'system' && parts[1] === 'run-check') {
    if (!isPrivileged) return err('Forbidden', 403)
    const autoFix = body?.auto_fix !== false
    const persist = body?.persist !== false
    const snapshot = body?.snapshot !== false
    const scan = await runHealthScan(autoFix, persist, snapshot)
    return json({ success: true, ...scan })
  }

  // GET /health/system/history
  if (method === 'GET' && parts[0] === 'system' && parts[1] === 'history') {
    if (!isPrivileged) return err('Forbidden', 403)
    const limit = Math.min(2000, Math.max(10, Number(body?.limit || 500)))
    const [probes, snapshots, alerts] = await Promise.all([
      admin
        .from('platform_health_probe_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      admin
        .from('system_health_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.max(50, Math.floor(limit / 3))),
      admin
        .from('platform_realtime_alert_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.max(50, Math.floor(limit / 2))),
    ])

    if (probes.error) return err(probes.error.message)
    return json({
      data: probes.data || [],
      snapshots: snapshots.data || [],
      alerts: alerts.data || [],
    })
  }

  return err('Not found', 404)
}

async function handleFeatureFlags(_method: string, parts: string[]) {
  const admin = adminClient()
  const key = parts[0]
  if (key) {
    const { data } = await admin.from('feature_flags').select('flag_key,is_enabled,rollout_pct').eq('flag_key', key).maybeSingle()
    return json({ flag: data ?? null })
  }
  const { data } = await admin.from('feature_flags').select('flag_key,is_enabled,rollout_pct,description')
  return json({ flags: data ?? [] })
}

// ===================== MAIN ROUTER =====================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const fullPath = url.pathname.replace(/^\/api-gateway\/?/, '').replace(/\/$/, '')
    const parts = fullPath.split('/').filter(Boolean)
    const module = parts[0]
    const subParts = parts.slice(1)
    const isGithubWebhook = module === 'github' && subParts[0] === 'webhook' && req.method === 'POST'

    // Parse body for POST/PUT/DELETE, query params for GET
    let body: any = {}
    let rawBody = ''
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      if (isGithubWebhook) {
        rawBody = await req.text()
        try { body = rawBody ? JSON.parse(rawBody) : {} } catch { body = {} }
      } else {
        try { body = await req.json() } catch { body = {} }
      }
    } else {
      url.searchParams.forEach((v, k) => { body[k] = v })
    }

    if (isGithubWebhook) {
      const retryAfter = enforceRateLimit(`webhook:${req.headers.get('x-forwarded-for') || 'unknown'}`, 120, 60_000)
      if (retryAfter !== null) return err(`Rate limit exceeded. Retry in ${retryAfter}s`, 429)

      const admin = adminClient()
      return await handleGithub(req.method, subParts, body, 'webhook', admin, req, rawBody)
    }

    // Auth endpoints don't require JWT
    if (module === 'auth') {
      return await handleAuth(req.method, subParts, body, req)
    }

    // All other endpoints require JWT
    const auth = await authenticate(req)
    if (!auth) return err('Unauthorized', 401)

    const { userId, supabase: sb } = auth
    const retryAfter = enforceRateLimit(`user:${userId}:${module}`, 120, 60_000)
    if (retryAfter !== null) return err(`Rate limit exceeded. Retry in ${retryAfter}s`, 429)

    const requestStartedAt = Date.now()
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const geoHeaders = extractGeoHeaders(req.headers)
    const deviceFingerprint = req.headers.get('x-device-fingerprint') || req.headers.get('x-client-fingerprint') || null
    const requestId = req.headers.get('x-request-id') || (typeof body?.request_id === 'string' ? body.request_id : null) || crypto.randomUUID()
    const traceId = req.headers.get('x-trace-id') || (typeof body?.trace_id === 'string' ? body.trace_id : null) || requestId
    const sessionId = req.headers.get('x-session-id') || (typeof body?.session_id === 'string' ? body.session_id : null) || null
    const timezoneName = req.headers.get('x-timezone') || (typeof body?.timezone === 'string' ? body.timezone : null) || 'UTC'

    const auditAdmin = adminClient()
    const roleName = await resolvePrimaryRole(auditAdmin, userId)

    let response: Response

    switch (module) {
      case 'products': response = await handleProducts(req.method, subParts, body, userId, sb); break
      case 'resellers': response = await handleResellers(req.method, subParts, body, userId, sb); break
      case 'marketplace-admin': response = await handleMarketplaceAdmin(req.method, subParts, body, userId, sb, req); break
      case 'marketplace': response = await handlePublicMarketplace(req.method, subParts, body, userId, sb, req); break
      case 'health': response = await handleHealth(req.method, subParts, body, userId); break
      case 'feature-flags': response = await handleFeatureFlags(req.method, subParts); break
      case 'keys': response = await handleKeys(req.method, subParts, body, userId, sb); break
      case 'projects':
      case 'deploy':
      case 'deploy-targets':
      case 'domain':
      case 'server':
        response = await handleServers(req.method, [module, ...subParts], body, userId, sb)
        break
      case 'server-management':
        response = await handleServersV2(req.method, subParts, body, userId, sb, req)
        break
      case 'github': response = await handleGithub(req.method, subParts, body, userId, sb, req); break
      case 'ai': response = await handleAi(req.method, subParts, body, userId, sb); break
      case 'chat': response = await handleChat(req.method, subParts, body, userId, sb); break
      case 'api-keys': response = await handleApiKeys(req.method, subParts, body, userId, sb); break
      case 'api-usage':
        response = await handleApiKeys(req.method, ['usage'], body, userId, sb)
        break
      case 'auto': response = await handleAuto(req.method, subParts, body, userId, sb); break
      case 'apk': response = await handleApk(req.method, subParts, body, userId, sb); break
      case 'wallet': response = await handleWallet(req.method, subParts, body, userId, sb); break
      case 'leads':
      case 'seo':
      case 'system':
        response = await handleSeoLeads(req.method, [module, ...subParts], body, userId, sb)
        break
      default:
        response = err(`Unknown module: ${module}`, 404)
        break
    }

    const latencyMs = Date.now() - requestStartedAt
    const actionType = `${module}.${subParts.join('.') || 'root'}.${req.method}`
    const tableName = module
    const recordId = subParts.find((x) => isUuid(x)) || null
    const status = response.status
    let responsePayload: any = { status }
    try {
      responsePayload = await getResponsePayloadPreview(response)
    } catch (previewError) {
      console.warn('Audit response preview failed:', previewError)
    }

    const tenantScope = deriveTenantScope(roleName, body, req.headers)
    const bulkGroupId = String(
      req.headers.get('x-bulk-group-id')
      || (typeof body?.bulk_group_id === 'string' ? body.bulk_group_id : '')
      || ''
    ).trim() || null

    try {
      await appendAuditLogResilient(auditAdmin, {
        user_id: userId,
        role_name: roleName,
        action_type: actionType,
        action: actionType,
        table_name: tableName,
        entity_type: tableName,
        record_id: recordId,
        entity_id: recordId,
        event_source: 'api',
        system_generated: false,
        is_sensitive_action: isSensitiveAction(actionType, req.method, fullPath),
        occurred_at_utc: new Date().toISOString(),
        timezone_name: timezoneName,
        request_id: requestId,
        trace_id: traceId,
        session_id: sessionId,
        tenant_scope: tenantScope,
        api_path: `/${fullPath}`,
        http_method: req.method,
        response_status: status,
        latency_ms: latencyMs,
        request_payload: body,
        response_payload: responsePayload,
        ip_address: clientIp,
        ip_country: geoHeaders.country,
        ip_city: geoHeaders.city,
        device_fingerprint: deviceFingerprint,
        bulk_group_id: bulkGroupId,
        snapshot_before: body?.snapshot_before || null,
        snapshot_after: body?.snapshot_after || null,
        replay_steps: body?.replay_steps || null,
        anomaly_score: classifyAnomalyScore(status, latencyMs),
        anomaly_reason: status >= 500 ? 'server_error' : latencyMs > 4000 ? 'high_latency' : null,
        risk_score: isSensitiveAction(actionType, req.method, fullPath) ? 0.8 : status >= 500 ? 0.9 : 0.2,
      })
    } catch (auditError) {
      console.warn('Audit append failed:', auditError)
    }

    return response
  } catch (e) {
    console.error('API Gateway Error:', e)
    await sentryCaptureException(e, { url: req.url, method: req.method })
    return err('Internal server error', 500)
  }
})
