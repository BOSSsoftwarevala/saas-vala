 import { useState } from 'react';
 import { NavLink, useLocation } from 'react-router-dom';
 import { cn } from '@/lib/utils';
 import { useAuth } from '@/hooks/useAuth';
 import {
   LayoutDashboard,
   Key,
   Users,
   Wallet,
   Share2,
   Lock,
   ChevronLeft,
   ChevronRight,
   LogOut,
 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import saasValaLogo from '@/assets/saas-vala-logo.jpg';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 
 interface NavItem {
   title: string;
   icon: React.ComponentType<{ className?: string }>;
   href: string;
 }
 
 const resellerNavItems: NavItem[] = [
   { title: 'Dashboard', icon: LayoutDashboard, href: '/reseller-dashboard' },
   { title: 'Generate Keys', icon: Key, href: '/reseller-dashboard?tab=keys' },
   { title: 'My Clients', icon: Users, href: '/reseller-dashboard?tab=clients' },
   { title: 'Add Balance', icon: Wallet, href: '/reseller-dashboard?tab=wallet' },
   { title: 'Refer & Earn', icon: Share2, href: '/reseller-dashboard?tab=referral' },
   { title: 'Change Password', icon: Lock, href: '/reseller-dashboard?tab=password' },
 ];
 
 export function ResellerSidebar() {
   const [collapsed, setCollapsed] = useState(false);
   const location = useLocation();
   const { signOut } = useAuth();
 
   const isActive = (href: string) => {
     if (href === '/reseller-dashboard' && !location.search) return true;
     return location.pathname + location.search === href;
   };
 
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
               <div>
                 <span className="font-display text-lg font-bold text-foreground">SaaS VALA</span>
                 <span className="ml-2 text-xs text-secondary font-medium">Reseller</span>
               </div>
             </div>
           )}
           {collapsed && (
             <img src={saasValaLogo} alt="SaaS VALA" className="mx-auto h-8 w-8 rounded-lg object-cover" />
           )}
         </div>
 
         {/* Navigation */}
         <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
           {resellerNavItems.map((item) => {
             const active = isActive(item.href);
             const Icon = item.icon;
 
             const linkContent = (
               <NavLink
                 to={item.href}
                 className={cn(
                   'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                   active
                     ? 'bg-sidebar-accent text-primary'
                     : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                 )}
               >
                 <Icon
                   className={cn(
                     'h-5 w-5 shrink-0',
                     active ? 'text-primary' : ''
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
             onClick={() => setCollapsed(!collapsed)}
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