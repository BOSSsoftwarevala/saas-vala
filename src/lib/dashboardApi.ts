import { supabase } from '@/integrations/supabase/client';
import { withErrorHandling, withRetry, validators, security, rateLimiter, ValidationError, PermissionError, DashboardError } from './errorHandling';
import { createPhpOfflineRuntimePack, generateSecureLicenseKey, generateKeySignature, generateSecureOfflineLicenseKey, verifySecureOfflineLicenseKey, verifyKeySignature } from '@/lib/licenseUtils';

// Generate unique license key
const generateUniqueKey = (): string => {
  return generateSecureLicenseKey();
};

export interface DashboardProduct {
  id: string;
  name: string;
  apk?: string;
  description?: string | null;
  status?: string;
  created_by?: string | null;
  created_at: string;
  price?: number;
}

export interface DashboardKey {
  id: string;
  product_id: string;
  key: string;
  status: 'active' | 'inactive';
  assigned_to?: string | null;
  created_at: string;
}

export interface DashboardReseller {
  id: string;
  name: string;
  credits: number;
  wallet_balance?: number;
  total_added?: number;
  total_spent?: number;
  total_earned?: number;
  total_profit?: number;
  total_sales?: number;
  active_clients?: number;
  keys_generated?: number;
  created_at: string;
}

export interface ResellerExportSummary {
  name: string;
  sales: number;
  keys: number;
  earnings: number;
  orders: number;
}

export interface ResellerApplication {
  id: string;
  name: string;
  email: string;
  phone?: string;
  business_name: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardServer {
  id: string;
  name: string;
  status: 'active' | 'down' | 'deploying' | 'suspended' | 'failed' | 'stopped' | 'live';
  region: 'India' | 'US' | 'EU' | 'Unknown';
  created_at: string;
  product_id?: string | null;
  load?: number;
}

export interface DashboardUser {
  id: string;
  role: string;
  assigned_products?: string[];
  created_at: string;
}

export interface DashboardNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error' | string;
  title: string;
  message: string;
  status: 'read' | 'unread';
  created_at: string;
  action_url?: string | null;
  user_id?: string | null;
}

export interface DashboardLog {
  id: string;
  action: string;
  performed_by: string | null;
  table_name?: string | null;
  record_id?: string | null;
  timestamp: string;
}

export interface DashboardLead {
  id: string;
  name: string;
  email?: string;
  source: 'demo' | 'support' | 'marketplace' | 'referral' | 'other';
  status: 'new' | 'contacted' | 'converted' | 'lost';
  created_at: string;
  converted_at?: string;
}

export interface CloudDeployment {
  id: string;
  product_id: string;
  server_id: string;
  region: 'India' | 'US' | 'EU' | 'Unknown';
  status: 'deploying' | 'live' | 'failed' | 'stopped' | 'suspended';
  load_balancer_url?: string;
  backup_server_id?: string;
  failover_enabled: boolean;
  auto_scaling: boolean;
  created_at: string;
  last_health_check: string;
  health_status: 'healthy' | 'warning' | 'critical';
}

export interface BackupRecord {
  id: string;
  entity_type: 'product' | 'server' | 'key' | 'reseller' | 'lead';
  entity_id: string;
  backup_type: 'auto' | 'manual';
  status: 'pending' | 'completed' | 'failed';
  file_path?: string;
  size_bytes?: number;
  created_at: string;
  restored_at?: string;
}

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalKeys: number;
  activeKeys: number;
  totalResellers: number;
  activeResellers: number;
  liveServers: number;
  totalServers: number;
  unreadNotifications: number;
  totalLeads: number;
  recentActivity: number;
}

function safeCount(count: number | null) {
  return typeof count === 'number' ? count : 0;
}

function mapKey(row: any): DashboardKey {
  return {
    id: row.id,
    product_id: row.product_id,
    key: row.license_key ?? row.key ?? '',
    status: row.status ?? 'inactive',
    assigned_to: row.assigned_to ?? null,
    created_at: row.created_at,
  };
}

function mapReseller(row: any): DashboardReseller {
  return {
    id: row.id,
    name: row.company_name ?? row.name ?? '',
    credits: Number(row.wallet_balance ?? row.credits ?? row.credit_limit ?? 0),
    created_at: row.created_at,
  };
}

function mapNotification(row: any): DashboardNotification {
  return {
    id: row.id,
    type: row.type ?? 'info',
    title: row.title ?? '',
    message: row.message ?? '',
    status: row.read === false ? 'unread' : row.read === true ? 'read' : (row.status ?? 'unread'),
    created_at: row.created_at,
    action_url: row.action_url ?? null,
    user_id: row.user_id ?? null,
  };
}

function mapServer(row: any): DashboardServer {
  return {
    ...row,
    status: row.status ?? 'down',
    region: row.region ?? 'Unknown',
  };
}

class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

async function createLog(
  action: string,
  performedBy: string | null,
  tableName?: string,
  recordId?: string,
  details?: Record<string, unknown>
) {
  const detailIp = typeof details?.ip_address === 'string' ? String(details.ip_address) : null;
  await (supabase as any).from('audit_logs').insert({
    action,
    user_id: performedBy,
    table_name: tableName || null,
    record_id: recordId || null,
    new_data: details || null,
    ip_address: detailIp,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    created_at: new Date().toISOString(),
  });
}

async function createNotification(
  type: string,
  title: string,
  message: string,
  userId?: string
) {
  await supabase.from('notifications').insert({
    type,
    title,
    message,
    read: false,
    user_id: userId || null,
    created_at: new Date().toISOString(),
  });
}

