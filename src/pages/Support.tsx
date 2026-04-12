import { useMemo, useRef, useState } from 'react';
import { Paperclip, Plus, Search, Send, Users, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupport } from '@/hooks/useSupport';
import { cn } from '@/lib/utils';

export default function Support() {
  const {
    channels,
    activeChannel,
    messages,
    members,
    typingUsers,
    unreadCounts,
    loading,
    selectChannel,
    sendMessage,
    sendFile,
    setTyping,
    createChannel,
    searchMessages,
  } = useSupport();

  const [message, setMessage] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredChannels = useMemo(() => {
    return channels.filter((channel) => {
      const matchesType =
        channelFilter === 'all' ||
        (channelFilter === 'direct' ? channel.channel_type === 'direct' : channel.channel_type !== 'direct');
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [channels, channelFilter, searchQuery]);

  const handleSend = async () => {
    if (!message.trim()) return;
    await sendMessage(message);
    setMessage('');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await sendFile(file);
    event.target.value = '';
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-background p-4 md:p-6">
      <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
        <Card className="flex h-full flex-col overflow-hidden border-border/60 bg-card/80">
          <div className="border-b border-border/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold">Support</h1>
                <p className="text-sm text-muted-foreground">Ultraviewer-style team workspace</p>
              </div>
              <Button size="icon" variant="outline" onClick={() => void createChannel('New Channel', 'Support workspace', 'group')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search channels"
                className="pl-9"
              />
            </div>
            <Tabs value={channelFilter} onValueChange={(value) => setChannelFilter(value as 'all' | 'direct' | 'group')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="direct">Direct</TabsTrigger>
                <TabsTrigger value="group">Rooms</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {filteredChannels.map((channel) => {
                const active = activeChannel?.id === channel.id;
                const unread = unreadCounts[channel.id] || 0;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => void selectChannel(channel)}
                    className={cn(
                      'mb-2 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                      active
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-transparent bg-muted/40 hover:bg-muted/70'
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                      {channel.channel_type === 'direct' ? <Users className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{channel.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{channel.description || channel.channel_type}</div>
                    </div>
                    {unread > 0 && (
                      <div className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                        {unread}
                      </div>
                    )}
                  </button>
                );
              })}
              {!loading && filteredChannels.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No support channels found.</div>
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/60 bg-card/80">
          <div className="border-b border-border/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{activeChannel?.name || 'Select a channel'}</h2>
                <p className="text-sm text-muted-foreground">
                  {typingUsers.length > 0
                    ? `${typingUsers.length} user${typingUsers.length > 1 ? 's are' : ' is'} typing...`
                    : activeChannel?.description || 'Live support collaboration'}
                </p>
              </div>
              <Button variant="outline" onClick={() => void searchMessages(searchQuery)} disabled={!activeChannel}>
                Search
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 bg-muted/20 p-4">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1">
                  <div className="text-xs text-muted-foreground">{msg.sender_name || 'User'} • {new Date(msg.created_at).toLocaleString()}</div>
                  <div className="w-fit max-w-[85%] rounded-2xl border border-border/50 bg-background px-4 py-3 text-sm shadow-sm">
                    {msg.message_type === 'file' ? (
                      <a href={msg.file_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        {msg.file_name || 'Attachment'}
                      </a>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {!loading && activeChannel && messages.length === 0 && (
                <div className="pt-10 text-center text-sm text-muted-foreground">No messages yet in this support room.</div>
              )}
              {!activeChannel && (
                <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                  Choose a support channel to open the new system.
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 p-4">
            <div className="flex items-end gap-2">
              <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={!activeChannel}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Input
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  void setTyping();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={activeChannel ? 'Type your support message...' : 'Select a channel first'}
                disabled={!activeChannel}
              />
              <Button onClick={() => void handleSend()} disabled={!activeChannel || !message.trim()}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </Card>

        <Card className="hidden h-full flex-col overflow-hidden border-border/60 bg-card/80 lg:flex">
          <div className="border-b border-border/60 p-4">
            <h3 className="font-semibold">Channel Members</h3>
            <p className="text-sm text-muted-foreground">Support staff and participants</p>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="rounded-xl border border-border/50 bg-muted/30 px-3 py-3">
                  <div className="font-medium">{member.full_name || member.user_id}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{member.role}</div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No members loaded.</div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
