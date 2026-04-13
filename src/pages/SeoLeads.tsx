import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutDashboard,
  Cpu,
  FileText,
  Sparkles,
  Users,
  Link2,
  BarChart3,
  Settings,
  Store,
  ScanLine,
  Tags,
  Globe,
} from 'lucide-react';
import { SeoDashboard } from '@/components/seo-leads/SeoDashboard';
import { AutoSeoEngine } from '@/components/seo-leads/AutoSeoEngine';
import { MetaTagManager } from '@/components/seo-leads/MetaTagManager';
import { AiContentGenerator } from '@/components/seo-leads/AiContentGenerator';
import { LeadsManager } from '@/components/seo-leads/LeadsManager';
import { LeadSources } from '@/components/seo-leads/LeadSources';
import { SeoAnalytics } from '@/components/seo-leads/SeoAnalytics';
import { SeoSettings } from '@/components/seo-leads/SeoSettings';
 import { EnterpriseSeoEngine } from '@/components/seo-leads/EnterpriseSeoEngine';
import { WorldClassSeoEngine } from '@/components/seo-leads/WorldClassSeoEngine';

export default function SeoLeads() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            SEO & Lead Automation
          </h2>
          <p className="text-muted-foreground">
            AI-powered SEO optimization and lead management
          </p>
        </div>

        {/* Tabs - ONLY REAL WORKING MODULES */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4 md:grid-cols-8 h-auto gap-1 bg-muted/30 p-1.5 rounded-xl">
            <TabsTrigger value="dashboard" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <LayoutDashboard className="h-3 w-3" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="auto-seo" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ScanLine className="h-3 w-3" />
              <span className="hidden sm:inline">Auto SEO</span>
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Tags className="h-3 w-3" />
              <span className="hidden sm:inline">Meta Tags</span>
            </TabsTrigger>
            <TabsTrigger value="keywords" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Globe className="h-3 w-3" />
              <span className="hidden sm:inline">Keywords</span>
            </TabsTrigger>
            <TabsTrigger value="ai-content" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="h-3 w-3" />
              <span className="hidden sm:inline">AI Content</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">Leads</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Link2 className="h-3 w-3" />
              <span className="hidden sm:inline">Sources</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Store className="h-3 w-3" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-3 w-3" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="h-3 w-3" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <SeoDashboard />
          </TabsContent>

          <TabsContent value="auto-seo" className="mt-6">
            <AutoSeoEngine />
          </TabsContent>

          <TabsContent value="meta" className="mt-6">
            <MetaTagManager />
          </TabsContent>

          <TabsContent value="keywords" className="mt-6">
            <KeywordTracker />
          </TabsContent>

          <TabsContent value="ai-content" className="mt-6">
            <AiContentGenerator />
          </TabsContent>

          <TabsContent value="leads" className="mt-6">
            <LeadsManager />
          </TabsContent>

          <TabsContent value="sources" className="mt-6">
            <LeadSources />
          </TabsContent>

          
          <TabsContent value="analytics" className="mt-6">
            <SeoAnalytics />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SeoSettings />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
        </p>
      </div>
    </DashboardLayout>
  );
}
