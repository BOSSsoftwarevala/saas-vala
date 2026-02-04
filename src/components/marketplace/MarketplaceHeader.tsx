import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  User, 
  Globe,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function MarketplaceHeader() {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        {/* Left - Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/marketplace')}
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

        {/* Center - Title */}
        <h1 className="absolute left-1/2 -translate-x-1/2 font-display font-semibold text-foreground text-sm md:text-base">
          ALL SOFTWARE
        </h1>

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

          {/* Wallet */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 px-2"
            onClick={() => navigate('/wallet')}
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">₹0</span>
          </Button>

          {/* Profile */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/settings')}
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
