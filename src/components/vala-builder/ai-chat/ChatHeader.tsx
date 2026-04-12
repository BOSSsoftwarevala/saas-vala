import { Button } from '@/components/ui/button';
import { PanelLeft, Brain } from 'lucide-react';
import { ModelSelector } from './ModelSelector';

interface ChatHeaderProps {
  title: string;
  onExport?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onOpenHistory?: () => void;
  onClearChat?: () => void;
  onOpenSearch?: () => void;
  onOpenShortcuts?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onOpenMemory?: () => void;
}

export function ChatHeader({ 
  onToggleSidebar, 
  sidebarOpen,
  selectedModel = 'google/gemini-3-flash-preview',
  onModelChange,
  onOpenMemory,
}: ChatHeaderProps) {

  return (
    <header className="h-12 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        {!sidebarOpen && onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-2">
          <img 
            src="/vala-ai-logo.jpg" 
            alt="VALA AI" 
            className="h-7 w-7 rounded-full object-cover"
          />
          <div>
            <h1 className="text-sm font-semibold text-foreground">VALA AI</h1>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {onOpenMemory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenMemory}
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10"
            title="Persistent Memory System"
          >
            <Brain className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Memory</span>
          </Button>
        )}
        {onModelChange && (
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
          />
        )}
      </div>
    </header>
  );
}
