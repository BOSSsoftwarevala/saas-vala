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

// ===================== PUBLIC MARKETPLACE =====================
export const publicMarketplaceApi = {
  // Products
  listProducts: (params?: { category?: string; search?: string; sort?: string; limit?: number; offset?: number }) =>
    apiCall('GET', 'marketplace/products', params),
  getProduct: (id: string) => apiCall('GET', `marketplace/products/${id}`),
  getProductPricing: (id: string) => apiCall('GET', `marketplace/products/${id}/pricing`),
  
  // Categories
  getCategories: () => apiCall('GET', 'marketplace/categories'),
  
  // Banners
  getBanners: () => apiCall('GET', 'marketplace/banners'),
  
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
  initiatePayment: (data: {
    product_id: string;
    duration_days: number;
    payment_method: 'wallet' | 'upi' | 'bank' | 'wise' | 'payu' | 'binance';
    amount: number;
  }) => apiCall('POST', 'marketplace/payments/initiate', data),
  
  verifyPayment: (data: { order_id: string; transaction_ref?: string; provider?: string }) =>
    apiCall('POST', 'marketplace/payments/verify', data),
  
  getPaymentGateways: () => apiCall('GET', 'marketplace/payment-gateways'),
  
  // License Keys
  getLicenseKeys: () => apiCall('GET', 'marketplace/licenses'),
  getLicenseKey: (id: string) => apiCall('GET', `marketplace/licenses/${id}`),
  validateLicense: (licenseKey: string, deviceId?: string) =>
    apiCall('POST', 'marketplace/licenses/validate', { license_key: licenseKey, device_id: deviceId }),
  downloadAPK: (productId: string, licenseKeyId?: string) =>
    apiCall('POST', 'marketplace/download-apk', { product_id: productId, license_key_id: licenseKeyId }),
  
  // APK Downloads
  getDownloadLink: (productId: string) => apiCall('GET', `marketplace/apk/${productId}/download-link`),
  getDownloadHistory: () => apiCall('GET', 'marketplace/download-history'),
  
  // Demo Access
  logDemoAccess: (productId: string, sessionId: string) =>
    apiCall('POST', `marketplace/demo/${productId}/log`, { session_id: sessionId }),
  
  // Wallet
  getWallet: () => apiCall('GET', 'marketplace/wallet'),
  addWalletBalance: (amount: number, paymentMethod?: string) =>
    apiCall('POST', 'marketplace/wallet/add', { amount, payment_method: paymentMethod }),
  
  // Reseller Specific
  getResellerStats: () => apiCall('GET', 'marketplace/reseller/stats'),
  getResellerPlans: () => apiCall('GET', 'marketplace/reseller/plans'),
  subscribeToResellerPlan: (planId: string) =>
    apiCall('POST', 'marketplace/reseller/subscribe', { plan_id: planId }),
  getResellerEarnings: (params?: { period?: string }) =>
    apiCall('GET', 'marketplace/reseller/earnings', params),
  generateResellerKeys: (productId: string, quantity: number, durationDays?: number) =>
    apiCall('POST', 'marketplace/reseller/generate-keys', { product_id: productId, quantity, duration_days: durationDays }),
  
  // Notifications
  getNotifications: (params?: { page?: number; limit?: number; unread_only?: boolean }) =>
    apiCall('GET', 'marketplace/notifications', params),
  markNotificationAsRead: (notificationId: string) =>
    apiCall('PUT', `marketplace/notifications/${notificationId}/read`, {}),
  
  // Search
  search: (query: string, params?: { category?: string; min_price?: number; max_price?: number; min_rating?: number; sort?: string }) =>
    apiCall('GET', 'marketplace/search', { q: query, ...params }),
};
