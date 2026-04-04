import { useState } from 'react';
import { Hash, Lock, Plus, ChevronDown, ChevronRight, Search, PenSquare, Bookmark, MessageCircle, Headphones, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Channel } from '@/hooks/useSupport';

interface Props {
  channels: Channel[];
  activeChannel: Channel | null;
  unreadCounts: Record<string, number>;
  onSelectChannel: (ch: Channel) => void;
  onCreateChannel: (name: string, desc: string, type: string) => Promise<any>;
}

export function SupportChannelSidebar({ channels, activeChannel, unreadCounts, onSelectChannel, onCreateChannel }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  const publicChannels = channels.filter(c => c.channel_type !== 'direct');
  const directChannels = channels.filter(c => c.channel_type === 'direct');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreateChannel(newName.trim().toLowerCase().replace(/\s+/g, '-'), newDesc, 'public');
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col h-full border-r" style={{ background: '#3F0E40', borderColor: 'rgba(255,255,255,0.1)' }}>
      {/* Workspace name header */}
      <div className="h-[49px] px-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
          <h2 className="font-[900] text-[17px] text-white truncate tracking-[-0.2px]">SaasVala Support</h2>
          <ChevronDown className="h-4 w-4 text-white/60 flex-shrink-0" />
        </button>
        <button className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors">
          <PenSquare className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Quick nav links */}
      <div className="px-2 pt-3 pb-1 space-y-[1px]">
        {[
          { icon: MessageCircle, label: 'Threads' },
          { icon: Headphones, label: 'Huddles' },
          { icon: Search, label: 'Drafts & sent' },
          { icon: Bookmark, label: 'Saved items' },
          { icon: MoreHorizontal, label: 'More' },
        ].map((item, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-[10px] px-[10px] py-[5px] text-[14px] text-white/80 hover:bg-white/10 rounded-[6px] transition-colors font-normal"
          >
            <item.icon className="h-[18px] w-[18px] flex-shrink-0 opacity-80" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Channels section header */}
          <div className="px-[10px] mb-[2px]">
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="flex items-center gap-1 w-full px-[6px] py-[3px] rounded-[4px] hover:bg-white/10 transition-colors"
            >
              {channelsOpen ? (
                <ChevronDown className="h-[12px] w-[12px] text-white/60" />
              ) : (
                <ChevronRight className="h-[12px] w-[12px] text-white/60" />
              )}
              <span className="text-[14px] font-medium text-white/80 tracking-[-0.1px]">Channels</span>
            </button>
          </div>

          {channelsOpen && publicChannels.map(ch => {
            const hasUnread = (unreadCounts[ch.id] || 0) > 0;
            const isActive = activeChannel?.id === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={cn(
                  'w-full flex items-center gap-[6px] pl-[26px] pr-[10px] py-[4px] text-[14px] text-left transition-colors',
                  isActive
                    ? 'text-white font-medium rounded-[6px] mx-[4px]'
                    : hasUnread
                      ? 'text-white font-bold hover:bg-white/10'
                      : 'text-white/70 hover:bg-white/10'
                )}
                style={isActive ? { background: '#1264A3', width: 'calc(100% - 8px)' } : undefined}
              >
                {ch.channel_type === 'private' ? (
                  <Lock className="h-[14px] w-[14px] flex-shrink-0 opacity-70" />
                ) : (
                  <Hash className="h-[14px] w-[14px] flex-shrink-0 opacity-70" />
                )}
                <span className="truncate flex-1">{ch.name}</span>
                {hasUnread && (
                  <span className="bg-[#cd2553] text-white text-[11px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-[5px]">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            );
          })}

          {/* Add channels button */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <button className="w-full flex items-center gap-[6px] pl-[26px] pr-[10px] py-[4px] text-[14px] text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                <Plus className="h-[14px] w-[14px]" />
                <span>Add channels</span>
              </button>
            </DialogTrigger>
            <DialogContent className="border-0 shadow-2xl" style={{ background: '#1a1d21', color: 'white' }}>
              <DialogHeader>
                <DialogTitle className="text-white text-lg">Create a channel</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-white/60 -mt-2">Channels are where your team communicates.</p>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-[13px] font-medium text-white/80 mb-1.5 block">Name</label>
                  <Input
                    placeholder="e.g. plan-budget"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30 h-[42px] rounded-[8px] focus:border-[#1264A3]"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-white/80 mb-1.5 block">Description <span className="text-white/40">(optional)</span></label>
                  <Input
                    placeholder="What's this channel about?"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30 h-[42px] rounded-[8px] focus:border-[#1264A3]"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="w-full h-[42px] rounded-[8px] text-white font-bold text-[15px] transition-colors disabled:opacity-50"
                  style={{ background: newName.trim() ? '#007a5a' : '#007a5a80' }}
                >
                  Create
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Direct Messages section */}
          <div className="px-[10px] mt-4 mb-[2px]">
            <button
              onClick={() => setDmsOpen(!dmsOpen)}
              className="flex items-center gap-1 w-full px-[6px] py-[3px] rounded-[4px] hover:bg-white/10 transition-colors"
            >
              {dmsOpen ? (
                <ChevronDown className="h-[12px] w-[12px] text-white/60" />
              ) : (
                <ChevronRight className="h-[12px] w-[12px] text-white/60" />
              )}
              <span className="text-[14px] font-medium text-white/80 tracking-[-0.1px]">Direct messages</span>
            </button>
          </div>

          {dmsOpen && directChannels.map(ch => {
            const hasUnread = (unreadCounts[ch.id] || 0) > 0;
            const isActive = activeChannel?.id === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={cn(
                  'w-full flex items-center gap-[8px] pl-[26px] pr-[10px] py-[4px] text-[14px] text-left transition-colors',
                  isActive
                    ? 'text-white font-medium rounded-[6px] mx-[4px]'
                    : hasUnread
                      ? 'text-white font-bold hover:bg-white/10'
                      : 'text-white/70 hover:bg-white/10'
                )}
                style={isActive ? { background: '#1264A3', width: 'calc(100% - 8px)' } : undefined}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-[20px] h-[20px] rounded-[4px] bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                    {ch.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-[1px] -right-[1px] w-[8px] h-[8px] bg-[#2bac76] rounded-full border-[1.5px]" style={{ borderColor: '#3F0E40' }} />
                </div>
                <span className="truncate flex-1">{ch.name}</span>
                {hasUnread && (
                  <span className="bg-[#cd2553] text-white text-[11px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-[5px]">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            );
          })}

          {dmsOpen && (
            <button className="w-full flex items-center gap-[8px] pl-[26px] pr-[10px] py-[4px] text-[14px] text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <Plus className="h-[14px] w-[14px]" />
              <span>Add teammates</span>
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
