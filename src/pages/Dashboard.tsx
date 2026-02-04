import { useNavigate } from 'react-router-dom';
import { Package, Key, Server, DollarSign, Users, FileText, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { NetflixRow } from '@/components/dashboard/NetflixRow';
import { ProductCard } from '@/components/dashboard/ProductCard';
import { ServerCard } from '@/components/dashboard/ServerCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useAuth } from '@/hooks/useAuth';

// Mock data - will be replaced with real data from Supabase
const mockProducts = [
  { id: '1', name: 'Enterprise CRM', description: 'Full-featured customer management', price: 299, status: 'active' as const, type: 'product' as const },
  { id: '2', name: 'Inventory Pro', description: 'Warehouse management solution', price: 149, status: 'active' as const, type: 'product' as const },
  { id: '3', name: 'Chat App v2', description: 'Real-time messaging platform', price: 0, status: 'draft' as const, type: 'demo' as const },
  { id: '4', name: 'Mobile POS', description: 'Android point of sale', price: 99, status: 'active' as const, type: 'apk' as const },
  { id: '5', name: 'Analytics Dashboard', description: 'Business intelligence tool', price: 199, status: 'archived' as const, type: 'product' as const },
];

const mockServers = [
  { id: '1', name: 'Production API', domain: 'api.saas-vala.com', repo: 'saas-vala/api', status: 'online' as const, lastDeployed: '2 hours ago' },
  { id: '2', name: 'Staging Environment', domain: 'staging.saas-vala.com', repo: 'saas-vala/web', status: 'deploying' as const, lastDeployed: 'Just now' },
  { id: '3', name: 'Analytics Service', domain: 'analytics.saas-vala.com', repo: 'saas-vala/analytics', status: 'online' as const, lastDeployed: '1 day ago' },
  { id: '4', name: 'Legacy System', repo: 'saas-vala/legacy', status: 'offline' as const, lastDeployed: '1 week ago' },
];

const mockActivities = [
  { id: '1', type: 'key' as const, message: 'New license key generated for Enterprise CRM', time: '5 minutes ago' },
  { id: '2', type: 'payment' as const, message: 'Payment of $299 received from Acme Corp', time: '1 hour ago' },
  { id: '3', type: 'server' as const, message: 'Staging Environment deployment started', time: '2 hours ago' },
  { id: '4', type: 'product' as const, message: 'Mobile POS APK updated to v2.1.0', time: '3 hours ago' },
  { id: '5', type: 'user' as const, message: 'New reseller account created: TechStore Inc', time: '5 hours ago' },
  { id: '6', type: 'key' as const, message: 'License key suspended for inactive account', time: '1 day ago' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-8 stagger-children">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Products"
            value={24}
            icon={Package}
            trend={{ value: 12, positive: true }}
            accentColor="orange"
          />
          <StatsCard
            title="Active Keys"
            value={1847}
            icon={Key}
            trend={{ value: 8, positive: true }}
            accentColor="cyan"
          />
          <StatsCard
            title="Revenue"
            value={48750}
            prefix="$"
            icon={DollarSign}
            trend={{ value: 23, positive: true }}
            accentColor="green"
          />
          <StatsCard
            title="Active Servers"
            value={12}
            icon={Server}
            trend={{ value: 2, positive: false }}
            accentColor="purple"
          />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Netflix Rows */}
        <NetflixRow
          title="Recent Products"
          subtitle="Your latest products, demos, and APKs"
          onViewAll={() => navigate('/products')}
        >
          {mockProducts.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              status={product.status}
              type={product.type}
              onClick={() => navigate('/products')}
            />
          ))}
        </NetflixRow>

        <NetflixRow
          title="Server Status"
          subtitle="Monitor your deployed applications"
          onViewAll={() => navigate('/servers')}
        >
          {mockServers.map((server) => (
            <ServerCard
              key={server.id}
              name={server.name}
              domain={server.domain}
              repo={server.repo}
              status={server.status}
              lastDeployed={server.lastDeployed}
              onClick={() => navigate('/servers')}
            />
          ))}
        </NetflixRow>

        {/* Activity Feed - visible to Super Admin */}
        {isSuperAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="glass-card rounded-xl p-6">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">
                  Platform Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold text-foreground">156</p>
                    <p className="text-sm text-muted-foreground">Resellers</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <FileText className="h-6 w-6 mx-auto mb-2 text-cyan" />
                    <p className="text-2xl font-bold text-foreground">89</p>
                    <p className="text-sm text-muted-foreground">Invoices</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green" />
                    <p className="text-2xl font-bold text-foreground">342</p>
                    <p className="text-sm text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <Key className="h-6 w-6 mx-auto mb-2 text-purple" />
                    <p className="text-2xl font-bold text-foreground">12</p>
                    <p className="text-sm text-muted-foreground">API Keys</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <ActivityFeed activities={mockActivities} />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
