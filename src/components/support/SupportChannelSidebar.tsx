import { useState } from 'react';
import { Hash, Lock, Plus, MessageSquare, ChevronDown, ChevronRight, Search, PenSquare, Bookmark, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
    <div className="w-[260px] flex-shrink-0 bg-[hsl(215,72%,10%)] text-white flex flex-col h-full border-r border-white/5">
      {/* Workspace header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[15px] truncate">SaasVala Support</h2>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </div>
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10">
          <PenSquare className="h-4 w-4" />
        </button>
      </div>

      {/* Quick nav */}
      <div className="px-2 py-2 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 px-3 py-[5px] text-[13px] text-white/70 hover:bg-white/10 rounded-md transition-colors">
          <Search className="h-4 w-4" /> Search
        </button>
        <button className="w-full flex items-center gap-2.5 px-3 py-[5px] text-[13px] text-white/70 hover:bg-white/10 rounded-md transition-colors">
          <Bookmark className="h-4 w-4" /> Saved Items
        </button>
        <button className="w-full flex items-center gap-2.5 px-3 py-[5px] text-[13px] text-white/70 hover:bg-white/10 rounded-md transition-colors">
          <ArrowDownCircle className="h-4 w-4" /> All Unreads
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* Channels section */}
          <div className="px-2 mb-0.5">
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-white/60 hover:text-white w-full px-2 py-1 rounded transition-colors"
            >
              {channelsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Channels
            </button>
          </div>

          {channelsOpen && publicChannels.map(ch => {
            const hasUnread = (unreadCounts[ch.id] || 0) > 0;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-[5px] text-[13px] text-left transition-colors rounded-r-md',
                  activeChannel?.id === ch.id
                    ? 'bg-[hsl(215,65%,32%)] text-white'
                    : hasUnread
                      ? 'text-white font-semibold hover:bg-white/10'
                      : 'text-white/60 hover:bg-white/10'
                )}
              >
                {ch.channel_type === 'private' ? <Lock className="h-3.5 w-3.5 flex-shrink-0 opacity-60" /> : <Hash className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />}
                <span className="truncate flex-1">{ch.name}</span>
                {hasUnread && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            );
          })}

          {/* Add channel */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <button className="w-full flex items-center gap-2 px-4 py-[5px] text-[13px] text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add channels
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[hsl(215,30%,16%)] border-white/10 text-white">
              <DialogHeader><DialogTitle className="text-white">Create a channel</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Name</label>
                  <Input
                    placeholder="e.g. project-updates"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Description (optional)</label>
                  <Input
                    placeholder="What's this channel about?"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <Button onClick={handleCreate} className="w-full bg-[hsl(155,60%,40%)] hover:bg-[hsl(155,60%,35%)] text-white">
                  Create Channel
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* DMs section */}
          <div className="px-2 mt-3 mb-0.5">
            <button
              onClick={() => setDmsOpen(!dmsOpen)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-white/60 hover:text-white w-full px-2 py-1 rounded transition-colors"
            >
              {dmsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Direct Messages
            </button>
          </div>

          {dmsOpen && directChannels.map(ch => {
            const hasUnread = (unreadCounts[ch.id] || 0) > 0;
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-[5px] text-[13px] text-left transition-colors',
                  activeChannel?.id === ch.id
                    ? 'bg-[hsl(215,65%,32%)] text-white'
                    : hasUnread
                      ? 'text-white font-semibold hover:bg-white/10'
                      : 'text-white/60 hover:bg-white/10'
                )}
              >
                <div className="relative flex-shrink-0">
                  <MessageSquare className="h-3.5 w-3.5 opacity-60" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-[hsl(215,72%,10%)]" />
                </div>
                <span className="truncate flex-1">{ch.name}</span>
                {hasUnread && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            );
          })}

          {dmsOpen && (
            <button className="w-full flex items-center gap-2 px-4 py-[5px] text-[13px] text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add teammates
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
