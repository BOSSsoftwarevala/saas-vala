import { ReactNode, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  PanelLeftClose,
  PanelLeft,
  History,
  Cloud,
  Eye,
  Code2,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
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
  isOpen,
  onToggle,
  onOpenHistory,
  children,
}: ChatSidebarProps) {
  const hasChatPanel = Boolean(children);
  const [activeProjectId, setActiveProjectId] = useState<string>('1');
  const [projects, setProjects] = useState<Project[]>(demoProjects);
  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');
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

  return (
    <>
      <div
        className={cn(
          'h-full border-r border-sidebar-border flex flex-col transition-all duration-300 shrink-0',
          isOpen ? 'w-[20%] min-w-[280px]' : 'w-0 overflow-hidden',
        )}
      >
        <TooltipProvider delayDuration={200}>
          {/* Row 1: Action Icons */}
          <div className="h-9 flex items-center justify-between gap-1 px-3 border-b border-sidebar-border/50 shrink-0">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onOpenHistory} className="h-6 w-6 rounded text-muted-foreground hover:text-foreground">
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">History</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded text-muted-foreground hover:text-foreground">
                    <Cloud className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Cloud</TooltipContent>
              </Tooltip>

            <div className="w-px h-4 bg-border" />

            {/* Preview/Code Toggle */}
            <div className="flex items-center bg-muted/50 rounded-md p-0.5">
              <button
                onClick={() => setActiveView('preview')}
                className={cn(
                  "h-6 px-2 rounded text-[10px] flex items-center gap-1 transition-all",
                  activeView === 'preview' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
              <button
                onClick={() => setActiveView('code')}
                className={cn(
                  "h-6 px-2 rounded text-[10px] flex items-center gap-1 transition-all",
                  activeView === 'code' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Code2 className="h-3 w-3" />
                Code
              </button>
            </div>

            <div className="w-px h-4 bg-border" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem>Export</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Clear</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>

            <Button variant="ghost" size="icon" onClick={onToggle} className="h-6 w-6 rounded text-muted-foreground hover:text-foreground">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Row 2: Project Icons (scrollable) */}
          <div className="h-11 flex items-center px-3 gap-1.5 border-b border-sidebar-border shrink-0">
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
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-sidebar scale-110"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      )}
                    >
                      {getInitial(project.name)}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="flex items-center gap-1">
                      {project.isActive && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
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
                <TooltipContent side="bottom" className="text-xs">Add Project</TooltipContent>
              </Tooltip>
            </div>

            {canScrollRight && (
              <button onClick={() => scroll('right')} className="h-7 w-7 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </TooltipProvider>

        {/* Chat Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {hasChatPanel && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-background">
              {children}
            </div>
          )}

          <div className="shrink-0 py-2 px-3 border-t border-sidebar-border">
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

