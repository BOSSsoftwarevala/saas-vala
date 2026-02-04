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
import { ArrowLeft, Search, Bell, User, Settings, LogOut } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Product Manager',
  '/keys': 'Key Management',
  '/servers': 'Server Manager',
  '/ai-chat': 'SaaS AI Chat',
  '/ai-apis': 'AI API Manager',
  '/wallet': 'Wallet & Billing',
  '/seo-leads': 'SEO & Lead Manager',
  '/settings': 'Settings & Security',
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut, isSuperAdmin } = useAuth();

  const pageTitle = pageTitles[location.pathname] || 'SaaS VALA';
  const canGoBack = location.pathname !== '/';

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6">
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
            <Badge variant="outline" className="mt-0.5 text-xs border-primary/50 text-primary">
              Super Admin
            </Badge>
          )}
          {role === 'reseller' && (
            <Badge variant="outline" className="mt-0.5 text-xs border-secondary/50 text-secondary">
              Reseller
            </Badge>
          )}
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products, keys, servers..."
            className="pl-10 bg-muted/50 border-border focus:border-primary"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
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
              <Avatar className="h-9 w-9 border-2 border-primary/30">
                <AvatarImage src="" alt={user?.email || ''} />
                <AvatarFallback className="bg-muted text-foreground font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-popover border-border" align="end">
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
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
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