function randomId(prefix = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${timestamp}-${random}`;
}

const REQUEST_ID_PATTERN = /^rs_[a-zA-Z0-9_-]{8,80}$/;

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `rs_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `rs_${Date.now().toString(36)}${randomId('rs').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
}

function normalizeRequestId(raw?: unknown): string {
  const candidate = String(raw || '').trim();
  if (!candidate || candidate.startsWith('thinking_')) {
    return generateRequestId();
  }
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : generateRequestId();
}

async function requireSuperAdmin(userId: string) {
  await security.validateSession(userId);
  await security.requireAnyRole(userId, ['super_admin']);
}

async function enforceLicenseCompatibility(
  productId: string,
  apkVersionCode?: number,
  appVersion?: string
) {
  const hasVersionSignals = Number.isFinite(Number(apkVersionCode)) || !!String(appVersion || '').trim();
  if (!hasVersionSignals) return;

  const { data, error } = await (supabase as any).rpc('validate_license_apk_compatibility', {
    p_product_id: productId,
    p_apk_version_code: Number.isFinite(Number(apkVersionCode)) ? Number(apkVersionCode) : null,
    p_app_version: appVersion || null,
  });

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (!message.includes('does not exist')) {
      throw error;
    }
    return;
  }

  if (data && data.compatible === false) {
    throw new ValidationError(String(data.message || 'APK version is not compatible with this license'));
  }
}

async function enforceRevocationSync(
  licenseKey: string,
  userId?: string,
  deviceId?: string
) {
  const { data, error } = await (supabase as any).rpc('sync_license_revocation_status', {
    p_license_key: licenseKey,
    p_user_id: userId || null,
    p_device_id: deviceId || null,
  });

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (!message.includes('does not exist')) {
      throw error;
    }
    return;
  }

  if (data?.revoked === true) {
    throw new ValidationError(String(data.reason || 'License key has been revoked'));
  }
}

function computeResellerPrice(basePrice: number, marginPercent: number): number {
  const price = Number(basePrice || 0);
  const margin = Number(marginPercent || 0);
  const adjusted = price - (price * margin) / 100;
  return Math.max(0, Number(adjusted.toFixed(2)));
}

type ResellerPlanDuration = '1M' | '3M' | '6M' | '12M' | 'lifetime';

type PhpSourceKind = 'zip_upload' | 'github_repo';
type OfflineOutputPlatform = 'android_apk' | 'windows_exe' | 'desktop_webview' | 'electron_exe' | 'ios_bundle';

const RESELLER_PLAN_MULTIPLIERS: Record<ResellerPlanDuration, number> = {
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '12M': 12,
  lifetime: 24,
};

function getResellerPlanPrice(baseMonthlyPrice: number, planDuration: ResellerPlanDuration): number {
  return Math.max(0, Number((Number(baseMonthlyPrice || 0) * RESELLER_PLAN_MULTIPLIERS[planDuration]).toFixed(2)));
}

function getKeyTypeForPlan(planDuration: ResellerPlanDuration): 'monthly' | 'yearly' | 'lifetime' {
  if (planDuration === '12M') return 'yearly';
  if (planDuration === 'lifetime') return 'lifetime';
  return 'monthly';
}

function getExpiryForPlan(planDuration: ResellerPlanDuration): string | null {
  if (planDuration === 'lifetime') return null;

  const expiry = new Date();
  const monthsToAdd = Number(planDuration.replace('M', ''));
  expiry.setUTCMonth(expiry.getUTCMonth() + monthsToAdd);
  return expiry.toISOString();
}

function randomKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `KEY-${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'KEY-';
  for (let i = 0; i < 24; i += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

async function resolveResellerAndWallet(userId: string) {
  await security.validateSession(userId);
  await security.requireAnyRole(userId, ['reseller']);

  const { data: reseller, error: resellerError } = await (supabase as any)
    .from('resellers')
    .select('id, user_id, company_name, created_at')
    .eq('user_id', userId)
    .single();
  if (resellerError || !reseller) throw resellerError || new ValidationError('Reseller account not found');

  let { data: wallet, error: walletError } = await (supabase as any)
    .from('wallets')
    .select('id, user_id, reseller_id, balance, total_added, total_spent, total_earned, is_locked, version')
    .eq('user_id', userId)
    .maybeSingle();
  if (walletError) throw walletError;

  if (!wallet) {
    const { data: createdWallet, error: createWalletError } = await (supabase as any)
      .from('wallets')
      .insert({
        user_id: userId,
        reseller_id: reseller.id,
        balance: 0,
        total_added: 0,
        total_spent: 0,
        total_earned: 0,
        currency: 'USD',
        is_locked: false,
      })
      .select('id, user_id, reseller_id, balance, total_added, total_spent, total_earned, is_locked, version')
      .single();
    if (createWalletError || !createdWallet) {
      throw createWalletError || new ValidationError('Failed to create reseller wallet');
    }
    wallet = createdWallet;
  } else if (!wallet.reseller_id) {
    const { data: linkedWallet, error: linkError } = await (supabase as any)
      .from('wallets')
      .update({ reseller_id: reseller.id })
      .eq('id', wallet.id)
      .select('id, user_id, reseller_id, balance, total_added, total_spent, total_earned, is_locked, version')
      .single();
    if (linkError || !linkedWallet) {
      throw linkError || new ValidationError('Failed to link wallet to reseller');
    }
    wallet = linkedWallet;
  }

  return { reseller, wallet };
}

async function updateWalletAtomic(
  walletId: string,
  expectedVersion: number,
  patch: Record<string, unknown>
) {
  const { data, error } = await (supabase as any)
    .from('wallets')
    .update({
      ...patch,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', walletId)
    .eq('version', expectedVersion)
    .select('id, user_id, reseller_id, balance, total_added, total_spent, total_earned, is_locked, version')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ValidationError('Wallet was updated by another request. Please retry.');
  return data;
}

async function generateResellerLicenseKeyAtomic(params: {
  requestId: string;
  userId: string;
  resellerId: string;
  walletId: string;
  productId: string;
  planDuration: ResellerPlanDuration;
  amount: number;
  licenseKey: string;
  keySignature: string;
  keyType: 'monthly' | 'yearly' | 'lifetime';
  expiresAt: string | null;
  deviceLimit: number;
  clientId?: string | null;
  sellPrice?: number | null;
  deliveryStatus: 'pending' | 'sent' | 'failed';
  notes: string;
  meta: Record<string, unknown>;
}) {
  const requestId = normalizeRequestId(params.requestId);

  const { data, error } = await withRetry(async () => {
    const rpcResult = await (supabase as any).rpc('reseller_generate_license_key_atomic_locked', {
      p_request_id: requestId,
      p_user_id: params.userId,
      p_reseller_id: params.resellerId,
      p_wallet_id: params.walletId,
      p_product_id: params.productId,
      p_amount: params.amount,
      p_plan_duration: params.planDuration,
      p_license_key: params.licenseKey,
      p_key_signature: params.keySignature,
      p_key_type: params.keyType,
      p_expires_at: params.expiresAt,
      p_device_limit: params.deviceLimit,
      p_client_id: params.clientId || null,
      p_sell_price: params.sellPrice ?? null,
      p_delivery_status: params.deliveryStatus,
      p_notes: params.notes,
      p_meta: params.meta,
    });

    const message = String(rpcResult?.error?.message || '').toLowerCase();
    if (rpcResult?.error && (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('temporar') ||
      message.includes('deadlock')
    )) {
      throw new DashboardError('Transient transaction failure, retrying', 'TRANSIENT_RPC_ERROR', 503, {
        originalError: rpcResult.error,
      });
    }

    return rpcResult;
  }, 3, 800);

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('insufficient')) {
      throw new ValidationError('Insufficient balance');
    }
    throw new ValidationError('Transaction failed');
  }

  const payload = data || {};
  if (!payload.transaction_id || !payload.license_key_id || payload.balance_after === undefined || payload.version === undefined) {
    throw new ValidationError('Transaction failed');
  }

  return {
    transactionId: String(payload.transaction_id),
    licenseKeyId: String(payload.license_key_id),
    balanceAfter: Number(payload.balance_after || 0),
    walletVersion: Number(payload.version || 0),
    totalSpent: Number(payload.total_spent || 0),
    idempotent: payload.idempotent === true,
  };
}

async function ensureUniqueKey(keyValue: string): Promise<string> {
  const { data, error } = await supabase
    .from('license_keys')
    .select('id')
    .eq('license_key', keyValue)
    .limit(1);

  if (error) {
    console.error('Key uniqueness check failed', error);
    return keyValue;
  }

  if (data && data.length > 0) {
    return ensureUniqueKey(randomKey());
  }

  return keyValue;
}

const BUY_RATE_LIMIT_MAX_ATTEMPTS = 5;
const BUY_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const BUY_DB_LIMIT_MAX_ATTEMPTS = 12;
const BUY_DB_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const ACTIVATE_RATE_LIMIT_MAX_ATTEMPTS = 8;
const ACTIVATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const BRUTE_FORCE_FAIL_LIMIT = 6;
const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000;

function normalizeLicenseKey(input: string): string {
  return String(input || '').trim().toUpperCase();
}

function maskLicenseKey(input: string): string {
  const normalized = normalizeLicenseKey(input);
  if (normalized.length < 8) return '****';
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

function isLicenseBlacklisted(row: any): boolean {
  return (
    row?.key_status === 'blocked' ||
    row?.status === 'blocked' ||
    row?.meta?.blacklisted === true
  );
}

async function logLicenseVerificationAttempt(
  licenseKey: string,
  result: string,
  reason?: string,
  userId?: string,
  deviceId?: string
) {
  try {
    await (supabase as any).from('license_verification_logs').insert({
      license_key: normalizeLicenseKey(licenseKey),
      user_id: userId || null,
      device_id: deviceId || null,
      result,
      reason: reason || null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Failed to write license verification log', error);
  }
}

async function createAdminAuditLog(
  adminUserId: string | null,
  tableName: string,
  recordId: string,
  event: string,
  details?: Record<string, unknown>
) {
  await createLog('update', adminUserId, tableName, recordId, {
    admin_event: event,
    ...(details || {}),
  });
}

export const dashboardApi = {
  getDashboardData: async (userId?: string) => {
    const [productsRes, keysRes, resellersRes, serversRes, notificationsRes, logsRes, leadsRes] =
      await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('license_keys').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('resellers').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('servers').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

    const errors = [productsRes.error, keysRes.error, resellersRes.error, serversRes.error, notificationsRes.error, logsRes.error, leadsRes.error]
      .filter(Boolean);
    if (errors.length > 0) {
      throw new Error('Failed to load dashboard data');
    }

    const products = (productsRes.data || []) as DashboardProduct[];
    const keys = (keysRes.data || []).map(mapKey);
    const resellers = (resellersRes.data || []).map(mapReseller);
    const servers = (serversRes.data || []).map(mapServer);
    const notifications = (notificationsRes.data || []).map(mapNotification);
    const leads = (leadsRes.data || []) as DashboardLead[];
    const logs = (logsRes.data || []).map((log: any) => ({
      id: log.id,
      action: log.action,
      performed_by: log.user_id || null,
      table_name: log.table_name,
      record_id: log.record_id,
      timestamp: log.created_at,
    })) as DashboardLog[];

    const activeResellers = resellers.filter((reseller) => Number(reseller.credits) > 0).length;
    const activeProducts = products.filter((product) => product.status === 'active').length;
    const stats: DashboardStats = {
      totalProducts: products.length,
      activeProducts,
      totalKeys: keys.length,
      activeKeys: keys.filter((key) => key.status === 'active').length,
      totalResellers: resellers.length,
      activeResellers,
      liveServers: servers.filter((server) => server.status === 'live' || server.status === 'active').length,
      totalServers: servers.length,
      unreadNotifications: notifications.filter((notice) => notice.status === 'unread').length,
      totalLeads: leads.length,
      recentActivity: logs.length,
    };

    return { products, keys, resellers, servers, notifications, logs, leads, stats };
  },

  createProduct: async (data: Partial<DashboardProduct>) => {
    const payload: any = {
      ...data,
      slug: (data as any).slug || (data.name ? data.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') : randomId('product')),
      created_at: new Date().toISOString(),
      status: data.status || 'active',
      apk: data.apk || null,
      created_by: data.created_by || null,
    };
    const { data: result, error } = await supabase.from('products').insert(payload).select().single();
    if (error) throw error;
    return result as DashboardProduct;
  },

  generateKey: async (payload: { productId: string; assignedTo?: string | null; status?: 'active' | 'inactive'; createdBy?: string | null }) => {
    const keyBundle = await generateSecureOfflineLicenseKey({
      productId: payload.productId,
      assignedTo: payload.assignedTo || null,
    });
    const nextKey = await ensureUniqueKey(keyBundle.key);
    const insertPayload = {
      id: randomId('key'),
      product_id: payload.productId,
      license_key: nextKey,
      key_signature: keyBundle.signature,
      status: payload.status || 'active',
      key_status: payload.status === 'inactive' ? 'unused' : 'active',
      assigned_to: payload.assignedTo || null,
      max_devices: 1,
      activated_devices: 0,
      created_at: new Date().toISOString(),
      created_by: payload.createdBy || null,
      meta: {
        offline_payload: keyBundle.payload,
        generated_mode: 'secure_offline_v1',
      },
    };
    const { data, error } = await (supabase as any).from('license_keys').insert(insertPayload as any).select().single();
    if (error) throw error;
    await createLog('create', payload.createdBy || null, 'license_keys', data.id, {
      security_event: 'key_generated',
      product_id: payload.productId,
      assigned_to: payload.assignedTo || null,
    });
    return mapKey(data);
  },

  deployServer: async (serverId: string, region: 'India' | 'US' | 'EU' | 'Unknown' = 'US') => {
    const payload: Record<string, unknown> = { status: 'deploying' };
    if (region !== 'Unknown') payload.region = region;

    let response = await supabase.from('servers').update(payload).eq('id', serverId).select().single();
    if (response.error && response.error.message?.includes('column') && payload.region) {
      response = await supabase.from('servers').update({ status: 'deploying' }).eq('id', serverId).select().single();
    }
    if (response.error) throw response.error;

    // Simulate deployment completion after a short delay.
    setTimeout(async () => {
      await supabase.from('servers').update({ status: 'live', updated_at: new Date().toISOString() }).eq('id', serverId);
    }, 2000);

    return mapServer(response.data);
  },

  addCredits: async (resellerId: string, amount: number) => {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new ValidationError('Amount must be greater than zero');
    }

    const { data: reseller, error: resellerError } = await (supabase as any)
      .from('resellers')
      .select('id, user_id, company_name, credit_limit, created_at')
      .eq('id', resellerId)
      .single();
    if (resellerError || !reseller) throw resellerError || new ValidationError('Reseller not found');

    const { data: wallet, error: walletError } = await (supabase as any)
      .from('wallets')
      .select('id, balance, total_added, version')
      .eq('user_id', reseller.user_id)
      .maybeSingle();
    if (walletError) throw walletError;
    if (!wallet) throw new ValidationError('Wallet not found for reseller account');

    const safeAmount = Number(Number(amount).toFixed(2));
    const balance = Number(wallet.balance || 0);
    const totalAdded = Number((wallet as any).total_added || 0);

    const nextWallet = await updateWalletAtomic(wallet.id, Number(wallet.version || 0), {
      balance: Number((balance + safeAmount).toFixed(2)),
      total_added: Number((totalAdded + safeAmount).toFixed(2)),
    });

    await (supabase as any).from('transactions').insert({
      wallet_id: wallet.id,
      reseller_id: reseller.id,
      amount: safeAmount,
      type: 'credit',
      status: 'completed',
      balance_after: Number(nextWallet.balance || 0),
      description: 'Admin credit top-up',
      reference_type: 'admin_credit_topup',
      created_at: new Date().toISOString(),
      meta: { reseller_id: reseller.id },
    });

    await createLog('balance_added', reseller.user_id, 'wallets', wallet.id, {
      reseller_id: reseller.id,
      amount: safeAmount,
      balance_after: Number(nextWallet.balance || 0),
    });

    return {
      ...mapReseller(reseller),
      credits: Number(nextWallet.balance || 0),
      wallet_balance: Number(nextWallet.balance || 0),
      total_added: Number((nextWallet as any).total_added || 0),
      total_spent: Number((nextWallet as any).total_spent || 0),
      total_earned: Number((nextWallet as any).total_earned || 0),
    } as DashboardReseller;
  },

  getNotifications: async (userId?: string) => {
    let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapNotification);
  },

  markNotificationsRead: async (ids: string[]) => {
    const { data, error } = await supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() }).in('id', ids).select();
    if (error) throw error;
    return (data || []).map(mapNotification);
  },

  createNotification: async (payload: Partial<DashboardNotification>) => {
    const insertPayload = {
      id: payload.id || randomId('notification'),
      type: payload.type || 'info',
      title: payload.title || 'Notification',
      message: payload.message || '',
      read: payload.status !== 'unread' ? true : false,
      created_at: new Date().toISOString(),
      action_url: payload.action_url || null,
      user_id: payload.user_id || null,
    };
    const { data, error } = await supabase.from('notifications').insert(insertPayload).select().single();
    if (error) throw error;
    return mapNotification(data);
  },

  createLog: async (action: string, performedBy: string | null, tableName?: string, recordId?: string, details?: Record<string, unknown>) => {
    const { data, error } = await (supabase as any).from('audit_logs').insert({
      action,
      user_id: performedBy,
      table_name: tableName,
      record_id: recordId || null,
      new_data: details || null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      created_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      action: data.action,
      performed_by: data.user_id || null,
      table_name: data.table_name,
      record_id: data.record_id || null,
      timestamp: data.created_at,
    } as DashboardLog;
  },

  createLead: async (lead: Partial<DashboardLead>) => {
    const payload: any = {
      ...lead,
      name: lead.name || 'Anonymous',
      id: lead.id || randomId('lead'),
      status: lead.status || 'new',
      source: lead.source || 'other',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('leads').insert(payload as any).select().single();
    if (error) throw error;
    return data as DashboardLead;
  },

  updateLeadStatus: async (leadId: string, status: 'new' | 'contacted' | 'converted' | 'lost') => {
    const updateData: any = { status };
    if (status === 'converted') {
      updateData.converted_at = new Date().toISOString();
    }
    const { data, error } = await supabase.from('leads').update(updateData).eq('id', leadId).select().single();
    if (error) throw error;
    return data as DashboardLead;
  },

  getSystemMetrics: () => {
    return {
      version: '1.0.3',
      uptime: 99.98,
      environment: 'production',
      lastSync: new Date().toISOString(),
    };
  },

  queuePhpOfflineConversion: async (payload: {
    productId: string;
    sourceKind: PhpSourceKind;
    sourceBucketPath?: string;
    sourceRepoUrl?: string;
    outputPlatform?: OfflineOutputPlatform;
    version?: string;
    notes?: string;
  }) => {
    return withErrorHandling(async () => {
      validators.uuid(payload.productId, 'productId');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      validators.oneOf(payload.sourceKind, ['zip_upload', 'github_repo'], 'sourceKind');
      if (payload.sourceKind === 'zip_upload') {
        validators.required(payload.sourceBucketPath, 'sourceBucketPath');
      }
      if (payload.sourceKind === 'github_repo') {
        validators.required(payload.sourceRepoUrl, 'sourceRepoUrl');
      }

      const outputPlatform = payload.outputPlatform || 'android_apk';
      validators.oneOf(outputPlatform, ['android_apk', 'windows_exe', 'desktop_webview', 'electron_exe', 'ios_bundle'], 'outputPlatform');

      const { data: product, error: productError } = await (supabase as any)
        .from('products')
        .select('id, name, slug')
        .eq('id', payload.productId)
        .single();
      if (productError || !product) throw productError || new ValidationError('Product not found');

      const { data: result, error: invokeError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: {
          action: 'register_php_offline_conversion',
          data: {
            product_id: payload.productId,
            project_name: product.name,
            source_kind: payload.sourceKind,
            source_bucket_path: payload.sourceBucketPath || null,
            source_repo_url: payload.sourceRepoUrl || null,
            output_platform: outputPlatform,
            version: payload.version || '1.0.0',
            notes: payload.notes || null,
          },
        },
      });

      if (invokeError) throw invokeError;
      if (!result?.success) throw new ValidationError(result?.error || 'Unable to queue PHP offline conversion');

      await createLog('php_offline_conversion_queued', user.id, 'products', payload.productId, {
        source_kind: payload.sourceKind,
        output_platform: outputPlatform,
        version: payload.version || '1.0.0',
      });

      return result;
    }, 'Queue PHP offline conversion');
  },

  triggerPhpOfflineBuild: async (payload: {
    slug: string;
    productId: string;
    repoUrl?: string;
    sourceKind?: PhpSourceKind;
    sourceBucketPath?: string;
    outputPlatform?: OfflineOutputPlatform;
    version?: string;
  }) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      validators.required(payload.slug, 'slug');
      validators.uuid(payload.productId, 'productId');

      const { data: result, error: invokeError } = await supabase.functions.invoke('apk-factory', {
        body: {
          action: 'trigger_build',
          data: {
            slug: payload.slug,
            repo_url: payload.repoUrl || null,
            product_id: payload.productId,
            conversion_type: 'php_offline',
            output_platform: payload.outputPlatform || 'android_apk',
            source_kind: payload.sourceKind || (payload.sourceBucketPath ? 'zip_upload' : 'github_repo'),
            source_bucket_path: payload.sourceBucketPath || null,
            source_repo_url: payload.repoUrl || null,
            output_version: payload.version || '1.0.0',
          },
        },
      });

      if (invokeError) throw invokeError;
      if (!result?.success) throw new ValidationError(result?.error || 'Unable to trigger PHP offline build');

      await createLog('php_offline_build_triggered', user.id, 'products', payload.productId, {
        slug: payload.slug,
        output_platform: payload.outputPlatform || 'android_apk',
      });

      return result;
    }, 'Trigger PHP offline build');
  },

  finalizePhpOfflineBuild: async (payload: {
    queueId: string;
    productId: string;
    outputPlatform: OfflineOutputPlatform;
    version: string;
    filePath: string;
    fileSize?: number;
    fileHash?: string;
    expiresAt?: string | null;
    deviceLimit?: number;
    note?: string;
  }) => {
    return withErrorHandling(async () => {
      validators.uuid(payload.queueId, 'queueId');
      validators.uuid(payload.productId, 'productId');
      validators.required(payload.filePath, 'filePath');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      const runtimePack = await createPhpOfflineRuntimePack({
        productId: payload.productId,
        expiresAt: payload.expiresAt || null,
        deviceLimit: Math.max(1, Number(payload.deviceLimit || 1)),
      });

      const { data: result, error: invokeError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: {
          action: 'finalize_php_offline_conversion',
          data: {
            queue_id: payload.queueId,
            product_id: payload.productId,
            output_platform: payload.outputPlatform,
            version: payload.version,
            file_path: payload.filePath,
            file_size: payload.fileSize || null,
            file_hash: payload.fileHash || null,
            license_runtime_bundle: {
              bootstrap: runtimePack.bootstrap,
              php_guard: runtimePack.phpGuardSnippet,
              js_guard: runtimePack.jsGuardSnippet,
              note: payload.note || null,
            },
            build_meta: {
              finalized_by: user.id,
              finalized_at: new Date().toISOString(),
            },
          },
        },
      });

      if (invokeError) throw invokeError;
      if (!result?.success) throw new ValidationError(result?.error || 'Unable to finalize PHP offline build');

      await createLog('php_offline_build_finalized', user.id, 'products', payload.productId, {
        queue_id: payload.queueId,
        output_platform: payload.outputPlatform,
        version: payload.version,
        file_path: payload.filePath,
      });

      return {
        ...result,
        runtimePack,
      };
    }, 'Finalize PHP offline build');
  },

  getPhpOfflineBuildQueue: async (productId?: string) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      let query = (supabase as any)
        .from('apk_build_queue')
        .select('*')
        .eq('conversion_type', 'php_offline')
        .order('created_at', { ascending: false })
        .limit(200);

      if (productId) {
        validators.uuid(productId, 'productId');
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }, 'Get PHP offline build queue');
  },

  generatePhpOfflineLicenseRuntime: async (payload: {
    productId: string;
    expiresAt?: string | null;
    deviceLimit?: number;
    resellerId?: string | null;
    assignedTo?: string | null;
  }) => {
    return withErrorHandling(async () => {
      validators.uuid(payload.productId, 'productId');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await security.validateSession(user.id);

      const runtimePack = await createPhpOfflineRuntimePack({
        productId: payload.productId,
        expiresAt: payload.expiresAt || null,
        deviceLimit: Math.max(1, Number(payload.deviceLimit || 1)),
        resellerId: payload.resellerId || null,
        assignedTo: payload.assignedTo || null,
      });

      return runtimePack;
    }, 'Generate PHP offline runtime bundle');
  },

  // Cloud Deployment Functions
  deployToCloud: async (productId: string, region: 'India' | 'US' | 'EU' | 'Unknown' = 'US', userId?: string) => {
    return withErrorHandling(async () => {
      return withRetry(async () => {
        // Rate limiting for deployments
        if (!rateLimiter.checkLimit(`deploy-${userId}`, 5, 300000)) { // 5 deployments per 5 minutes
          throw new Error('Deployment rate limit exceeded. Please wait before deploying again.');
        }

        // Validate inputs
        validators.uuid(productId, 'productId');
        validators.oneOf(region, ['India', 'US', 'EU', 'Unknown'], 'region');

        // Validate user session
        await security.validateSession(userId);

        // Auto-routing: Select optimal server based on region and load
        const { data: servers } = await (supabase as any)
          .from('servers')
          .select('*')
          .eq('region', region)
          .eq('status', 'live')
          .order('load', { ascending: true })
          .limit(1);

        if (!servers || servers.length === 0) {
          throw new ValidationError(`No available servers in ${region} region`);
        }

        const primaryServer = servers[0];

        // Find backup server in different region for failover
        const backupRegion = region === 'US' ? 'EU' : region === 'EU' ? 'India' : 'US';
        const { data: backupServers } = await (supabase as any)
          .from('servers')
          .select('*')
          .eq('region', backupRegion)
          .eq('status', 'live')
          .order('load', { ascending: true })
          .limit(1);

        const backupServer = backupServers?.[0];

        // Create deployment record
        const deploymentId = randomId('deploy');
        const { error: deployError } = await (supabase as any)
          .from('cloud_deployments')
          .insert({
            id: deploymentId,
            product_id: productId,
            server_id: primaryServer.id,
            region,
            status: 'deploying',
            failover_enabled: !!backupServer,
            backup_server_id: backupServer?.id,
            auto_scaling: true,
            health_status: 'healthy',
            last_health_check: new Date().toISOString(),
          });

        if (deployError) throw deployError;

        // Update server status and load
        await (supabase as any)
          .from('servers')
          .update({
            status: 'deploying',
            product_id: productId,
            load: ((primaryServer as any).load || 0) + 10
          })
          .eq('id', primaryServer.id);

        await createLog('deploy_product', userId, 'products', productId);
        await createNotification('success', 'Product Deployment Started', `Product deployed to ${region} region`, userId);

        return {
          deploymentId,
          serverId: primaryServer.id,
          region,
          backupServerId: backupServer?.id
        };
      }, 3, 2000);
    }, 'Cloud deployment');
  },

  getCloudDeployments: async () => {
    const { data, error } = await (supabase as any)
      .from('cloud_deployments')
      .select(`
        *,
        products (name),
        servers (name, region, status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as (CloudDeployment & { products: { name: string }, servers: { name: string, region: string, status: string } })[];
  },

  failoverDeployment: async (deploymentId: string, userId?: string) => {
    const { data: deployment } = await (supabase as any)
      .from('cloud_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    if (!deployment || !deployment.backup_server_id) {
      throw new Error('No backup server available for failover');
    }

    // Switch to backup server
    const { error } = await (supabase as any)
      .from('cloud_deployments')
      .update({
        server_id: deployment.backup_server_id,
        status: 'live',
        last_health_check: new Date().toISOString(),
        health_status: 'healthy'
      })
      .eq('id', deploymentId);

    if (error) throw error;

    await createLog('failover_deployment', userId, 'cloud_deployments', deploymentId);
    await createNotification('warning', 'Automatic Failover', 'Deployment failed over to backup server', userId);

    return { success: true };
  },

  // Backup & Recovery Functions
  createBackup: async (entityType: 'product' | 'server' | 'key' | 'reseller' | 'lead', entityId: string, backupType: 'auto' | 'manual' = 'manual', userId?: string) => {
    return withErrorHandling(async () => {
      return withRetry(async () => {
        // Rate limiting for backups
        if (!rateLimiter.checkLimit(`backup-${userId}`, 10, 3600000)) { // 10 backups per hour
          throw new Error('Backup rate limit exceeded. Please wait before creating another backup.');
        }

        // Validate inputs
        validators.oneOf(entityType, ['product', 'server', 'key', 'reseller', 'lead'], 'entityType');
        validators.uuid(entityId, 'entityId');
        validators.oneOf(backupType, ['auto', 'manual'], 'backupType');

        // Validate user session
        await security.validateSession(userId);

        const backupId = randomId('backup');

        const { error } = await (supabase as any)
          .from('backups')
          .insert({
            id: backupId,
            entity_type: entityType,
            entity_id: entityId,
            backup_type: backupType,
            status: 'pending',
            created_at: new Date().toISOString(),
          });

        if (error) throw error;

        // Simulate backup process (in real implementation, this would trigger actual backup)
        setTimeout(async () => {
          await (supabase as any)
            .from('backups')
            .update({
              status: 'completed',
              file_path: `/backups/${entityType}/${entityId}/${backupId}.zip`,
              size_bytes: 512000 // Default 500KB estimate until backup is complete
            })
            .eq('id', backupId);
        }, 2000);

        await createLog('create_backup', userId, `${entityType}s`, entityId);
        await createNotification('info', 'Backup Created', `${entityType} backup initiated`, userId);

        return { backupId };
      }, 3, 1000);
    }, 'Backup creation');
  },

  getBackups: async (entityType?: string, entityId?: string) => {
    const queryBase = (supabase as any)
      .from('backups')
      .select('*')
      .order('created_at', { ascending: false });

    let query = queryBase;
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error } = await query;
    if (error) throw error;
    return data as BackupRecord[];
  },

  restoreBackup: async (backupId: string, userId?: string) => {
    const { data: backup } = await (supabase as any)
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (!backup) throw new Error('Backup not found');

    // Mark as restoring
    await (supabase as any)
      .from('backups')
      .update({ status: 'pending' })
      .eq('id', backupId);

    // Simulate restore process
    setTimeout(async () => {
      await (supabase as any)
        .from('backups')
        .update({
          status: 'completed',
          restored_at: new Date().toISOString()
        })
        .eq('id', backupId);
    }, 3000);

    await createLog('restore_backup', userId, 'backups', backupId);
    await createNotification('success', 'Backup Restored', `${backup.entity_type} restored from backup`, userId);

    return { success: true };
  },

  // Auto-backup scheduling (would be called by cron job)
  scheduleAutoBackup: async () => {
    const entities = [
      { type: 'product' as const, table: 'products' },
      { type: 'server' as const, table: 'servers' },
      { type: 'key' as const, table: 'license_keys' },
      { type: 'reseller' as const, table: 'resellers' },
      { type: 'lead' as const, table: 'leads' },
    ];

    for (const entity of entities) {
      const { data } = await (supabase as any)
        .from(entity.table)
        .select('id')
        .limit(10); // Backup most recent 10 entities

      if (data) {
        for (const item of data) {
          await dashboardApi.createBackup(entity.type, item.id, 'auto');
        }
      }
    }

    return { success: true };
  },

  // Reseller Application Functions
  submitResellerApplication: async (applicationData: {
    name: string;
    email: string;
    phone?: string;
    business_name: string;
  }, userId?: string) => {
    return withErrorHandling(async () => {
      // Check if user already has a pending or approved application
      const { data: existingApp } = await (supabase as any)
        .from('reseller_applications')
        .select('id, status')
        .eq('user_id', userId)
        .in('status', ['pending', 'approved'])
        .single();

      if (existingApp) {
        if ((existingApp as any).status === 'approved') {
          throw new ValidationError('You are already an approved reseller');
        } else {
          throw new ValidationError('You already have a pending application');
        }
      }

      const { data, error } = await (supabase as any)
        .from('reseller_applications')
        .insert({
          ...applicationData,
          user_id: userId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      await createLog('submit_reseller_application', userId, 'reseller_applications', (data as any).id);
      await createNotification('info', 'Application Submitted', 'Your reseller application has been submitted for review', userId);

      return data as ResellerApplication;
    }, 'Reseller application submission');
  },

  getResellerApplications: async (status?: 'pending' | 'approved' | 'rejected') => {
    try {
      return await withErrorHandling(async () => {
        let query = (supabase as any)
          .from('reseller_applications')
          .select('*')
          .order('created_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as ResellerApplication[];
      }, 'Fetch reseller applications');
    } catch (err: any) {
      // Table not yet migrated – silently return empty list so the UI
      // renders the "no applications" empty state instead of crashing.
      if (err?.code === 'TABLE_NOT_FOUND') {
        console.warn('[dashboardApi] reseller_applications table not found – run migration 20260410090000_missing_tables_backfill.sql in Supabase SQL editor');
        return [] as ResellerApplication[];
      }
      throw err;
    }
  },

  approveResellerApplication: async (applicationId: string, adminUserId: string) => {
    return withErrorHandling(async () => {
      // Get the application
      const { data: application, error: fetchError } = await (supabase as any)
        .from('reseller_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (fetchError || !application) {
        throw new NotFoundError('Reseller application', applicationId);
      }

      if ((application as any).status !== 'pending') {
        throw new ValidationError('Application is not in pending status');
      }

      // Update application status
      const { error: updateError } = await (supabase as any)
        .from('reseller_applications')
        .update({
          status: 'approved',
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      // Create reseller record
      const { data: reseller, error: resellerError } = await supabase
        .from('resellers')
        .insert({
          user_id: (application as any).user_id,
          company_name: (application as any).business_name,
          credit_limit: 1000, // Initial credits
          is_verified: true,
          is_active: true,
        })
        .select()
        .single();

      if (resellerError) throw resellerError;

      // Update user role to reseller (assuming there's a user_roles or similar table)
      // This might need adjustment based on your auth system
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: (application as any).user_id,
          role: 'reseller',
        });

      if (roleError) {
        console.warn('Could not update user role:', roleError);
      }

      await createLog('approve_reseller_application', adminUserId, 'reseller_applications', applicationId);
      await createNotification('success', 'Application Approved', 'Your reseller application has been approved!', (application as any).user_id);

      return { success: true, reseller };
    }, 'Approve reseller application');
  },

  rejectResellerApplication: async (applicationId: string, rejectionReason: string, adminUserId: string) => {
    return withErrorHandling(async () => {
      const { data: application, error: fetchError } = await (supabase as any)
        .from('reseller_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (fetchError || !application) {
        throw new NotFoundError('Reseller application', applicationId);
      }

      const { error: updateError } = await (supabase as any)
        .from('reseller_applications')
        .update({
          status: 'rejected',
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      await createLog('reject_reseller_application', adminUserId, 'reseller_applications', applicationId);
      await createNotification('error', 'Application Rejected', `Your reseller application was rejected: ${rejectionReason}`, (application as any).user_id);

      return { success: true };
    }, 'Reject reseller application');
  },

  // Reseller-specific functions
  getResellerData: async (userId: string) => {
    return withErrorHandling(async () => {
      const { reseller, wallet } = await resolveResellerAndWallet(userId);

      // Get assigned keys (all keys, not just active ones for display)
      const { data: keys, error: keysError } = await (supabase as any)
        .from('license_keys')
        .select(`
          *,
          products (name, price, apk_url)
        `)
        .eq('reseller_id', reseller.id)
        .order('created_at', { ascending: false });

      if (keysError) throw keysError;

      // Get available products for resellers
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const [{ count: activeClientCount, error: clientCountError }, { data: completedTx, error: txError }] = await Promise.all([
        (supabase as any)
          .from('license_keys')
          .select('id', { count: 'exact', head: true })
          .eq('reseller_id', reseller.id)
          .eq('is_used', true),
        (supabase as any)
          .from('transactions')
          .select('amount, reference_type, type, status')
          .eq('reseller_id', reseller.id)
          .eq('status', 'completed'),
      ]);
      if (clientCountError) throw clientCountError;
      if (txError) throw txError;

      const txRows = completedTx || [];
      const totalSales = txRows
        .filter((tx: any) => tx.reference_type === 'reseller_client_sale')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
      const totalProfit = (keys || []).reduce((sum: number, key: any) => sum + Number(key.profit_amount || 0), 0);

      const mappedReseller: DashboardReseller = {
        ...mapReseller(reseller),
        credits: Number(wallet.balance || 0),
        wallet_balance: Number(wallet.balance || 0),
        total_added: Number((wallet as any).total_added || 0),
        total_spent: Number((wallet as any).total_spent || 0),
        total_earned: Number((wallet as any).total_earned || 0),
        total_profit: Number(totalProfit.toFixed(2)),
        total_sales: Number(totalSales.toFixed(2)),
        active_clients: Number(activeClientCount || 0),
        keys_generated: Number((keys || []).length),
      };

      return {
        reseller: mappedReseller,
        wallet,
        keys: keys || [],
        products: products || [],
      };
    }, 'Fetch reseller data');
  },

  resellerPurchaseProduct: async (productId: string, userId: string) => {
    return withErrorHandling(async () => {
      const buyLimiterKey = `buy:${userId}`;
      if (!rateLimiter.checkLimit(buyLimiterKey, BUY_RATE_LIMIT_MAX_ATTEMPTS, BUY_RATE_LIMIT_WINDOW_MS)) {
        await createLog('update', userId, 'transactions', productId, {
          security_event: 'buy_rate_limited',
          window_ms: BUY_RATE_LIMIT_WINDOW_MS,
          max_attempts: BUY_RATE_LIMIT_MAX_ATTEMPTS,
        });
        throw new ValidationError('Too many purchase attempts. Please wait before trying again.');
      }

      const { reseller, wallet } = await resolveResellerAndWallet(userId);
      if ((wallet as any).is_locked) {
        throw new ValidationError('Wallet is locked. Please contact support.');
      }

      // Get product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      const rateLimitSince = new Date(Date.now() - BUY_DB_LIMIT_WINDOW_MS).toISOString();
      const { count: recentBuyCount, error: buyRateError } = await (supabase as any)
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('reseller_id', reseller.id)
        .eq('type', 'debit')
        .eq('reference_type', 'reseller_product_purchase')
        .gte('created_at', rateLimitSince);
      if (buyRateError) throw buyRateError;
      if ((recentBuyCount || 0) >= BUY_DB_LIMIT_MAX_ATTEMPTS) {
        await createLog('update', userId, 'transactions', productId, {
          security_event: 'buy_db_rate_limited',
          window_ms: BUY_DB_LIMIT_WINDOW_MS,
          max_attempts: BUY_DB_LIMIT_MAX_ATTEMPTS,
          recent_count: recentBuyCount || 0,
        });
        throw new ValidationError('Purchase rate limit exceeded. Please try again later.');
      }

      // Guard against suspicious burst purchases for same reseller/product
      const recentIso = new Date(Date.now() - 15 * 1000).toISOString();
      const { data: recentPurchases, error: recentError } = await (supabase as any)
        .from('transactions')
        .select('id')
        .eq('reseller_id', reseller.id)
        .eq('product_id', productId)
        .eq('reference_type', 'reseller_product_purchase')
        .in('status', ['pending', 'success', 'completed'])
        .gte('created_at', recentIso)
        .limit(1);
      if (recentError) throw recentError;
      if (recentPurchases && recentPurchases.length > 0) {
        throw new ValidationError('Duplicate purchase attempt detected. Please wait and try again.');
      }

      // Prevent duplicate active ownership (no duplicate resale to same reseller)
      const { data: existingActiveKeys, error: existingKeyError } = await (supabase as any)
        .from('license_keys')
        .select('id')
        .eq('product_id', productId)
        .eq('reseller_id', reseller.id)
        .in('key_status', ['unused', 'active'])
        .limit(1);
      if (existingKeyError) throw existingKeyError;
      if (existingActiveKeys && existingActiveKeys.length > 0) {
        throw new ValidationError('You already own an active key for this product.');
      }

      // Resolve reseller-specific pricing with optional per-product override.
      const basePrice = Number(product.price || 0);
      const defaultMargin = Number((reseller as any).margin_percent || 0);
      let marginPercent = defaultMargin;
      const { data: pricingOverride, error: pricingError } = await (supabase as any)
        .from('reseller_product_pricing')
        .select('margin_percent, fixed_price')
        .eq('reseller_id', reseller.id)
        .eq('product_id', productId)
        .maybeSingle();
      if (pricingError && !String(pricingError.message || '').toLowerCase().includes('does not exist')) {
        throw pricingError;
      }

      let finalPrice = computeResellerPrice(basePrice, marginPercent);
      if (pricingOverride) {
        if (pricingOverride.fixed_price !== null && pricingOverride.fixed_price !== undefined) {
          finalPrice = Math.max(0, Number(pricingOverride.fixed_price));
        } else if (pricingOverride.margin_percent !== null && pricingOverride.margin_percent !== undefined) {
          marginPercent = Number(pricingOverride.margin_percent);
          finalPrice = computeResellerPrice(basePrice, marginPercent);
        }
      }

      if (finalPrice <= 0) {
        throw new ValidationError('Invalid reseller price for this product');
      }

      // Daily spend misuse protection (if daily limit is configured).
      const now = new Date();
      const r = reseller as any;
      const lastReset = r.last_spent_reset_at ? new Date(r.last_spent_reset_at) : null;
      const isNewDay = !lastReset || lastReset.toDateString() !== now.toDateString();
      const currentDailySpent = isNewDay ? 0 : Number(r.daily_spent || 0);
      const dailyLimit = Number(r.daily_credit_limit || 0);
      if (dailyLimit > 0 && currentDailySpent + finalPrice > dailyLimit) {
        throw new ValidationError('Daily wallet purchase limit exceeded for reseller account');
      }

      const walletBalance = Number(wallet.balance || 0);
      if (walletBalance < finalPrice) {
        throw new ValidationError('Insufficient wallet balance for this purchase');
      }

      const walletVersion = Number((wallet as any).version || 0);
      const walletTotalSpent = Number((wallet as any).total_spent || 0);
      const updatedWallet = await updateWalletAtomic(wallet.id, walletVersion, {
        balance: Number((walletBalance - finalPrice).toFixed(2)),
        total_spent: Number((walletTotalSpent + finalPrice).toFixed(2)),
      });

      const { error: dailySpendError } = await (supabase as any)
        .from('resellers')
        .update({
          daily_spent: Number((currentDailySpent + finalPrice).toFixed(2)),
          last_spent_reset_at: now.toISOString(),
        })
        .eq('id', reseller.id);

      if (dailySpendError) throw dailySpendError;

      // Create transaction record
      const { data: transaction, error: transactionError } = await (supabase as any).from('transactions').insert({
        wallet_id: wallet.id,
        reseller_id: reseller.id,
        product_id: productId,
        amount: finalPrice,
        type: 'debit',
        status: 'completed',
        balance_after: Number(updatedWallet.balance || 0),
        reference_type: 'reseller_product_purchase',
        meta: {
          base_price: basePrice,
          margin_percent: marginPercent,
          charged_price: finalPrice,
        },
        created_at: new Date().toISOString(),
      }).select('*').single();
      if (transactionError || !transaction) throw transactionError || new ValidationError('Failed to create transaction');

      // Use pre-generated reseller key pool first; fallback to generating fresh key.
      const { data: pooledKey, error: pooledKeyError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .eq('product_id', productId)
        .eq('reseller_id', reseller.id)
        .eq('key_status', 'pool')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pooledKeyError && !String(pooledKeyError.message || '').toLowerCase().includes('no rows')) {
        throw pooledKeyError;
      }

      const generatedBundle = pooledKey?.license_key
        ? null
        : await generateSecureOfflineLicenseKey({
            productId,
            resellerId: reseller.id,
            assignedTo: reseller.id,
          });
      const nextKey = pooledKey?.license_key || await ensureUniqueKey(generatedBundle!.key);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day license
      const signature = pooledKey?.key_signature || generatedBundle?.signature || await generateKeySignature(nextKey);

      let licenseKey: any = null;
      if (pooledKey?.id) {
        const { data: updatedKey, error: updateKeyError } = await (supabase as any)
          .from('license_keys')
          .update({
            key_status: 'unused',
            status: 'active',
            is_used: false,
            assigned_to: reseller.id,
            expires_at: expiresAt.toISOString(),
            activated_devices: 0,
            activated_at: null,
            purchase_transaction_id: transaction.id,
            notes: `Purchased from pool: ${product.name}`,
            meta: {
              ...(pooledKey.meta || {}),
              product_title: product.name,
              transaction_id: transaction.id,
              product_id: productId,
            },
          })
          .eq('id', pooledKey.id)
          .eq('key_status', 'pool')
          .select('*')
          .single();
        if (updateKeyError || !updatedKey) throw updateKeyError || new ValidationError('Failed to allocate key from pool');
        licenseKey = updatedKey;
      } else {
        const { data: insertedKey, error: keyError } = await (supabase as any)
          .from('license_keys')
          .insert({
            id: randomId('key'),
            product_id: productId,
            license_key: nextKey,
            key_signature: signature,
            key_type: 'monthly',
            key_status: 'unused',
            status: 'active',
            is_used: false,
            max_devices: 1,
            activated_devices: 0,
            activated_at: null,
            purchase_transaction_id: transaction.id,
            expires_at: expiresAt.toISOString(),
            created_by: userId,
            reseller_id: reseller.id,
            assigned_to: reseller.id,
            notes: `Purchased: ${product.name}`,
            meta: {
              product_title: product.name,
              transaction_id: transaction.id,
              product_id: productId,
              offline_payload: generatedBundle?.payload || null,
            }
          })
          .select('*')
          .single();
        if (keyError || !insertedKey) throw keyError || new ValidationError('Failed to create license key');
        licenseKey = insertedKey;
      }

      await createLog('reseller_purchase', userId, 'license_keys', licenseKey.id, {
        productId,
        price: finalPrice,
        basePrice,
        marginPercent,
        resellerId: reseller.id,
      });
      await createNotification('success', 'Purchase Successful', `You purchased ${product.name} for $${finalPrice.toFixed(2)}`, userId);

      return { success: true, licenseKey, reseller, wallet: updatedWallet };
    }, 'Reseller product purchase');
  },

  generateResellerLicenseKey: async (payload: {
    productId: string;
    planDuration: ResellerPlanDuration;
    userId: string;
    idempotencyKey?: string;
    clientId?: string;
    sellPrice?: number;
    deliveryMethod?: 'whatsapp' | 'email' | 'manual' | 'sms';
    deliveryTarget?: string;
    note?: string;
  }) => {
    return withErrorHandling(async () => {
      const { productId, planDuration, userId } = payload;

      const planRateKey = `reseller-key:${userId}`;
      if (!rateLimiter.checkLimit(planRateKey, 5, 60 * 1000)) {
        throw new ValidationError('Too many key generation attempts. Please wait before trying again.');
      }

      const { reseller, wallet } = await resolveResellerAndWallet(userId);
      if ((wallet as any).is_locked) throw new ValidationError('Wallet is locked. Please contact support.');

      if (payload.clientId) {
        const { data: client, error: clientError } = await (supabase as any)
          .from('reseller_clients')
          .select('id, reseller_id, status, email, phone')
          .eq('id', payload.clientId)
          .single();
        if (clientError || !client) throw clientError || new ValidationError('Client not found');
        if (String(client.reseller_id) !== String(reseller.id)) {
          throw new PermissionError('Client does not belong to this reseller');
        }
        if (client.status !== 'active') {
          throw new ValidationError('Client is not active. Activate client before assigning key.');
        }
      }

      const { data: product, error: productError } = await (supabase as any)
        .from('products')
        .select('id, name, price, status, license_enabled')
        .eq('id', productId)
        .single();
      if (productError || !product) throw productError || new ValidationError('Product not found');
      if (product.status !== 'active') throw new ValidationError('Selected product is not active');
      if (product.license_enabled === false) throw new ValidationError('License generation is disabled for this product');

      const baseMonthlyPrice = Number(product.price || 0);
      const planPrice = getResellerPlanPrice(baseMonthlyPrice, planDuration);
      if (planPrice <= 0) throw new ValidationError('Invalid plan price for this product');

      const currentBalance = Number(wallet.balance || 0);
      if (currentBalance < planPrice) {
        throw new ValidationError(`Insufficient balance. Need $${planPrice.toFixed(2)}, have $${currentBalance.toFixed(2)}`);
      }

      const sellPrice = payload.sellPrice !== undefined && payload.sellPrice !== null
        ? Number(Number(payload.sellPrice).toFixed(2))
        : null;
      if (sellPrice !== null && (!Number.isFinite(sellPrice) || sellPrice < 0)) {
        throw new ValidationError('Sell price must be zero or greater');
      }
      if (sellPrice !== null && sellPrice < planPrice) {
        throw new ValidationError('Sell price cannot be below reseller minimum price');
      }
      const profitAmount = sellPrice !== null ? Number((sellPrice - planPrice).toFixed(2)) : null;

      const walletVersion = Number((wallet as any).version || 0);
      const walletSpent = Number((wallet as any).total_spent || 0);
      const effectiveExpiresAt = getExpiryForPlan(planDuration);

      const keyBundle = await generateSecureOfflineLicenseKey({
        productId,
        resellerId: reseller.id,
        assignedTo: reseller.id,
        planDuration,
        expiresAt: effectiveExpiresAt,
        deviceLimit: 1,
      });
      const uniqueKey = await ensureUniqueKey(keyBundle.key);
      const idempotencyKey = normalizeRequestId(payload.idempotencyKey);

      const debitResult = await generateResellerLicenseKeyAtomic({
        requestId: idempotencyKey,
        userId,
        resellerId: reseller.id,
        walletId: wallet.id,
        productId,
        planDuration,
        amount: planPrice,
        licenseKey: uniqueKey,
        keySignature: keyBundle.signature,
        keyType: getKeyTypeForPlan(planDuration),
        expiresAt: effectiveExpiresAt,
        deviceLimit: 1,
        clientId: payload.clientId || null,
        sellPrice,
        deliveryStatus: payload.deliveryMethod ? 'sent' : 'pending',
        notes: `Reseller generated key (${planDuration}) for ${product.name}`,
        meta: {
          reseller_id: reseller.id,
          product_id: productId,
          plan_duration: planDuration,
          base_monthly_price: baseMonthlyPrice,
          charged_price: planPrice,
          offline_payload: keyBundle.payload,
          generated_mode: 'reseller_wallet_plan',
          idempotency_key: idempotencyKey,
        },
      });

      const nextBalance = Number(debitResult.balanceAfter || 0);
      const updatedWallet = {
        ...wallet,
        balance: nextBalance,
        total_spent: Number(debitResult.totalSpent || walletSpent + planPrice),
        version: Number(debitResult.walletVersion || walletVersion + 1),
      };
      const transaction = {
        id: debitResult.transactionId,
        wallet_id: wallet.id,
        reseller_id: reseller.id,
        product_id: productId,
        amount: planPrice,
        balance_after: nextBalance,
        type: 'debit',
        status: 'completed',
      };

      try {
        const { data: createdKey, error: keyError } = await (supabase as any)
          .from('license_keys')
          .select('*')
          .eq('id', debitResult.licenseKeyId)
          .single();

        if (keyError || !createdKey) throw keyError || new ValidationError('Key generation failed');

        if (sellPrice !== null) {
          const earnedNow = Number((Number((updatedWallet as any).total_earned || 0) + sellPrice).toFixed(2));
          const walletAfterSale = await updateWalletAtomic(wallet.id, Number(updatedWallet.version || 0), {
            total_earned: earnedNow,
          });

          const { error: saleTxError } = await (supabase as any)
            .from('transactions')
            .insert({
              wallet_id: wallet.id,
              reseller_id: reseller.id,
              product_id: productId,
              amount: sellPrice,
              balance_after: Number(walletAfterSale.balance || nextBalance),
              type: 'adjustment',
              status: 'completed',
              reference_type: 'reseller_client_sale',
              description: `Client sale recorded for ${product.name}`,
              created_by: userId,
              meta: {
                license_key_id: createdKey.id,
                client_id: payload.clientId || null,
                sell_price: sellPrice,
                cost_price: planPrice,
                profit_amount: profitAmount,
              },
            });
          if (saleTxError) {
            console.warn('Sale transaction log failed', saleTxError);
          }
        }

        if (payload.deliveryMethod) {
          const { error: deliveryError } = await (supabase as any).from('license_key_deliveries').insert({
            reseller_id: reseller.id,
            client_id: payload.clientId || null,
            license_key_id: createdKey.id,
            delivery_method: payload.deliveryMethod,
            delivery_status: 'sent',
            delivered_to: payload.deliveryTarget || null,
            delivered_at: new Date().toISOString(),
            notes: payload.note || null,
            created_by: userId,
            meta: {
              sell_price: sellPrice,
              cost_price: planPrice,
            },
          });
          if (deliveryError) {
            console.warn('Delivery log failed', deliveryError);
          }
        }

        try {
          await createLog('reseller_generate_key', userId, 'license_keys', createdKey.id, {
            reseller_id: reseller.id,
            product_id: productId,
            plan_duration: planDuration,
            price: planPrice,
            transaction_id: transaction.id,
          });

          await createLog('key_generated', userId, 'license_keys', createdKey.id, {
            reseller_id: reseller.id,
            transaction_id: transaction.id,
            idempotency_key: idempotencyKey,
          });

          await createNotification('success', 'License Key Generated', `${product.name} key generated for ${planDuration}`, userId);
        } catch (auditError) {
          console.warn('Post-generation audit/log write failed', auditError);
        }

        return {
          success: true,
          licenseKey: createdKey,
          transaction,
          planPrice,
          expiresAt: effectiveExpiresAt,
          resellerId: reseller.id,
          walletBalance: Number(updatedWallet.balance || nextBalance),
        };
      } catch (error) {
        const message = String((error as any)?.message || '').toLowerCase();
        if (message.includes('insufficient')) {
          throw new ValidationError('Insufficient balance');
        }
        if (message.includes('transaction')) {
          throw new ValidationError('Transaction failed');
        }
        throw new ValidationError('Key generation failed');
      }
    }, 'Reseller generate license key');
  },

  generateResellerLicenseKeysBulk: async (payload: {
    productId: string;
    planDuration: ResellerPlanDuration;
    userId: string;
    quantity: number;
    idempotencyKey?: string;
    clientId?: string;
  }) => {
    return withErrorHandling(async () => {
      const safeQty = Math.max(1, Math.min(500, Math.floor(Number(payload.quantity || 0))));
      if (!Number.isFinite(safeQty) || safeQty <= 0) {
        throw new ValidationError('Invalid bulk quantity');
      }

      const { reseller, wallet } = await resolveResellerAndWallet(payload.userId);
      if ((wallet as any).is_locked) throw new ValidationError('Wallet is locked. Please contact support.');

      const { data: product, error: productError } = await (supabase as any)
        .from('products')
        .select('id, name, price, status, license_enabled')
        .eq('id', payload.productId)
        .single();
      if (productError || !product) throw productError || new ValidationError('Product not found');
      if (product.status !== 'active') throw new ValidationError('Selected product is not active');
      if (product.license_enabled === false) throw new ValidationError('License generation is disabled for this product');

      const baseMonthlyPrice = Number(product.price || 0);
      const planPrice = getResellerPlanPrice(baseMonthlyPrice, payload.planDuration);
      if (planPrice <= 0) throw new ValidationError('Invalid plan price for this product');

      const totalCost = Number((planPrice * safeQty).toFixed(2));
      const currentBalance = Number(wallet.balance || 0);
      if (currentBalance < totalCost) {
        throw new ValidationError('Insufficient balance');
      }

      const expiresAt = getExpiryForPlan(payload.planDuration);
      const keyType = getKeyTypeForPlan(payload.planDuration);

      const generatedKeys: string[] = [];
      const generatedSignatures: string[] = [];
      for (let i = 0; i < safeQty; i += 1) {
        const keyBundle = await generateSecureOfflineLicenseKey({
          productId: payload.productId,
          resellerId: reseller.id,
          assignedTo: reseller.id,
          planDuration: payload.planDuration,
          expiresAt,
          deviceLimit: 1,
        });
        const uniqueKey = await ensureUniqueKey(keyBundle.key);
        generatedKeys.push(uniqueKey);
        generatedSignatures.push(keyBundle.signature);
      }

      const idempotencyKey = normalizeRequestId(payload.idempotencyKey);

      const { data: bulkResult, error: bulkError } = await withRetry(async () => {
        const rpcResult = await (supabase as any).rpc('reseller_generate_license_keys_bulk_atomic', {
          p_request_id: idempotencyKey,
          p_user_id: payload.userId,
          p_reseller_id: reseller.id,
          p_wallet_id: wallet.id,
          p_product_id: payload.productId,
          p_plan_duration: payload.planDuration,
          p_amount_per_key: planPrice,
          p_key_type: keyType,
          p_expires_at: expiresAt,
          p_license_keys: generatedKeys,
          p_key_signatures: generatedSignatures,
          p_device_limit: 1,
          p_client_id: payload.clientId || null,
          p_delivery_status: payload.clientId ? 'sent' : 'pending',
          p_meta: {
            reseller_id: reseller.id,
            product_id: payload.productId,
            plan_duration: payload.planDuration,
            amount_per_key: planPrice,
            quantity: safeQty,
            idempotency_key: idempotencyKey,
            generated_mode: 'reseller_bulk_atomic',
          },
        });

        const message = String(rpcResult?.error?.message || '').toLowerCase();
        if (rpcResult?.error && (
          message.includes('timeout') ||
          message.includes('connection') ||
          message.includes('temporar') ||
          message.includes('deadlock')
        )) {
          throw new DashboardError('Transient bulk transaction failure, retrying', 'TRANSIENT_RPC_ERROR', 503, {
            originalError: rpcResult.error,
          });
        }
        return rpcResult;
      }, 3, 800);

      if (bulkError || !bulkResult) {
        const message = String((bulkError as any)?.message || '').toLowerCase();
        if (message.includes('insufficient')) throw new ValidationError('Insufficient balance');
        if (message.includes('transaction') || message.includes('daily limit')) throw new ValidationError('Transaction failed');
        throw bulkError || new ValidationError('Key generation failed');
      }

      const keyIds = ((bulkResult.results || []) as any[])
        .map((item: any) => String(item.license_key_id || ''))
        .filter((id: string) => id.length > 0);

      const { data: createdKeys, error: keysFetchError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .in('id', keyIds)
        .order('created_at', { ascending: false });
      if (keysFetchError) throw keysFetchError;

      await createLog('key_generated', payload.userId, 'license_keys', `${reseller.id}:${payload.productId}`, {
        reseller_id: reseller.id,
        product_id: payload.productId,
        quantity: safeQty,
        total_cost: totalCost,
        idempotency_key: idempotencyKey,
      });

      return {
        success: true,
        quantity: safeQty,
        totalCost,
        planPrice,
        keys: createdKeys || [],
        resellerId: reseller.id,
      };
    }, 'Reseller generate license keys bulk');
  },

  getResellerClients: async (userId: string) => {
    return withErrorHandling(async () => {
      const { reseller } = await resolveResellerAndWallet(userId);

      const [{ data: clients, error: clientsError }, { data: keyRows, error: keysError }] = await Promise.all([
        (supabase as any)
          .from('reseller_clients')
          .select('*')
          .eq('reseller_id', reseller.id)
          .order('created_at', { ascending: false }),
        (supabase as any)
          .from('license_keys')
          .select('client_id, created_at')
          .eq('reseller_id', reseller.id)
          .not('client_id', 'is', null),
      ]);

      if (clientsError) throw clientsError;
      if (keysError) throw keysError;

      const aggregate = new Map<string, { keys: number; lastPurchase: string | null }>();
      for (const row of keyRows || []) {
        const id = String((row as any).client_id || '');
        if (!id) continue;
        const prev = aggregate.get(id) || { keys: 0, lastPurchase: null };
        const currentDate = (row as any).created_at || null;
        aggregate.set(id, {
          keys: prev.keys + 1,
          lastPurchase: !prev.lastPurchase || (currentDate && currentDate > prev.lastPurchase) ? currentDate : prev.lastPurchase,
        });
      }

      return (clients || []).map((client: any) => ({
        ...client,
        keys: aggregate.get(client.id)?.keys || 0,
        lastPurchase: aggregate.get(client.id)?.lastPurchase || null,
      }));
    }, 'Get reseller clients');
  },

  createResellerClient: async (userId: string, payload: {
    fullName: string;
    email?: string;
    phone?: string;
    notes?: string;
  }) => {
    return withErrorHandling(async () => {
      const { reseller } = await resolveResellerAndWallet(userId);
      const fullName = String(payload.fullName || '').trim();
      if (!fullName) throw new ValidationError('Client name is required');

      const { data, error } = await (supabase as any)
        .from('reseller_clients')
        .insert({
          reseller_id: reseller.id,
          full_name: fullName,
          email: payload.email || null,
          phone: payload.phone || null,
          notes: payload.notes || null,
          status: 'active',
        })
        .select('*')
        .single();
      if (error || !data) throw error || new ValidationError('Failed to create client');

      await createLog('reseller_create_client', userId, 'reseller_clients', data.id, {
        reseller_id: reseller.id,
      });

      return data;
    }, 'Create reseller client');
  },

  generateResellerRenewalKey: async (payload: { expiredLicenseKey: string; planDuration: ResellerPlanDuration; userId: string }) => {
    return withErrorHandling(async () => {
      const normalizedKey = normalizeLicenseKey(payload.expiredLicenseKey);
      if (!normalizedKey) throw new ValidationError('Expired license key is required');

      const { data: reseller, error: resellerError } = await (supabase as any)
        .from('resellers')
        .select('id')
        .eq('user_id', payload.userId)
        .single();
      if (resellerError || !reseller) throw resellerError || new ValidationError('Reseller account not found');

      const { data: oldKey, error: oldKeyError } = await (supabase as any)
        .from('license_keys')
        .select('id, reseller_id, product_id, expires_at, key_status, status, license_key')
        .eq('license_key', normalizedKey)
        .single();
      if (oldKeyError || !oldKey) throw oldKeyError || new ValidationError('Original license key not found');

      if (String(oldKey.reseller_id || '') !== String(reseller.id)) {
        throw new PermissionError('You can renew only keys sold by your reseller account');
      }

      const expiredByStatus = oldKey.key_status === 'expired' || oldKey.status === 'expired';
      const expiredByDate = oldKey.expires_at ? new Date(oldKey.expires_at).getTime() <= Date.now() : false;
      if (!expiredByStatus && !expiredByDate) {
        throw new ValidationError('This key is not expired yet. Renewal is allowed only after expiry.');
      }

      const renewalResult = await (dashboardApi as any).generateResellerLicenseKey({
        userId: payload.userId,
        productId: oldKey.product_id,
        planDuration: payload.planDuration,
      });

      await createLog('reseller_generate_renewal_key', payload.userId, 'license_keys', renewalResult.licenseKey.id, {
        previous_license_key: maskLicenseKey(normalizedKey),
        previous_license_id: oldKey.id,
        product_id: oldKey.product_id,
        plan_duration: payload.planDuration,
      });

      return {
        ...renewalResult,
        renewedFromLicenseId: oldKey.id,
      };
    }, 'Reseller generate renewal key');
  },

  setResellerMargin: async (resellerId: string, marginPercent: number, adminUserId?: string) => {
    return withErrorHandling(async () => {
      if (Number.isNaN(Number(marginPercent)) || marginPercent < 0 || marginPercent > 100) {
        throw new ValidationError('Margin percent must be between 0 and 100');
      }

      const { data, error } = await (supabase as any)
        .from('resellers')
        .update({ margin_percent: Number(marginPercent) })
        .eq('id', resellerId)
        .select('*')
        .single();
      if (error) throw error;

      await createLog('set_reseller_margin', adminUserId || null, 'resellers', resellerId, { marginPercent });
      return data;
    }, 'Set reseller margin');
  },

  setResellerProductPricing: async (resellerId: string, productId: string, payload: { marginPercent?: number; fixedPrice?: number }, adminUserId?: string) => {
    return withErrorHandling(async () => {
      const hasMargin = payload.marginPercent !== undefined && payload.marginPercent !== null;
      const hasFixed = payload.fixedPrice !== undefined && payload.fixedPrice !== null;
      if (!hasMargin && !hasFixed) {
        throw new ValidationError('Either marginPercent or fixedPrice is required');
      }
      if (hasMargin && (Number(payload.marginPercent) < 0 || Number(payload.marginPercent) > 100)) {
        throw new ValidationError('marginPercent must be between 0 and 100');
      }
      if (hasFixed && Number(payload.fixedPrice) < 0) {
        throw new ValidationError('fixedPrice cannot be negative');
      }

      const { data, error } = await (supabase as any)
        .from('reseller_product_pricing')
        .upsert({
          reseller_id: resellerId,
          product_id: productId,
          margin_percent: hasMargin ? Number(payload.marginPercent) : null,
          fixed_price: hasFixed ? Number(payload.fixedPrice) : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'reseller_id,product_id' })
        .select('*')
        .single();
      if (error) throw error;

      await createLog('set_reseller_product_pricing', adminUserId || null, 'reseller_product_pricing', `${resellerId}:${productId}`, payload as Record<string, unknown>);
      return data;
    }, 'Set reseller product pricing');
  },

  getResellerProductPrice: async (resellerId: string, productId: string) => {
    return withErrorHandling(async () => {
      const [{ data: reseller, error: resellerError }, { data: product, error: productError }] = await Promise.all([
        (supabase as any).from('resellers').select('id, margin_percent').eq('id', resellerId).single(),
        supabase.from('products').select('id, price').eq('id', productId).single(),
      ]);
      if (resellerError) throw resellerError;
      if (productError) throw productError;

      const { data: override, error: overrideError } = await (supabase as any)
        .from('reseller_product_pricing')
        .select('margin_percent, fixed_price')
        .eq('reseller_id', resellerId)
        .eq('product_id', productId)
        .maybeSingle();
      if (overrideError && !String(overrideError.message || '').toLowerCase().includes('does not exist')) {
        throw overrideError;
      }

      const basePrice = Number(product.price || 0);
      const defaultMargin = Number(reseller.margin_percent || 0);
      let marginPercent = defaultMargin;
      let finalPrice = computeResellerPrice(basePrice, marginPercent);

      if (override) {
        if (override.fixed_price !== null && override.fixed_price !== undefined) {
          finalPrice = Number(override.fixed_price);
        } else if (override.margin_percent !== null && override.margin_percent !== undefined) {
          marginPercent = Number(override.margin_percent);
          finalPrice = computeResellerPrice(basePrice, marginPercent);
        }
      }

      return {
        resellerId,
        productId,
        basePrice,
        marginPercent,
        finalPrice: Math.max(0, Number(finalPrice.toFixed(2))),
      };
    }, 'Get reseller product price');
  },

  generateResellerKeyPool: async (resellerId: string, productId: string, count: number, createdBy?: string) => {
    return withErrorHandling(async () => {
      const safeCount = Math.max(1, Math.min(500, Math.floor(Number(count || 0))));
      const rows: any[] = [];
      for (let i = 0; i < safeCount; i += 1) {
        const license = await ensureUniqueKey(generateUniqueKey());
        const signature = await generateKeySignature(license);
        rows.push({
          id: randomId('key'),
          product_id: productId,
          license_key: license,
          key_signature: signature,
          key_type: 'monthly',
          key_status: 'pool',
            status: 'suspended',
          reseller_id: resellerId,
          assigned_to: null,
          max_devices: 1,
          activated_devices: 0,
          activated_at: null,
          created_by: createdBy || null,
          meta: { pool: true, generated_at: new Date().toISOString() },
        });
      }

      const { data, error } = await (supabase as any)
        .from('license_keys')
        .insert(rows)
        .select('id, license_key, product_id, reseller_id, key_status');
      if (error) throw error;

      await createLog('generate_reseller_key_pool', createdBy || null, 'license_keys', `${resellerId}:${productId}`, { count: safeCount });
      return { success: true, count: safeCount, keys: data || [] };
    }, 'Generate reseller key pool');
  },

  getResellerKeyPool: async (resellerId: string, productId?: string) => {
    return withErrorHandling(async () => {
      let query = (supabase as any)
        .from('license_keys')
        .select('id, product_id, license_key, key_status, status, created_at')
        .eq('reseller_id', resellerId)
        .eq('key_status', 'pool')
        .order('created_at', { ascending: true });
      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }, 'Get reseller key pool');
  },

  getResellerReport: async (resellerId?: string) => {
    return withErrorHandling(async () => {
      let txQuery = (supabase as any)
        .from('transactions')
        .select('id, reseller_id, product_id, amount, type, status, created_at')
        .in('type', ['debit', 'credit'])
        .order('created_at', { ascending: false });

      if (resellerId) {
        txQuery = txQuery.eq('reseller_id', resellerId);
      }

      const [{ data: txRows, error: txError }, { data: resellerRows, error: resellerError }, { data: productRows, error: productError }] = await Promise.all([
        txQuery,
        supabase.from('resellers').select('id, company_name, user_id'),
        supabase.from('products').select('id, name'),
      ]);

      if (txError) throw txError;
      if (resellerError) throw resellerError;
      if (productError) throw productError;

      const resellerMap = new Map((resellerRows || []).map((r: any) => [r.id, r]));
      const productMap = new Map((productRows || []).map((p: any) => [p.id, p]));

      const byReseller = new Map<string, any>();
      const byProduct = new Map<string, any>();
      let totalSales = 0;

      for (const tx of txRows || []) {
        const rid = tx.reseller_id || 'unknown';
        const pid = tx.product_id || 'unknown';
        const amount = Number(tx.amount || 0);
        const isSale = tx.type === 'debit' && (tx.status === 'success' || tx.status === 'completed');
        if (isSale) totalSales += amount;

        const resellerAgg = byReseller.get(rid) || {
          resellerId: rid,
          resellerName: (resellerMap.get(rid) as any)?.company_name || 'Unknown',
          totalPurchases: 0,
          purchaseCount: 0,
          creditAdded: 0,
        };
        if (tx.type === 'debit') {
          resellerAgg.totalPurchases += amount;
          resellerAgg.purchaseCount += 1;
        }
        if (tx.type === 'credit') {
          resellerAgg.creditAdded += amount;
        }
        byReseller.set(rid, resellerAgg);

        if (tx.type === 'debit') {
          const productAgg = byProduct.get(pid) || {
            productId: pid,
            productName: (productMap.get(pid) as any)?.name || 'Unknown',
            salesAmount: 0,
            salesCount: 0,
          };
          productAgg.salesAmount += amount;
          productAgg.salesCount += 1;
          byProduct.set(pid, productAgg);
        }
      }

      return {
        totalSales: Number(totalSales.toFixed(2)),
        resellerWise: Array.from(byReseller.values()).sort((a, b) => b.totalPurchases - a.totalPurchases),
        productWise: Array.from(byProduct.values()).sort((a, b) => b.salesAmount - a.salesAmount),
        transactions: txRows || [],
      };
    }, 'Get reseller report');
  },

  exportCurrentResellerSummary: async (): Promise<ResellerExportSummary> => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');

      await security.validateSession(user.id);
      const roles = await security.getUserRoles(user.id);
      const isReseller = roles.includes('reseller') || roles.includes('master_reseller');

      if (!isReseller) {
        throw new PermissionError('Unauthorized export: reseller access required');
      }

      const { data: reseller, error: resellerError } = await (supabase as any)
        .from('resellers')
        .select('id, company_name, total_sales, total_commission, user_id')
        .eq('user_id', user.id)
        .single();

      if (resellerError || !reseller) {
        throw resellerError || new PermissionError('Unauthorized export: reseller profile not found');
      }

      const { count: keyCount, error: keyError } = await (supabase as any)
        .from('license_keys')
        .select('id', { count: 'exact', head: true })
        .eq('reseller_id', reseller.id);

      if (keyError) throw keyError;

      const { data: wallet, error: walletError } = await (supabase as any)
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) throw walletError;

      let orderCount = 0;
      if (wallet?.id) {
        const { count: orders, error: orderError } = await (supabase as any)
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('wallet_id', wallet.id)
          .eq('type', 'debit')
          .in('status', ['success', 'completed']);

        if (orderError) throw orderError;
        orderCount = Number(orders || 0);
      }

      return {
        name: String(reseller.company_name || 'Unknown'),
        sales: Number(reseller.total_sales || 0),
        keys: Number(keyCount || 0),
        earnings: Number(reseller.total_commission || 0),
        orders: orderCount,
      };
    }, 'Export current reseller summary');
  },

  // ═══════════════════════════════════════════════════════════════
  // MARKETPLACE PRODUCT CONTROL SYSTEM (Admin Only)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Toggle demo enabled status for a product (Admin only)
   */
  toggleDemoEnabled: async (productId: string, enabled: boolean) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      // Get product to validate it exists and has demoUrl
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, demo_url')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      if (!product) throw new ValidationError('Product not found');

      // Prevent enabling demo without URL
      if (enabled && !product.demo_url) {
        throw new ValidationError('Cannot enable demo without demo URL');
      }

      // Update product
      const { error } = await (supabase as any)
        .from('products')
        .update({ demo_enabled: enabled })
        .eq('id', productId);

      if (error) throw error;

      await createLog('control_demo', user.id, 'products', productId);
      return { success: true, productId, enabled };
    }, 'Toggle demo enabled');
  },

  /**
   * Toggle buy enabled status for a product (Admin only)
   */
  toggleBuyEnabled: async (productId: string, enabled: boolean) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      const { error } = await (supabase as any)
        .from('products')
        .update({ buy_enabled: enabled })
        .eq('id', productId);

      if (error) throw error;

      await createLog('control_buy', user.id, 'products', productId);
      return { success: true, productId, enabled };
    }, 'Toggle buy enabled');
  },

  /**
   * Toggle apk/download enabled status for a product (Admin only)
   */
  toggleDownloadEnabled: async (productId: string, enabled: boolean) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      // Get product to validate
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, apk_url')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      if (!product) throw new ValidationError('Product not found');

      // Prevent enabling download without URL
      if (enabled && !product.apk_url) {
        throw new ValidationError('Cannot enable download without APK URL');
      }

      const { error } = await (supabase as any)
        .from('products')
        .update({ apk_enabled: enabled, download_enabled: enabled })
        .eq('id', productId);

      if (error) throw error;

      await createLog('control_download', user.id, 'products', productId);
      return { success: true, productId, enabled };
    }, 'Toggle download enabled');
  },

  /**
   * Get product control status (Admin only)
   */
  getProductControls: async (productId: string) => {
    return withErrorHandling(async () => {
      const { data: product, error } = await (supabase as any)
        .from('products')
        .select('id, name, price, demo_enabled, demo_url, buy_enabled, apk_enabled, download_enabled, apk_url, is_visible, status')
        .eq('id', productId)
        .single();

      if (error) throw error;
      if (!product) throw new ValidationError('Product not found');

      return {
        id: product.id,
        name: product.name,
        price: product.price,
        status: product.status,
        demo: {
          enabled: product.demo_enabled,
          url: product.demo_url,
          canEnable: !!product.demo_url,
        },
        buy: {
          enabled: product.buy_enabled,
          canEnable: true,
        },
        download: {
          enabled: product.apk_enabled || product.download_enabled,
          url: product.apk_url,
          canEnable: !!product.apk_url,
        },
        visible: product.is_visible,
      };
    }, 'Get product controls');
  },

  /**
   * Batch update product visibility (Admin only)
   */
  updateProductVisibility: async (productIds: string[], visible: boolean) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      const { error } = await (supabase as any)
        .from('products')
        .update({ is_visible: visible })
        .in('id', productIds);

      if (error) throw error;

      await createLog('control_visibility', user.id, 'products', productIds.join(','));
      return { success: true, count: productIds.length, visible };
    }, 'Update product visibility');
  },

  /**
   * Enable all controls for a product (Admin only) - Make product fully interactive
   */
  enableFullProductControls: async (productId: string) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      const { data: product, error: productError } = await supabase
        .from('products')
        .select('demo_url, apk_url')
        .eq('id', productId)
        .single();

      if (productError) throw productError;

      // Only enable controls for which URLs exist
      const updates: any = {
        buy_enabled: true,
        is_visible: true,
      };

      if (product.demo_url) updates.demo_enabled = true;
      if (product.apk_url) {
        updates.apk_enabled = true;
        updates.download_enabled = true;
      }

      const { error } = await (supabase as any)
        .from('products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;

      await createLog('enable_full_controls', user.id, 'products', productId);
      return { success: true, productId, controls: updates };
    }, 'Enable full product controls');
  },

  /**
   * Disable all controls for a product (Admin only) - Prevent interaction
   */
  disableAllProductControls: async (productId: string) => {
    return withErrorHandling(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new PermissionError('Not authenticated');
      await requireSuperAdmin(user.id);

      const { error } = await (supabase as any)
        .from('products')
        .update({
          demo_enabled: false,
          buy_enabled: false,
          apk_enabled: false,
          download_enabled: false,
        })
        .eq('id', productId);

      if (error) throw error;

      await createLog('disable_all_controls', user.id, 'products', productId);
      return { success: true, productId };
    }, 'Disable all product controls');
  },

  getTransactions: async (resellerId?: string) => {
    let query = (supabase as any)
      .from('transactions')
      .select(`
        *,
        resellers (company_name),
        products (name)
      `)
      .order('created_at', { ascending: false });

    if (resellerId) {
      query = query.eq('reseller_id', resellerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  blacklistLicenseKey: async (licenseKeyId: string, reason: string, adminUserId: string) => {
    return withErrorHandling(async () => {
      await requireSuperAdmin(adminUserId);

      const { data: existingKey, error: keyError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .eq('id', licenseKeyId)
        .single();
      if (keyError || !existingKey) throw keyError || new ValidationError('License key not found');

      const updatedMeta = {
        ...((existingKey as any).meta || {}),
        blacklisted: true,
        blacklisted_at: new Date().toISOString(),
        blacklisted_by: adminUserId,
        blacklist_reason: reason,
      };

      const { data: updatedKey, error: updateError } = await (supabase as any)
        .from('license_keys')
        .update({
          key_status: 'blocked',
          status: 'suspended',
          meta: updatedMeta,
          notes: reason ? `BLACKLISTED: ${reason}` : 'BLACKLISTED',
        })
        .eq('id', licenseKeyId)
        .select('*')
        .single();
      if (updateError) throw updateError;

      await createAdminAuditLog(adminUserId, 'license_keys', licenseKeyId, 'license_blacklisted', {
        reason,
        license_key: maskLicenseKey((existingKey as any).license_key || ''),
      });

      await logLicenseVerificationAttempt((existingKey as any).license_key || '', 'blocked', reason, adminUserId);

      return { success: true, key: updatedKey };
    }, 'Blacklist license key');
  },

  unblacklistLicenseKey: async (licenseKeyId: string, adminUserId: string, note?: string) => {
    return withErrorHandling(async () => {
      await requireSuperAdmin(adminUserId);

      const { data: existingKey, error: keyError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .eq('id', licenseKeyId)
        .single();
      if (keyError || !existingKey) throw keyError || new ValidationError('License key not found');

      const updatedMeta = {
        ...((existingKey as any).meta || {}),
        blacklisted: false,
        unblacklisted_at: new Date().toISOString(),
        unblacklisted_by: adminUserId,
        unblacklist_note: note || null,
      };

      const { data: updatedKey, error: updateError } = await (supabase as any)
        .from('license_keys')
        .update({
          key_status: 'unused',
          status: 'active',
          meta: updatedMeta,
          notes: note ? `UNBLACKLISTED: ${note}` : 'UNBLACKLISTED',
        })
        .eq('id', licenseKeyId)
        .select('*')
        .single();
      if (updateError) throw updateError;

      await createAdminAuditLog(adminUserId, 'license_keys', licenseKeyId, 'license_unblacklisted', {
        note: note || null,
        license_key: maskLicenseKey((existingKey as any).license_key || ''),
      });

      return { success: true, key: updatedKey };
    }, 'Unblacklist license key');
  },

  createManualPaymentRequest: async (payload: {
    productId: string;
    amount: number;
    buyerUserId: string;
    resellerId?: string | null;
  }) => {
    return withErrorHandling(async () => {
      const { data: tx, error } = await (supabase as any)
        .from('transactions')
        .insert({
          product_id: payload.productId,
          reseller_id: payload.resellerId || null,
          amount: Number(payload.amount || 0),
          type: 'purchase',
          status: 'pending',
          meta: {
            payment_mode: 'manual',
            buyer_user_id: payload.buyerUserId,
            requires_admin_approval: true,
          },
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;

      await createLog('create', payload.buyerUserId, 'transactions', tx.id, {
        security_event: 'manual_payment_pending',
        product_id: payload.productId,
      });

      return tx;
    }, 'Create manual payment request');
  },

  approveManualPaymentAndGenerateKey: async (transactionId: string, adminUserId: string) => {
    return withErrorHandling(async () => {
      await requireSuperAdmin(adminUserId);

      const { data: tx, error: txError } = await (supabase as any)
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();
      if (txError || !tx) throw txError || new ValidationError('Transaction not found');
      if (tx.status !== 'pending') {
        throw new ValidationError('Only pending transactions can be approved');
      }

      const productId = tx.product_id || tx.meta?.product_id;
      if (!productId) throw new ValidationError('Transaction missing product reference');

      const buyerUserId = tx.meta?.buyer_user_id || tx.created_by || tx.user_id || null;
      const resellerId = tx.reseller_id || tx.meta?.reseller_id || null;

      if (resellerId) {
        const { data: existingAssignedKey, error: existingAssignedKeyError } = await (supabase as any)
          .from('license_keys')
          .select('id')
          .eq('product_id', productId)
          .eq('reseller_id', resellerId)
          .in('key_status', ['unused', 'active'])
          .limit(1);
        if (existingAssignedKeyError) throw existingAssignedKeyError;
        if (existingAssignedKey && existingAssignedKey.length > 0) {
          throw new ValidationError('Reseller already has an assigned active key for this product');
        }
      }

      const keyBundle = await generateSecureOfflineLicenseKey({
        productId,
        resellerId,
        assignedTo: resellerId,
      });

      const uniqueKey = await ensureUniqueKey(keyBundle.key);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { data: createdKey, error: keyError } = await (supabase as any)
        .from('license_keys')
        .insert({
          id: randomId('key'),
          product_id: productId,
          reseller_id: resellerId,
          assigned_to: resellerId,
          license_key: uniqueKey,
          key_signature: keyBundle.signature,
          key_status: 'unused',
          status: 'active',
          max_devices: 1,
          activated_devices: 0,
          expires_at: expiresAt.toISOString(),
          created_by: adminUserId,
          purchase_transaction_id: tx.id,
          notes: 'Generated after manual payment approval',
          meta: {
            offline_payload: keyBundle.payload,
            approved_from_transaction: tx.id,
            approved_by: adminUserId,
          },
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (keyError || !createdKey) throw keyError || new ValidationError('Failed to generate license key');

      const { error: updateTxError } = await (supabase as any)
        .from('transactions')
        .update({
          status: 'completed',
          meta: {
            ...(tx.meta || {}),
            approved_by: adminUserId,
            approved_at: new Date().toISOString(),
            license_key_id: createdKey.id,
          },
        })
        .eq('id', tx.id);
      if (updateTxError) throw updateTxError;

      await createAdminAuditLog(adminUserId, 'transactions', tx.id, 'manual_payment_approved', {
        generated_key_id: createdKey.id,
        buyer_user_id: buyerUserId,
      });
      await createLog('create', adminUserId, 'license_keys', createdKey.id, {
        security_event: 'key_generated_after_manual_approval',
        transaction_id: tx.id,
      });

      return { success: true, transactionId: tx.id, licenseKey: createdKey };
    }, 'Approve manual payment and generate key');
  },

  expireLicenseKey: async (licenseKeyId: string, adminUserId: string, reason?: string) => {
    return withErrorHandling(async () => {
      await requireSuperAdmin(adminUserId);

      const { data: existingKey, error: keyError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .eq('id', licenseKeyId)
        .single();
      if (keyError || !existingKey) throw keyError || new ValidationError('License key not found');

      const { data: updatedKey, error: updateError } = await (supabase as any)
        .from('license_keys')
        .update({
          key_status: 'expired',
          status: 'expired',
          expires_at: new Date().toISOString(),
          meta: {
            ...((existingKey as any).meta || {}),
            expired_by: adminUserId,
            expired_at: new Date().toISOString(),
            expire_reason: reason || null,
          },
        })
        .eq('id', licenseKeyId)
        .select('*')
        .single();
      if (updateError) throw updateError;

      await createAdminAuditLog(adminUserId, 'license_keys', licenseKeyId, 'license_expired', {
        reason: reason || null,
        license_key: maskLicenseKey((existingKey as any).license_key || ''),
      });

      return { success: true, key: updatedKey };
    }, 'Expire license key');
  },

  // Activate license key
  activateLicenseKey: async (
    licenseKey: string,
    deviceId: string,
    userId: string,
    context?: {
      apkVersionCode?: number;
      appVersion?: string;
      ipAddress?: string;
      deviceFingerprint?: string;
    }
  ) => {
    return withErrorHandling(async () => {
      const normalizedLicenseKey = normalizeLicenseKey(licenseKey);
      const normalizedDeviceId = String(deviceId || '').trim();
      if (!normalizedLicenseKey) throw new ValidationError('License key is required');
      if (!normalizedDeviceId) throw new ValidationError('Device id is required');

      const activateLimiterKey = `activate:${userId}:${normalizedDeviceId}`;
      if (!rateLimiter.checkLimit(activateLimiterKey, ACTIVATE_RATE_LIMIT_MAX_ATTEMPTS, ACTIVATE_RATE_LIMIT_WINDOW_MS)) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'rate_limited', 'activation_rate_limit', userId, normalizedDeviceId);
        await createLog('update', userId, 'license_keys', normalizedLicenseKey, {
          security_event: 'activation_rate_limited',
          device_id: normalizedDeviceId,
          max_attempts: ACTIVATE_RATE_LIMIT_MAX_ATTEMPTS,
          window_ms: ACTIVATE_RATE_LIMIT_WINDOW_MS,
        });
        throw new ValidationError('Too many activation attempts. Please wait before trying again.');
      }

      const bruteForceSince = new Date(Date.now() - BRUTE_FORCE_WINDOW_MS).toISOString();
      const { count: recentFailedAttempts, error: bruteForceError } = await (supabase as any)
        .from('license_verification_logs')
        .select('id', { count: 'exact', head: true })
        .eq('device_id', normalizedDeviceId)
        .eq('user_id', userId)
        .in('result', ['invalid', 'not_found', 'blocked', 'revoked', 'rate_limited'])
        .gte('created_at', bruteForceSince);
      if (bruteForceError) throw bruteForceError;
      if ((recentFailedAttempts || 0) >= BRUTE_FORCE_FAIL_LIMIT) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'blocked', 'activation_bruteforce_lock', userId, normalizedDeviceId);
        await createLog('update', userId, 'license_keys', normalizedLicenseKey, {
          security_event: 'activation_bruteforce_blocked',
          device_id: normalizedDeviceId,
          failed_attempts: recentFailedAttempts || 0,
          window_ms: BRUTE_FORCE_WINDOW_MS,
        });
        throw new ValidationError('Activation temporarily locked due to too many failed attempts.');
      }

      const { data: key, error: fetchError } = await (supabase as any)
        .from('license_keys')
        .select('*')
        .eq('license_key', normalizedLicenseKey)
        .single();

      if (fetchError || !key) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'not_found', 'license_not_found', userId, normalizedDeviceId);
        throw new ValidationError('License key not found');
      }

      await enforceRevocationSync(normalizedLicenseKey, userId, normalizedDeviceId);
      await enforceLicenseCompatibility(
        String((key as any).product_id || ''),
        context?.apkVersionCode,
        context?.appVersion
      );

      if (normalizedLicenseKey.startsWith('V1.')) {
        const offlineVerified = await verifySecureOfflineLicenseKey(normalizedLicenseKey);
        if (!offlineVerified) {
          await logLicenseVerificationAttempt(normalizedLicenseKey, 'invalid', 'offline_signature_invalid', userId, normalizedDeviceId);
          await (supabase as any)
            .from('license_keys')
            .update({ key_status: 'blocked', status: 'suspended' })
            .eq('id', key.id);
          throw new ValidationError('Invalid license key signature');
        }
      } else if ((key as any).key_signature) {
        const signatureValid = await verifyKeySignature(normalizedLicenseKey, (key as any).key_signature);
        if (!signatureValid) {
          await logLicenseVerificationAttempt(normalizedLicenseKey, 'invalid', 'db_signature_mismatch', userId, normalizedDeviceId);
          await (supabase as any)
            .from('license_keys')
            .update({ key_status: 'blocked', status: 'suspended' })
            .eq('id', key.id);
          throw new ValidationError('License key signature mismatch');
        }
      }

      if (isLicenseBlacklisted(key)) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'blocked', 'license_blacklisted', userId, normalizedDeviceId);
        await createLog('update', userId, 'license_keys', key.id, {
          security_event: 'activation_blacklisted_key',
          license_key: maskLicenseKey(normalizedLicenseKey),
        });
        throw new ValidationError('License key is blacklisted');
      }
      if ((key as any).key_status === 'revoked' || key.status === 'revoked') {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'revoked', 'license_revoked', userId, normalizedDeviceId);
        throw new ValidationError('License key has been revoked');
      }
      if ((key as any).key_status === 'expired' || key.status === 'expired') {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'expired', 'license_status_expired', userId, normalizedDeviceId);
        throw new ValidationError('License expired');
      }
      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'expired', 'license_expired', userId, normalizedDeviceId);
        throw new ValidationError('License expired');
      }
      if ((key as any).user_id && (key as any).user_id !== userId) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'invalid', 'bound_to_different_user', userId, normalizedDeviceId);
        throw new ValidationError('License key is assigned to a different user');
      }
      if ((key as any).device_id && (key as any).device_id !== normalizedDeviceId) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'invalid', 'bound_to_different_device', userId, normalizedDeviceId);
        throw new ValidationError('License key is already activated on a different device');
      }
      if ((key as any).is_used === true && !(key as any).device_id && !(key as any).user_id) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'invalid', 'used_key_without_binding', userId, normalizedDeviceId);
        throw new ValidationError('License key is already used');
      }
      if (key.activated_devices >= key.max_devices) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'revoked', 'device_limit_reached', userId, normalizedDeviceId);
        throw new ValidationError('License key has reached device limit');
      }

      // Check if already activated on this device
      const { data: existingActivation } = await (supabase as any)
        .from('license_activations')
        .select('id')
        .eq('license_key_id', key.id)
        .eq('device_id', normalizedDeviceId)
        .single();

      if (existingActivation) {
        await logLicenseVerificationAttempt(normalizedLicenseKey, 'invalid', 'duplicate_device_activation', userId, normalizedDeviceId);
        throw new ValidationError('License key already activated on this device');
      }

      // Activate
      await (supabase as any).from('license_activations').insert({
        license_key_id: key.id,
        device_id: normalizedDeviceId,
        activated_at: new Date().toISOString(),
        activated_by: userId,
      });

      await (supabase as any)
        .from('license_keys')
        .update({
          key_status: 'active',
          is_used: true,
          activated_devices: Math.max(1, Number(key.activated_devices || 0) + 1),
          user_id: (key as any).user_id || userId,
          device_id: normalizedDeviceId,
          activated_at: key.activated_at || new Date().toISOString(),
          last_validated_at: new Date().toISOString(),
        })
        .eq('id', key.id);

      await logLicenseVerificationAttempt(normalizedLicenseKey, 'valid', 'activation_success', userId, normalizedDeviceId);
      await createLog('activate', userId, 'license_keys', key.id, {
        security_event: 'license_activated',
        device_id: normalizedDeviceId,
        app_version: context?.appVersion || null,
        apk_version_code: context?.apkVersionCode ?? null,
        device_fingerprint: context?.deviceFingerprint || null,
        ip_address: context?.ipAddress || null,
      });
      await createLog('key_used', userId, 'license_keys', key.id, {
        reseller_id: (key as any).reseller_id || null,
        device_id: normalizedDeviceId,
        app_version: context?.appVersion || null,
        ip_address: context?.ipAddress || null,
      });

      return { success: true, key: key.license_key };
    }, 'License key activation');
  },
};
