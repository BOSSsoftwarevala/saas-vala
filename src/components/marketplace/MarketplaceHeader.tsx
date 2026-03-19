import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  User,
  Globe,
  ChevronDown,
  LogIn,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

interface HeaderMenuItem {
  id: string;
  label: string;
  target_id: string | null;
  link_url: string | null;
  sort_order: number;
}

const fallbackLinks: HeaderMenuItem[] = [
  { id: 'f1', label: 'Marketplace', target_id: 'marketplace-top', link_url: '#marketplace-top', sort_order: 1 },
  { id: 'f2', label: 'Pricing', target_id: 'pricing', link_url: '#pricing', sort_order: 2 },
  { id: 'f3', label: 'Demo', target_id: 'demo', link_url: '#demo', sort_order: 3 },
  { id: 'f4', label: 'Contact', target_id: 'contact', link_url: '#contact', sort_order: 4 },
];

export function MarketplaceHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isSuperAdmin } = useAuth();
  const [menuLinks, setMenuLinks] = useState<HeaderMenuItem[]>(fallbackLinks);

  useEffect(() => {
    const loadMenus = async () => {
      const { data } = await (supabase as any)
        .from('marketplace_header_menus')
        .select('id, label, target_id, link_url, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (data && data.length > 0) setMenuLinks(data as HeaderMenuItem[]);
    };

    loadMenus();

    const channel = supabase
      .channel('marketplace-header-menu-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_header_menus' }, loadMenus)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const scrollToSection = (target: string) => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(target);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return;
    }

    if (target === 'marketplace-top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const el = document.getElementById(target);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleMenuClick = (item: HeaderMenuItem) => {
    const link = item.link_url || '';

    if (link.startsWith('http')) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }

    if (link.startsWith('/')) {
      navigate(link);
      return;
    }

    if (link.startsWith('#')) {
      scrollToSection(link.slice(1));
      return;
    }

    if (item.target_id) {
      scrollToSection(item.target_id);
      return;
    }

    scrollToSection('marketplace-top');
  };

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;

    setTimeout(() => {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  }, [location.hash]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/90 backdrop-blur-xl border-border">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
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

        <nav className="hidden md:flex items-center gap-6">
          {menuLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleMenuClick(link)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">🇺🇸</span>
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

          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/admin/marketplace')}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Manage</span>
            </Button>
          )}

          {user ? (
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
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
    </header>
  );
}
