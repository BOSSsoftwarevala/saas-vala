import { useState, useCallback, useMemo, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Package, Key, Server, Users, FileText, TrendingUp, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { NetflixRow } from '@/components/dashboard/NetflixRow';
import { ProductCard } from '@/components/dashboard/ProductCard';
import { ServerCard } from '@/components/dashboard/ServerCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import { seoApi, systemApi } from '@/lib/api';
import { toast } from 'sonner';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin, isReseller } = useAuth();

  const {
    stats,
    products,
    servers,
    logs,
    notifications,
    loading,
    restartServer,
    markServerOffline,
    deployProductToServer,
    searchGlobal,
    getSystemMetrics,
    updateProduct,
    refreshDashboard,
  } = useDashboardStore();

  const safeProducts = Array.isArray(products) ? products : [];
  const safeServers = Array.isArray(servers) ? servers : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [aiMode, setAiMode] = useState<'fast' | 'balanced' | 'quality' | 'cheap'>('balanced');
  const [modalState, setModalState] = useState<{
    open: boolean;
    action: 'view' | 'edit' | 'deploy' | null;
    product: any;
  }>({ open: false, action: null, product: null });
  const [aiSaving, setAiSaving] = useState(false);
  const [superSummary, setSuperSummary] = useState<{
    leads_total?: number;
    ads_campaigns_total?: number;
    revenue_total?: number;
    ai_calls_total?: number;
    ai_cost_total?: number;
  } | null>(null);
  const [superResilience, setSuperResilience] = useState<{
    circuit_open?: number;
    queue_pending?: number;
    queue_running?: number;
    probe_pass_rate?: number;
  } | null>(null);
  const [superSecurity, setSuperSecurity] = useState<{
    critical_alerts?: number;
    ai_safety_blocked?: number;
    prompt_injection_blocked?: number;
    zero_trust_denies?: number;
  } | null>(null);
  const [superCompliance, setSuperCompliance] = useState<{
    consent_total?: number;
    tax_applied_events?: number;
    billing_failures_open?: number;
    subscriptions_active?: number;
  } | null>(null);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      searchGlobal(query);
    }, 300),
    [searchGlobal]
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const loadSuperadminInsights = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const [command, resilience, security, compliance, aiSettings] = await Promise.all([
        systemApi.commandCenter(),
        systemApi.resilienceDashboard(),
        systemApi.securityDashboard(),
        systemApi.complianceDashboard(),
        seoApi.aiSettings(),
      ]);

      setSuperSummary((command?.data || null) as typeof superSummary);
      setSuperResilience((resilience?.data || null) as typeof superResilience);
      setSuperSecurity((security?.data || null) as typeof superSecurity);
      setSuperCompliance((compliance?.data || null) as typeof superCompliance);

      const taskMap = (aiSettings?.data?.task_execution_map || []) as Array<{ default_mode?: string }>;
      const modeCounts = taskMap.reduce((acc: Record<string, number>, row) => {
        const key = String(row.default_mode || 'balanced');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const dominantMode = (Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced') as 'fast' | 'balanced' | 'quality' | 'cheap';
      setAiMode(dominantMode);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load superadmin insights');
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadSuperadminInsights();
  }, [loadSuperadminInsights]);

  const applyAiMode = async () => {
    if (!isSuperAdmin) return;
    setAiSaving(true);
    try {
      const current = await seoApi.aiSettings();
      const taskMap = (current?.data?.task_execution_map || []) as Array<any>;
      const patchedTaskMap = taskMap.map((row) => ({
        ...row,
        default_mode: aiMode,
      }));

      await seoApi.updateAiSettings({
        task_execution_map: patchedTaskMap,
      });

      toast.success(`AI mode updated to ${aiMode}`);
      await loadSuperadminInsights();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update AI mode');
    } finally {
      setAiSaving(false);
    }
  };

  const handleOpenModal = (action: 'view' | 'edit' | 'deploy', product: any) => {
    setModalState({ open: true, action, product });
  };

  const handleCloseModal = () => {
    setModalState({ open: false, action: null, product: null });
  };

  const handleSaveProduct = async (productData: Partial<any>) => {
    if (!modalState.product?.id) return;
    try {
      await updateProduct(modalState.product.id, productData);
      await refreshDashboard();
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product');
    }
  };

  const handleDeployProduct = async (productId: string, serverId: string) => {
    try {
      await deployProductToServer(productId, serverId);
      await refreshDashboard();
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deploy product');
    }
  };

  // Convert server status to display format
  const getServerDisplayStatus = (status: string) => {
    switch (status) {
      case 'live': return 'online' as const;
      case 'deploying': return 'deploying' as const;
      case 'stopped': case 'failed': case 'suspended': return 'offline' as const;
      default: return 'offline' as const;
    }
  };

  // Convert product status to display format
  const getProductDisplayStatus = (status: string) => {
    switch (status) {
      case 'active': return 'active' as const;
      case 'draft': return 'draft' as const;
      case 'archived': case 'suspended': return 'archived' as const;
      default: return 'draft' as const;
    }
  };

  // Map audit logs to activity feed format
  const activities = useMemo(() => {
    return safeLogs.slice(0, 10).map((log, index) => {
      const safeAction = typeof log?.action === 'string' && log.action.trim().length > 0
        ? log.action
        : 'unknown_action';
      const safeTableName = typeof log?.table_name === 'string' && log.table_name.trim().length > 0
        ? log.table_name
        : '';
      const safeTimestamp = typeof log?.timestamp === 'string' && log.timestamp.trim().length > 0
        ? log.timestamp
        : new Date().toISOString();

      let type: 'key' | 'product' | 'server' | 'payment' | 'user' | 'security' = 'user';
      let iconType: string = 'user';

      switch (safeTableName) {
        case 'license_keys':
          type = 'key';
          iconType = 'key';
          break;
        case 'products':
          type = 'product';
          iconType = 'product';
          break;
        case 'servers':
          type = 'server';
          iconType = 'server';
          break;
        case 'resellers':
        case 'transactions':
          type = 'payment';
          iconType = 'payment';
          break;
        case 'leads':
          type = 'user';
          iconType = 'user';
          break;
        default:
          if (safeAction.includes('security') || safeTableName === 'security') {
            type = 'security';
            iconType = 'security';
          }
          break;
      }

      return {
        id: log?.id || `activity-${index}`,
        type,
        message: `${safeAction.replace(/_/g, ' ')} ${safeTableName ? `on ${safeTableName}` : ''}`,
        time: new Date(safeTimestamp).toLocaleString(),
        iconType,
      };
    });
  }, [safeLogs]);

  // Memoized system metrics
  const systemMetrics = useMemo(() => getSystemMetrics(), [getSystemMetrics]);

  // Resellers should not access admin dashboard.
  if (isReseller) {
    return <Navigate to="/reseller/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Products"
            value={loading ? 0 : stats.totalProducts}
            icon={Package}
            trend={{ value: stats.activeProducts, positive: true }}
            accentColor="orange"
            index={0}
          />
          <StatsCard
            title="Active Keys"
            value={loading ? 0 : stats.activeKeys}
            icon={Key}
            trend={{ value: Math.round((stats.activeKeys / Math.max(stats.totalKeys, 1)) * 100), positive: true }}
            accentColor="cyan"
            index={1}
          />
          <StatsCard
            title="Resellers"
            value={loading ? 0 : stats.totalResellers}
            prefix=""
            icon={Users}
            trend={{ value: stats.activeResellers, positive: true }}
            accentColor="green"
            index={2}
          />
          <StatsCard
            title="Live Servers"
            value={loading ? 0 : stats.liveServers}
            icon={Server}
            trend={{ value: stats.totalServers - stats.liveServers, positive: false }}
            accentColor="purple"
            index={3}
          />
        </div>

        {/* Quick Actions */}
        <div style={{backgroundColor: 'orange', padding: '20px', margin: '20px 0', border: '3px solid red'}}>
          <h2 style={{color: 'white', fontSize: '24px'}}>🚨 QUICK ACTIONS TEST SECTION 🚨</h2>
          <p style={{color: 'white'}}>If you can see this orange section, the Dashboard is working here!</p>
          <button onClick={() => alert('Dashboard button works!')} style={{
            backgroundColor: 'blue', 
            color: 'white', 
            padding: '10px 20px', 
            border: 'none', 
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            TEST DASHBOARD BUTTON
          </button>
        </div>
        <QuickActions />
        <div style={{backgroundColor: 'purple', padding: '20px', margin: '20px 0', border: '3px solid yellow'}}>
          <h2 style={{color: 'white', fontSize: '24px'}}>🚨 AFTER QUICKACTIONS 🚨</h2>
          <p style={{color: 'white'}}>This section appears after QuickActions component</p>
        </div>

        {/* Netflix Rows */}
        <NetflixRow
          title="Recent Products"
          subtitle="Your latest products, demos, and APKs"
          onViewAll={() => navigate('/products')}
        >
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : safeProducts.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No products yet. Click "Add Product" to create one.
            </div>
          ) : (
            safeProducts.slice(0, 5).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                servers={safeServers}
                onClick={() => navigate('/products')}
              />
            ))
          )}
        </NetflixRow>

        <NetflixRow
          title="Server Status"
          subtitle="Monitor your deployed applications"
          onViewAll={() => navigate('/servers')}
        >
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : safeServers.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No servers yet. Deploy your first project.
            </div>
          ) : (
            safeServers.slice(0, 5).map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onRestart={async (serverId) => {
                  await restartServer(serverId);
                }}
                onMarkOffline={async (serverId) => {
                  await markServerOffline(serverId);
                }}
                onDeployProduct={async (serverId, productId) => {
                  await deployProductToServer(serverId, productId);
                }}
                logs={safeLogs}
                products={safeProducts}
                onClick={() => navigate('/servers')}
              />
            ))
          )}
        </NetflixRow>

        {/* Activity Feed - visible to Super Admin */}
        {isSuperAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className="glass-card rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="font-display text-lg font-bold text-foreground">Superadmin Command Center</h3>
                  <div className="flex items-center gap-2">
                    <Select value={aiMode} onValueChange={(v: 'fast' | 'balanced' | 'quality' | 'cheap') => setAiMode(v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="AI mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fast">Fast</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="quality">Quality</SelectItem>
                        <SelectItem value="cheap">Cheap</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={applyAiMode} disabled={aiSaving}>
                      {aiSaving ? 'Applying...' : 'Apply AI Mode'}
                    </Button>
                    <Button variant="outline" onClick={() => void loadSuperadminInsights()}>
                      Refresh Control
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{superSummary?.leads_total || 0}</p>
                    <p className="text-sm text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{superSummary?.ads_campaigns_total || 0}</p>
                    <p className="text-sm text-muted-foreground">Ads Campaigns</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{superSummary?.revenue_total || 0}</p>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{superSummary?.ai_calls_total || 0}</p>
                    <p className="text-sm text-muted-foreground">AI Calls</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{superSummary?.ai_cost_total || 0}</p>
                    <p className="text-sm text-muted-foreground">AI Cost</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="text-center p-3 bg-muted/20 rounded-lg"><p className="text-lg font-bold">{superResilience?.circuit_open || 0}</p><p className="text-xs text-muted-foreground">Open Circuits</p></div>
                  <div className="text-center p-3 bg-muted/20 rounded-lg"><p className="text-lg font-bold">{superResilience?.queue_pending || 0}</p><p className="text-xs text-muted-foreground">Queue Pending</p></div>
                  <div className="text-center p-3 bg-muted/20 rounded-lg"><p className="text-lg font-bold">{superSecurity?.critical_alerts || 0}</p><p className="text-xs text-muted-foreground">Critical Alerts</p></div>
                  <div className="text-center p-3 bg-muted/20 rounded-lg"><p className="text-lg font-bold">{superCompliance?.billing_failures_open || 0}</p><p className="text-xs text-muted-foreground">Billing Failures</p></div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">
                  Platform Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-foreground">{stats.totalResellers}</p>
                    <p className="text-sm text-muted-foreground">Resellers</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <FileText className="h-6 w-6 mx-auto mb-2 text-cyan" />
                    <p className="text-2xl font-bold text-foreground">{stats.totalProducts}</p>
                    <p className="text-sm text-muted-foreground">Products</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green" />
                    <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
                    <p className="text-sm text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <Key className="h-6 w-6 mx-auto mb-2 text-purple" />
                    <p className="text-2xl font-bold text-foreground">{stats.totalKeys}</p>
                    <p className="text-sm text-muted-foreground">License Keys</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <ActivityFeed activities={activities.length > 0 ? activities : [
                { id: '1', type: 'user', message: 'No recent activity', time: 'Just now' }
              ]} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
