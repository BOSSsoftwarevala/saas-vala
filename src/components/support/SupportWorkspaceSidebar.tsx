import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, MoreHorizontal, Plus, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';

export function SupportWorkspaceSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = (user?.user_metadata?.full_name || user?.email || 'SV').slice(0, 2).toUpperCase();

  const topItems = [
    { icon: Home, label: 'Home', action: () => {}, active: false },
    { icon: MessageSquare, label: 'DMs', action: () => {}, active: true },
    { icon: Compass, label: 'Activity', action: () => {} },
    { icon: MoreHorizontal, label: 'More', action: () => {} },
  ];

  return (
    <div className="w-[70px] flex-shrink-0 flex flex-col items-center py-2 gap-1" style={{ background: '#1a0037' }}>
      {/* Workspace icon */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-white font-extrabold text-[15px] mb-1 hover:opacity-80 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #611f69, #4a154b)' }}
          >
            SV
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">Back to Dashboard</TooltipContent>
      </Tooltip>

      <div className="w-[32px] h-px bg-white/20 my-1" />

      {/* Nav items */}
      {topItems.map((item, i) => (
        <Tooltip key={i} delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={item.action}
              className={cn(
                'w-[36px] h-[36px] rounded-[8px] flex flex-col items-center justify-center transition-all gap-0',
                item.active
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">{item.label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      {/* Create new */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all mb-1">
            <Plus className="h-[20px] w-[20px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">Create New</TooltipContent>
      </Tooltip>

      {/* User avatar */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-white text-[12px] font-bold cursor-pointer hover:ring-2 hover:ring-white/40 transition-all relative" style={{ background: '#4a154b' }}>
            {initials}
            <span className="absolute bottom-0 right-0 w-[10px] h-[10px] bg-[#2bac76] rounded-full border-2" style={{ borderColor: '#1a0037' }} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">Profile</TooltipContent>
      </Tooltip>
    </div>
  );
}
