import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  Gift,
  Settings,
  RefreshCcw,
  Pencil,
  Star,
  FolderOpen,
  Clock,
  Moon,
  HelpCircle,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ProjectMenuProps {
  projectName?: string;
  credits?: number;
  maxCredits?: number;
}

export function ProjectMenu({ 
  projectName = "VALA AI Project", 
  credits = 150, 
  maxCredits = 200 
}: ProjectMenuProps) {
  const [isStarred, setIsStarred] = useState(false);
  const navigate = useNavigate();
  const creditPercent = (credits / maxCredits) * 100;

  const handleGetFreeCredits = () => {
    toast.success('🎁 Free credits coming soon!', {
      description: 'Referral program launching next week'
    });
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleRemix = () => {
    toast.info('Remix feature', {
      description: 'This will create a copy of your project'
    });
  };

  const handleRename = () => {
    toast.info('Rename project', {
      description: 'Project renaming will be available soon'
    });
  };

  const handleStar = () => {
    setIsStarred(!isStarred);
    toast.success(isStarred ? 'Project unstarred' : '⭐ Project starred!');
  };

  const handleMoveToFolder = () => {
    toast.info('Move to folder', {
      description: 'Folder organization coming soon'
    });
  };

  const handleBonuses = () => {
    toast.success('🎉 Bonuses', {
      description: 'Check your bonus rewards!'
    });
  };

  const handleAppearance = () => {
    toast.info('Appearance', {
      description: 'Theme settings coming soon'
    });
  };

  const handleHelp = () => {
    window.open('https://softwarevala.com/help', '_blank');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="gap-1 px-2 h-8 text-sm font-medium hover:bg-muted"
        >
          {projectName}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {/* Credits Section */}
        <div className="px-3 py-3 bg-muted/50 rounded-md mx-2 my-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Credits</span>
            <button className="flex items-center gap-1 text-sm text-primary hover:underline">
              {credits} left
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <Progress value={creditPercent} className="h-2 mb-2" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            Using monthly credits
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleGetFreeCredits} className="gap-3 py-2.5">
          <Gift className="h-4 w-4 text-primary" />
          <span>Get free credits</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSettings} className="gap-3 py-2.5">
          <Settings className="h-4 w-4" />
          <span>Settings</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Ctrl.</kbd>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleRemix} className="gap-3 py-2.5">
          <RefreshCcw className="h-4 w-4" />
          <span>Remix this project</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleRename} className="gap-3 py-2.5">
          <Pencil className="h-4 w-4" />
          <span>Rename project</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleStar} className="gap-3 py-2.5">
          <Star className={`h-4 w-4 ${isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          <span>{isStarred ? 'Unstar project' : 'Star project'}</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleMoveToFolder} className="gap-3 py-2.5">
          <FolderOpen className="h-4 w-4" />
          <span>Move to folder</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleBonuses} className="gap-3 py-2.5">
          <Clock className="h-4 w-4" />
          <span>Bonuses</span>
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">New</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleAppearance} className="gap-3 py-2.5">
          <Moon className="h-4 w-4" />
          <span>Appearance</span>
          <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleHelp} className="gap-3 py-2.5">
          <HelpCircle className="h-4 w-4" />
          <span>Help</span>
          <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
