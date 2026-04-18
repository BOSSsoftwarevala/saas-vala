import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AutoPilotDashboard } from '@/components/automation/AutoPilotDashboard';
import { SystemMonitorPanel } from '@/components/automation/SystemMonitorPanel';
import { AutoApkPipelinePanel } from '@/components/automation/AutoApkPipelinePanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Bot, Shield, Smartphone, Package, TrendingUp } from 'lucide-react';
import { automationIntegrator } from '@/lib/offline/moduleIntegration';
import { supabase } from "@/lib/supabase";

export default function Automation() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('autopilot');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Automation] MODULE LOADED');
    
    // Force database connection check
    const test = async () => {
      try {
        const { data, error } = await supabase
          .from('auth.users')
          .select('*')
          .limit(1)

        console.log("DB FORCE:", data, error)
      } catch (e) {
        console.error("DB check error:", e)
      }
    }
    test();

    // Initialize module integration with all 30 micro validations
    const init = async () => {
      try {
        await automationIntegrator.initialize();
      } catch (error) {
        console.error('Failed to initialize automation module:', error);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      try {
        automationIntegrator.cleanup();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    };
  }, []);

  const handleTabChange = (newTab: string) => {
    // Click lock to prevent double clicks
    const lockKey = `tab-change-${newTab}`;
    if (!automationIntegrator.acquireClickLock(lockKey)) {
      return;
    }

    try {
      setTab(newTab);
      automationIntegrator.logAction('tab_changed', { from: tab, to: newTab });
    } finally {
      automationIntegrator.releaseClickLock(lockKey);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">🤖 AI Auto-Pilot & Monitor</h1>
            <p className="text-muted-foreground">
              24/7 monitoring • Smart approval queue • Auto-builds • Auto SEO • APK pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/products')} className="gap-2">
              <Package className="h-4 w-4" />
              Products
            </Button>
            <Button variant="outline" onClick={() => navigate('/seo')} className="gap-2">
              <TrendingUp className="h-4 w-4" />
              SEO
            </Button>
            <Button variant="outline" onClick={() => navigate('/marketplace-admin')} className="gap-2">
              Marketplace Admin
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full grid grid-cols-3 bg-muted/30 p-1.5 rounded-xl">
            <TabsTrigger 
              value="autopilot" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              disabled={!automationIntegrator.getButtonState(loading, false, true).disabled}
            >
              <Bot className="h-4 w-4" /> Auto-Pilot
            </TabsTrigger>
            <TabsTrigger 
              value="apk-pipeline" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              disabled={!automationIntegrator.getButtonState(loading, false, true).disabled}
            >
              <Smartphone className="h-4 w-4" /> APK Pipeline
            </TabsTrigger>
            <TabsTrigger 
              value="monitor" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              disabled={!automationIntegrator.getButtonState(loading, false, true).disabled}
            >
              <Shield className="h-4 w-4" /> System Monitor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="autopilot">
            <AutoPilotDashboard />
          </TabsContent>

          <TabsContent value="apk-pipeline">
            <AutoApkPipelinePanel />
          </TabsContent>

          <TabsContent value="monitor">
            <SystemMonitorPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
