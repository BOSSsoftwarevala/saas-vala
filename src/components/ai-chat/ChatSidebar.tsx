import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  MessageSquare,
  Trash2,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  /** Optional content to render below the sessions list (e.g. chat messages + input). */
  children?: ReactNode;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onToggle,
  children,
}: ChatSidebarProps) {
  const hasChatPanel = Boolean(children);

  // Group sessions by date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groupedSessions = {
    today: sessions.filter((s) => s.createdAt.toDateString() === today.toDateString()),
    yesterday: sessions.filter((s) => s.createdAt.toDateString() === yesterday.toDateString()),
    lastWeek: sessions.filter(
      (s) =>
        s.createdAt > lastWeek &&
        s.createdAt.toDateString() !== today.toDateString() &&
        s.createdAt.toDateString() !== yesterday.toDateString(),
    ),
    older: sessions.filter((s) => s.createdAt <= lastWeek),
  };

  const SessionGroup = ({ title, items }: { title: string; items: ChatSession[] }) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="space-y-1">
          {items.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors',
                activeSessionId === session.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-sm">{session.title}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          'h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 shrink-0',
          isOpen ? 'w-[380px]' : 'w-0 overflow-hidden',
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-sidebar-foreground text-sm truncate">SaaS VALA AI</h2>
              <p className="text-xs text-muted-foreground truncate">Internal Power</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onNewSession} className="w-full gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Sessions List - smaller when chat panel exists */}
          <ScrollArea className={cn(hasChatPanel ? 'shrink-0 max-h-[30vh]' : 'flex-1')}>
            <div className="py-2">
              <SessionGroup title="Today" items={groupedSessions.today} />
              <SessionGroup title="Yesterday" items={groupedSessions.yesterday} />
              <SessionGroup title="Last 7 days" items={groupedSessions.lastWeek} />
              <SessionGroup title="Older" items={groupedSessions.older} />

              {sessions.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-medium">No conversations yet</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat Panel - takes more space */}
          {hasChatPanel && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background border-t border-sidebar-border">
              {children}
            </div>
          )}

          {/* Footer - always at bottom */}
          <div className="shrink-0 p-3 border-t border-sidebar-border bg-sidebar">
            <p className="text-xs text-center text-muted-foreground">
              Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
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

