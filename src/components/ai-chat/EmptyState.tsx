import { Sparkles, Upload, Server, Wrench } from 'lucide-react';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const capabilities = [
    {
      icon: Upload,
      title: 'Unlimited Source Upload',
      description: 'Accept any size code - ZIP, PHP, JS, mixed projects'
    },
    {
      icon: Wrench,
      title: 'Auto Fix & Upgrade',
      description: 'AI-powered code analysis, fixing, and modernization'
    },
    {
      icon: Server,
      title: 'One-Click Deploy',
      description: 'Auto deploy to any server without developer needed'
    }
  ];

  const suggestions = [
    'Upload a new source code project',
    'Analyze and fix my PHP application',
    'Deploy my project to a client server',
    'Add payment integration to my app'
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-12rem)]">
      {/* Logo & Title */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-6 border border-primary/20">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">
          SaaS VALA AI
        </h1>
        <p className="text-muted-foreground flex items-center justify-center gap-2 text-lg">
          Internal Power Version
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Better than Lovable • No Limits • No Developer Required
        </p>
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mb-10">
        {capabilities.map((cap, index) => (
          <div
            key={index}
            className="p-5 rounded-xl bg-muted/30 border border-border hover:border-primary/30 transition-colors"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
              <cap.icon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">{cap.title}</h3>
            <p className="text-sm text-muted-foreground">{cap.description}</p>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="max-w-2xl w-full">
        <p className="text-sm text-muted-foreground mb-4 text-center font-medium">Try asking:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion)}
              className="p-4 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-primary/30 text-left text-sm text-foreground transition-all duration-200 group"
            >
              <span className="group-hover:text-primary transition-colors">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
      </p>
    </div>
  );
}
