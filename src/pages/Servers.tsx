import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { ServerKPIBoxes } from '@/components/servers/ServerKPIBoxes';
import { ServerTable } from '@/components/servers/ServerTable';
import { ServerDrawer } from '@/components/servers/ServerDrawer';
import { useServerManager, type Server } from '@/hooks/useServerManager';

export default function Servers() {
  const {
    servers,
    domains,
    gitConnections,
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
    setSelectedServer(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const openViewDrawer = (server: Server) => {
    setSelectedServer(server);
    setDrawerMode('view');
    setDrawerOpen(true);
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Server Manager</h2>
            <p className="text-muted-foreground">One-click deploy • Auto subdomain • Zero configuration</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={fetchAll}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openCreateDrawer} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" /> New Server
            </Button>
          </div>
        </div>

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

      {/* Server Drawer */}
      <ServerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        server={selectedServer}
        domains={selectedServerDomains}
        gitConnection={selectedGitConnection}
        autoRules={null}
        mode={drawerMode}
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
