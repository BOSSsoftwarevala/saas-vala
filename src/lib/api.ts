import { supabase } from '@/integrations/supabase/client';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-gateway`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function apiCall<T = any>(method: string, path: string, body?: any): Promise<T> {
  const headers = await getAuthHeaders();

  const config: RequestInit = { method, headers };

  if (method === 'GET' && body) {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v));
    });
    path += '?' + params.toString();
  } else if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}/${path}`, config);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

// ===================== AUTH =====================
export const authApi = {
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
  addDomain: (data: any) => apiCall('POST', 'domain/add', data),
  verifyDomain: (domainId: string) => apiCall('POST', 'domain/verify', { domain_id: domainId }),
  health: () => apiCall('GET', 'server/health'),
};

// ===================== GITHUB =====================
export const githubApi = {
  installUrl: () => apiCall('GET', 'github/install-url'),
  callback: (code: string) => apiCall('POST', 'github/callback', { code }),
  repos: () => apiCall('GET', 'github/repos'),
};

// ===================== AI =====================
export const aiApi = {
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
  withdraw: (amount: number, description?: string, referenceId?: string, referenceType?: string) =>
    apiCall('POST', 'wallet/withdraw', { amount, description, reference_id: referenceId, reference_type: referenceType }),
  transactions: (params?: { page?: number; limit?: number }) =>
    apiCall('GET', 'wallet/transactions', params),
  all: () => apiCall('GET', 'wallet/all'),
};

// ===================== SEO & LEADS =====================
export const leadsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    apiCall('GET', 'leads', params),
  create: (data: any) => apiCall('POST', 'leads', data),
};

export const seoApi = {
  analytics: () => apiCall('GET', 'seo/analytics'),
};
