import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Upload, 
  Search, 
  Wrench, 
  Puzzle, 
  Rocket,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SaasAiStatusCards } from '@/components/saas-ai/StatusCards';
import { SourceUpload } from '@/components/saas-ai/SourceUpload';
import { CodeAnalysis } from '@/components/saas-ai/CodeAnalysis';
import { AutoFix } from '@/components/saas-ai/AutoFix';
import { AddonManager } from '@/components/saas-ai/AddonManager';
import { ServerDeploy } from '@/components/saas-ai/ServerDeploy';
import { UpdatePatch } from '@/components/saas-ai/UpdatePatch';
import { LicenseBrand } from '@/components/saas-ai/LicenseBrand';
import { SecurityScan } from '@/components/saas-ai/SecurityScan';

export default function AiChat() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload');
  const [stats] = useState({
    totalProjects: 12,
    activeBuilds: 3,
    pendingFixes: 5,
    liveDeployments: 8,
    failedBuilds: 1
  });

  const handleUploadComplete = () => {
    setActiveTab('analysis');
  };

  const handleAutoFix = () => {
    setActiveTab('fix');
  };

  const handleFixComplete = () => {
    setActiveTab('deploy');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-foreground">SaaS AI</h1>
                <p className="text-xs text-muted-foreground">
                  Lovable-Clone • Internal Power Version
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Powered by</span>
            <span className="font-semibold text-primary">SoftwareVala™</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Cards */}
        <SaasAiStatusCards stats={stats} />

        {/* Module Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full flex-wrap h-auto gap-2 bg-muted/30 p-2 rounded-xl">
            <TabsTrigger value="upload" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="fix" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Auto Fix</span>
            </TabsTrigger>
            <TabsTrigger value="addons" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <Puzzle className="h-4 w-4" />
              <span className="hidden sm:inline">Addons</span>
            </TabsTrigger>
            <TabsTrigger value="deploy" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-success data-[state=active]:text-success-foreground">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Deploy</span>
            </TabsTrigger>
            <TabsTrigger value="update" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Update</span>
            </TabsTrigger>
            <TabsTrigger value="license" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">License</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 min-w-[100px] gap-2 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Module 1: Source Upload */}
          <TabsContent value="upload" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SourceUpload onUploadComplete={handleUploadComplete} />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">Upload Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      No file size limit
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Chunk upload with auto-resume
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Auto language detection
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Framework auto-detection
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      ZIP / Folder / PHP / JS / Mixed
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 2: Code Analysis */}
          <TabsContent value="analysis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CodeAnalysis onAutoFix={handleAutoFix} />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">AI Analysis Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Scan full source code
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Detect broken files
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Detect missing configs
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Security vulnerability scan
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Dependency issue detection
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 3: Auto Fix */}
          <TabsContent value="fix" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AutoFix onComplete={handleFixComplete} />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">Auto Fix Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Fix deprecated code
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Fix missing files
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Fix config errors
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Upgrade old PHP/JS safely
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Keep original logic intact
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 4: Addons */}
          <TabsContent value="addons" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AddonManager />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">Addon Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Payment integrations
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Wallet system
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Multi-language support
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Notifications (Email, SMS, Push)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Analytics & SEO tools
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 5: Deploy */}
          <TabsContent value="deploy" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ServerDeploy />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">Deploy Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      No developer required
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Auto environment setup
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Auto SSL configuration
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Domain auto-apply
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      One-click deployment
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 6: Update */}
          <TabsContent value="update" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UpdatePatch />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">Update Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      One-click updates
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Incremental patches
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Zero downtime
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Instant rollback
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Version history
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 7: License */}
          <TabsContent value="license" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LicenseBrand />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">License Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Auto-injected branding
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Hidden watermark
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      License checksum
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Cannot be removed
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Auto ownership verification
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Module 8: Security */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SecurityScan />
              <div className="space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-display font-bold text-foreground mb-4">Security Features</h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Malware scan
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Backdoor detection
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Permission hardening
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Threat auto-fix
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="status-dot status-online" />
                      Auto revert on failure
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-primary">SoftwareVala™</span> | 
            Internal Use Only | Super Admin + Reseller Access
          </p>
        </div>
      </footer>
    </div>
  );
}
