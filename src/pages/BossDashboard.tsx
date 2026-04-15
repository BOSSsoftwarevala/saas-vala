// Boss (Super Admin) Dashboard - Main Control Center
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Layout, Search, Bell, User, ChevronDown, Server, Package,
  Users, Activity, DollarSign, Plus, Upload, Rocket, CreditCard,
  MessageSquare, Cpu, Settings, LogOut, PanelLeft, TrendingUp,
  AlertTriangle, Clock, Zap, Globe, Shield, Database, CheckCircle,
  XCircle, RefreshCw, MoreVertical, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { errorHandler } from '@/services/error-handler.service';
import { notification } from '@/services/notification.service';
import { apiClient } from '@/services/api-client.service';
import { cacheControl } from '@/services/cache-control.service';
import { useAuth } from '@/hooks/useAuth';

interface DashboardStats {
  total_products: number;
  products_growth: number;
  active_keys: number;
  keys_growth: number;
  resellers: number;
  resellers_growth: number;
  live_servers: number;
  servers_growth: number;
}

interface Server {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'backup' | 'dev';
  status: 'online' | 'offline' | 'deploying';
  region: string;
  uptime: number;
  last_updated: string;
}

interface CommandCenter {
  leads: number;
  ads_campaigns: number;
  revenue: number;
  ai_calls: number;
  ai_cost: number;
  open_circuits: number;
  queue_pending: number;
  critical_alerts: number;
  billing_failures: number;
}

interface RecentProduct {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'draft';
  price: number;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
}

