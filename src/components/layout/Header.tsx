import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Search, Bell, User, Settings, LogOut, ShoppingCart } from 'lucide-react';
import { WalletHeaderButton } from '@/components/wallet/WalletHeaderButton';
import { useCart } from '@/hooks/useCart';

const pageTitles: Record<string, string> = {
  '/': 'Marketplace',
  '/marketplace': 'Marketplace',
  '/dashboard': 'Dashboard',
  '/products': 'Product Manager',
  '/admin/marketplace': 'Marketplace Admin',
  '/admin/add-product': 'Add Product',
  '/keys': 'Key Management',
  '/servers': 'Server Manager',
  '/ai-chat': 'VALA AI Chat',
  '/saas-ai-dashboard': 'SaaS AI Dashboard',
  '/ai-apis': 'AI API Manager',
  '/vala-builder': 'VALA Builder',
  '/wallet': 'Wallet & Billing',
  '/seo-leads': 'SEO & Lead Manager',
  '/reseller-manager': 'Reseller Manager',
  '/resellers': 'Reseller Manager',
  '/reseller-dashboard': 'Reseller Dashboard',
  '/automation': 'Auto-Pilot & Monitor',
  '/apk-pipeline': 'APK Pipeline',
  '/audit-logs': 'Audit Logs',
  '/system-health': 'System Health',
  '/settings': 'Settings & Security',
  '/education': 'Education Systems',
  '/role-detail': 'Role Configuration',
  '/cart': 'Shopping Cart',
  '/install': 'Install App',
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut, isSuperAdmin } = useAuth();
  const { count: cartCount } = useCart();

  const pageTitle = pageTitles[location.pathname] || 'SaaS VALA';
  const canGoBack = location.pathname !== '/';

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-xl px-6">
      {/* Subtle top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      
      {/* Left section */}
      <div className="flex items-center gap-4">
        {canGoBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            {pageTitle}
          </h1>
          {isSuperAdmin && (
            <Badge variant="outline" className="mt-0.5 text-xs border-primary/30 text-primary bg-primary/5">
              Super Admin
            </Badge>
          )}
          {role === 'reseller' && (
            <Badge variant="outline" className="mt-0.5 text-xs border-secondary/30 text-secondary bg-secondary/5">
              Reseller
            </Badge>
          )}
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            type="search"
            placeholder="Search products, keys, servers..."
            className="pl-10 bg-muted/30 border-border/50 focus:border-primary/50 focus:bg-muted/50 transition-all duration-300"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Cart */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/cart')}
        >
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </Button>

        {/* Wallet */}
        <WalletHeaderButton />

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
            3
          </span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full"
            >
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 hover:ring-primary/40 transition-all duration-300">
                <AvatarImage src="" alt={user?.email || ''} />
                <AvatarFallback className="bg-muted text-foreground font-medium text-sm">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-popover/95 backdrop-blur-xl border-border/50" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {role?.replace('_', ' ')}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}