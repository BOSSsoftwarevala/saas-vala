import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Globe, Shield, Settings } from 'lucide-react';
import { DomainTable } from '@/components/servers/DomainTable';
import { DomainDrawer } from '@/components/servers/DomainDrawer';
import { SSLManagement } from '@/components/servers/SSLManagement';
import { AutoOperationsPanel } from '@/components/servers/AutoOperationsPanel';
import { LiveDomainSSLPanel } from '@/components/servers/LiveDomainSSLPanel';
import { useServerManager } from '@/hooks/useServerManager';
import { useProducts } from '@/hooks/useProducts';
import { toast } from 'sonner';

export default function DomainOperations() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('domains');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<any>(null);

  const { servers, domains, addDomain, updateDomain } = useServerManager();
  const { products } = useProducts();

  // Mock live data - in real app, this would come from real-time subscriptions
  const liveData = useMemo(() => ({
    domainsAddedToday: domains.filter(d => {
      const today = new Date().toDateString();
      return d.created_at && new Date(d.created_at).toDateString() === today;
    }).length,
    sslIssuedToday: domains.filter(d => d.ssl_status === 'active').length,
    sslErrors: domains.filter(d => d.ssl_status === 'failed' || d.ssl_status === 'expired').length,
    autoRenewRunning: false,
    recentEvents: [
      { id: '1', type: 'domain_added' as const, message: 'Domain example.com added', time: '2 min ago', status: 'success' as const },
      { id: '2', type: 'ssl_issued' as const, message: 'SSL issued for api.example.com', time: '5 min ago', status: 'success' as const },
      { id: '3', type: 'domain_verified' as const, message: 'DNS verified for staging.example.com', time: '10 min ago', status: 'info' as const },
    ],
  }), [domains]);

  const handleAddDomain = () => {
    setSelectedDomain(null);
    setDrawerOpen(true);
  };

  const handleViewDomain = (domain: any) => {
    setSelectedDomain(domain);
    setDrawerOpen(true);
  };

  const handleSaveDomain = async (data: any) => {
    if (data.id) {
      await updateDomain(data.id, data);
      toast.success('Domain updated');
    } else {
      await addDomain({
        domain_name: data.domain_name,
        domain_type: data.domain_type,
        server_id: data.server_id || null,
        product_id: data.product_id || null,
        is_primary: data.is_primary,
        ssl_auto_renew: data.ssl_auto_renew,
      });
      toast.success('Domain added');
    }
    setDrawerOpen(false);
  };

  const handleVerifyDomain = async (domainId: string) => {
    // Simulate DNS verification
    toast.info('Checking DNS records...');
    setTimeout(() => {
      updateDomain(domainId, { status: 'active', dns_verified: true });
      toast.success('Domain verified successfully');
    }, 2000);
  };

  const handleEnableSSL = async (domainId: string) => {
    toast.info('Issuing SSL certificate...');
    setTimeout(() => {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      updateDomain(domainId, { 
        ssl_status: 'active', 
        ssl_expiry_at: expiryDate.toISOString() 
      });
      toast.success('SSL certificate issued');
    }, 2000);
  };

  const handleRemoveDomain = async (domainId: string) => {
    // Unlink domain (not delete)
    await updateDomain(domainId, { status: 'inactive', server_id: null });
    toast.success('Domain unlinked');
  };

  const handleIssueSSL = async (domainId: string) => {
    await updateDomain(domainId, { ssl_status: 'pending' });
    setTimeout(() => {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      updateDomain(domainId, { 
        ssl_status: 'active', 
        ssl_expiry_at: expiryDate.toISOString() 
      });
    }, 2000);
  };

  const handleRenewSSL = async (domainId: string) => {
    await updateDomain(domainId, { ssl_status: 'pending' });
    setTimeout(() => {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      updateDomain(domainId, { 
        ssl_status: 'active', 
        ssl_expiry_at: expiryDate.toISOString() 
      });
    }, 2000);
  };

  const handleRecheckSSL = async (_domainId: string) => {
    toast.info('Rechecking SSL status...');
  };

  const handleUpdateAutoRules = async (rules: any) => {
    // In real app, save to server_auto_rules table
    console.log('Auto rules updated:', rules);
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
                  Domain & Auto Operations
                </h2>
                <p className="text-muted-foreground text-sm">
                  Manage domains, SSL certificates, and automation
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="domains" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Domains</span>
              </TabsTrigger>
              <TabsTrigger value="ssl" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">SSL</span>
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Auto Ops</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              {/* Domains Tab */}
              <TabsContent value="domains" className="mt-0">
                <DomainTable
                  domains={domains}
                  servers={servers.map(s => ({ id: s.id, name: s.name, subdomain: s.subdomain }))}
                  products={products.map(p => ({ id: p.id, name: p.name }))}
                  onAddDomain={handleAddDomain}
                  onVerify={handleVerifyDomain}
                  onEnableSSL={handleEnableSSL}
                  onRemove={handleRemoveDomain}
                  onView={handleViewDomain}
                />
              </TabsContent>

              {/* SSL Tab */}
              <TabsContent value="ssl" className="mt-0">
                <SSLManagement
                  domains={domains}
                  onIssueSSL={handleIssueSSL}
                  onRenewSSL={handleRenewSSL}
                  onRecheckSSL={handleRecheckSSL}
                />
              </TabsContent>

              {/* Auto Operations Tab */}
              <TabsContent value="auto" className="mt-0">
                <AutoOperationsPanel
                  serverName="All Servers"
                  onUpdate={handleUpdateAutoRules}
                />
              </TabsContent>
            </div>
          </Tabs>

          {/* Brand Lock */}
          <p className="text-center text-xs text-muted-foreground pt-8">
            Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
          </p>
        </div>

        {/* Live Domain & SSL Panel (Right Side) */}
        <LiveDomainSSLPanel {...liveData} />
      </div>

      {/* Domain Drawer */}
      <DomainDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        domain={selectedDomain}
        servers={servers.map(s => ({ id: s.id, name: s.name, subdomain: s.subdomain }))}
        products={products.map(p => ({ id: p.id, name: p.name, slug: p.slug }))}
        onSave={handleSaveDomain}
        onVerify={handleVerifyDomain}
      />
    </DashboardLayout>
  );
}
