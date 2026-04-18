import { supabase } from '@/lib/supabase';
import { eventLogger, EventType } from './eventLogger';

const normalizeEnv = (value: string | undefined): string => (value ?? '').trim().replace(/^['"]|['"]$/g, '');
const normalizedSupabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const API_BASE = `${normalizedSupabaseUrl || (() => {
  throw new Error('VITE_SUPABASE_URL is not configured. Please set it in your .env file.');
})()}/functions/v1/api-gateway`;

/** Timeout for all API requests (ms). */
const API_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for transient server errors (5xx). */
const MAX_RETRIES = 3;

/** Cache auth headers briefly to reduce frequent session lookups. */
const AUTH_HEADERS_CACHE_MS = 15_000;
let authHeadersCache: { expiresAt: number; headers: Record<string, string> } | null = null;

/** Enhanced in-memory GET cache with better TTL for performance. */
const GET_RESPONSE_CACHE_MS = 30_000; // Increased for better performance
const getResponseCache = new Map<string, { expiresAt: number; data: unknown; etag?: string }>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();

/** Request deduplication cache to prevent duplicate API calls */
const requestDeduplicationCache = new Map<string, Promise<unknown>>();

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (authHeadersCache && Date.now() < authHeadersCache.expiresAt) {
    return { ...authHeadersCache.headers };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  authHeadersCache = {
    expiresAt: Date.now() + AUTH_HEADERS_CACHE_MS,
    headers,
  };
  return headers;
}

/**
 * Idempotency key options for mutation requests.
 * Pass an explicit key to make the call idempotent (prevents duplicate
 * orders/payments on double-click or retry).
 */
export interface ApiCallOptions {
  idempotencyKey?: string;
  /** Override the default timeout (ms). */
  timeoutMs?: number;
}

async function apiCall<T = any>(
  method: string,
  path: string,
  body?: any,
  options: ApiCallOptions = {}
): Promise<T> {
  const isGet = method === 'GET';
  const cacheKey = isGet ? `${path}::${JSON.stringify(body || {})}` : '';

  if (isGet) {
    const cached = getResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    const inFlight = inFlightGetRequests.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const exec = async (): Promise<T> => {
  const timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS;
  const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const startTime = Date.now();

  let attempt = 0;
  let lastError: Error = new Error('Request failed');

  while (attempt < MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = await getAuthHeaders();

      // Inject idempotency key for mutation requests to prevent duplicates
      if (isMutation) {
        const idemKey = options.idempotencyKey ?? crypto.randomUUID();
        headers['X-Idempotency-Key'] = idemKey;
      }

      let resolvedPath = path;
      const config: RequestInit = { method, headers, signal: controller.signal };

      if (method === 'GET' && body) {
        const params = new URLSearchParams();
        Object.entries(body).forEach(([k, v]) => {
          if (v !== undefined && v !== null) params.set(k, String(v));
        });
        resolvedPath += '?' + params.toString();
      } else if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        config.body = JSON.stringify(body);
      }

      const res = await fetch(`${API_BASE}/${resolvedPath}`, config);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Parse JSON safely — body may be empty on some error responses
      let data: any;
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = text ? { message: text } : {};
      }

      // Log API call
      eventLogger.logApiCall(method, path, undefined, res.status, duration);

      if (!res.ok) {
        const errMsg = (typeof data?.error === 'string' && data.error)
          ? data.error
          : `API error: ${res.status}`;

        // Log error
        eventLogger.logError(`API ${method} ${path}`, new Error(errMsg));

        // Only retry on transient server errors (5xx), not client errors (4xx)
        if (res.status >= 500 && attempt < MAX_RETRIES - 1) {
          lastError = new Error(errMsg);
          attempt++;
          // Exponential backoff: 500ms, 1000ms, 2000ms …
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          continue;
        }

        throw new Error(errMsg);
      }
      if (isGet) {
        getResponseCache.set(cacheKey, {
          expiresAt: Date.now() + GET_RESPONSE_CACHE_MS,
          data,
        });
      }
      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s (${path})`);
      }

      // Network-level failures are retry-able
      if (attempt < MAX_RETRIES - 1 && (err.message?.includes('fetch') || err.message?.includes('network'))) {
        lastError = err;
        attempt++;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
  };

  if (isGet) {
    const request = exec();
    inFlightGetRequests.set(cacheKey, request);
    try {
      return await request;
    } finally {
      inFlightGetRequests.delete(cacheKey);
    }
  }

  return exec();
}

// ===================== AUTH =====================
export const authApi = {
  login: (email: string, password: string) => apiCall('POST', 'auth/login', { email, password }),
  me: () => apiCall('GET', 'auth/me'),
};

// ===================== PRODUCTS =====================
export const productsApi = {
  list: () => apiCall('GET', 'products'),
  get: (id: string) => apiCall('GET', `products/${id}`),
  create: (data: any) => apiCall('POST', 'products', data),
  update: (id: string, data: any) => apiCall('PUT', `products/${id}`, data),
  delete: (id: string) => apiCall('DELETE', `products/${id}`),
  categories: () => apiCall('GET', 'products/categories'),
  versions: (id: string) => apiCall('GET', `products/${id}/versions`),
};

// ===================== RESELLERS =====================
export const resellersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    apiCall('GET', 'resellers', params),
  create: (data: any) => apiCall('POST', 'resellers', data),
  update: (id: string, data: any) => apiCall('PUT', `resellers/${id}`, data),
  sales: (id: string) => apiCall('GET', `resellers/${id}/sales`),
};

// ===================== MARKETPLACE =====================
export const marketplaceApi = {
  products: () => apiCall('GET', 'marketplace/products'),
  approve: (productId: string) => apiCall('PUT', 'marketplace/approve', { product_id: productId }),
  orders: () => apiCall('GET', 'marketplace/orders'),
  pricing: (productId: string, price: number, discount?: number) =>
    apiCall('PUT', 'marketplace/pricing', { product_id: productId, price, discount_percent: discount }),
};

// ===================== ORDER =====================
export const orderApi = {
  create: (data: any) => apiCall('POST', 'order', data),
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiCall('GET', 'orders', params),
  get: (id: string) => apiCall('GET', `orders/${id}`),
};

// ===================== MARKETPLACE ADMIN =====================
export const marketplaceAdminApi = {
  dashboard: () => apiCall('GET', 'marketplace-admin/dashboard'),

  listProducts: (params?: { page?: number; limit?: number; search?: string; status?: string; include_deleted?: boolean }) =>
    apiCall('GET', 'marketplace-admin/products', params),
  createProduct: (data: any) => apiCall('POST', 'marketplace-admin/products', data),
  updateProduct: (id: string, data: any) => apiCall('PUT', `marketplace-admin/products/${id}`, data),
  deleteProduct: (id: string) => apiCall('DELETE', `marketplace-admin/products/${id}`),
  bulkProducts: (operation: string, productIds: string[], extra: Record<string, unknown> = {}) =>
    apiCall('POST', 'marketplace-admin/products/bulk', { operation, product_ids: productIds, ...extra }),
  requestProductApproval: (id: string, data?: { request_type?: string; reason?: string; payload?: unknown }) =>
    apiCall('POST', `marketplace-admin/products/${id}/request-approval`, data || {}),
  listProductVersions: (id: string) => apiCall('GET', `marketplace-admin/products/${id}/versions`),
  rollbackProduct: (id: string, versionNo: number) =>
    apiCall('POST', `marketplace-admin/products/${id}/rollback`, { version_no: versionNo }),

  reviewApproval: (requestId: string, decision: 'approve' | 'reject', reason?: string) =>
    apiCall('POST', `marketplace-admin/approvals/${requestId}/${decision}`, { reason }),

  listCategories: () => apiCall('GET', 'marketplace-admin/categories'),
  createCategory: (data: any) => apiCall('POST', 'marketplace-admin/categories', data),
  updateCategory: (id: string, data: any) => apiCall('PUT', `marketplace-admin/categories/${id}`, data),
  deleteCategory: (id: string) => apiCall('DELETE', `marketplace-admin/categories/${id}`),

  listBanners: () => apiCall('GET', 'marketplace-admin/banners'),
  createBanner: (data: any) => apiCall('POST', 'marketplace-admin/banners', data),
  updateBanner: (id: string, data: any) => apiCall('PUT', `marketplace-admin/banners/${id}`, data),
  deleteBanner: (id: string) => apiCall('DELETE', `marketplace-admin/banners/${id}`),

  listOrders: (params?: { page?: number; limit?: number; user_id?: string; product_id?: string; status?: string }) =>
    apiCall('GET', 'marketplace-admin/orders', params),
  manualVerifyOrder: (id: string, notes?: string, reason?: string) =>
    apiCall('POST', `marketplace-admin/orders/${id}/manual-verify`, { notes, reason }),
  refundOrder: (id: string, reason?: string) =>
    apiCall('POST', `marketplace-admin/orders/${id}/refund`, { reason }),

  listLicenses: (params?: { page?: number; limit?: number; product_id?: string; owner_email?: string; key?: string }) =>
    apiCall('GET', 'marketplace-admin/licenses', params),
  revokeLicense: (id: string, reason?: string) =>
    apiCall('POST', `marketplace-admin/licenses/${id}/revoke`, { reason }),
  extendLicense: (id: string, extendDays: number) =>
    apiCall('POST', `marketplace-admin/licenses/${id}/extend`, { extend_days: extendDays }),
  resendLicense: (id: string) => apiCall('POST', `marketplace-admin/licenses/${id}/resend`, {}),

  listReviews: (params?: { page?: number; limit?: number; status?: string }) =>
    apiCall('GET', 'marketplace-admin/reviews', params),
  moderateReview: (id: string, status: 'published' | 'pending' | 'rejected') =>
    apiCall('PUT', `marketplace-admin/reviews/${id}/moderate`, { status }),

  listResellers: () => apiCall('GET', 'marketplace-admin/resellers'),
  updateReseller: (id: string, data: { is_active?: boolean; commission_percent?: number }) =>
    apiCall('PUT', `marketplace-admin/resellers/${id}`, data),
  overrideResellerCommission: (id: string, data: { commission_percent: number; product_id?: string; reason?: string; is_active?: boolean }) =>
    apiCall('POST', `marketplace-admin/resellers/${id}/commission-override`, data),

  listPayouts: () => apiCall('GET', 'marketplace-admin/payouts'),
  reviewPayout: (id: string, data: { decision: 'approved' | 'rejected' | 'paid'; approved_amount?: number; payout_reference?: string; notes?: string }) =>
    apiCall('POST', `marketplace-admin/payouts/${id}/review`, data),

  listBlacklist: () => apiCall('GET', 'marketplace-admin/blacklist'),
  addBlacklist: (data: any) => apiCall('POST', 'marketplace-admin/blacklist', data),
  updateBlacklist: (id: string, data: any) => apiCall('PUT', `marketplace-admin/blacklist/${id}`, data),

  listFeatureFlags: () => apiCall('GET', 'marketplace-admin/feature-flags'),
  updateFeatureFlag: (flagKey: string, updates: { is_enabled?: boolean; rollout_pct?: number; description?: string }) =>
    apiCall('PUT', 'marketplace-admin/feature-flags', { flag_key: flagKey, ...updates }),

  getConfig: () => apiCall('GET', 'marketplace-admin/config'),
  upsertConfig: (configKey: string, configValue: unknown) =>
    apiCall('PUT', 'marketplace-admin/config/system', { config_key: configKey, config_value: configValue }),
  upsertTemplate: (data: { template_key: string; subject_template: string; body_template: string; is_active?: boolean }) =>
    apiCall('PUT', 'marketplace-admin/config/template', data),

  apiMonitoring: (limit = 100) => apiCall('GET', 'marketplace-admin/api-monitoring', { limit }),
  runCron: (job: 'expire_old_licenses' | 'cleanup_expired_data') =>
    apiCall('POST', 'marketplace-admin/cron/run', { job }),

  exportOrders: () => apiCall('GET', 'marketplace-admin/export/orders'),
  exportUsers: () => apiCall('GET', 'marketplace-admin/export/users'),
  exportResellers: () => apiCall('GET', 'marketplace-admin/export/resellers'),
};

// ===================== KEYS =====================
export const keysApi = {
  list: () => apiCall('GET', 'keys'),
  generate: (data: any) => apiCall('POST', 'keys/generate', data),
  activate: (id: string) => apiCall('PUT', `keys/${id}/activate`),
  deactivate: (id: string) => apiCall('PUT', `keys/${id}/deactivate`),
  validate: (licenseKey: string) => apiCall('POST', 'keys/validate', { license_key: licenseKey }),
  delete: (id: string) => apiCall('DELETE', `keys/${id}`),
};

// ===================== SERVERS =====================
export const serversApi = {
  list: () => apiCall('GET', 'projects'),
  create: (data: any) => apiCall('POST', 'projects', data),
  deployTargets: () => apiCall('GET', 'deploy-targets'),
  triggerDeploy: (serverId: string) => apiCall('POST', 'deploy/trigger', { server_id: serverId }),
  deployStatus: (serverId: string) => apiCall('GET', `deploy/status/${serverId}`),
  deployLogs: (deploymentId: string) => apiCall('GET', `deploy/logs/${deploymentId}`),
  listDomains: () => apiCall('GET', 'domain/list'),
  addDomain: (data: any) => apiCall('POST', 'domain/add', data),
  domainRecords: (domainId: string) => apiCall('GET', `domain/records/${domainId}`),
  verifyDomain: (domainId: string) => apiCall('POST', 'domain/verify', { domain_id: domainId }),
  removeDomain: (domainId: string) => apiCall('DELETE', `domain/remove/${domainId}`),
  health: () => apiCall('GET', 'server/health'),

  // Security Monitoring
  securityScan: (serverId: string) => apiCall('POST', `server/security/scan/${serverId}`),
  
  // Health Monitoring
  healthMetrics: (serverId: string) => apiCall('GET', `server/health/metrics/${serverId}`),
  
  // SSL/TLS Management
  sslStatus: (serverId: string) => apiCall('GET', `server/ssl/${serverId}`),
  provisionSSL: (serverId: string) => apiCall('POST', `server/ssl/provision/${serverId}`),
  
  // Backup Management
  listBackups: (serverId: string) => apiCall('GET', `server/backups/${serverId}`),
  createBackup: (serverId: string, type: 'full' | 'incremental' | 'database' = 'full') =>
    apiCall('POST', `server/backups/create/${serverId}`, { type }),
  restoreBackup: (serverId: string, backupId: string) =>
    apiCall('POST', `server/backups/restore/${serverId}`, { backup_id: backupId }),
  deleteBackup: (backupId: string) => apiCall('DELETE', `server/backups/${backupId}`),
};

// ===================== SERVER MANAGEMENT (PREMIUM) =====================
export const serverManagementApi = {
  // Real-time Metrics
  getLatestMetrics: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/metrics/latest`),
  getMetricsHistory: (serverId: string, hours: number = 24) =>
    apiCall('GET', `server-management/${serverId}/metrics/history`, { hours }),
  recordMetrics: (serverId: string, data: any) =>
    apiCall('POST', `server-management/${serverId}/metrics/record`, data),
  
  // SSH Key Management
  getSSHKeys: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/ssh-keys`),
  addSSHKey: (serverId: string, data: any) =>
    apiCall('POST', `server-management/${serverId}/ssh-keys/add`, data),
  removeSSHKey: (serverId: string, keyId: string) =>
    apiCall('DELETE', `server-management/${serverId}/ssh-keys/remove`, { key_id: keyId }),
  
  // Agent Management
  getAgents: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/agents`),
  registerAgent: (serverId: string, data: any) =>
    apiCall('POST', `server-management/${serverId}/agents/register`, data),
  heartbeat: (serverId: string, agentId: string, data: any) =>
    apiCall('POST', `server-management/${serverId}/agents/heartbeat`, { agent_id: agentId, ...data }),
  
  // Server Logs
  getLogs: (serverId: string, limit: number = 100) =>
    apiCall('GET', `server-management/${serverId}/logs`, { limit }),
  logAction: (serverId: string, data: any) =>
    apiCall('POST', `server-management/${serverId}/logs/log`, data),
  
  // Billing ($49/month)
  getCurrentBilling: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/billing/current`),
  getBillingHistory: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/billing/history`),
  createBillingCycle: (serverId: string) =>
    apiCall('POST', `server-management/${serverId}/billing/create-cycle`),
  markBillingPaid: (serverId: string, billingId: string) =>
    apiCall('POST', `server-management/${serverId}/billing/mark-paid`, { billing_id: billingId }),
  
  // AI Analysis (OpenAI-powered)
  getLatestAnalysis: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/ai-analysis/latest`),
  analyzeServer: (serverId: string) =>
    apiCall('POST', `server-management/${serverId}/ai-analysis/analyze`),
  
  // SSL Certificate Management
  getSSLCertificates: (serverId: string) =>
    apiCall('GET', `server-management/${serverId}/ssl`),
  addSSLCertificate: (serverId: string, data: any) =>
    apiCall('POST', `server-management/${serverId}/ssl/add`, data),
  
  // Server Control
  startServer: (serverId: string) =>
    apiCall('POST', `server-management/${serverId}/control/start`),
  stopServer: (serverId: string) =>
    apiCall('POST', `server-management/${serverId}/control/stop`),
  restartServer: (serverId: string) =>
    apiCall('POST', `server-management/${serverId}/control/restart`),
  deployServer: (serverId: string, data?: any) =>
    apiCall('POST', `server-management/${serverId}/control/deploy`, data || {}),
};

// ===================== GITHUB =====================
export const githubApi = {
  installUrl: () => apiCall('GET', 'github/install-url'),
  callback: (code: string) => apiCall('POST', 'github/callback', { code }),
  repos: () => apiCall('GET', 'github/repos'),
};

// ===================== AI =====================
export const aiApi = {
  generate: (data: any) => apiCall('POST', 'ai/generate', data),
  chat: (data: any) => apiCall('POST', 'ai/chat', data),
  run: (data: any) => apiCall('POST', 'ai/run', data),
  models: () => apiCall('GET', 'ai/models'),
  usage: () => apiCall('GET', 'ai/usage'),
};

// ===================== CHAT =====================
export const chatApi = {
  send: (data: any) => apiCall('POST', 'chat/send', data),
  history: () => apiCall('GET', 'chat/history'),
};

// ===================== API KEYS =====================
export const apiKeysApi = {
  create: (data: any) => apiCall('POST', 'api-keys/create', data),
  list: () => apiCall('GET', 'api-keys'),
  usage: () => apiCall('GET', 'api-usage'),
};

// ===================== AUTO-PILOT =====================
export const autoApi = {
  run: (data?: any) => apiCall('POST', 'auto/run', data),
  tasks: () => apiCall('GET', 'auto/tasks'),
  update: (id: string, data: any) => apiCall('PUT', `auto/${id}`, data),
};

// ===================== APK =====================
export const apkApi = {
  build: (data: any) => apiCall('POST', 'apk/build', data),
  history: () => apiCall('GET', 'apk/history'),
  download: (id: string) => apiCall('GET', `apk/download/${id}`),
};

// ===================== WALLET =====================
export const walletApi = {
  get: () => apiCall('GET', 'wallet'),
  add: (amount: number, description?: string, paymentMethod?: string) =>
    apiCall('POST', 'wallet/add', { amount, description, payment_method: paymentMethod }),
  deduct: (amount: number, description?: string, referenceId?: string, referenceType?: string) =>
    apiCall('POST', 'wallet/deduct', { amount, description, reference_id: referenceId, reference_type: referenceType }),
  withdraw: (amount: number, description?: string, referenceId?: string, referenceType?: string) =>
    apiCall('POST', 'wallet/withdraw', { amount, description, reference_id: referenceId, reference_type: referenceType }),
  transactions: (params?: { page?: number; limit?: number }) =>
    apiCall('GET', 'wallet/transactions', params),
  all: () => apiCall('GET', 'wallet/all'),
};

// ===================== VALA BUILDER =====================
export const valaBuilderApi = {
  startRun: (payload: {
    action: 'create_app' | 'clone_software' | 'generate_ui' | 'generate_backend' | 'fix_errors' | 'build_project' | 'deploy_demo' | 'publish_marketplace';
    app_name: string;
    app_description?: string;
    selected_server_id?: string | null;
    fallback_server_id?: string | null;
    source_ref?: string;
    environment?: 'dev' | 'staging' | 'production';
    template_key?: string;
    project_key?: string;
    prompt_version?: string;
    priority?: number;
    step_timeout_seconds?: number;
    max_retries?: number;
    safe_mode?: boolean;
    plugin_keys?: string[];
  }) => supabase.functions.invoke('vala-builder-orchestrator', {
    body: {
      operation: 'start_run',
      ...payload,
    },
  }),

  retryRun: (runId: string) => supabase.functions.invoke('vala-builder-orchestrator', {
    body: {
      operation: 'retry_run',
      run_id: runId,
    },
  }),

  resumeRun: (runId: string, resumeFromStep?: string) => supabase.functions.invoke('vala-builder-orchestrator', {
    body: {
      operation: 'resume_run',
      run_id: runId,
      resume_from_step: resumeFromStep,
    },
  }),

  cancelRun: (runId: string) => supabase.functions.invoke('vala-builder-orchestrator', {
    body: {
      operation: 'cancel_run',
      run_id: runId,
    },
  }),

  triggerWorker: (limit = 2) => supabase.functions.invoke('vala-builder-orchestrator', {
    body: {
      operation: 'trigger_worker',
      limit,
    },
  }),

  getRun: async (runId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vala-builder-orchestrator?run_id=${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch run (${res.status})`);
    return res.json();
  },

  getRunLogs: async (runId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vala-builder-orchestrator?run_id=${encodeURIComponent(runId)}&logs=1`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch run logs (${res.status})`);
    return res.json();
  },

  getRunLogsFiltered: async (runId: string, params?: { step?: string; logStatus?: string }) => {
    const headers = await getAuthHeaders();
    const qp = new URLSearchParams();
    qp.set('run_id', runId);
    qp.set('logs', '1');
    if (params?.step) qp.set('step', params.step);
    if (params?.logStatus) qp.set('log_status', params.logStatus);

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vala-builder-orchestrator?${qp.toString()}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch filtered run logs (${res.status})`);
    return res.json();
  },

  health: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vala-builder-orchestrator?operation=health`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`Failed to fetch orchestrator health (${res.status})`);
    return res.json();
  },
};

