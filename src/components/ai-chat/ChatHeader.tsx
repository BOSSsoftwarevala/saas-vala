 import { Button } from '@/components/ui/button';
 import { 
   Settings, 
   Share2, 
   Download,
   Sparkles,
   ArrowLeft,
   PanelLeft,
   MoreVertical,
   Trash2,
   Copy,
   History,
   Search,
   Keyboard
 } from 'lucide-react';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
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
   title, 
   onExport, 
   onToggleSidebar, 
   sidebarOpen, 
   onOpenHistory, 
   onClearChat, 
   onOpenSearch, 
   onOpenShortcuts,
   selectedModel = 'google/gemini-3-flash-preview',
   onModelChange,
 }: ChatHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2">
        {!sidebarOpen && onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="h-6 w-px bg-border mx-1" />

        <div className="flex items-center gap-3">
          <img 
            src="/vala-ai-logo.jpg" 
            alt="VALA AI" 
            className="h-8 w-8 rounded-full object-cover"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground">
                VALA AI
              </h1>
             {onModelChange && (
               <ModelSelector
                 selectedModel={selectedModel}
                 onModelChange={onModelChange}
               />
             )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSearch}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="Search (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenHistory}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          title="View History"
        >
          <History className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export Chat
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Copy className="h-4 w-4" />
              Copy All
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={onClearChat}>
              <Trash2 className="h-4 w-4" />
              Clear Chat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onClick={onOpenShortcuts}>
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted">Ctrl+/</kbd>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
