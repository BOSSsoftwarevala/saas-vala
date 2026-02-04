import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { ServerKPIBoxes } from '@/components/servers/ServerKPIBoxes';
import { ServerTable } from '@/components/servers/ServerTable';
import { ServerDrawer } from '@/components/servers/ServerDrawer';
import { LiveActivityPanel } from '@/components/servers/LiveActivityPanel';
import { QuickActionBar } from '@/components/servers/QuickActionBar';
import { useServerManager, type Server } from '@/hooks/useServerManager';
import { toast } from 'sonner';

export default function Servers() {
  const navigate = useNavigate();
  const {
    servers,
    domains,
    gitConnections,
    deployments,
    serverEvents,
    backupLogs,
    kpis,
    loading,
    fetchAll,
    createServer,
    updateServer,
    deleteServer,
    triggerDeploy,
    addDomain,
    connectGit,
    updateAutoRules,
  } = useServerManager();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create');
  const [drawerTab, setDrawerTab] = useState<'server' | 'git' | 'domains' | 'auto'>('server');

  const filteredServers = servers.filter((server) => {
    const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!activeFilter || activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'live') return matchesSearch && server.status === 'live';
    if (activeFilter === 'stopped') return matchesSearch && (server.status === 'stopped' || server.status === 'failed');
    if (activeFilter === 'suspended') return matchesSearch && server.status === 'suspended';
    return matchesSearch;
  });

  const handleKPIClick = (filter: string) => {
    setActiveFilter(filter === activeFilter ? 'all' : filter);
  };

  const openCreateDrawer = () => {
    // Navigate to server setup page for creating new server
    navigate('/server-setup');
  };

  const openViewDrawer = (server: Server) => {
    // Navigate to server setup page with server ID
    navigate(`/server-setup?id=${server.id}`);
  };

  const openGitDrawer = () => {
    // If we have servers, open first server's git tab
    if (servers.length > 0) {
      setSelectedServer(servers[0]);
      setDrawerMode('view');
      setDrawerTab('git');
      setDrawerOpen(true);
    } else {
      toast.error('Create a server first before connecting Git');
    }
  };

  const openDomainDrawer = () => {
    if (servers.length > 0) {
      setSelectedServer(servers[0]);
      setDrawerMode('view');
      setDrawerTab('domains');
      setDrawerOpen(true);
    } else {
      toast.error('Create a server first before adding domains');
    }
  };

  const handleDeployNow = async () => {
    const liveServers = servers.filter((s) => s.status === 'live' || s.status === 'stopped');
    if (liveServers.length === 0) {
      toast.error('No servers available for deployment');
      return;
    }
    // Deploy first available server
    await triggerDeploy(liveServers[0].id);
  };

  const handleForceSync = async () => {
    await fetchAll();
    toast.success('Sync completed');
  };

  const handleDeploy = async (server: Server) => {
    await triggerDeploy(server.id);
  };

  const handleDisable = async (server: Server) => {
    await updateServer(server.id, { status: 'suspended' });
  };

  const handleActivate = async (server: Server) => {
    await updateServer(server.id, { status: 'stopped' });
  };

  const handleDelete = async (server: Server) => {
    await deleteServer(server.id);
  };

  const selectedServerDomains = selectedServer 
    ? domains.filter(d => d.server_id === selectedServer.id)
    : [];

  const selectedGitConnection = selectedServer
    ? gitConnections.find(g => g.server_id === selectedServer.id) || null
    : null;

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Main Content */}
        <div className="flex-1 space-y-6 pr-0 xl:pr-4">
          {/* Quick Action Bar */}
          <QuickActionBar
            onAddServer={openCreateDrawer}
            onAddDomain={openDomainDrawer}
            onConnectGit={openGitDrawer}
            onDeployNow={handleDeployNow}
            onRefresh={fetchAll}
            onForceSync={handleForceSync}
            loading={loading}
          />

          {/* KPI Boxes */}
          <ServerKPIBoxes kpis={kpis} onKPIClick={handleKPIClick} activeFilter={activeFilter} />

          {/* Search & Tabs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50"
              />
            </div>
            <Tabs value={activeFilter || 'all'} onValueChange={setActiveFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="live">Live</TabsTrigger>
                <TabsTrigger value="stopped">Stopped</TabsTrigger>
                <TabsTrigger value="suspended">Suspended</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Server Table */}
          <div className="glass-card rounded-xl overflow-hidden">
            <ServerTable
              servers={filteredServers}
              loading={loading}
              onView={openViewDrawer}
              onDeploy={handleDeploy}
              onDisable={handleDisable}
              onDelete={handleDelete}
              onActivate={handleActivate}
            />
          </div>

          {/* Brand Lock */}
          <p className="text-center text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
          </p>
        </div>

        {/* Live Activity Panel (Right Side) */}
        <LiveActivityPanel
          deployments={deployments}
          serverEvents={serverEvents}
          backupLogs={backupLogs}
          gitConnections={gitConnections}
          servers={servers.map(s => ({ id: s.id, name: s.name }))}
        />
      </div>

      {/* Server Drawer */}
      <ServerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        server={selectedServer}
        domains={selectedServerDomains}
        gitConnection={selectedGitConnection}
        autoRules={null}
        mode={drawerMode}
        defaultTab={drawerTab}
        onSave={async (data) => {
          if (drawerMode === 'create') {
            await createServer(data);
          } else if (selectedServer) {
            await updateServer(selectedServer.id, data);
          }
        }}
        onConnectGit={connectGit}
        onAddDomain={addDomain}
        onUpdateAutoRules={async (rules) => {
          if (selectedServer) {
            await updateAutoRules(selectedServer.id, rules);
          }
        }}
      />
    </DashboardLayout>
  );
}