// ===================== SEO & LEADS =====================
export const leadsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    apiCall('GET', 'leads', params),
  create: (data: any) => apiCall('POST', 'leads', data),
  analytics: () => apiCall('GET', 'leads/analytics'),
  analyticsUltra: (params?: { period?: 'today' | '7d' | '30d' | 'custom'; start_date?: string; end_date?: string; dry_run?: boolean }) =>
    apiCall('GET', 'leads/analytics/ultra', params),
  analyticsSnapshot: (data?: { period?: 'today' | '7d' | '30d' | 'custom'; start_date?: string; end_date?: string }) =>
    apiCall('POST', 'leads/analytics/snapshot', data || {}),
  analyticsExport: (data: { format: 'pdf' | 'excel' | 'csv'; period?: 'today' | '7d' | '30d' | 'custom'; start_date?: string; end_date?: string }) =>
    apiCall('POST', 'leads/analytics/export', data),
  analyticsAlerts: (params?: { open_only?: boolean }) => apiCall('GET', 'leads/analytics/alerts', params),
  resolveAnalyticsAlert: (alert_id: string) => apiCall('POST', 'leads/analytics/alerts/resolve', { alert_id }),
  autoRoute: (data?: { limit?: number }) => apiCall('POST', 'leads/auto-route', data || {}),
  syncCrm: (data: { lead_id: string; target_system?: string }) => apiCall('POST', 'leads/sync-crm', data),
  sourcesDashboard: () => apiCall('GET', 'leads/sources/dashboard'),
  sourceTrack: (data: {
    source_code: string;
    event_type?: 'click' | 'form_submit' | 'conversion';
    lead_id?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    revenue?: number;
    click_count?: number;
    risk_score?: number;
    ip_address?: string;
    fingerprint?: string;
    tag?: string;
    ref?: string;
  }) => apiCall('POST', 'leads/sources/track', data),
  ingestGoogleAds: (rows: Array<{
    source_code?: string;
    campaign_id?: string;
    campaign_name?: string;
    country_code?: string;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    spend?: number;
    revenue?: number;
    metric_date?: string;
  }>) => apiCall('POST', 'leads/sources/ingest/google-ads', { rows }),
  ingestSearchConsole: (rows: Array<{
    source_code?: string;
    keyword: string;
    country_code?: string;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    avg_position?: number;
    metric_date?: string;
  }>) => apiCall('POST', 'leads/sources/ingest/search-console', { rows }),
  sourceToggle: (data: { source_code: string; is_enabled: boolean }) => apiCall('POST', 'leads/sources/toggle', data),
  sourceGenerateLink: (data: {
    source_code: string;
    reseller_id?: string;
    base_url?: string;
    utm_medium?: string;
    utm_campaign?: string;
  }) => apiCall('POST', 'leads/sources/link', data),
};

