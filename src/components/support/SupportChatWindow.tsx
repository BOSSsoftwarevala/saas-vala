import { useState, useRef, useEffect } from 'react';
import { Send, Hash, Users, Phone, Pin, Search, Smile, Paperclip, AtSign, Bold, Italic, List, Code, Link as LinkIcon, MoreHorizontal, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import type { Channel, ChatMessage, ChannelMember } from '@/hooks/useSupport';

interface Props {
  channel: Channel | null;
  messages: ChatMessage[];
  members: ChannelMember[];
  typingUsers: string[];
  onSend: (content: string) => void;
  onTyping: () => void;
  onOpenThread?: (msgId: string) => void;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
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

const avatarColors = [
  'bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600',
  'bg-pink-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function SupportChatWindow({ channel, messages, members, typingUsers, onSend, onTyping, onOpenThread }: Props) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, [channel]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white text-gray-500">
        <div className="text-center">
          <Hash className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-xl font-medium text-gray-700">Welcome to Support</p>
          <p className="text-sm text-gray-400 mt-1">Select a channel from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
  const typingNames = members.filter(m => typingUsers.includes(m.user_id)).map(m => m.full_name || 'Someone');

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      {/* Slack-style header */}
      <div className="h-12 px-4 flex items-center justify-between border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Hash className="h-4 w-4 text-gray-400" />
          <span className="font-bold text-[15px] text-gray-900">{channel.name}</span>
          {channel.description && (
            <>
              <span className="text-gray-300 mx-1">|</span>
              <span className="text-xs text-gray-500 truncate max-w-[200px]">{channel.description}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {[
            { icon: Phone, label: 'Huddle' },
            { icon: Pin, label: 'Pins' },
            { icon: Search, label: 'Search' },
          ].map((item, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                  <item.icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">{item.label}</TooltipContent>
            </Tooltip>
          ))}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={cn(
              'h-8 px-2 rounded flex items-center gap-1 text-sm transition-colors',
              showMembers ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            <Users className="h-4 w-4" />
            <span className="text-xs">{members.length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {/* Channel intro */}
            {messages.length === 0 && (
              <div className="px-5 pt-8 pb-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                  <Hash className="h-6 w-6 text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">#{channel.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {channel.description || `This is the very beginning of the #${channel.name} channel.`}
                </p>
              </div>
            )}

            {messageGroups.map((group, gi) => (
              <div key={gi}>
                {/* Date divider */}
                <div className="flex items-center gap-3 px-5 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-bold text-gray-500 bg-white px-3 py-0.5 rounded-full border border-gray-200">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {group.messages.map((msg, mi) => {
                  const isMe = msg.sender_id === user?.id;
                  const prevMsg = mi > 0 ? group.messages[mi - 1] : null;
                  const sameAuthor = prevMsg?.sender_id === msg.sender_id;
                  const initials = (msg.sender_name || '?').slice(0, 2).toUpperCase();
                  const color = getAvatarColor(msg.sender_name || '?');

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'group relative flex gap-2 px-5 py-0.5 hover:bg-gray-50 transition-colors',
                        !sameAuthor && 'mt-2 pt-1'
                      )}
                    >
                      <div className="w-9 flex-shrink-0 pt-0.5">
                        {!sameAuthor ? (
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={cn('text-xs font-semibold text-white', color)}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 leading-[22px] block text-right">
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!sameAuthor && (
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-[15px] text-gray-900 hover:underline cursor-pointer">{msg.sender_name}</span>
                            <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-[15px] leading-[22px] text-gray-900 break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Hover toolbar (Slack-style) */}
                      <div className="absolute -top-3 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5">
                          {[Smile, MessageCircle, MoreHorizontal].map((Icon, i) => (
                            <button
                              key={i}
                              onClick={() => i === 1 && onOpenThread?.(msg.id)}
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Typing indicator */}
          {typingNames.length > 0 && (
            <div className="px-5 py-1 text-xs text-gray-500 flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              <span className="font-medium">{typingNames.join(', ')}</span> {typingNames.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}

          {/* Slack-style message input */}
          <div className="px-5 pb-4 pt-1">
            <div className="border border-gray-300 rounded-lg bg-white focus-within:border-gray-400 focus-within:shadow-sm transition-all">
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100">
                {[Bold, Italic, Code, LinkIcon, List].map((Icon, i) => (
                  <button key={i} className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              {/* Text area */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); onTyping(); }}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${channel.name}`}
                rows={1}
                className="w-full px-3 py-2 resize-none text-[15px] outline-none bg-transparent min-h-[36px] max-h-[200px] leading-[22px] text-gray-900 placeholder:text-gray-400"
                style={{ height: Math.min(200, Math.max(36, input.split('\n').length * 22)) }}
              />

              {/* Bottom bar */}
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center gap-0.5">
                  {[Paperclip, Smile, AtSign].map((Icon, i) => (
                    <button key={i} className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    input.trim()
                      ? 'bg-[hsl(155,60%,40%)] text-white hover:bg-[hsl(155,60%,35%)]'
                      : 'bg-gray-100 text-gray-300'
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="w-[260px] border-l bg-white flex flex-col flex-shrink-0">
            <div className="h-12 px-4 flex items-center border-b">
              <h3 className="font-bold text-[15px] text-gray-900">Members</h3>
              <span className="ml-2 text-xs text-gray-400">{members.length}</span>
            </div>
            <ScrollArea className="flex-1 p-3">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2 py-2 px-1 rounded hover:bg-gray-50 cursor-pointer">
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={cn('text-[11px] font-semibold text-white', getAvatarColor(m.full_name || '?'))}>
                        {(m.full_name || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                    {m.role === 'admin' && <p className="text-[10px] text-blue-500 font-medium">Admin</p>}
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
