import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiServicesMarketplace } from '@/components/ai-services/AiServicesMarketplace';
import { AutoPilotPanel } from '@/components/ai-services/AutoPilotPanel';
import { AiModelManager } from '@/components/saas-ai/AiModelManager';
import { AiBillingPanel } from '@/components/saas-ai/AiBillingPanel';
import { 
  Cpu, 
  Zap, 
  ShoppingCart,
  DollarSign
} from 'lucide-react';

export default function AiApis() {
  const [activeTab, setActiveTab] = useState('marketplace');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            AI Services & APIs
          </h2>
          <p className="text-muted-foreground">
            Subscribe to AI services • Auto-pilot mode • Billing & Usage tracking
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="marketplace" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              AI Services
            </TabsTrigger>
            <TabsTrigger value="autopilot" className="gap-2">
              <Zap className="h-4 w-4" />
              Auto-Pilot
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-2">
              <Cpu className="h-4 w-4" />
              AI Models
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Billing & Usage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace">
            <AiServicesMarketplace />
          </TabsContent>

          <TabsContent value="autopilot">
            <AutoPilotPanel />
          </TabsContent>

          <TabsContent value="models">
            <AiModelManager />
          </TabsContent>

          <TabsContent value="billing">
            <AiBillingPanel />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
