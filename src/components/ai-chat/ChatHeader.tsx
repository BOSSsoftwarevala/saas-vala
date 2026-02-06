import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  History,
  Cloud,
  Eye,
  Code2,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Download,
  Settings,
  Trash2,
  Copy,
  Keyboard
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  color: string;
  isActive?: boolean;
}

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

// Demo projects - active projects first
const demoProjects: Project[] = [
  { id: '1', name: 'PHP Project', color: 'bg-blue-500', isActive: true },
  { id: '2', name: 'React App', color: 'bg-green-500', isActive: true },
  { id: '3', name: 'Node API', color: 'bg-purple-500', isActive: false },
  { id: '4', name: 'Python ML', color: 'bg-orange-500', isActive: false },
  { id: '5', name: 'Vue Dashboard', color: 'bg-cyan-500', isActive: false },
];

export function ChatHeader({ 
  onExport, 
  onOpenHistory, 
  onClearChat, 
  onOpenShortcuts,
}: ChatHeaderProps) {
  const [activeProjectId, setActiveProjectId] = useState<string>('1');
  const [projects, setProjects] = useState<Project[]>(demoProjects);
  const [activeView, setActiveView] = useState<'preview' | 'code'>('preview');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sort projects: active first, then others
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return 0;
  });

  // Check scroll capability
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
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
    };
  }, [projects]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
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

  const getProjectInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
      <TooltipProvider delayDuration={200}>
        {/* Top Row - Action Icons */}
        <div className="h-10 flex items-center justify-center gap-1 px-4 border-b border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenHistory}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">History</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Cloud className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Cloud</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Preview/Code Toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView('preview')}
              className={cn(
                "h-7 px-3 rounded-md text-xs gap-1.5",
                activeView === 'preview' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView('code')}
              className={cn(
                "h-7 px-3 rounded-md text-xs gap-1.5",
                activeView === 'code' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              Code
            </Button>
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
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
                Shortcuts
                <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted">Ctrl+/</kbd>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Bottom Row - Project Icons (scrollable) */}
        <div className="h-11 flex items-center px-2 gap-1">
          {/* Scroll Left */}
          {canScrollLeft && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => scroll('left')}
              className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Projects Container */}
          <div 
            ref={scrollRef}
            className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {sortedProjects.map((project) => (
              <Tooltip key={project.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveProjectId(project.id)}
                    className={cn(
                      "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold transition-all",
                      project.color,
                      activeProjectId === project.id
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105"
                        : "opacity-80 hover:opacity-100 hover:scale-105",
                      project.isActive && "shadow-md"
                    )}
                  >
                    {getProjectInitial(project.name)}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="flex items-center gap-1.5">
                    {project.isActive && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                    {project.name}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Add Project */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleAddProject}
                  className="shrink-0 h-8 w-8 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Add Project</TooltipContent>
            </Tooltip>
          </div>

          {/* Scroll Right */}
          {canScrollRight && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => scroll('right')}
              className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TooltipProvider>
    </header>
  );
}
