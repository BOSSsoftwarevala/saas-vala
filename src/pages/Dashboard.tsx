import { useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Package, Key, Server, Users, FileText, TrendingUp, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { NetflixRow } from '@/components/dashboard/NetflixRow';
import { ProductCard } from '@/components/dashboard/ProductCard';
import { ServerCard } from '@/components/dashboard/ServerCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStore } from '@/hooks/useDashboardStore';

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

  // Resellers should not access admin dashboard
  if (isReseller) {
    return <Navigate to="/reseller/dashboard" replace />;
  }

  const {
    stats,
    products,
    servers,
    logs,
    notifications,
    loading,
    restartServer,
    markServerOffline,
    searchGlobal,
    getSystemMetrics,
  } = useDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');

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
    return logs.slice(0, 10).map(log => {
      let type: 'key' | 'product' | 'server' | 'payment' | 'user' | 'security' = 'user';
      let iconType: string = 'user';

      switch (log.table_name) {
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
          if (log.action.includes('security') || log.table_name === 'security') {
            type = 'security';
            iconType = 'security';
          }
          break;
      }

      return {
        id: log.id,
        type,
        message: `${log.action.replace(/_/g, ' ')} ${log.table_name ? `on ${log.table_name}` : ''}`,
        time: new Date(log.timestamp).toLocaleString(),
        iconType,
      };
    });
  }, [logs]);

  // Memoized system metrics
  const systemMetrics = useMemo(() => getSystemMetrics(), [getSystemMetrics]);

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
        <QuickActions />

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
          ) : products.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No products yet. Click "Add Product" to create one.
            </div>
          ) : (
            products.slice(0, 5).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                servers={servers}
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
          ) : servers.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No servers yet. Deploy your first project.
            </div>
          ) : (
            servers.slice(0, 5).map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onRestart={restartServer}
                onMarkOffline={markServerOffline}
                onDeployProduct={deployProductToServer}
                logs={logs}
                products={products}
                onClick={() => navigate('/servers')}
              />
            ))
          )}
        </NetflixRow>

        {/* Activity Feed - visible to Super Admin */}
        {isSuperAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