export const seoApi = {
  update: (data: any) => apiCall('POST', 'seo/update', data),
  analytics: () => apiCall('GET', 'seo/analytics'),
  marketplaceProducts: (params?: { limit?: number; search?: string }) => apiCall('GET', 'seo/marketplace/products', params),
  automationRuns: (params?: { limit?: number }) => apiCall('GET', 'seo/automation/runs', params),
  runAutomation: (data?: { run_type?: string; product_id?: string; limit?: number; dry_run?: boolean }) =>
    apiCall('POST', 'seo/automation/run', data || {}),
  ultraRun: (data?: { run_type?: string; product_id?: string; region_mode?: 'india' | 'usa' | 'africa' | 'uk' | 'uae'; ai_mode?: 'fast' | 'balanced' | 'quality' | 'cheap'; dry_run?: boolean; max_products?: number }) =>
    apiCall('POST', 'seo/ultra/run', data || {}),
  contentRun: (data?: { run_type?: string; product_id?: string; region_mode?: 'india' | 'usa' | 'africa' | 'uk' | 'uae'; ai_mode?: 'fast' | 'balanced' | 'quality' | 'cheap'; dry_run?: boolean; max_products?: number }) =>
    apiCall('POST', 'seo/content/run', data || {}),
  ultraDashboard: () => apiCall('GET', 'seo/ultra/dashboard'),
  contentDashboard: () => apiCall('GET', 'seo/content/dashboard'),
  googleDashboard: (params?: { limit?: number }) => apiCall('GET', 'seo/google/dashboard', params),
  googleConnect: (data: {
    provider: 'gsc' | 'ga4' | 'google_ads';
    account_email?: string;
    account_id?: string;
    access_scope?: string[];
    token_ref?: string;
    refresh_ref?: string;
    expires_at?: string;
    is_active?: boolean;
    domains?: Array<{ domain_host: string; property_id: string; is_active?: boolean }>;
  }) => apiCall('POST', 'seo/google/connect', data),
  googleSync: (data: {
    provider: 'gsc' | 'ga4' | 'google_ads';
    domain_host?: string;
    fetched_keywords?: number;
    fetched_pages?: number;
    fetched_metrics?: number;
    indexing_issues?: number;
    crawl_errors?: number;
  }) => apiCall('POST', 'seo/google/sync', data),
  sitemapDashboard: () => apiCall('GET', 'seo/sitemap/dashboard'),
  sitemapSubmit: (data?: { domain_host?: string; sitemap_key?: string }) => apiCall('POST', 'seo/sitemap/submit', data || {}),
  schemaDashboard: () => apiCall('GET', 'seo/schema/dashboard'),
  schemaValidate: (data?: { page_url?: string }) => apiCall('POST', 'seo/schema/validate', data || {}),
  aiSettings: () => apiCall('GET', 'seo/ai/settings'),
  updateAiSettings: (data: {
    providers?: Array<{
      provider: 'openai' | 'gemini' | 'claude';
      is_enabled?: boolean;
      priority_order?: number;
      speed_score?: number;
      cost_score?: number;
      health_status?: 'healthy' | 'degraded' | 'down';
    }>;
    routing?: Array<{
      task_type: 'content' | 'seo' | 'analysis' | 'fast_task' | 'meta_tags' | 'blog' | 'keyword_analysis' | 'lead_scoring' | 'ads_copy' | 'image_generation' | 'video_generation';
      primary_provider: 'openai' | 'gemini' | 'claude' | 'custom_api';
      fallback_providers?: Array<'openai' | 'gemini' | 'claude' | 'custom_api'>;
    }>;
    task_execution_map?: Array<{
      task_key: string;
      module_name?: string;
      default_mode?: 'fast' | 'balanced' | 'quality' | 'cheap';
      preferred_provider: 'openai' | 'gemini' | 'claude' | 'custom_api';
      fallback_providers?: Array<'openai' | 'gemini' | 'claude' | 'custom_api'>;
      preferred_model_key?: string;
      min_quality_score?: number;
      max_cost_per_request?: number;
      is_active?: boolean;
    }>;
    role_access_controls?: Array<{
      role_name: string;
      can_use_openai?: boolean;
      can_use_gemini?: boolean;
      can_use_claude?: boolean;
      can_use_custom_api?: boolean;
      can_control_ads?: boolean;
      can_control_payments?: boolean;
      can_edit_router?: boolean;
    }>;
    rate_limit_controls?: Array<{
      role_name: string;
      provider: 'openai' | 'gemini' | 'claude' | 'custom_api' | 'all';
      rpm_limit?: number;
      rph_limit?: number;
      rpd_limit?: number;
      burst_limit?: number;
      block_seconds?: number;
      is_active?: boolean;
    }>;
    offline_rules?: Array<{
      task_key: string;
      priority_order?: number;
      rule_payload?: Record<string, unknown>;
      is_active?: boolean;
    }>;
    model_catalog?: Array<{
      provider: 'openai' | 'gemini' | 'claude' | 'custom_api';
      model_key: string;
      model_family?: 'flash' | 'standard' | 'quality' | 'custom';
      input_cost_per_1k?: number;
      output_cost_per_1k?: number;
      max_context_tokens?: number;
      is_active?: boolean;
      release_date?: string;
    }>;
    controls?: {
      auto_index_enabled?: boolean;
      auto_recrawl_enabled?: boolean;
      auto_schema_fix_enabled?: boolean;
      auto_content_refresh_enabled?: boolean;
      auto_keyword_boost_enabled?: boolean;
      auto_backlink_builder_enabled?: boolean;
      auto_page_creator_enabled?: boolean;
      auto_geo_switch_enabled?: boolean;
      auto_language_engine_enabled?: boolean;
      auto_performance_boost_enabled?: boolean;
      auto_security_seo_enabled?: boolean;
    };
  }) => apiCall('POST', 'seo/ai/settings', data),
  indexingStatus: (params?: { limit?: number }) => apiCall('GET', 'seo/indexing/status', params),
  keywordPositions: (params?: { limit?: number; product_id?: string }) => apiCall('GET', 'seo/keywords/positions', params),
  rollback: (data: { snapshot_id: string }) => apiCall('POST', 'seo/rollback', data),
};

