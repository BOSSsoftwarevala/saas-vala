import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  return err('Not found', 404)
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

    switch (module) {
      case 'products': return await handleProducts(req.method, subParts, body, userId, sb)
      case 'resellers': return await handleResellers(req.method, subParts, body, userId, sb)
      case 'marketplace': return await handleMarketplace(req.method, subParts, body, userId, sb)
      case 'keys': return await handleKeys(req.method, subParts, body, userId, sb)
      case 'projects':
      case 'deploy':
      case 'deploy-targets':
      case 'domain':
      case 'server':
        return await handleServers(req.method, [module, ...subParts], body, userId, sb)
      case 'github': return await handleGithub(req.method, subParts, body, userId, sb, req)
      case 'ai': return await handleAi(req.method, subParts, body, userId, sb)
      case 'chat': return await handleChat(req.method, subParts, body, userId, sb)
      case 'api-keys': return await handleApiKeys(req.method, subParts, body, userId, sb)
      case 'api-usage':
        return await handleApiKeys(req.method, ['usage'], body, userId, sb)
      case 'auto': return await handleAuto(req.method, subParts, body, userId, sb)
      case 'apk': return await handleApk(req.method, subParts, body, userId, sb)
      case 'wallet': return await handleWallet(req.method, subParts, body, userId, sb)
      case 'leads':
      case 'seo':
        return await handleSeoLeads(req.method, [module, ...subParts], body, userId, sb)
      default:
        return err(`Unknown module: ${module}`, 404)
    }
  } catch (e) {
    console.error('API Gateway Error:', e)
    return err('Internal server error', 500)
  }
})
