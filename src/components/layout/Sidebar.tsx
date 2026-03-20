import { NavLink, useLocation } from 'react-router-dom';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  Key,
  Server,
  Cpu,
  Wallet,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
  Store,
  Bot,
  Rocket,
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
  { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { title: 'Products', icon: Package, href: '/products' },
  { title: 'Keys', icon: Key, href: '/keys' },
  { title: 'Servers', icon: Server, href: '/servers' },
  { title: 'SaaS AI', icon: Cpu, href: '/saas-ai-dashboard' },
  { title: 'Builder + APK Pipeline', icon: Rocket, href: '/ai-chat' },
  { title: 'AI APIs', icon: Bot, href: '/ai-apis', adminOnly: true },
  { title: 'Auto-Pilot', icon: Bot, href: '/automation', adminOnly: true },
  { title: 'Wallet', icon: Wallet, href: '/wallet' },
  { title: 'SEO & Leads', icon: TrendingUp, href: '/seo-leads' },
  { title: 'Reseller Management', icon: Users, href: '/resellers', adminOnly: true },
  { title: 'Marketplace Admin', icon: Store, href: '/admin/marketplace', adminOnly: true },
  { title: 'Settings', icon: Settings, href: '/settings', adminOnly: true },
];

export function Sidebar() {
  const { collapsed, toggle } = useSidebarState();
  const location = useLocation();
  const { isSuperAdmin, signOut } = useAuth();

  const blockedNavPaths = new Set(['/marketplace', '/audit-logs', '/system-health', '/apk-pipeline', '/vala-builder']);

  const filteredNavItems = navItems.filter(
    (item) => (!item.adminOnly || isSuperAdmin) && !blockedNavPaths.has(item.href)
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border transition-all duration-300 overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{
        background: 'linear-gradient(180deg, hsl(215, 72%, 12%) 0%, hsl(215, 75%, 8%) 100%)',
      }}
    >
      {/* Subtle ambient glow on sidebar */}
      <div 
        className="absolute top-0 left-0 w-full h-32 pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, hsl(215, 80%, 60%, 0.15) 0%, transparent 70%)',
        }}
      />

      <div className="flex h-full flex-col relative z-10">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border/50 px-4">
          {!collapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="relative">
                <img src={saasValaLogo} alt="SaaS VALA" className="h-8 w-8 rounded-lg object-cover ring-1 ring-primary/20" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-sidebar" />
              </div>
              <span className="font-display text-lg font-bold text-white tracking-tight">
                SaaS VALA
              </span>
            </motion.div>
          )}
          {collapsed && (
            <div className="relative mx-auto">
              <img src={saasValaLogo} alt="SaaS VALA" className="h-8 w-8 rounded-lg object-cover ring-1 ring-primary/20" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-sidebar" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            const linkContent = (
              <NavLink
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative group',
                  isActive
                    ? 'text-white font-bold'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
                style={isActive ? { background: 'hsl(215, 65%, 32%)' } : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                    style={{
                      background: 'linear-gradient(180deg, #5B9BFF, #3B7BFF)',
                      boxShadow: '0 0 12px rgba(91, 155, 255, 0.6)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-colors duration-200',
                      isActive ? 'text-white' : 'text-white/70 group-hover:text-white'
                    )}
                  />
                </motion.div>
                
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.title}
                    </motion.span>
                  )}
                </AnimatePresence>
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
        <div className="border-t border-sidebar-border/50 p-2">
          {/* Logout button */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={signOut}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  'text-white/70 hover:bg-red-500/15 hover:text-red-400'
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </motion.button>
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
              'mt-2 w-full justify-center text-white/70 hover:bg-white/10 hover:text-white',
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
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-center text-xs text-white/40"
              >
                Powered by{' '}
                <span className="font-semibold text-gradient-primary">SoftwareVala™</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}