export const systemApi = {
  commandCenter: () => apiCall('GET', 'system/command-center'),
  resilienceDashboard: () => apiCall('GET', 'system/resilience/dashboard'),
  securityDashboard: () => apiCall('GET', 'system/security/dashboard'),
  complianceDashboard: () => apiCall('GET', 'system/compliance/dashboard'),
  healthDashboard: () => apiCall('GET', 'health/system/dashboard'),
  runHealthCheck: (data?: { auto_fix?: boolean; persist?: boolean; snapshot?: boolean }) =>
    apiCall('POST', 'health/system/run-check', data || {}),
  healthHistory: (params?: { limit?: number }) => apiCall('GET', 'health/system/history', params),
  auditLogs: (params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    action_type?: string;
    table_name?: string;
    request_id?: string;
    trace_id?: string;
    session_id?: string;
    start?: string;
    end?: string;
    sensitive?: boolean;
    event_source?: string;
    search?: string;
  }) => apiCall('GET', 'system/audit/logs', params),
  auditTimeline: (params: { request_id?: string; trace_id?: string; session_id?: string }) =>
    apiCall('GET', 'system/audit/timeline', params),
  auditDiff: (id: string) => apiCall('GET', `system/audit/diff/${id}`),
  auditReplay: (params: { request_id?: string; trace_id?: string; session_id?: string; limit?: number }) =>
    apiCall('GET', 'system/audit/replay', params),
  auditStats: (params?: { period_hours?: number }) => apiCall('GET', 'system/audit/stats', params),
  auditAlerts: (params?: { unresolved?: boolean; severity?: 'info' | 'warn' | 'warning' | 'critical' }) =>
    apiCall('GET', 'system/audit/alerts', params),
  resolveAuditAlert: (id: string) => apiCall('POST', `system/audit/alerts/resolve/${id}`, {}),
  markAuditRead: (id: string) => apiCall('POST', `system/audit/read/${id}`, {}),
  auditExport: (data?: { format?: 'json' | 'csv'; limit?: number }) =>
    apiCall('POST', 'system/audit/export', data || {}),
  verifyAuditIntegrity: (data?: { limit?: number }) =>
    apiCall('POST', 'system/audit/integrity/verify', data || {}),
  processAuditQueue: (data?: { limit?: number }) =>
    apiCall('POST', 'system/audit/queue/process', data || {}),
  runAuditRetention: (data?: { limit?: number; delete_old?: boolean; delete_limit?: number }) =>
    apiCall('POST', 'system/audit/retention/run', data || {}),
  dispatchAuditWebhooks: (data?: { since_hours?: number }) =>
    apiCall('POST', 'system/audit/webhook/dispatch', data || {}),
  reportError: (data: {
    module_name: string;
    error_code?: string;
    severity?: 'info' | 'warning' | 'critical';
    error_message: string;
    auto_fix_attempted?: boolean;
    auto_fix_status?: 'pending' | 'fixed' | 'failed';
  }) => apiCall('POST', 'system/errors/report', data),
  checkIdempotency: (data: {
    scope: string;
    idempotency_key: string;
    request_hash?: string;
    response_payload?: Record<string, unknown> | null;
    status_code?: number;
    expires_at?: string;
  }) => apiCall('POST', 'system/idempotency/check', data),
};

