import { useState, useRef, useEffect } from 'react';
import {
  Send, Hash, Users, Pin, Search, Smile, Paperclip, Bookmark,
  AtSign, Bold, Italic, List, Code, Link as LinkIcon,
  MoreHorizontal, MessageCircle, Strikethrough,
  ListOrdered, Quote, Video, ChevronDown, Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
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
  '#e8912d', '#2eb67d', '#36c5f0', '#ecb22e',
  '#e01e5a', '#6b2fa0', '#1264a3', '#d83b7d',
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
      <div className="flex-1 flex flex-col" style={{ background: '#1A1D21' }}>
        {/* Top search bar — Slack style */}
        <div className="h-[38px] flex items-center justify-center px-[16px] flex-shrink-0" style={{ background: '#3F0E40' }}>
          <div className="flex items-center gap-[8px] h-[26px] w-full max-w-[720px] rounded-[6px] px-[12px]" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Search className="h-[14px] w-[14px] text-white/60" />
            <span className="text-[13px] text-white/60">Search SaasVala Support</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-[80px] h-[80px] rounded-[16px] mx-auto mb-[20px] flex items-center justify-center" style={{ background: '#2e2e38' }}>
              <Hash className="h-[40px] w-[40px]" style={{ color: '#ababad' }} />
            </div>
            <p className="text-[22px] font-[900] text-white tracking-[-0.3px]">Welcome to SaasVala Support</p>
            <p className="text-[15px] mt-[8px]" style={{ color: '#ababad' }}>Select a channel from the sidebar to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);
  const typingNames = members.filter(m => typingUsers.includes(m.user_id)).map(m => m.full_name || 'Someone');

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ background: '#1A1D21' }}>
      {/* Top search bar — Slack style */}
      <div className="h-[38px] flex items-center justify-center px-[16px] flex-shrink-0" style={{ background: '#3F0E40' }}>
        <div className="flex items-center gap-[8px] h-[26px] w-full max-w-[720px] rounded-[6px] px-[12px] cursor-pointer hover:bg-white/25 transition-colors" style={{ background: 'rgba(255,255,255,0.2)' }}>
          <Search className="h-[14px] w-[14px] text-white/70" />
          <span className="text-[13px] text-white/70">Search SaasVala Support</span>
        </div>
      </div>

      {/* Channel header */}
      <div className="h-[49px] px-[16px] flex items-center justify-between border-b flex-shrink-0" style={{ background: '#1A1D21', borderColor: '#383838' }}>
        <div className="flex items-center gap-[6px] min-w-0">
          <Hash className="h-[16px] w-[16px] flex-shrink-0" style={{ color: '#b9bbbe' }} />
          <span className="font-[900] text-[16px] text-white truncate">{channel.name}</span>
          <ChevronDown className="h-[14px] w-[14px] text-white/40 flex-shrink-0" />
          {channel.description && (
            <>
              <div className="w-px h-[16px] mx-[4px]" style={{ background: '#383838' }} />
              <span className="text-[13px] truncate max-w-[260px]" style={{ color: '#ababad' }}>{channel.description}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-[2px] flex-shrink-0">
          {[
            { icon: Video, label: 'Huddle' },
            { icon: Pin, label: 'Pinned' },
          ].map((item, i) => (
            <Tooltip key={i} delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: '#b9bbbe' }}>
                  <item.icon className="h-[16px] w-[16px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs bg-black text-white border-0">{item.label}</TooltipContent>
            </Tooltip>
          ))}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={cn(
              'h-[28px] px-[8px] rounded-[6px] flex items-center gap-[4px] text-[13px] transition-colors',
              showMembers ? 'bg-white/15 text-white' : 'hover:bg-white/10'
            )}
            style={{ color: showMembers ? 'white' : '#b9bbbe' }}
          >
            <Users className="h-[16px] w-[16px]" />
            <span>{members.length}</span>
          </button>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: '#b9bbbe' }}>
                <Search className="h-[16px] w-[16px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs bg-black text-white border-0">Search this channel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {/* Channel welcome */}
            {messages.length === 0 && (
              <div className="px-[20px] pt-[60px] pb-[16px]">
                <div className="w-[52px] h-[52px] rounded-[12px] flex items-center justify-center mb-[12px]" style={{ background: '#2e2e38' }}>
                  <Hash className="h-[28px] w-[28px]" style={{ color: '#e8912d' }} />
                </div>
                <h2 className="text-[22px] font-[900] text-white tracking-[-0.3px]">Welcome to #{channel.name}</h2>
                <p className="text-[15px] mt-[6px] max-w-[600px] leading-[22px]" style={{ color: '#ababad' }}>
                  {channel.description || `This is the very beginning of the **#${channel.name}** channel. Send a message to get started.`}
                </p>
                <button className="mt-[12px] text-[13px] font-bold hover:underline" style={{ color: '#1D9BD1' }}>
                  Edit description
                </button>
              </div>
            )}

            {messageGroups.map((group, gi) => (
              <div key={gi}>
                {/* Date divider — exact Slack style */}
                <div className="flex items-center gap-0 px-[20px] my-[20px]">
                  <div className="flex-1 h-px" style={{ background: '#383838' }} />
                  <button className="text-[12px] font-[700] px-[12px] py-[3px] rounded-full border flex-shrink-0 hover:bg-white/5 transition-colors" style={{ color: '#e8e8e8', borderColor: '#383838', background: '#1A1D21' }}>
                    {group.date}
                  </button>
                  <div className="flex-1 h-px" style={{ background: '#383838' }} />
                </div>

                {group.messages.map((msg, mi) => {
                  const prevMsg = mi > 0 ? group.messages[mi - 1] : null;
                  const sameAuthor = prevMsg?.sender_id === msg.sender_id;
                  const initials = (msg.sender_name || '?').slice(0, 2).toUpperCase();
                  const color = getAvatarColor(msg.sender_name || '?');

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'group relative flex gap-[8px] px-[20px] py-[2px] transition-colors',
                        !sameAuthor && 'mt-[4px] pt-[8px]'
                      )}
                      onMouseEnter={e => (e.currentTarget.style.background = '#222529')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="w-[36px] flex-shrink-0 pt-[2px]">
                        {!sameAuthor ? (
                          <Avatar className="h-[36px] w-[36px] rounded-[8px] cursor-pointer hover:opacity-80 transition-opacity">
                            <AvatarFallback className="text-[13px] font-bold text-white rounded-[8px]" style={{ background: color }}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className="text-[11px] opacity-0 group-hover:opacity-100 leading-[22px] block text-right tabular-nums" style={{ color: '#ababad' }}>
                            {formatTime(msg.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!sameAuthor && (
                          <div className="flex items-baseline gap-[8px]">
                            <span className="font-[900] text-[15px] text-white hover:underline cursor-pointer">{msg.sender_name}</span>
                            <span className="text-[12px]" style={{ color: '#ababad' }}>{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <p className="text-[15px] leading-[22px] text-white/90 break-words whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Hover toolbar — exact Slack style */}
                      <div className="absolute -top-[14px] right-[20px] opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <div className="flex items-center gap-0 rounded-[8px] border shadow-xl px-[2px] py-[2px]" style={{ background: '#1A1D21', borderColor: '#565856' }}>
                          {[
                            { icon: Smile, action: () => {}, tip: 'Add reaction' },
                            { icon: MessageCircle, action: () => onOpenThread?.(msg.id), tip: 'Reply in thread' },
                            { icon: Send, action: () => {}, tip: 'Forward' },
                            { icon: Bookmark, action: () => {}, tip: 'Save for later' },
                            { icon: MoreHorizontal, action: () => {}, tip: 'More actions' },
                          ].map((btn, i) => (
                            <Tooltip key={i} delayDuration={0}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={btn.action}
                                  className="w-[30px] h-[30px] rounded-[6px] flex items-center justify-center transition-colors hover:bg-white/10"
                                  style={{ color: '#ababad' }}
                                >
                                  <btn.icon className="h-[16px] w-[16px]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs bg-black text-white border-0">{btn.tip}</TooltipContent>
                            </Tooltip>
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
            <div className="px-[20px] py-[4px] text-[13px] flex items-center gap-[6px]" style={{ color: '#ababad' }}>
              <span className="flex gap-[3px]">
                <span className="w-[6px] h-[6px] rounded-full animate-bounce" style={{ background: '#ababad', animationDelay: '0ms' }} />
                <span className="w-[6px] h-[6px] rounded-full animate-bounce" style={{ background: '#ababad', animationDelay: '150ms' }} />
                <span className="w-[6px] h-[6px] rounded-full animate-bounce" style={{ background: '#ababad', animationDelay: '300ms' }} />
              </span>
              <span><strong className="text-white">{typingNames.join(', ')}</strong> {typingNames.length === 1 ? 'is' : 'are'} typing...</span>
            </div>
          )}

          {/* Slack-style compose box */}
          <div className="px-[20px] pb-[20px] pt-[4px]">
            <div className="rounded-[8px] border overflow-hidden transition-colors focus-within:border-[#565856]" style={{ background: '#222529', borderColor: '#565856' }}>
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0 px-[6px] py-[4px] border-b" style={{ borderColor: '#383838' }}>
                {[Bold, Italic, Strikethrough, Code, LinkIcon, ListOrdered, List, Quote].map((Icon, i) => (
                  <button key={i} className="w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: '#b9bbbe' }}>
                    <Icon className="h-[15px] w-[15px]" />
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
                className="w-full px-[12px] py-[8px] resize-none text-[15px] outline-none bg-transparent min-h-[38px] max-h-[200px] leading-[22px] text-white placeholder:text-white/40"
                style={{ height: Math.min(200, Math.max(38, input.split('\n').length * 22)) }}
              />

              {/* Bottom bar with attachments + send */}
              <div className="flex items-center justify-between px-[6px] py-[4px]">
                <div className="flex items-center gap-0">
                  {[
                    { icon: Paperclip, tip: 'Attach' },
                    { icon: Smile, tip: 'Emoji' },
                    { icon: AtSign, tip: 'Mention' },
                    { icon: Video, tip: 'Record video' },
                    { icon: Mic, tip: 'Record audio' },
                  ].map((item, i) => (
                    <Tooltip key={i} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button className="w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: '#b9bbbe' }}>
                          <item.icon className="h-[16px] w-[16px]" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs bg-black text-white border-0">{item.tip}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center transition-all"
                  style={{
                    background: input.trim() ? '#007A5A' : 'transparent',
                    color: input.trim() ? 'white' : '#565856',
                  }}
                >
                  <Send className="h-[16px] w-[16px]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="w-[260px] border-l flex flex-col flex-shrink-0" style={{ background: '#1A1D21', borderColor: '#383838' }}>
            <div className="h-[49px] px-[16px] flex items-center border-b" style={{ borderColor: '#383838' }}>
              <h3 className="font-[900] text-[15px] text-white">Members</h3>
              <span className="ml-[6px] text-[13px]" style={{ color: '#ababad' }}>{members.length}</span>
            </div>
            <ScrollArea className="flex-1 p-[8px]">
              <p className="text-[13px] font-medium px-[8px] py-[6px]" style={{ color: '#ababad' }}>Online — {members.length}</p>
              {members.map(m => (
                <button key={m.user_id} className="flex items-center gap-[8px] py-[6px] px-[8px] rounded-[6px] hover:bg-white/10 cursor-pointer w-full transition-colors">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-[32px] w-[32px] rounded-[8px]">
                      <AvatarFallback className="text-[11px] font-bold text-white rounded-[8px]" style={{ background: getAvatarColor(m.full_name || '?') }}>
                        {(m.full_name || '?').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-[1px] -right-[1px] w-[10px] h-[10px] bg-[#2BAC76] rounded-full border-2" style={{ borderColor: '#1A1D21' }} />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[14px] font-medium text-white truncate">{m.full_name}</p>
                    {m.role === 'admin' && <p className="text-[11px] font-medium" style={{ color: '#1264a3' }}>Admin</p>}
                  </div>
                </button>
              ))}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
