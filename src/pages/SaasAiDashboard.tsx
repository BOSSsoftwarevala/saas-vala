import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  GitBranch, 
  Terminal, 
  Settings2, 
  Globe, 
  Rocket,
  Activity,
  MessageSquare
} from 'lucide-react';
import { GitConnectPanel } from '@/components/saas-ai-dashboard/GitConnectPanel';
import { BuildLogsPanel } from '@/components/saas-ai-dashboard/BuildLogsPanel';
import { EnvVarsPanel } from '@/components/saas-ai-dashboard/EnvVarsPanel';
import { DomainsPanel } from '@/components/saas-ai-dashboard/DomainsPanel';
import { DeploymentsPanel } from '@/components/saas-ai-dashboard/DeploymentsPanel';
import { HealthPanel } from '@/components/saas-ai-dashboard/HealthPanel';
import { ProjectSelector } from '@/components/saas-ai-dashboard/ProjectSelector';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

export default function SaasAiDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('git');
  const [selectedProject, setSelectedProject] = useState<string | null>('demo-project');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/ai-chat')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <img src={saasValaLogo} alt="SaaS VALA" className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <h1 className="font-display font-bold text-foreground">SaaS AI Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  Project Management • Deploy • Monitor
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ProjectSelector 
              value={selectedProject} 
              onChange={setSelectedProject} 
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/ai-chat')}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              AI Chat
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 md:grid-cols-6 h-auto gap-1 bg-muted/30 p-1.5 rounded-xl">
            <TabsTrigger value="git" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Git</span>
            </TabsTrigger>
            <TabsTrigger value="builds" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Terminal className="h-4 w-4" />
              <span className="hidden sm:inline">Builds</span>
            </TabsTrigger>
            <TabsTrigger value="env" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Env Vars</span>
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Domains</span>
            </TabsTrigger>
            <TabsTrigger value="deploys" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Deploys</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="git">
            <GitConnectPanel projectId={selectedProject} />
          </TabsContent>

          <TabsContent value="builds">
            <BuildLogsPanel projectId={selectedProject} />
          </TabsContent>

          <TabsContent value="env">
            <EnvVarsPanel projectId={selectedProject} />
          </TabsContent>

          <TabsContent value="domains">
            <DomainsPanel projectId={selectedProject} />
          </TabsContent>

          <TabsContent value="deploys">
            <DeploymentsPanel projectId={selectedProject} />
          </TabsContent>

          <TabsContent value="health">
            <HealthPanel projectId={selectedProject} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <p className="text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
        </p>
      </footer>
    </div>
  );
}