// ===================== PUBLIC MARKETPLACE =====================
export const publicMarketplaceApi = {
  // Products
  listProducts: (params?: { category?: string; search?: string; sort?: string; limit?: number; offset?: number }) =>
    apiCall('GET', 'marketplace/products', params),
  getProduct: (id: string) => apiCall('GET', `marketplace/products/${id}`),
  getProductPricing: (id: string) => apiCall('GET', `marketplace/products/${id}/pricing`),
  
  // Categories
  getCategories: () => apiCall('GET', 'marketplace/categories'),
  
  // Ratings & Reviews
  getRatings: (productId: string) => apiCall('GET', `marketplace/products/${productId}/ratings`),
  submitRating: (productId: string, data: { rating: number; review_title?: string; review_text?: string }) =>
    apiCall('POST', `marketplace/products/${productId}/ratings`, data),
  
  // Favorites
  getFavorites: () => apiCall('GET', 'marketplace/favorites'),
  addFavorite: (productId: string) => apiCall('POST', 'marketplace/favorites', { product_id: productId }),
  removeFavorite: (productId: string) => apiCall('DELETE', `marketplace/favorites/${productId}`),
  isFavorite: (productId: string) => apiCall('GET', `marketplace/favorites/${productId}/check`),
  
  // Orders
  getOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    apiCall('GET', 'marketplace/orders', params),
  getOrder: (id: string) => apiCall('GET', `marketplace/orders/${id}`),
  
  // Payments
  initiatePayment: (
    data: {
      product_id: string;
      duration_days: number;
      payment_method: 'wallet' | 'upi' | 'bank' | 'wise' | 'payu' | 'binance';
      amount: number;
    }
  ) => apiCall('POST', 'marketplace/payments/initiate', data),
  verifyPayment: (data: { order_id: string; reference_id?: string }) =>
    apiCall('POST', 'marketplace/payments/verify', data),
  getPaymentMethods: () => apiCall('GET', 'marketplace/payments/methods'),
  
  // Search
  search: (query: string) => apiCall('GET', 'marketplace/products/search', { q: query }),
  
  // Orders
  createOrder: (data: { product_id: string; payment_method: string; amount: number }) =>
    apiCall('POST', 'marketplace/orders/create', data),
  
  // Favorites
  toggleFavorite: (product_id: string) => apiCall('POST', 'marketplace/favorites/toggle', { product_id }),
  
  // Demo
  logDemoAccess: (product_id: string, session_id: string) =>
    apiCall('POST', 'marketplace/demo/log', { product_id, session_id }),
  getDemoUrl: (product_id: string) => apiCall('GET', `marketplace/products/${product_id}/demo-url`),
  
  // Download
  getDownloadUrl: (product_id: string) => apiCall('GET', `marketplace/products/${product_id}/download`),

  };
