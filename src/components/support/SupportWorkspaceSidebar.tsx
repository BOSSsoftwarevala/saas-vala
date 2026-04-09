import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Bell, MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';

export function SupportWorkspaceSidebar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = (user?.user_metadata?.full_name || user?.email || 'SV').slice(0, 2).toUpperCase();

  const topItems = [
    { icon: Home, label: 'Home', action: () => {}, active: true },
    { icon: MessageSquare, label: 'DMs', action: () => {}, active: false },
    { icon: Bell, label: 'Activity', action: () => {} },
    { icon: MoreHorizontal, label: 'More', action: () => {} },
  ];

  return (
    <div className="w-[68px] flex-shrink-0 flex flex-col items-center py-[10px] gap-[2px]" style={{ background: '#3F0E40' }}>
      {/* Workspace icon */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-white font-[900] text-[18px] mb-[6px] hover:opacity-90 transition-opacity shadow-md"
            style={{ background: 'linear-gradient(135deg, #611f69 0%, #4a154b 100%)' }}
          >
            S
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-semibold bg-black text-white border-0 shadow-xl">SaasVala Support</TooltipContent>
      </Tooltip>

      <div className="w-[32px] h-[1px] bg-white/20 my-[6px]" />

      {/* Nav items */}
      {topItems.map((item, i) => (
        <Tooltip key={i} delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={item.action}
              className={cn(
                'w-[36px] h-[36px] rounded-[8px] flex flex-col items-center justify-center transition-all relative',
                item.active
                  ? 'bg-[#4A154B]/80 text-white'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/10'
              )}
            >
              <item.icon className="h-[20px] w-[20px]" strokeWidth={item.active ? 2.2 : 1.8} />
              <span className="text-[10px] mt-[1px] font-medium leading-none">{item.label}</span>
              {item.active && (
                <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-[3px] h-[20px] rounded-r-full bg-white" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-semibold bg-black text-white border-0 shadow-xl">{item.label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      {/* Create new */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all mb-[6px]">
            <Plus className="h-[20px] w-[20px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-semibold bg-black text-white border-0 shadow-xl">Create</TooltipContent>
      </Tooltip>

      {/* User avatar */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-white text-[13px] font-bold cursor-pointer hover:ring-2 hover:ring-white/30 transition-all relative" style={{ background: '#1264A3' }}>
            {initials}
            <span className="absolute bottom-[-1px] right-[-1px] w-[10px] h-[10px] bg-[#2BAC76] rounded-full border-[2px]" style={{ borderColor: '#3F0E40' }} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-semibold bg-black text-white border-0 shadow-xl">Profile</TooltipContent>
      </Tooltip>
    </div>
  );
}
