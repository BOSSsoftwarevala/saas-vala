import { Bot, Sparkles, Zap, Shield, Code } from 'lucide-react';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const capabilities = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Get instant answers to your platform questions'
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your conversations are encrypted and private'
    },
    {
      icon: Code,
      title: 'Smart Assistance',
      description: 'Help with products, keys, servers, and more'
    }
  ];

  const suggestions = [
    'How do I generate a new license key?',
    'Show me my server deployment status',
    'Help me understand my revenue analytics',
    'What are the best SEO practices for my product?'
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Logo & Title */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          SaaS VALA AI
        </h1>
        <p className="text-muted-foreground flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Your intelligent platform assistant
        </p>
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mb-8">
        {capabilities.map((cap, index) => (
          <div
            key={index}
            className="p-4 rounded-xl bg-muted/30 border border-border text-center"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mb-3">
              <cap.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{cap.title}</h3>
            <p className="text-xs text-muted-foreground">{cap.description}</p>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="max-w-2xl w-full">
        <p className="text-sm text-muted-foreground mb-3 text-center">Try asking:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion)}
              className="p-3 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-primary/30 text-left text-sm text-foreground transition-all duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
      </p>
    </div>
  );
}
