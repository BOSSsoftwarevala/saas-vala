import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Server, GitBranch, Rocket } from 'lucide-react';
import { ServerSetupPanel } from '@/components/servers/ServerSetupPanel';
import { GitConnectionPanel } from '@/components/servers/GitConnectionPanel';
import { DeploymentPanel } from '@/components/servers/DeploymentPanel';
import { LiveDeployStatusPanel } from '@/components/servers/LiveDeployStatusPanel';
import { useServerManager, type Server as ServerType } from '@/hooks/useServerManager';
import { useProducts } from '@/hooks/useProducts';

export default function ServerSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get('id');
  
  const {
    servers,
    domains,
    gitConnections,
    deployments,
    createServer,
    updateServer,
    triggerDeploy,
    rollbackDeploy,
    stopDeploy,
    addDomain,
    connectGit,
    disconnectGit,
  } = useServerManager();

  const { products } = useProducts();

  const [activeTab, setActiveTab] = useState('server');
  const [selectedServer, setSelectedServer] = useState<ServerType | null>(null);

  // Find server from URL param
  useEffect(() => {
    if (serverId) {
      const server = servers.find(s => s.id === serverId);
      if (server) {
        setSelectedServer(server);
      }
    }
  }, [serverId, servers]);

  const mode = selectedServer ? 'edit' : 'create';

  const selectedGitConnection = selectedServer
    ? gitConnections.find(g => g.server_id === selectedServer.id) || null
    : null;

  const handleSaveServer = async (data: Partial<ServerType>) => {
    if (mode === 'create') {
      const newServer = await createServer(data);
      if (newServer) {
        setSelectedServer(newServer as ServerType);
        navigate(`/server-setup?id=${newServer.id}`, { replace: true });
      }
    } else if (selectedServer) {
      await updateServer(selectedServer.id, data);
    }
  };

  const handleDisableServer = async (server: ServerType) => {
    await updateServer(server.id, { status: 'suspended' });
  };

  const handleConnectGit = async (connection: Parameters<typeof connectGit>[0]) => {
    await connectGit(connection);
  };

  const handleDisconnectGit = async (connectionId: string) => {
    await disconnectGit(connectionId);
  };

  const handleManualDeploy = async (serverId: string, branch?: string) => {
    await triggerDeploy(serverId, branch);
  };

  const handleDeploy = async (serverId: string) => {
    await triggerDeploy(serverId);
  };

  const handleRollback = async (deploymentId: string, serverId: string) => {
    await rollbackDeploy(deploymentId, serverId);
  };

  const handleStop = async (deploymentId: string) => {
    await stopDeploy(deploymentId);
  };

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Main Content */}
        <div className="flex-1 space-y-6 pr-0 xl:pr-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/servers')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Server Setup & Deployment
                </h2>
                <p className="text-muted-foreground text-sm">
                  {mode === 'create' ? 'Configure a new server' : `Managing: ${selectedServer?.name}`}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="server" className="gap-2">
                <Server className="h-4 w-4" />
                <span className="hidden sm:inline">Server</span>
              </TabsTrigger>
              <TabsTrigger value="git" className="gap-2" disabled={!selectedServer}>
                <GitBranch className="h-4 w-4" />
                <span className="hidden sm:inline">Git</span>
              </TabsTrigger>
              <TabsTrigger value="deploy" className="gap-2">
                <Rocket className="h-4 w-4" />
                <span className="hidden sm:inline">Deploy</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="server" className="mt-0">
                <ServerSetupPanel
                  server={selectedServer}
                  mode={mode}
                  onSave={handleSaveServer}
                  onDisable={handleDisableServer}
                />
              </TabsContent>

              <TabsContent value="git" className="mt-0">
                <GitConnectionPanel
                  server={selectedServer}
                  gitConnection={selectedGitConnection}
                  onConnect={handleConnectGit}
                  onDisconnect={handleDisconnectGit}
                  onManualDeploy={handleManualDeploy}
                />
              </TabsContent>

              <TabsContent value="deploy" className="mt-0">
                <DeploymentPanel
                  servers={servers.filter(s => s.status !== 'suspended')}
                  deployments={deployments}
                  products={products.map(p => ({ id: p.id, name: p.name }))}
                  onDeploy={handleDeploy}
                  onRollback={handleRollback}
                  onStop={handleStop}
                />
              </TabsContent>
            </div>
          </Tabs>

          {/* Brand Lock */}
          <p className="text-center text-xs text-muted-foreground pt-8">
            Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
          </p>
        </div>

        {/* Live Deploy Status Panel (Right Side) */}
        <LiveDeployStatusPanel
          deployments={deployments}
          servers={servers}
        />
      </div>
    </DashboardLayout>
  );
}
