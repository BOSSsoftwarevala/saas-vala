import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import {
  LayoutDashboard,
  Package,
  Key,
  Server,
  MessageSquare,
  Cpu,
  Wallet,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  History,
  Headphones,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'Products', icon: Package, href: '/products' },
  { title: 'Keys', icon: Key, href: '/keys' },
  { title: 'Servers', icon: Server, href: '/servers' },
  { title: 'AI Chat', icon: MessageSquare, href: '/ai-chat' },
  { title: 'AI APIs', icon: Cpu, href: '/ai-apis' },
  { title: 'Wallet', icon: Wallet, href: '/wallet' },
  { title: 'SEO & Leads', icon: TrendingUp, href: '/seo-leads' },
  { title: 'Support', icon: Headphones, href: '/support' },
  { title: 'Resellers', icon: Users, href: '/resellers', adminOnly: true },
  { title: 'Audit Logs', icon: History, href: '/audit-logs', adminOnly: true },
  { title: 'Settings', icon: Settings, href: '/settings', adminOnly: true },
];

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const location = useLocation();
  const { isSuperAdmin, signOut } = useAuth();

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || isSuperAdmin
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src={saasValaLogo} alt="SaaS VALA" className="h-8 w-8 rounded-lg object-cover" />
              <span className="font-display text-lg font-bold text-foreground">
                SaaS VALA
              </span>
            </div>
          )}
          {collapsed && (
            <img src={saasValaLogo} alt="SaaS VALA" className="mx-auto h-8 w-8 rounded-lg object-cover" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            const linkContent = (
              <NavLink
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-primary' : ''
                  )}
                />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-2">
          {/* Logout button */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  'text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive'
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
                Logout
              </TooltipContent>
            )}
          </Tooltip>

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              'mt-2 w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
              collapsed && 'px-0'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>

          {/* Powered by */}
          {!collapsed && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Powered by{' '}
              <span className="font-semibold text-primary">SoftwareVala™</span>
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
