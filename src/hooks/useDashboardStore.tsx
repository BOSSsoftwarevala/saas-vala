import { createContext, useContext, useEffect, useMemo, useReducer, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { dashboardApi, type DashboardProduct, type DashboardKey, type DashboardReseller, type DashboardServer, type DashboardNotification, type DashboardLog, type DashboardLead, type DashboardStats, type CloudDeployment, type BackupRecord, type ResellerApplication } from '@/lib/dashboardApi';

export type SearchResultType = 'product' | 'key' | 'reseller' | 'server' | 'lead';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}

interface DashboardState {
  products: DashboardProduct[];
  keys: DashboardKey[];
  resellers: DashboardReseller[];
  servers: DashboardServer[];
  leads: DashboardLead[];
  notifications: DashboardNotification[];
  logs: DashboardLog[];
  stats: DashboardStats;
  loading: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  lastRefreshedAt: string | null;
  cloudDeployments: CloudDeployment[];
  backups: BackupRecord[];
  resellerApplications: ResellerApplication[];
}

const initialState: DashboardState = {
  products: [],
  keys: [],
  resellers: [],
  servers: [],
  leads: [],
  notifications: [],
  logs: [],
  stats: {
    totalProducts: 0,
    activeProducts: 0,
    totalKeys: 0,
    activeKeys: 0,
    totalResellers: 0,
    activeResellers: 0,
    liveServers: 0,
    totalServers: 0,
    unreadNotifications: 0,
    totalLeads: 0,
    recentActivity: 0,
  },
  loading: false,
  searchQuery: '',
  searchResults: [],
  lastRefreshedAt: null,
  cloudDeployments: [],
  backups: [],
  resellerApplications: [],
};

type Action =
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_DATA'; payload: Partial<DashboardState> }
  | { type: 'SET_SERVERS'; servers: DashboardServer[] }
  | { type: 'SET_SEARCH'; query: string; results: SearchResult[] }
  | { type: 'SET_CLOUD_DEPLOYMENTS'; deployments: CloudDeployment[] }
  | { type: 'SET_BACKUPS'; backups: BackupRecord[] }
  | { type: 'SET_RESELLER_APPLICATIONS'; applications: ResellerApplication[] }
  | { type: 'RESET' };

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.value };
    case 'SET_DATA':
      return {
        ...state,
        ...action.payload,
        lastRefreshedAt: new Date().toISOString(),
      } as DashboardState;
    case 'SET_SERVERS':
      return {
        ...state,
        servers: action.servers,
        stats: {
          ...state.stats,
          liveServers: action.servers.filter((s) => s.status === 'live').length,
          totalServers: action.servers.length,
        },
        lastRefreshedAt: new Date().toISOString(),
      };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query, searchResults: action.results };
    case 'SET_CLOUD_DEPLOYMENTS':
      return { ...state, cloudDeployments: action.deployments };
    case 'SET_BACKUPS':
      return { ...state, backups: action.backups };
    case 'SET_RESELLER_APPLICATIONS':
      return { ...state, resellerApplications: action.applications };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface DashboardStoreContextType extends DashboardState {
  refreshDashboard: () => Promise<void>;
  createProduct: (product: Partial<DashboardProduct>) => Promise<DashboardProduct | null>;
  generateKey: (productId: string, assignedTo?: string | null) => Promise<DashboardKey | null>;
  deployServer: (serverId: string, region?: 'India' | 'US' | 'EU' | 'Unknown') => Promise<DashboardServer | null>;
  restartServer: (serverId: string) => Promise<DashboardServer | null>;
  markServerOffline: (serverId: string) => Promise<DashboardServer | null>;
  deployProductToServer: (serverId: string, productId: string) => Promise<boolean>;
  createLead: (lead: Partial<DashboardLead>) => Promise<DashboardLead | null>;
  updateLeadStatus: (leadId: string, status: 'new' | 'contacted' | 'converted' | 'lost') => Promise<DashboardLead | null>;
  addCredits: (resellerId: string, amount: number) => Promise<DashboardReseller | null>;
  markAllNotificationsRead: () => Promise<void>;
  searchGlobal: (query: string) => void;
  getSystemMetrics: () => { version: string; uptime: number; environment: string; lastSync: string };
  // Cloud deployment methods
  deployToCloud: (productId: string, region?: 'India' | 'US' | 'EU' | 'Unknown') => Promise<{ deploymentId: string; serverId: string; region: string; backupServerId?: string }>;
  getCloudDeployments: () => Promise<CloudDeployment[]>;
  failoverDeployment: (deploymentId: string) => Promise<{ success: boolean }>;
  // Backup methods
  createBackup: (entityType: 'product' | 'server' | 'key' | 'reseller' | 'lead', entityId: string, backupType?: 'auto' | 'manual') => Promise<{ backupId: string }>;
  getBackups: (entityType?: string, entityId?: string) => Promise<BackupRecord[]>;
  restoreBackup: (backupId: string) => Promise<{ success: boolean }>;
  scheduleAutoBackup: () => Promise<{ success: boolean }>;
  // Reseller application methods
  submitResellerApplication: (applicationData: { name: string; email: string; phone?: string; business_name: string }) => Promise<ResellerApplication>;
  getResellerApplications: (status?: 'pending' | 'approved' | 'rejected') => Promise<ResellerApplication[]>;
  approveResellerApplication: (applicationId: string) => Promise<{ success: boolean; reseller: any }>;
  rejectResellerApplication: (applicationId: string, rejectionReason: string) => Promise<{ success: boolean }>;
  getResellerData: () => Promise<{ reseller: any; keys: any[]; products: any[] }>;
  resellerPurchaseProduct: (productId: string) => Promise<{ success: boolean; licenseKey: any }>;
}

