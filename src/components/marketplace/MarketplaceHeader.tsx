import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Globe,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const navLinks = [
  { label: 'Marketplace', target: 'marketplace-top' },
  { label: 'Pricing', target: 'pricing' },
  { label: 'Demo', target: 'demo' },
  { label: 'Contact', target: 'contact' },
];

export function MarketplaceHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const scrollToSection = (target: string) => {
    // If not on marketplace page, navigate there first
    if (location.pathname !== '/') {
      navigate('/');
      // Wait for navigation then scroll
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
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handle hash on mount
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [location.hash]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b" style={{ background: 'rgba(11,16,32,0.92)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        {/* Left - Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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

        {/* Center - Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => scrollToSection(link.target)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
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

          {/* Login / Profile */}
          {user ? (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
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
