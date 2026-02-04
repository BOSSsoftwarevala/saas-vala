import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  LayoutDashboard,
  Cpu,
  Layers,
  Server,
  Shield,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { AiStatsCards } from '@/components/saas-ai/AiStatsCards';
import { AiQuickActions } from '@/components/saas-ai/AiQuickActions';
import { AiModelManager } from '@/components/saas-ai/AiModelManager';
import { AiCategoryManager } from '@/components/saas-ai/AiCategoryManager';
import { ServerAiIntegration } from '@/components/saas-ai/ServerAiIntegration';
import { SecurityPanel } from '@/components/saas-ai/SecurityPanel';
import { motion } from 'framer-motion';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

export default function SaasAiDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

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
              <motion.img 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={saasValaLogo} 
                alt="SaaS VALA" 
                className="h-10 w-10 rounded-xl object-cover border border-primary/20 shadow-lg shadow-primary/10"
              />
              <div>
                <h1 className="font-display font-bold text-foreground flex items-center gap-2">
                  SaaS AI Dashboard
                  <Sparkles className="h-4 w-4 text-primary" />
                </h1>
                <p className="text-xs text-muted-foreground">
                  Super Admin • Full Control
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 h-auto gap-1 bg-muted/30 p-1.5 rounded-xl">
            <TabsTrigger 
              value="overview" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="models" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Cpu className="h-4 w-4" />
              <span className="hidden sm:inline">AI Models</span>
            </TabsTrigger>
            <TabsTrigger 
              value="categories" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger 
              value="server" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Server + AI</span>
            </TabsTrigger>
            <TabsTrigger 
              value="security" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <AiStatsCards />
            <AiQuickActions />
            <div className="grid grid-cols-1 gap-6">
              <AiModelManager />
            </div>
          </TabsContent>

          {/* AI Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <AiStatsCards />
            <AiModelManager />
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <AiCategoryManager />
          </TabsContent>

          {/* Server + AI Tab */}
          <TabsContent value="server" className="space-y-6">
            <ServerAiIntegration />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <SecurityPanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6 mt-8">
        <p className="text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
        </p>
      </footer>
    </div>
  );
}
