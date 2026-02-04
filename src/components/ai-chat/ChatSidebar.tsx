import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  collapsed,
  onToggleCollapse,
}: ChatSidebarProps) {
  return (
    <aside
      className={cn(
        'h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-sidebar-border">
        <Button
          onClick={onNewChat}
          className={cn(
            'w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 gap-2',
            collapsed && 'px-0'
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>New Chat</span>}
        </Button>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            
            return (
              <div
                key={session.id}
                className={cn(
                  'group relative rounded-lg transition-all duration-200',
                  isActive 
                    ? 'bg-sidebar-accent' 
                    : 'hover:bg-sidebar-accent/50'
                )}
              >
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    'w-full text-left p-3 flex items-start gap-3',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  <MessageSquare 
                    className={cn(
                      'h-4 w-4 shrink-0 mt-0.5',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )} 
                  />
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium truncate',
                        isActive ? 'text-foreground' : 'text-sidebar-foreground'
                      )}>
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {session.preview}
                      </p>
                    </div>
                  )}
                </button>

                {/* Actions */}
                {!collapsed && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={() => onDeleteSession(session.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className={cn(
            'w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
            collapsed && 'px-0'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>

        {!collapsed && (
          <div className="mt-3 px-2 py-2 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">SaaS VALA AI</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Powered by SoftwareVala™
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
