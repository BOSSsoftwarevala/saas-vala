import { Sparkles, Upload, Server, Wrench, Zap, Shield, Code, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const navigate = useNavigate();
  const capabilities = [
    {
      icon: Upload,
      title: 'Unlimited Upload',
      description: 'Any size ZIP, PHP, JS projects'
    },
    {
      icon: Wrench,
      title: 'Auto Fix',
      description: 'AI-powered code analysis & repair'
    },
    {
      icon: Server,
      title: 'One-Click Deploy',
      description: 'Deploy without a developer'
    },
    {
      icon: Zap,
      title: 'Addon Integration',
      description: 'Payments, wallets, language packs'
    },
    {
      icon: Shield,
      title: 'Security Scan',
      description: 'Malware & backdoor detection'
    },
    {
      icon: Code,
      title: 'Smart Upgrade',
      description: 'Modernize legacy code safely'
    }
  ];

  const suggestions = [
    'Help me upload and analyze my PHP project',
    'Deploy my application to a client server',
    'Scan my source code for security issues',
    'Add payment integration to my SaaS app'
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 min-h-[calc(100vh-8rem)]">
      {/* Logo & Title */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent mb-6 border border-primary/20 shadow-lg shadow-primary/10">
          <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-primary" />
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
          SaaS VALA AI
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">
          Internal Power Version
        </p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Better than Lovable • No File Limits • No Developer Required
        </p>
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mb-8">
        {capabilities.map((cap, index) => (
          <div
            key={index}
            className="p-4 rounded-xl bg-muted/20 border border-border hover:border-primary/30 hover:bg-muted/30 transition-all group"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
              <cap.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{cap.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{cap.description}</p>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="w-full max-w-2xl">
        <p className="text-sm text-muted-foreground mb-3 text-center font-medium">Try asking:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion)}
              className="p-3 md:p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border hover:border-primary/30 text-left text-sm text-foreground transition-all duration-200 group"
            >
              <span className="group-hover:text-primary transition-colors">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Button */}
      <Button 
        variant="outline" 
        onClick={() => navigate('/saas-ai-dashboard')}
        className="mt-6 gap-2"
      >
        <LayoutDashboard className="h-4 w-4" />
        Open Project Dashboard
      </Button>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
      </p>
    </div>
  );
}
