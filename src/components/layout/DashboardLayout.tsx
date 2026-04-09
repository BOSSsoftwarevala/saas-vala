import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSidebarState } from '@/hooks/useSidebarState';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { collapsed } = useSidebarState();
  const { getSystemMetrics, lastRefreshedAt } = useDashboardStore();

  const systemMetrics = useMemo(() => getSystemMetrics(), [getSystemMetrics]);

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    return `${Math.floor(diffInSeconds / 3600)} hr ago`;
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle premium background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-mesh-gradient opacity-40" />
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, hsl(215, 75%, 42%) 0%, transparent 70%)',
          }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-[0.02]"
          style={{
            background: 'radial-gradient(circle, hsl(195, 85%, 45%) 0%, transparent 70%)',
          }}
        />
      </div>

      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300 relative z-10',
          collapsed ? 'pl-16' : 'pl-16 lg:pl-64'
        )}
      >
        <Header />
        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6">
          {children}
        </main>
        <footer className="border-t border-border/50 py-4 px-6 backdrop-blur-sm">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 SaaS VALA | System {systemMetrics.version} | Uptime: {systemMetrics.uptime}% | Last Sync: {getTimeAgo(lastRefreshedAt)} | {systemMetrics.environment}
          </p>
        </footer>
      </div>
    </div>
  );
}