import { useNavigate } from 'react-router-dom';
import { MessageSquare, Home, Bell, MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';

export function SupportWorkspaceSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = (user?.user_metadata?.full_name || 'SV').slice(0, 2).toUpperCase();

  const items = [
    { icon: Home, label: 'Back to Dashboard', action: () => navigate('/dashboard') },
    { icon: MessageSquare, label: 'Messages', action: () => {}, active: true },
    { icon: Bell, label: 'Notifications', action: () => {} },
    { icon: MoreHorizontal, label: 'More', action: () => {} },
  ];

  return (
    <div className="w-[68px] flex-shrink-0 bg-[hsl(215,72%,6%)] flex flex-col items-center py-3 gap-2 border-r border-white/5">
      {/* Workspace avatar */}
      <button
        onClick={() => navigate('/dashboard')}
        className="w-9 h-9 rounded-lg bg-gradient-to-br from-[hsl(215,65%,45%)] to-[hsl(270,60%,50%)] flex items-center justify-center text-white font-bold text-sm mb-3 hover:opacity-90 transition-opacity"
      >
        SV
      </button>

      <div className="w-8 h-px bg-white/10 mb-1" />

      {/* Nav items */}
      {items.map((item, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <button
              onClick={item.action}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                item.active
                  ? 'bg-[hsl(215,65%,32%)] text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              )}
            >
              <item.icon className="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      {/* New message */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="w-10 h-10 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all">
            <Plus className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">New Message</TooltipContent>
      </Tooltip>

      {/* User avatar */}
      <div className="w-9 h-9 rounded-lg bg-[hsl(215,65%,32%)] flex items-center justify-center text-white text-xs font-semibold mt-1 cursor-pointer hover:ring-2 hover:ring-white/30 transition-all">
        {initials}
      </div>
    </div>
  );
}
