import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Globe,
  ChevronDown,
  LogIn,
  Users,
  Search,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

const currencies = [
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  { code: 'INR', symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', flag: '🇸🇦', name: 'Saudi Riyal' },
];

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function MarketplaceHeader() {
  const navigate = useNavigate();
  const { user, isReseller } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [applyingReseller, setApplyingReseller] = useState(false);

  const handleApplyReseller = async () => {
    if (!user) {
      navigate('/auth?apply=reseller');
      return;
    }
    setApplyingReseller(true);
    try {
      // Assign reseller role
      await supabase.from('user_roles').upsert(
        { user_id: user.id, role: 'reseller' as any },
        { onConflict: 'user_id,role' }
      );
      // Create reseller record
      await supabase.from('resellers').upsert(
        { user_id: user.id, is_active: true, is_verified: false, commission_percent: 10, credit_limit: 0 },
        { onConflict: 'user_id' }
      );
      // Log activity for admin alert
      await supabase.from('activity_logs').insert({
        entity_type: 'reseller',
        entity_id: user.id,
        action: 'reseller_joined',
        performed_by: user.id,
        details: { email: user.email, name: user.user_metadata?.full_name || 'Unknown' } as any,
      });
      toast.success('🎉 You are now a Reseller! Redirecting to your dashboard...');
      setTimeout(() => navigate('/reseller-dashboard'), 1000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply as reseller');
    } finally {
      setApplyingReseller(false);
    }
  };

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Scroll to products and filter — dispatch custom event
      window.dispatchEvent(new CustomEvent('marketplace-search', { detail: searchQuery.trim() }));
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/90 backdrop-blur-xl border-border">
      <div className="h-full px-4 md:px-8 flex items-center justify-between gap-2">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer shrink-0"
          onClick={() => {
            navigate('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <img
            src={saasValaLogo}
            alt="SaaS VALA"
            className="h-10 w-10 rounded-xl object-cover border border-primary/20"
          />
          <span className="font-display font-bold text-lg text-foreground hidden sm:block">
            SaaS VALA
          </span>
        </div>

        {/* Center — Search Bar (expandable) */}
        <div className="flex-1 max-w-md mx-2 hidden md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search 2000+ software products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-3 h-9 text-sm bg-muted/50 border-border/50 focus:bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); window.dispatchEvent(new CustomEvent('marketplace-search', { detail: '' })); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Renew / Recharge */}
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => navigate('/wallet')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Renew</span>
            </Button>
          )}

          {/* Currency Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2 text-xs">
                <span>{selectedCurrency.flag}</span>
                <span className="hidden sm:inline font-medium">{selectedCurrency.code}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {currencies.map((c) => (
                <DropdownMenuItem
                  key={c.code}
                  className="gap-2 text-sm"
                  onClick={() => setSelectedCurrency(c)}
                >
                  <span>{c.flag}</span>
                  <span>{c.symbol} {c.code}</span>
                  {c.code === selectedCurrency.code && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
                <Globe className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {languages.map((lang) => (
                <DropdownMenuItem key={lang.code} className="gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Apply for Reseller */}
          {!isReseller && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hidden sm:flex"
              onClick={handleApplyReseller}
              disabled={applyingReseller}
            >
              {applyingReseller ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              <span className="hidden lg:inline">{applyingReseller ? 'Joining...' : 'Apply Reseller'}</span>
            </Button>
          )}

          {/* Reseller Panel */}
          {isReseller && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-secondary/30 text-secondary hover:bg-secondary/10"
              onClick={() => navigate('/reseller-dashboard')}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Reseller</span>
            </Button>
          )}

          {/* Auth */}
          {user ? (
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="h-9 w-9">
              <User className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-3 bg-background border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
