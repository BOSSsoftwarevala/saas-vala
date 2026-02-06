import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
}

export function ChatHeader({ 
  onToggleSidebar, 
  sidebarOpen,
  selectedModel = 'google/gemini-3-flash-preview',
  onModelChange,
}: ChatHeaderProps) {
  const navigate = useNavigate();

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

      {/* Right - Model Selector */}
      <div className="flex items-center gap-2">
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
