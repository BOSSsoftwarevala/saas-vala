import { useState, useRef, useEffect } from 'react';
import { Send, Hash, Users, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import type { Channel, ChatMessage, ChannelMember } from '@/hooks/useSupport';

interface Props {
  channel: Channel | null;
  messages: ChatMessage[];
  members: ChannelMember[];
  typingUsers: string[];
  onSend: (content: string) => void;
  onTyping: () => void;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

export function SupportChatWindow({ channel, messages, members, typingUsers, onSend, onTyping }: Props) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channel]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <Hash className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Select a channel</p>
          <p className="text-sm">Choose a channel from the sidebar to start chatting</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
  const typingNames = members.filter(m => typingUsers.includes(m.user_id)).map(m => m.full_name || 'Someone');

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b bg-background">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-lg">{channel.name}</span>
          {channel.description && (
            <span className="text-xs text-muted-foreground hidden md:inline ml-2">| {channel.description}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowMembers(!showMembers)} className="gap-1">
          <Users className="h-4 w-4" />
          <span className="hidden md:inline">{members.length}</span>
        </Button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
            {messageGroups.map((group, gi) => (
              <div key={gi}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-medium text-muted-foreground bg-background px-2">{group.date}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {group.messages.map((msg, mi) => {
                  const isMe = msg.sender_id === user?.id;
                  const prevMsg = mi > 0 ? group.messages[mi - 1] : null;
                  const sameAuthor = prevMsg?.sender_id === msg.sender_id;
                  const initials = (msg.sender_name || '?').slice(0, 2).toUpperCase();

                  return (
                    <div key={msg.id} className={cn('group flex gap-2 px-1 py-0.5 hover:bg-muted/50 rounded', sameAuthor ? 'mt-0' : 'mt-3')}>
                      <div className="w-9 flex-shrink-0">
                        {!sameAuthor && (
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={cn('text-xs font-semibold', isMe ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!sameAuthor && (
                          <div className="flex items-baseline gap-2">
                            <span className={cn('font-semibold text-sm', isMe && 'text-primary')}>{msg.sender_name}</span>
                            <span className="text-[11px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Typing indicator */}
          {typingNames.length > 0 && (
            <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
              {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t">
            <div className="flex items-end gap-2 bg-muted/50 rounded-lg border px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); onTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${channel.name}`}
                rows={1}
                className="flex-1 bg-transparent resize-none text-sm outline-none min-h-[24px] max-h-[120px] leading-6"
                style={{ height: Math.min(120, Math.max(24, input.split('\n').length * 24)) }}
              />
              <Button size="icon" variant="ghost" onClick={handleSend} disabled={!input.trim()} className="h-8 w-8 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="w-56 border-l bg-background p-3 hidden md:block">
            <h3 className="font-semibold text-sm mb-3">Members — {members.length}</h3>
            <ScrollArea className="h-full">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2 py-1.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{(m.full_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{m.full_name}</span>
                  {m.role === 'admin' && <span className="text-[10px] text-primary font-medium">admin</span>}
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