export default function BossDashboard() {
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [commandCenter, setCommandCenter] = useState<CommandCenter | null>(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load stats using API client with retry
      const [statsData, serversData, commandData, productsData, logsData] = await Promise.all([
        apiClient.withRetry(fetchDashboardStats, { retries: 3, showToast: false }),
        apiClient.withRetry(fetchServerStatus, { retries: 3, showToast: false }),
        apiClient.withRetry(fetchCommandCenter, { retries: 3, showToast: false }),
        apiClient.withRetry(fetchRecentProducts, { retries: 3, showToast: false }),
        apiClient.withRetry(fetchActivityLogs, { retries: 3, showToast: false }),
      ]);

      setStats(statsData);
      setServers(serversData);
      setCommandCenter(commandData);
      setRecentProducts(productsData);
      setActivityLogs(logsData);
      
      // Cache the dashboard data
      cacheControl.set('dashboard:stats', statsData);
      cacheControl.set('dashboard:servers', serversData);
    } catch (error) {
      errorHandler.handleError(error as Error, { action: 'load_dashboard' });
      notification.serverError();
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async (): Promise<DashboardStats> => {
    // In production, fetch from API
    return {
      total_products: 156,
      products_growth: 12.5,
      active_keys: 1247,
      keys_growth: 8.3,
      resellers: 89,
      resellers_growth: 15.2,
      live_servers: 12,
      servers_growth: 5.0,
    };
  };

  const fetchServerStatus = async (): Promise<Server[]> => {
    return [
      { id: '1', name: 'Production Server', environment: 'production', status: 'online', region: 'us-east-1', uptime: 99.98, last_updated: new Date().toISOString() },
      { id: '2', name: 'Staging Server', environment: 'staging', status: 'deploying', region: 'us-west-2', uptime: 98.5, last_updated: new Date().toISOString() },
      { id: '3', name: 'Backup Server', environment: 'backup', status: 'online', region: 'eu-west-1', uptime: 99.9, last_updated: new Date().toISOString() },
      { id: '4', name: 'Dev Server', environment: 'dev', status: 'offline', region: 'ap-south-1', uptime: 0, last_updated: new Date().toISOString() },
    ];
  };

  const fetchCommandCenter = async (): Promise<CommandCenter> => {
    return {
      leads: 234,
      ads_campaigns: 12,
      revenue: 45678,
      ai_calls: 12456,
      ai_cost: 234.56,
      open_circuits: 3,
      queue_pending: 45,
      critical_alerts: 2,
      billing_failures: 5,
    };
  };

  const fetchRecentProducts = async (): Promise<RecentProduct[]> => {
    return [
      { id: '1', name: 'SaaS AI Pro', status: 'active', price: 99, created_at: new Date().toISOString() },
      { id: '2', name: 'VALA Builder', status: 'active', price: 149, created_at: new Date().toISOString() },
      { id: '3', name: 'SEO Master', status: 'active', price: 79, created_at: new Date().toISOString() },
      { id: '4', name: 'Lead Generator', status: 'draft', price: 129, created_at: new Date().toISOString() },
    ];
  };

  const fetchActivityLogs = async (): Promise<ActivityLog[]> => {
    return [
      { id: '1', action: 'Product Created', user: 'Admin', timestamp: new Date().toISOString(), details: 'Created new product: SaaS AI Pro' },
      { id: '2', action: 'Key Generated', user: 'Admin', timestamp: new Date().toISOString(), details: 'Generated 10 keys for product: VALA Builder' },
      { id: '3', action: 'Server Deployed', user: 'System', timestamp: new Date().toISOString(), details: 'Deployed staging server to us-west-2' },
      { id: '4', action: 'Payment Received', user: 'System', timestamp: new Date().toISOString(), details: 'Payment of $99.00 received from user #1234' },
    ];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'offline':
      case 'inactive':
        return 'text-red-500 bg-red-500/10';
      case 'deploying':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'draft':
        return 'text-gray-500 bg-gray-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const StatCard = ({ title, value, growth, icon: Icon }: any) => (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-2">{title}</p>
          <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
          <div className={cn('flex items-center text-sm', growth >= 0 ? 'text-green-500' : 'text-red-500')}>
            <TrendingUp className="w-4 h-4 mr-1" />
            {growth >= 0 ? '+' : ''}{growth}%
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-700/50 group-hover:bg-slate-600/50 transition-colors">
          <Icon className="w-6 h-6 text-slate-300" />
        </div>
      </div>
    </div>
  );

  const CommandMetric = ({ label, value, icon: Icon, alert }: any) => (
    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{label}</span>
        {alert && <AlertTriangle className="w-4 h-4 text-red-500" />}
      </div>
      <div className="flex items-center">
        <Icon className="w-5 h-5 text-slate-300 mr-2" />
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <PanelLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SaaS VALA
            </h1>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
              Super Admin
            </span>
          </div>

          <div className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, keys, servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors relative">
              <Bell className="w-5 h-5 text-slate-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 bottom-0 z-40 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <nav className="p-4 space-y-2">
          {[
            { icon: Layout, label: 'Dashboard', active: true },
            { icon: Package, label: 'Products' },
            { icon: Users, label: 'Reseller Manager' },
            { icon: Settings, label: 'Marketplace Admin' },
            { icon: Activity, label: 'Keys' },
            { icon: Server, label: 'Servers' },
            { icon: Cpu, label: 'SaaS AI' },
            { icon: Zap, label: 'VALA Builder' },
            { icon: MessageSquare, label: 'AI Chat' },
            { icon: Globe, label: 'AI APIs' },
          ].map((item) => (
            <button
              key={item.label}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                item.active
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-slate-800">
            <button
              onClick={() => window.location.href = '/boss/settings'}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">Settings</span>}
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">Logout</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'pt-20 transition-all duration-300',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <div className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Products" value={stats?.total_products} growth={stats?.products_growth} icon={Package} />
            <StatCard title="Active Keys" value={stats?.active_keys} growth={stats?.keys_growth} icon={Activity} />
            <StatCard title="Resellers" value={stats?.resellers} growth={stats?.resellers_growth} icon={Users} />
            <StatCard title="Live Servers" value={stats?.live_servers} growth={stats?.servers_growth} icon={Server} />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: Plus, label: 'Add Product', color: 'from-blue-500 to-blue-600' },
                { icon: Activity, label: 'Generate Key', color: 'from-purple-500 to-purple-600' },
                { icon: Upload, label: 'Upload APK', color: 'from-green-500 to-green-600' },
                { icon: Rocket, label: 'Deploy Server', color: 'from-orange-500 to-orange-600' },
                { icon: CreditCard, label: 'Add Credits', color: 'from-pink-500 to-pink-600' },
                { icon: MessageSquare, label: 'Support', color: 'from-cyan-500 to-cyan-600' },
              ].map((action) => (
                <button
                  key={action.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 group"
                >
                  <div className={cn('p-3 rounded-xl bg-gradient-to-br', action.color)}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Server Status */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">Server Status</h2>
                  <RefreshCw className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white transition-colors" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {servers.map((server) => (
                    <div
                      key={server.id}
                      className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Server className="w-5 h-5 text-slate-400" />
                          <span className="font-medium text-white">{server.name}</span>
                        </div>
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(server.status))}>
                          {server.status}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-slate-400">
                          <span>Environment</span>
                          <span className="text-white">{server.environment}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Region</span>
                          <span className="text-white">{server.region}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Uptime</span>
                          <span className="text-white">{server.uptime}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Superadmin Command Center */}
            <div>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">Command Center</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Mode:</span>
                    <span className="text-xs font-medium text-blue-400">Balanced</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <CommandMetric label="Leads" value={commandCenter?.leads} icon={Users} />
                  <CommandMetric label="Ads Campaigns" value={commandCenter?.ads_campaigns} icon={Globe} />
                  <CommandMetric label="Revenue" value={`$${commandCenter?.revenue}`} icon={DollarSign} />
                  <CommandMetric label="AI Calls" value={commandCenter?.ai_calls} icon={Cpu} />
                  <CommandMetric label="AI Cost" value={`$${commandCenter?.ai_cost}`} icon={CreditCard} />
                  <CommandMetric label="Open Circuits" value={commandCenter?.open_circuits} icon={Zap} alert={commandCenter?.open_circuits > 0} />
                  <CommandMetric label="Queue Pending" value={commandCenter?.queue_pending} icon={Clock} />
                  <CommandMetric label="Critical Alerts" value={commandCenter?.critical_alerts} icon={AlertTriangle} alert={commandCenter?.critical_alerts > 0} />
                  <CommandMetric label="Billing Failures" value={commandCenter?.billing_failures} icon={XCircle} alert={commandCenter?.billing_failures > 0} />
                </div>
                <button className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity">
                  Apply AI Mode
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Recent Products */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">Recent Products</h2>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentProducts.map((product) => (
                    <div
                      key={product.id}
                      className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {product.name}
                        </h3>
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(product.status))}>
                          {product.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">${product.price}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                  <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {activityLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 pb-4 border-b border-slate-700/50 last:border-0 last:pb-0"
                    >
                      <div className="p-2 rounded-lg bg-slate-700/50">
                        <Activity className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{log.action}</p>
                        <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                        <p className="text-xs text-slate-500 mt-1">{log.user}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <span>Version: v1.0.3</span>
                <span>Uptime: 99.98%</span>
                <span>Last sync: Just now</span>
                <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400">Environment: Production</span>
              </div>
              <div className="text-sm text-slate-500">
                Powered by SoftwareVala™
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
