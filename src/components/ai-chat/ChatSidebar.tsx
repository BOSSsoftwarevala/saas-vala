import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  messages: any[];
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function ChatSidebar({
  isOpen,
  onToggle,
  children,
}: ChatSidebarProps) {
  const hasChatPanel = Boolean(children);

  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          'h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 shrink-0',
          isOpen ? 'w-[380px]' : 'w-0 overflow-hidden',
        )}
      >
        {/* Header - minimal */}
        <div className="p-3 border-b border-sidebar-border flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Body - Clean, only chat panel */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Chat Panel - full space */}
          {hasChatPanel && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background">
              {children}
            </div>
          )}

          {/* Footer */}
          <div className="shrink-0 py-2 px-3 border-t border-sidebar-border bg-sidebar">
            <p className="text-[10px] text-center text-muted-foreground">
              Powered by <span className="font-medium text-primary">SoftwareVala™</span>
            </p>
          </div>
        </div>
      </div>

      {/* Toggle Button (when sidebar is closed) */}
      {!isOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 h-10 w-10 bg-background border border-border shadow-lg hover:bg-muted"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      )}
    </>
  );
}

