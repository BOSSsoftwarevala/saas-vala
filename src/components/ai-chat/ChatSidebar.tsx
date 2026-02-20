import { ReactNode, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  PanelLeftClose,
  PanelLeft,
  History,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  messages: any[];
}

interface Project {
  id: string;
  name: string;
  color: string;
  isActive?: boolean;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenHistory?: () => void;
  onClearChat?: () => void;
  onExport?: () => void;
  children?: ReactNode;
}

// Demo projects
const demoProjects: Project[] = [
  { id: '1', name: 'PHP Project', color: 'bg-blue-500', isActive: true },
  { id: '2', name: 'React App', color: 'bg-green-500', isActive: true },
  { id: '3', name: 'Node API', color: 'bg-purple-500', isActive: false },
  { id: '4', name: 'Python ML', color: 'bg-orange-500', isActive: false },
];

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onToggle,
  onOpenHistory,
  onClearChat,
  onExport,
  children,
}: ChatSidebarProps) {
  const hasChatPanel = Boolean(children);
  const [activeProjectId, setActiveProjectId] = useState<string>('1');
  const [projects, setProjects] = useState<Project[]>(demoProjects);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return 0;
  });

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
      }
    };
    checkScroll();
    scrollRef.current?.addEventListener('scroll', checkScroll);
    return () => scrollRef.current?.removeEventListener('scroll', checkScroll);
  }, [projects]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -100 : 100,
        behavior: 'smooth'
      });
    }
  };

  const handleAddProject = () => {
    const colors = ['bg-pink-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-red-500'];
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `Project ${projects.length + 1}`,
      color: colors[projects.length % colors.length],
      isActive: true,
    };
    setProjects([...projects, newProject]);
    setActiveProjectId(newProject.id);
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const formatTime = (date: Date) => {
    try {
      const d = date instanceof Date ? date : new Date(date);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <>
      <div
        className={cn(
          'h-full border-r border-border flex flex-col transition-all duration-300 shrink-0 bg-background',
          isOpen ? 'w-[20%] min-w-[280px]' : 'w-0 overflow-hidden',
        )}
      >
        <TooltipProvider delayDuration={200}>
          {/* Row 1: Action Icons */}
          <div className="h-9 flex items-center justify-between gap-1 px-3 border-b border-border/50 shrink-0 bg-muted/30">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onOpenHistory} className="h-6 w-6 rounded text-muted-foreground hover:text-foreground">
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-popover text-popover-foreground border">History</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-border" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => window.location.reload()}
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-popover text-popover-foreground border">Refresh</TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-border" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 bg-popover border z-50">
                  <DropdownMenuItem onClick={onExport}>Export</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={onClearChat}>Clear</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6 rounded text-muted-foreground hover:text-foreground">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Row 2: Project Icons (scrollable) */}
          <div className="h-11 flex items-center px-3 gap-1.5 border-b border-border shrink-0 bg-muted/20">
            {canScrollLeft && (
              <button onClick={() => scroll('left')} className="h-7 w-7 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div 
              ref={scrollRef}
              className="flex-1 flex items-center gap-2 overflow-x-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {sortedProjects.map((project) => (
                <Tooltip key={project.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveProjectId(project.id)}
                      className={cn(
                        "shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all shadow-sm",
                        project.color,
                        activeProjectId === project.id
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      )}
                    >
                      {getInitial(project.name)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs bg-popover text-popover-foreground border">
                    <div className="flex items-center gap-1">
                      {project.isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                      {project.name}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleAddProject}
                    className="shrink-0 h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-all"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs bg-popover text-popover-foreground border">Add Project</TooltipContent>
              </Tooltip>
            </div>

            {canScrollRight && (
              <button onClick={() => scroll('right')} className="h-7 w-7 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </TooltipProvider>

        {/* Session list + footer */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* New Chat button */}
          <div className="px-3 pt-3 pb-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewSession}
              className="w-full h-8 text-xs gap-1.5 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </Button>
          </div>

          {/* Chat sessions list */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-30" />
                <p>No chats yet</p>
                <p className="opacity-60 mt-0.5">Start a new conversation</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-xs',
                    activeSessionId === session.id
                      ? 'bg-primary/10 text-foreground border border-primary/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <MessageSquare className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    activeSessionId === session.id ? 'text-primary' : 'text-muted-foreground/60'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium leading-tight">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {session.messages.length} msg · {formatTime(session.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Extra children (if any) */}
          {hasChatPanel && (
            <div className="shrink-0 min-h-0 overflow-hidden flex flex-col bg-background">
              {children}
            </div>
          )}

          <div className="shrink-0 py-2 px-3 border-t border-border bg-muted/20">
            <p className="text-[10px] text-center text-muted-foreground">
              Powered by <span className="font-medium text-primary">SoftwareVala™</span>
            </p>
          </div>
        </div>
      </div>

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