const DashboardStoreContext = createContext<DashboardStoreContextType | undefined>(undefined);
let hasWarnedMissingDashboardProvider = false;

const fallbackDashboardStore: DashboardStoreContextType = {
  ...initialState,
  refreshDashboard: async () => {},
  createProduct: async () => null,
  generateKey: async () => null,
  deployServer: async () => null,
  restartServer: async () => null,
  markServerOffline: async () => null,
  deployProductToServer: async () => false,
  createLead: async () => null,
  updateLeadStatus: async () => null,
  addCredits: async () => null,
  markAllNotificationsRead: async () => {},
  searchGlobal: () => {},
  getSystemMetrics: () => ({
    version: '1.0.0',
    uptime: 99.9,
    environment: 'production',
    lastSync: new Date().toISOString(),
  }),
  deployToCloud: async () => ({
    deploymentId: '',
    serverId: '',
    region: 'Unknown',
  }),
  getCloudDeployments: async () => [],
  failoverDeployment: async () => ({ success: false }),
  createBackup: async () => ({ backupId: '' }),
  getBackups: async () => [],
  restoreBackup: async () => ({ success: false }),
  scheduleAutoBackup: async () => ({ success: false }),
  submitResellerApplication: async () => ({} as ResellerApplication),
  getResellerApplications: async () => [],
  approveResellerApplication: async () => ({ success: false, reseller: null }),
  rejectResellerApplication: async () => ({ success: false }),
  getResellerData: async () => ({ reseller: null, keys: [], products: [] }),
  resellerPurchaseProduct: async () => ({ success: false, licenseKey: null }),
};

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshDashboard = useCallback(async () => {
    if (!user) {
      dispatch({ type: 'RESET' });
      return;
    }

    dispatch({ type: 'SET_LOADING', value: true });
    try {
      const { products, keys, resellers, servers, notifications, logs, leads, stats } = await dashboardApi.getDashboardData(user.id);
      dispatch({
        type: 'SET_DATA',
        payload: { products, keys, resellers, servers, notifications, logs, leads, stats },
      });
    } catch (error: any) {
      console.error('Dashboard refresh error', error);
      toast.error('Unable to refresh dashboard data');
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }, [user]);

  const createProduct = useCallback(async (product: Partial<DashboardProduct>) => {
    const createdBy = user?.id || null;
    try {
      const result = await dashboardApi.createProduct({ ...product, created_by: createdBy });
      await dashboardApi.createLog('create_product', createdBy, 'products', result.id, { name: result.name });
      await dashboardApi.createNotification({
        type: 'success',
        title: 'Product Created',
        message: `Product ${result.name} was created successfully.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/products',
      });
      await refreshDashboard();
      toast.success('Product created successfully');
      return result;
    } catch (error: any) {
      console.error('Create product failed', error);
      toast.error('Failed to create product');
      return null;
    }
  }, [refreshDashboard, user]);

  const generateKey = useCallback(async (productId: string, assignedTo?: string | null) => {
    const createdBy = user?.id || null;
    try {
      // Security monitoring: Check for rapid key generation
      const recentKeys = state.keys.filter(key =>
        key.created_at && new Date(key.created_at).getTime() > Date.now() - 60000 // Last minute
      ).length;

      if (recentKeys >= 5) {
        await dashboardApi.createLog('security_alert', createdBy, 'security', null, {
          alert_type: 'rapid_key_generation',
          count: recentKeys,
          message: 'Multiple license keys generated in short time period',
        });
        await dashboardApi.createNotification({
          type: 'warning',
          title: 'Security Alert',
          message: 'Rapid license key generation detected',
          status: 'unread',
          user_id: user?.id || null,
          action_url: '/security',
        });
      }

      const result = await dashboardApi.generateKey({ productId, assignedTo, createdBy, status: 'active' });
      await dashboardApi.createLog('generate_key', createdBy, 'license_keys', result.id, { productId, key: result.key });
      await dashboardApi.createNotification({
        type: 'info',
        title: 'License Key Generated',
        message: `A new license key was generated for product ${productId}.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/keys',
      });
      await refreshDashboard();
      toast.success('License key generated');
      return result;
    } catch (error: any) {
      console.error('Generate key failed', error);
      toast.error('Failed to generate key');
      return null;
    }
  }, [refreshDashboard, user, state.keys]);

  const deployServer = useCallback(async (serverId: string, region: 'India' | 'US' | 'EU' | 'Unknown' = 'US') => {
    const performedBy = user?.id || null;
    try {
      // Security monitoring: Check for rapid server deployments
      const recentDeploys = state.logs.filter(log =>
        log.action === 'deploy_server' &&
        log.timestamp && new Date(log.timestamp).getTime() > Date.now() - 300000 // Last 5 minutes
      ).length;

      if (recentDeploys >= 3) {
        await dashboardApi.createLog('security_alert', performedBy, 'security', null, {
          alert_type: 'rapid_server_deploy',
          count: recentDeploys,
          message: 'Multiple server deployments in short time period',
        });
        await dashboardApi.createNotification({
          type: 'warning',
          title: 'Security Alert',
          message: 'Rapid server deployment activity detected',
          status: 'unread',
          user_id: user?.id || null,
          action_url: '/security',
        });
      }

      const result = await dashboardApi.deployServer(serverId, region);
      await dashboardApi.createLog('deploy_server', performedBy, 'servers', serverId, { region });
      await dashboardApi.createNotification({
        type: 'success',
        title: 'Server Deployment Started',
        message: `Server ${result.name} is deploying in ${region}.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/servers',
      });
      await refreshDashboard();
      toast.success('Server deployment started');
      return result;
    } catch (error: any) {
      console.error('Server deploy failed', error);
      toast.error('Failed to deploy server');
      return null;
    }
  }, [refreshDashboard, user, state.logs]);

  const restartServer = useCallback(async (serverId: string) => {
    const performedBy = user?.id || null;
    try {
      const server = state.servers.find((s) => s.id === serverId);
      if (!server) throw new Error('Server not found');

      const result = await dashboardApi.deployServer(serverId, server.region as 'India' | 'US' | 'EU' | 'Unknown');
      await dashboardApi.createLog('restart_server', performedBy, 'servers', serverId, {});
      await dashboardApi.createNotification({
        type: 'success',
        title: 'Server Restart Initiated',
        message: `Server ${server.name} is restarting...`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/servers',
      });
      await refreshDashboard();
      toast.success('Server restart initiated');
      return result;
    } catch (error: any) {
      console.error('Server restart failed', error);
      toast.error('Failed to restart server');
      return null;
    }
  }, [refreshDashboard, user, state.servers]);

  const markServerOffline = useCallback(async (serverId: string) => {
    const performedBy = user?.id || null;
    try {
      const server = state.servers.find((s) => s.id === serverId);
      if (!server) throw new Error('Server not found');

      const result = await dashboardApi.deployServer(serverId, server.region as 'India' | 'US' | 'EU' | 'Unknown');
      await dashboardApi.createLog('mark_offline', performedBy, 'servers', serverId, { status: 'offline' });
      await dashboardApi.createNotification({
        type: 'warning',
        title: 'Server Marked Offline',
        message: `Server ${server.name} has been marked offline.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/servers',
      });
      await refreshDashboard();
      toast.success('Server marked offline');
      return result;
    } catch (error: any) {
      console.error('Mark offline failed', error);
      toast.error('Failed to mark server offline');
      return null;
    }
  }, [refreshDashboard, user, state.servers]);

  const deployProductToServer = useCallback(async (serverId: string, productId: string) => {
    const performedBy = user?.id || null;
    try {
      const server = state.servers.find((s) => s.id === serverId);
      const product = state.products.find((p) => p.id === productId);
      if (!server) throw new Error('Server not found');
      if (!product) throw new Error('Product not found');

      await dashboardApi.createLog('deploy_product', performedBy, 'servers', serverId, {
        product_id: productId,
      });
      await dashboardApi.createNotification({
        type: 'success',
        title: 'Product Deployment Started',
        message: `Product ${product.name} is being deployed to ${server.name}.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/servers',
      });
      await refreshDashboard();
      toast.success('Product deployment started');
      return true;
    } catch (error: any) {
      console.error('Deploy product to server failed', error);
      toast.error('Failed to deploy product');
      return false;
    }
  }, [refreshDashboard, user, state.servers, state.products]);

  const createLead = useCallback(async (lead: Partial<DashboardLead>) => {
    try {
      const result = await dashboardApi.createLead(lead);
      await dashboardApi.createLog('create_lead', user?.id || null, 'leads', result.id, { name: result.name, source: result.source });
      await dashboardApi.createNotification({
        type: 'info',
        title: 'New Lead Added',
        message: `${result.name} from ${result.source} has been added to leads.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/leads',
      });
      await refreshDashboard();
      toast.success('Lead created successfully');
      return result;
    } catch (error: any) {
      console.error('Create lead failed', error);
      toast.error('Failed to create lead');
      return null;
    }
  }, [refreshDashboard, user]);

  const updateLeadStatus = useCallback(async (leadId: string, status: 'new' | 'contacted' | 'converted' | 'lost') => {
    try {
      const result = await dashboardApi.updateLeadStatus(leadId, status);
      await dashboardApi.createLog('update_lead_status', user?.id || null, 'leads', leadId, { status });
      if (status === 'converted') {
        await dashboardApi.createNotification({
          type: 'success',
          title: 'Lead Converted',
          message: `${result.name} has been converted to a customer.`,
          status: 'unread',
          user_id: user?.id || null,
          action_url: '/leads',
        });
      }
      await refreshDashboard();
      toast.success(`Lead status updated to ${status}`);
      return result;
    } catch (error: any) {
      console.error('Update lead status failed', error);
      toast.error('Failed to update lead status');
      return null;
    }
  }, [refreshDashboard, user]);

  const addCredits = useCallback(async (resellerId: string, amount: number) => {
    const performedBy = user?.id || null;
    try {
      const result = await dashboardApi.addCredits(resellerId, amount);
      await dashboardApi.createLog('add_credits', performedBy, 'resellers', resellerId, { amount });
      await dashboardApi.createNotification({
        type: 'success',
        title: 'Credits Added',
        message: `Added ₹${amount.toLocaleString()} to reseller ${result.name}.`,
        status: 'unread',
        user_id: user?.id || null,
        action_url: '/resellers',
      });
      await refreshDashboard();
      toast.success('Credits added successfully');
      return result;
    } catch (error: any) {
      console.error('Add credits failed', error);
      toast.error('Failed to add credits');
      return null;
    }
  }, [refreshDashboard, user]);

  const markAllNotificationsRead = useCallback(async () => {
    if (state.notifications.length === 0) return;
    try {
      const unreadIds = state.notifications.filter((item) => item.status === 'unread').map((item) => item.id);
      if (unreadIds.length === 0) return;
      await dashboardApi.markNotificationsRead(unreadIds);
      await refreshDashboard();
    } catch (error: any) {
      console.error('Mark notifications read failed', error);
      toast.error('Unable to mark notifications read');
    }
  }, [refreshDashboard, state.notifications]);

  const searchGlobal = useCallback((query: string) => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) {
      dispatch({ type: 'SET_SEARCH', query: '', results: [] });
      return;
    }

    const productResults = state.products
      .filter((product) => product.name?.toLowerCase().includes(normalized) || product.apk?.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map<SearchResult>((product) => ({
        id: product.id,
        type: 'product',
        title: product.name,
        subtitle: `Product • ${product.status || 'active'}`,
        href: '/products',
      }));

    const keyResults = state.keys
      .filter((key) => key.key.toLowerCase().includes(normalized) || key.product_id.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map<SearchResult>((key) => ({
        id: key.id,
        type: 'key',
        title: key.key,
        subtitle: `Key • ${key.status}`,
        href: '/keys',
      }));

    const resellerResults = state.resellers
      .filter((reseller) => reseller.name.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map<SearchResult>((reseller) => ({
        id: reseller.id,
        type: 'reseller',
        title: reseller.name,
        subtitle: `Reseller • ₹${reseller.credits.toLocaleString()}`,
        href: '/resellers',
      }));

    const serverResults = state.servers
      .filter((server) => server.name.toLowerCase().includes(normalized) || server.region.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map<SearchResult>((server) => ({
        id: server.id,
        type: 'server',
        title: server.name,
        subtitle: `Server • ${server.status} • ${server.region}`,
        href: '/servers',
      }));

    const leadResults = state.leads
      .filter((lead) => lead.name.toLowerCase().includes(normalized) || lead.email?.toLowerCase().includes(normalized))
      .slice(0, 3)
      .map<SearchResult>((lead) => ({
        id: lead.id,
        type: 'lead',
        title: lead.name,
        subtitle: `Lead • ${lead.status} • ${lead.source}`,
        href: '/leads',
      }));

    dispatch({
      type: 'SET_SEARCH',
      query: normalized,
      results: [...productResults, ...keyResults, ...resellerResults, ...serverResults, ...leadResults].slice(0, 8),
    });
  }, [state.products, state.keys, state.resellers, state.servers, state.leads]);

  const getSystemMetrics = useCallback(() => {
    return dashboardApi.getSystemMetrics();
  }, []);

  // Cloud deployment methods
  const deployToCloud = useCallback(async (productId: string, region: 'India' | 'US' | 'EU' | 'Unknown' = 'US') => {
    try {
      const result = await dashboardApi.deployToCloud(productId, region, user?.id);
      await refreshDashboard();
      toast.success(`Product deployed to ${region} region`);
      return result;
    } catch (error: any) {
      console.error('Cloud deployment failed', error);
      toast.error(error.message || 'Failed to deploy to cloud');
      throw error;
    }
  }, [refreshDashboard, user]);

  const getCloudDeployments = useCallback(async () => {
    try {
      const deployments = await dashboardApi.getCloudDeployments();
      dispatch({ type: 'SET_CLOUD_DEPLOYMENTS', deployments });
      return deployments;
    } catch (error: any) {
      console.error('Failed to get cloud deployments', error);
      toast.error('Failed to load cloud deployments');
      return [];
    }
  }, []);

  const failoverDeployment = useCallback(async (deploymentId: string) => {
    try {
      const result = await dashboardApi.failoverDeployment(deploymentId, user?.id);
      await refreshDashboard();
      toast.success('Deployment failed over successfully');
      return result;
    } catch (error: any) {
      console.error('Failover failed', error);
      toast.error(error.message || 'Failed to failover deployment');
      throw error;
    }
  }, [refreshDashboard, user]);

  // Backup methods
  const createBackup = useCallback(async (entityType: 'product' | 'server' | 'key' | 'reseller' | 'lead', entityId: string, backupType: 'auto' | 'manual' = 'manual') => {
    try {
      const result = await dashboardApi.createBackup(entityType, entityId, backupType, user?.id);
      await refreshDashboard();
      toast.success(`${entityType} backup created`);
      return result;
    } catch (error: any) {
      console.error('Backup creation failed', error);
      toast.error(error.message || 'Failed to create backup');
      throw error;
    }
  }, [refreshDashboard, user]);

  const getBackups = useCallback(async (entityType?: string, entityId?: string) => {
    try {
      const backups = await dashboardApi.getBackups(entityType, entityId);
      dispatch({ type: 'SET_BACKUPS', backups });
      return backups;
    } catch (error: any) {
      console.error('Failed to get backups', error);
      toast.error('Failed to load backups');
      return [];
    }
  }, []);

  const restoreBackup = useCallback(async (backupId: string) => {
    try {
      const result = await dashboardApi.restoreBackup(backupId, user?.id);
      await refreshDashboard();
      toast.success('Backup restored successfully');
      return result;
    } catch (error: any) {
      console.error('Backup restore failed', error);
      toast.error(error.message || 'Failed to restore backup');
      throw error;
    }
  }, [refreshDashboard, user]);

  const scheduleAutoBackup = useCallback(async () => {
    try {
      const result = await dashboardApi.scheduleAutoBackup();
      toast.success('Auto backup scheduled');
      return result;
    } catch (error: any) {
      console.error('Auto backup scheduling failed', error);
      toast.error('Failed to schedule auto backup');
      throw error;
    }
  }, []);

  // Reseller application methods
  const submitResellerApplication = useCallback(async (applicationData: { name: string; email: string; phone?: string; business_name: string }) => {
    try {
      const result = await dashboardApi.submitResellerApplication(applicationData, user?.id);
      toast.success('Reseller application submitted successfully');
      return result;
    } catch (error: any) {
      console.error('Reseller application submission failed', error);
      toast.error(error.message || 'Failed to submit application');
      throw error;
    }
  }, [user]);

  const getResellerApplications = useCallback(async (status?: 'pending' | 'approved' | 'rejected') => {
    try {
      const applications = await dashboardApi.getResellerApplications(status);
      dispatch({ type: 'SET_RESELLER_APPLICATIONS', applications });
      return applications;
    } catch (error: any) {
      console.error('Failed to get reseller applications', error);
      toast.error('Failed to load applications');
      return [];
    }
  }, []);

  const approveResellerApplication = useCallback(async (applicationId: string) => {
    try {
      const result = await dashboardApi.approveResellerApplication(applicationId, user?.id || '');
      await refreshDashboard();
      toast.success('Reseller application approved');
      return result;
    } catch (error: any) {
      console.error('Application approval failed', error);
      toast.error(error.message || 'Failed to approve application');
      throw error;
    }
  }, [refreshDashboard, user]);

  const rejectResellerApplication = useCallback(async (applicationId: string, rejectionReason: string) => {
    try {
      const result = await dashboardApi.rejectResellerApplication(applicationId, rejectionReason, user?.id || '');
      await refreshDashboard();
      toast.success('Reseller application rejected');
      return result;
    } catch (error: any) {
      console.error('Application rejection failed', error);
      toast.error(error.message || 'Failed to reject application');
      throw error;
    }
  }, [refreshDashboard, user]);

  const getResellerData = useCallback(async () => {
    try {
      const result = await dashboardApi.getResellerData(user?.id || '');
      return result;
    } catch (error: any) {
      console.error('Failed to get reseller data', error);
      toast.error('Failed to load reseller data');
      throw error;
    }
  }, [user]);

  const resellerPurchaseProduct = useCallback(async (productId: string) => {
    try {
      const result = await dashboardApi.resellerPurchaseProduct(productId, user?.id || '');
      await refreshDashboard();
      toast.success('Product purchased successfully');
      return result;
    } catch (error: any) {
      console.error('Product purchase failed', error);
      toast.error(error.message || 'Failed to purchase product');
      throw error;
    }
  }, [refreshDashboard, user]);

  useEffect(() => {
    if (!user) return;
    refreshDashboard();
  }, [user, refreshDashboard]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => refreshDashboard(), 15000);
    return () => window.clearInterval(interval);
  }, [user, refreshDashboard]);

  // Server heartbeat simulation - updates status and load every 7 seconds
  useEffect(() => {
    if (!user || state.servers.length === 0) return;

    const heartbeatInterval = window.setInterval(() => {
      const randomServer = state.servers[Math.floor(Math.random() * state.servers.length)];
      if (!randomServer) return;

      // Simulate status changes (80% stay same, 10% go offline, 10% come back online)
      const rand = Math.random();
      let newStatus = randomServer.status;
      if (rand > 0.8) {
        newStatus = randomServer.status === 'live' ? 'stopped' : 'live';
      }

      // Simulate load changes (random 20-90%)
      const newLoad = Math.floor(Math.random() * 70) + 20;

      // Update server in state
      dispatch({
        type: 'SET_SERVERS',
        servers: state.servers.map((s) =>
          s.id === randomServer.id
            ? { ...s, status: newStatus, load: newLoad }
            : s
        ),
      });
    }, 7000); // 7 second heartbeat

    return () => window.clearInterval(heartbeatInterval);
  }, [user, state.servers, state.servers.length]);

  const value = useMemo(() => ({
    ...state,
    refreshDashboard,
    createProduct,
    generateKey,
    deployServer,
    restartServer,
    markServerOffline,
    deployProductToServer,
    createLead,
    updateLeadStatus,
    addCredits,
    markAllNotificationsRead,
    searchGlobal,
    getSystemMetrics,
    deployToCloud,
    getCloudDeployments,
    failoverDeployment,
    createBackup,
    getBackups,
    restoreBackup,
    scheduleAutoBackup,
    submitResellerApplication,
    getResellerApplications,
    approveResellerApplication,
    rejectResellerApplication,
    getResellerData,
    resellerPurchaseProduct,
  }), [state, refreshDashboard, createProduct, generateKey, deployServer, restartServer, markServerOffline, deployProductToServer, createLead, updateLeadStatus, addCredits, markAllNotificationsRead, searchGlobal, getSystemMetrics, deployToCloud, getCloudDeployments, failoverDeployment, createBackup, getBackups, restoreBackup, scheduleAutoBackup, submitResellerApplication, getResellerApplications, approveResellerApplication, rejectResellerApplication, getResellerData, resellerPurchaseProduct]);

  return <DashboardStoreContext.Provider value={value}>{children}</DashboardStoreContext.Provider>;
}

export function useDashboardStore() {
  const context = useContext(DashboardStoreContext);
  if (context === undefined) {
    if (!hasWarnedMissingDashboardProvider) {
      hasWarnedMissingDashboardProvider = true;
      console.error('useDashboardStore used outside DashboardProvider. Returning fallback store to avoid app crash.');
    }
    return fallbackDashboardStore;
  }
  return context;
}
