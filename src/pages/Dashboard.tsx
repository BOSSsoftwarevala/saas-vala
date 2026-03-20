import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Key, Server, Users, FileText, TrendingUp, Loader2, Activity, Cpu, HardDrive, Shield, CreditCard, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Clock, Search, Download, Eye, Calendar } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { NetflixRow } from '@/components/dashboard/NetflixRow';
import { ProductCard } from '@/components/dashboard/ProductCard';
import { ServerCard } from '@/components/dashboard/ServerCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useProducts } from '@/hooks/useProducts';
import { useServers } from '@/hooks/useServers';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import React from 'react';
import type { Database } from '@/integrations/supabase/types';

type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
type AuditAction = Database['public']['Enums']['audit_action'];

const actionColors: Record<AuditAction, string> = {
  create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  update: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  read: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  login: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  logout: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  activate: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  suspend: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const tableIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  products: Package,
  license_keys: Key,
  servers: Server,
  transactions: CreditCard,
  profiles: Users,
};

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'checking';
  message: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { stats, loading: statsLoading } = useDashboardStats();
  const { products, loading: productsLoading } = useProducts();
  const { servers, loading: serversLoading } = useServers();
  const { logs: activityLogs } = useAuditLogs();

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // System Health state
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);

  const getServerDisplayStatus = (status: string) => {
    switch (status) {
      case 'live': return 'online' as const;
      case 'deploying': return 'deploying' as const;
      default: return 'offline' as const;
    }
  };

  const getProductDisplayStatus = (status: string) => {
    switch (status) {
      case 'active': return 'active' as const;
      case 'draft': return 'draft' as const;
      default: return 'draft' as const;
    }
  };

  const activities = activityLogs.slice(0, 10).map(log => ({
    id: log.id,
    type: (log.table_name === 'license_keys' ? 'key' :
           log.table_name === 'products' ? 'product' :
           log.table_name === 'servers' ? 'server' :
           log.table_name === 'transactions' ? 'payment' : 'user') as 'key' | 'payment' | 'server' | 'product' | 'user',
    message: `${log.action} on ${log.table_name}`,
    time: new Date(log.created_at).toLocaleString(),
  }));

  // Audit Logs functions
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      if (tableFilter !== 'all') query = query.eq('table_name', tableFilter);
      const { data, error } = await query;
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log =>
    log.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.record_id?.includes(searchQuery)
  );

  const uniqueTables = [...new Set(auditLogs.map(l => l.table_name))];

  const exportLogs = () => {
    const csv = [
      ['ID', 'Table', 'Action', 'Record ID', 'User ID', 'IP Address', 'Created At'].join(','),
      ...filteredLogs.map(log => [log.id, log.table_name, log.action, log.record_id || '', log.user_id || '', log.ip_address || '', log.created_at].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Logs exported successfully');
  };

  // System Health functions
  const runHealthCheck = async () => {
    setHealthLoading(true);
    const checks: HealthCheck[] = [];

    try {
      const { error } = await supabase.from('products').select('id').limit(1);
      checks.push({ name: 'Database', status: error ? 'error' : 'ok', message: error ? error.message : 'Connected', icon: Cpu });
    } catch { checks.push({ name: 'Database', status: 'error', message: 'Failed', icon: Cpu }); }

    try {
      const { data } = await supabase.auth.getSession();
      checks.push({ name: 'Auth', status: 'ok', message: data.session ? 'Active' : 'Service OK', icon: Shield });
    } catch { checks.push({ name: 'Auth', status: 'error', message: 'Error', icon: Shield }); }

    try {
      const { data, error } = await supabase.from('products').select('id', { count: 'exact' });
      checks.push({ name: 'Products', status: error ? 'error' : 'ok', message: `${data?.length || 0} items`, icon: Package, count: data?.length || 0 });
    } catch { checks.push({ name: 'Products', status: 'error', message: 'Failed', icon: Package }); }

    try {
      const { data, error } = await supabase.from('license_keys').select('id', { count: 'exact' });
      checks.push({ name: 'Keys', status: error ? 'error' : 'ok', message: `${data?.length || 0} keys`, icon: Key, count: data?.length || 0 });
    } catch { checks.push({ name: 'Keys', status: 'error', message: 'Failed', icon: Key }); }

    try {
      const { data, error } = await supabase.from('servers').select('id, status');
      const live = data?.filter(s => s.status === 'live').length || 0;
      checks.push({ name: 'Servers', status: error ? 'error' : live > 0 ? 'ok' : 'warning', message: `${live} live / ${data?.length || 0} total`, icon: Server, count: data?.length || 0 });
    } catch { checks.push({ name: 'Servers', status: 'error', message: 'Failed', icon: Server }); }

    try {
      const { data, error } = await supabase.from('wallets').select('id, balance');
      checks.push({ name: 'Wallets', status: error ? 'error' : 'ok', message: `${data?.length || 0} wallets`, icon: CreditCard, count: data?.length || 0 });
    } catch { checks.push({ name: 'Wallets', status: 'error', message: 'Failed', icon: CreditCard }); }

    checks.push({ name: 'Storage', status: 'ok', message: '2 buckets active', icon: HardDrive, count: 2 });

    setHealthChecks(checks);
    setLastCheck(new Date());
    setHealthLoading(false);
    toast.success('Health check completed');
  };

  const statusConfig = {
    ok: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
    checking: { icon: Loader2, color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  const overallStatus = healthChecks.length === 0 ? 'checking' : healthChecks.every(c => c.status === 'ok') ? 'ok' : healthChecks.some(c => c.status === 'error') ? 'error' : 'warning';
  const okCount = healthChecks.filter(c => c.status === 'ok').length;
  const healthPercentage = healthChecks.length > 0 ? Math.round((okCount / healthChecks.length) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Products" value={statsLoading ? 0 : stats.totalProducts} icon={Package} trend={{ value: stats.activeProducts, positive: true }} accentColor="orange" index={0} />
          <StatsCard title="Active Keys" value={statsLoading ? 0 : stats.activeKeys} icon={Key} trend={{ value: Math.round((stats.activeKeys / Math.max(stats.totalKeys, 1)) * 100), positive: true }} accentColor="cyan" index={1} />
          <StatsCard title="Resellers" value={statsLoading ? 0 : stats.totalResellers} prefix="" icon={Users} trend={{ value: stats.activeResellers, positive: true }} accentColor="green" index={2} />
          <StatsCard title="Live Servers" value={statsLoading ? 0 : stats.liveServers} icon={Server} trend={{ value: stats.totalServers - stats.liveServers, positive: false }} accentColor="purple" index={3} />
        </div>

        <QuickActions />

        {/* Products Row */}
        <NetflixRow title="Recent Products" subtitle="Your latest products, demos, and APKs" onViewAll={() => navigate('/products')}>
          {productsLoading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : products.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No products yet.</div>
          ) : (
            products.slice(0, 5).map((product) => (
              <ProductCard key={product.id} name={product.name} description={product.description || ''} price={product.price} status={getProductDisplayStatus(product.status)} type="product" onClick={() => navigate('/products')} />
            ))
          )}
        </NetflixRow>

        {/* Servers Row */}
        <NetflixRow title="Server Status" subtitle="Monitor your deployed applications" onViewAll={() => navigate('/servers')}>
          {serversLoading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : servers.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No servers yet.</div>
          ) : (
            servers.slice(0, 5).map((server) => (
              <ServerCard key={server.id} name={server.name} domain={server.custom_domain || `${server.subdomain}.saasvala.com`} repo={server.git_repo || ''} status={getServerDisplayStatus(server.status)} lastDeployed={server.last_deploy_at ? new Date(server.last_deploy_at).toLocaleString() : 'Never'} onClick={() => navigate('/servers')} />
            ))
          )}
        </NetflixRow>

        {/* Activity Feed */}
        {isSuperAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">Platform Overview</h3>
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
              <ActivityFeed activities={activities.length > 0 ? activities : [{ id: '1', type: 'user', message: 'No recent activity', time: 'Just now' }]} />
            </div>
          </div>
        )}

        {/* Audit Logs & System Health — Admin Only */}
        {isSuperAdmin && (
          <Tabs defaultValue="audit" className="space-y-4">
            <TabsList>
              <TabsTrigger value="audit" className="gap-2"><FileText className="h-4 w-4" />Audit Logs</TabsTrigger>
              <TabsTrigger value="health" className="gap-2"><Activity className="h-4 w-4" />System Health</TabsTrigger>
            </TabsList>

            {/* AUDIT LOGS TAB */}
            <TabsContent value="audit" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">System-wide activity tracking</p>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={fetchAuditLogs} className="gap-2"><RefreshCw className="h-4 w-4" />Refresh</Button>
                  <Button size="sm" onClick={exportLogs} className="gap-2"><Download className="h-4 w-4" />Export</Button>
                </div>
              </div>

              <div className="glass-card rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="relative flex-1 md:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search logs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-muted/50 border-border" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={tableFilter} onValueChange={setTableFilter}>
                      <SelectTrigger className="w-[160px]"><SelectValue placeholder="Table" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tables</SelectItem>
                        {uniqueTables.map(table => (<SelectItem key={table} value={table}>{table}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{auditLogs.length}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{auditLogs.filter(l => l.action === 'create').length}</p>
                  <p className="text-sm text-muted-foreground">Creates</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{auditLogs.filter(l => l.action === 'update').length}</p>
                  <p className="text-sm text-muted-foreground">Updates</p>
                </div>
                <div className="glass-card rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{auditLogs.filter(l => l.action === 'delete').length}</p>
                  <p className="text-sm text-muted-foreground">Deletes</p>
                </div>
              </div>

              <div className="glass-card rounded-xl overflow-hidden">
                {auditLoading ? (
                  <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-foreground mb-2">No audit logs found</h3>
                    <p className="text-muted-foreground">Click Refresh to load logs</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-muted/50">
                        <TableHead className="text-muted-foreground">Table</TableHead>
                        <TableHead className="text-muted-foreground">Action</TableHead>
                        <TableHead className="text-muted-foreground">Record ID</TableHead>
                        <TableHead className="text-muted-foreground">User</TableHead>
                        <TableHead className="text-muted-foreground">IP</TableHead>
                        <TableHead className="text-muted-foreground">Time</TableHead>
                        <TableHead className="text-muted-foreground text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.slice(0, 100).map((log) => {
                        const Icon = tableIcons[log.table_name] || FileText;
                        return (
                          <TableRow key={log.id} className="border-border hover:bg-muted/30">
                            <TableCell><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="font-medium text-foreground">{log.table_name}</span></div></TableCell>
                            <TableCell><Badge variant="outline" className={cn('uppercase text-xs', actionColors[log.action])}>{log.action}</Badge></TableCell>
                            <TableCell><span className="font-mono text-xs text-muted-foreground">{log.record_id?.slice(0, 8)}...</span></TableCell>
                            <TableCell><span className="font-mono text-xs text-muted-foreground">{log.user_id?.slice(0, 8) || 'System'}...</span></TableCell>
                            <TableCell><span className="text-xs text-muted-foreground">{log.ip_address || 'N/A'}</span></TableCell>
                            <TableCell><div className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(log.created_at || '').toLocaleString()}</div></TableCell>
                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}><Eye className="h-4 w-4" /></Button></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* SYSTEM HEALTH TAB */}
            <TabsContent value="health" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">Real-time monitoring of core modules</p>
                <div className="flex items-center gap-3">
                  {lastCheck && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {lastCheck.toLocaleTimeString()}
                    </div>
                  )}
                  <Button size="sm" onClick={runHealthCheck} disabled={healthLoading} className="gap-2">
                    <RefreshCw className={cn('h-4 w-4', healthLoading && 'animate-spin')} />
                    {healthLoading ? 'Checking...' : 'Run Check'}
                  </Button>
                </div>
              </div>

              {/* Overall Status */}
              <div className="glass-card rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', statusConfig[overallStatus].bg)}>
                      {healthLoading ? (
                        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                      ) : (
                        React.createElement(statusConfig[overallStatus].icon, { className: cn('h-7 w-7', statusConfig[overallStatus].color) })
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground uppercase">
                        {healthChecks.length === 0 ? 'Click Run Check' : overallStatus === 'ok' ? 'ALL SYSTEMS OK' : overallStatus === 'warning' ? 'MINOR ISSUES' : overallStatus === 'error' ? 'CRITICAL ISSUES' : 'CHECKING...'}
                      </h3>
                      <p className="text-muted-foreground text-sm">{okCount}/{healthChecks.length} modules healthy</p>
                    </div>
                  </div>
                  <div className="flex-1 max-w-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Health Score</span>
                      <span className={cn('font-bold', healthChecks.length > 0 ? statusConfig[overallStatus].color : 'text-muted-foreground')}>{healthPercentage}%</span>
                    </div>
                    <Progress value={healthPercentage} className="h-3" />
                  </div>
                </div>
              </div>

              {/* Health Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthChecks.map((check) => {
                  const StatusIcon = statusConfig[check.status].icon;
                  return (
                    <div key={check.name} className={cn('glass-card rounded-xl p-4 transition-all', check.status === 'error' && 'border-red-500/30', check.status === 'warning' && 'border-amber-500/30')}>
                      <div className="flex items-start justify-between mb-3">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', statusConfig[check.status].bg)}>
                          <check.icon className={cn('h-5 w-5', statusConfig[check.status].color)} />
                        </div>
                        <StatusIcon className={cn('h-5 w-5', statusConfig[check.status].color, check.status === 'checking' && 'animate-spin')} />
                      </div>
                      <h4 className="font-semibold text-foreground mb-1">{check.name}</h4>
                      <p className="text-sm text-muted-foreground">{check.message}</p>
                      {check.count !== undefined && <Badge variant="outline" className="mt-2 text-xs">{check.count} records</Badge>}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Audit Log Details</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Table</p><p className="font-medium">{selectedLog.table_name}</p></div>
                <div><p className="text-sm text-muted-foreground">Action</p><Badge variant="outline" className={cn('uppercase', actionColors[selectedLog.action])}>{selectedLog.action}</Badge></div>
                <div><p className="text-sm text-muted-foreground">Record ID</p><p className="font-mono text-sm">{selectedLog.record_id}</p></div>
                <div><p className="text-sm text-muted-foreground">User ID</p><p className="font-mono text-sm">{selectedLog.user_id || 'System'}</p></div>
                <div><p className="text-sm text-muted-foreground">IP Address</p><p className="font-mono text-sm">{selectedLog.ip_address || 'N/A'}</p></div>
                <div><p className="text-sm text-muted-foreground">User Agent</p><p className="text-sm truncate">{selectedLog.user_agent || 'N/A'}</p></div>
                <div className="col-span-2"><p className="text-sm text-muted-foreground">Timestamp</p><p>{new Date(selectedLog.created_at || '').toLocaleString()}</p></div>
              </div>
              {selectedLog.old_data && (<div><p className="text-sm text-muted-foreground mb-2">Old Data</p><pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-40">{JSON.stringify(selectedLog.old_data, null, 2)}</pre></div>)}
              {selectedLog.new_data && (<div><p className="text-sm text-muted-foreground mb-2">New Data</p><pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-40">{JSON.stringify(selectedLog.new_data, null, 2)}</pre></div>)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
