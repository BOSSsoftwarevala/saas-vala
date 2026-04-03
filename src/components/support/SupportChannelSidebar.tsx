import { useState } from 'react';
import { Hash, Lock, Plus, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
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
    <div className="w-64 flex-shrink-0 bg-[hsl(215,72%,10%)] text-white flex flex-col h-full">
      {/* Workspace header */}
      <div className="h-14 px-4 flex items-center border-b border-white/10">
        <h2 className="font-bold text-lg truncate">Support</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Channels section */}
          <div className="px-2 mb-1">
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white w-full px-2 py-1"
            >
              {channelsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Channels
            </button>
          </div>

          {channelsOpen && publicChannels.map(ch => (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch)}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-1.5 text-sm text-left hover:bg-white/10 transition-colors',
                activeChannel?.id === ch.id && 'bg-[hsl(215,65%,32%)] text-white font-semibold'
              )}
            >
              {ch.channel_type === 'private' ? <Lock className="h-3.5 w-3.5 opacity-70" /> : <Hash className="h-3.5 w-3.5 opacity-70" />}
              <span className="truncate flex-1">{ch.name}</span>
              {(unreadCounts[ch.id] || 0) > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                  {unreadCounts[ch.id]}
                </span>
              )}
            </button>
          ))}

          {/* Add channel button */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <button className="w-full flex items-center gap-2 px-4 py-1.5 text-sm text-white/50 hover:text-white hover:bg-white/10">
                <Plus className="h-3.5 w-3.5" /> Add Channel
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Channel</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="channel-name" value={newName} onChange={e => setNewName(e.target.value)} />
                <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <Button onClick={handleCreate} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* DMs section */}
          {directChannels.length > 0 && (
            <>
              <div className="px-2 mt-3 mb-1">
                <button
                  onClick={() => setDmsOpen(!dmsOpen)}
                  className="flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white w-full px-2 py-1"
                >
                  {dmsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Direct Messages
                </button>
              </div>
              {dmsOpen && directChannels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => onSelectChannel(ch)}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-1.5 text-sm text-left hover:bg-white/10',
                    activeChannel?.id === ch.id && 'bg-[hsl(215,65%,32%)] text-white font-semibold'
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5 opacity-70" />
                  <span className="truncate flex-1">{ch.name}</span>
                  {(unreadCounts[ch.id] || 0) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                      {unreadCounts[ch.id]}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
