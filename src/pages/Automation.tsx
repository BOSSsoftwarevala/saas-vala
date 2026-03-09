import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AutoPilotDashboard } from '@/components/automation/AutoPilotDashboard';
import { SystemMonitorPanel } from '@/components/automation/SystemMonitorPanel';
import { AutoApkPipelinePanel } from '@/components/automation/AutoApkPipelinePanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Shield, Smartphone } from 'lucide-react';

export default function Automation() {
  const [tab, setTab] = useState('autopilot');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">🤖 AI Auto-Pilot & Monitor</h1>
          <p className="text-muted-foreground">
            24/7 monitoring • Smart approval queue • Auto-builds • Auto SEO • APK pipeline
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 bg-muted/30 p-1.5 rounded-xl">
            <TabsTrigger value="autopilot" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bot className="h-4 w-4" /> Auto-Pilot
            </TabsTrigger>
            <TabsTrigger value="apk-pipeline" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Smartphone className="h-4 w-4" /> APK Pipeline
            </TabsTrigger>
            <TabsTrigger value="monitor" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
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
