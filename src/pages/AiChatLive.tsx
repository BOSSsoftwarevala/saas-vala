import { useEffect, useRef, useState } from 'react';
import { Bell, Bot, Heart, Home, Library, LayoutGrid, Mic2, MoreHorizontal, Pause, Play, Radio, Search, Send, SkipBack, SkipForward, Sparkles, User, User2, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

type MenuItem = {
  label: string;
  icon: typeof Home;
  active?: boolean;
};

type Artist = {
  id: string;
  name: string;
  followers: string;
  plays: string;
  accent: string;
  emoji: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const MENU_TOP: MenuItem[] = [
  { label: 'Explore', icon: Home, active: true },
  { label: 'Genres', icon: Radio },
  { label: 'Albums', icon: Disc3 },
  { label: 'Artist', icon: User2 },
];

const MENU_LIBRARY: MenuItem[] = [
  { label: 'Favourites', icon: Heart },
  { label: 'Popular', icon: LayoutGrid },
  { label: 'My Music', icon: Library },
];

const ARTISTS: Artist[] = [
  { id: '1', name: 'Mamank', followers: '1528 Followers', plays: '122M Plays', accent: 'from-fuchsia-500 to-violet-500', emoji: '🧑🏾‍🎤' },
  { id: '2', name: 'Maimunah', followers: '1928 Followers', plays: '50M Plays', accent: 'from-pink-400 to-purple-500', emoji: '👩🏻‍🎤' },
  { id: '3', name: 'Paijo', followers: '1028 Followers', plays: '32M Plays', accent: 'from-violet-400 to-fuchsia-500', emoji: '🧑🏽' },
];

const QUICK_PROMPTS = [
  'Tell me about pricing plans',
  'How to deploy on my server?',
  'Need help with setup',
  'Show AI automation options',
];

const WAVE_BARS = [18, 26, 14, 22, 30, 16, 25, 12, 20, 28, 17, 24, 15, 29, 19, 23];
const PLAYER_BARS = [10, 18, 30, 16, 28, 12, 26, 20, 32, 18, 24, 14, 27, 16, 22, 11, 29, 17, 25, 13];

export default function AiChatLive() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi, I am your SaaS Vala AI assistant. Ask me about products, deployments, servers, pricing, or automation.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progressRef.current) return;
    progressRef.current.style.width = '58%';
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (preset?: string) => {
    const prompt = (preset ?? input).trim();
    if (!prompt || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user', content: prompt },
    ];

    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
        },
      });

      if (error) {
        throw error;
      }

      const reply =
        data?.response ||
        data?.reply ||
        data?.message ||
        data?.content ||
        (typeof data === 'string' ? data : 'I could not generate a response right now.');

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ]);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'AI chat failed.';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: fallback },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#d7b3f5] px-3 py-5 md:px-6">
      <div className="mx-auto max-w-[1180px] rounded-[36px] border-[8px] border-[#17132d] bg-[#17132d] p-[10px] shadow-[0_28px_70px_rgba(52,20,91,0.28)]">
        <div className="grid min-h-[675px] grid-cols-1 gap-[10px] rounded-[28px] bg-[#faf8fd] p-[10px] lg:grid-cols-[205px_minmax(0,1fr)]">
          <aside className="flex flex-col rounded-[24px] bg-[linear-gradient(180deg,#1f1538_0%,#17122d_100%)] px-4 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[radial-gradient(circle_at_top,#d946ef,#6d28d9_70%)] shadow-[0_14px_30px_rgba(192,38,211,0.35)]">
                <User2 className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] text-white/50">Hi</p>
              <h2 className="mt-1 text-[18px] font-semibold leading-[1.1] tracking-tight">Ahmad<br />Fauzi</h2>
            </div>

            <div className="mt-8">
              <p className="mb-3 text-[11px] text-white/35">Menu</p>
              <div className="space-y-1.5">
                {MENU_TOP.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] transition ${item.active ? 'text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-3 text-[11px] text-white/35">Library</p>
              <div className="space-y-1.5">
                {MENU_LIBRARY.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] text-white/55 transition hover:bg-white/5 hover:text-white"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto rounded-[18px] border border-white/10 bg-[#1b132f] px-3 py-2">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.28em] text-white/35">
                <span>Live</span>
                <div className="flex items-end gap-[2px]">
                  {WAVE_BARS.slice(0, 10).map((bar, index) => (
                    <span key={`sidebar-wave-${index}`} className="w-[3px] rounded-full bg-white/35" style={{ height: `${Math.max(6, bar / 2)}px` }} />
                  ))}
                </div>
                <span>AI</span>
              </div>
            </div>

            <div className="mt-3 rounded-[20px] bg-[linear-gradient(135deg,#ca72ff_0%,#8c3cff_55%,#6d28d9_100%)] p-3 shadow-[0_18px_34px_rgba(147,51,234,0.35)]">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-[16px] bg-[linear-gradient(135deg,#f3d1ff,#a855f7)] p-[2px]">
                  <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#d8b4fe,#7c3aed)] text-lg">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">AI Chat Live</p>
                  <p className="text-xs text-white/70">Assistant online</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-white">
                <SkipBack className="h-3.5 w-3.5" />
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#7c3aed]"
                  onClick={() => setIsPlaying((value) => !value)}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <SkipForward className="h-3.5 w-3.5" />
              </div>
            </div>
          </aside>

          <main className="grid gap-[10px] lg:grid-cols-[minmax(0,1fr)_250px]">
            <section className="flex min-h-0 flex-col rounded-[24px] bg-white px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-[26px] font-semibold leading-none text-[#17132d]">Home</h1>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#efe7fb] text-[#30224d]">
                    <Bell className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex h-9 items-center gap-2 rounded-full border border-[#efe7fb] px-3 text-[#b5aac9]">
                    <Search className="h-3.5 w-3.5" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Type here to search"
                      className="w-36 border-0 bg-transparent text-xs outline-none placeholder:text-[#c6bdd6]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] bg-[linear-gradient(135deg,#cc6dff_0%,#a855f7_40%,#7c3aed_100%)] px-6 py-5 text-white shadow-[0_20px_40px_rgba(168,85,247,0.28)]">
                <div className="grid items-center gap-2 md:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-white/70">Musikania</p>
                    <h2 className="mt-3 max-w-[280px] text-[30px] font-semibold leading-[1.08]">Chat with AI all the time</h2>
                    <p className="mt-2 max-w-[300px] text-xs leading-5 text-white/80">Use the same premium design, but keep your real assistant working for products, support, pricing, and deployments.</p>
                    <button
                      type="button"
                      onClick={() => void sendMessage('Tell me about pricing plans')}
                      className="mt-5 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-[#7c3aed] shadow-[0_12px_28px_rgba(255,255,255,0.24)]"
                    >
                      Start Chat
                    </button>
                  </div>
                  <div className="relative flex min-h-[185px] items-end justify-center">
                    <div className="absolute right-6 top-3 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
                    <div className="absolute left-12 top-8 h-14 w-14 rounded-full bg-fuchsia-300/30 blur-xl" />
                    <div className="flex h-[210px] w-[225px] items-end justify-center rounded-[26px] bg-[radial-gradient(circle_at_top,#f9d8ff_0%,rgba(255,255,255,0.08)_60%,transparent_80%)]">
                      <div className="mb-4 flex flex-col items-center">
                        <div className="mb-2 flex gap-2">
                          <div className="h-7 w-7 rounded-full bg-white/30" />
                          <div className="h-7 w-7 rounded-full bg-white/30" />
                        </div>
                        <div className="flex h-[150px] w-[118px] items-center justify-center rounded-t-[64px] bg-[linear-gradient(180deg,#ffe4f4,#f5d0fe)] text-5xl shadow-[0_20px_40px_rgba(244,114,182,0.18)]">
                          <Sparkles className="h-12 w-12 text-[#7c3aed]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <h3 className="text-[20px] font-semibold leading-none text-[#17132d]">Conversation</h3>
                <button type="button" className="text-xs font-medium text-[#6c5b8c]">Live Chat</button>
              </div>

              <ScrollArea className="mt-3 flex-1 rounded-[20px] bg-[#fbf8ff] px-3 py-3">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-[18px] px-4 py-3 text-sm leading-6 shadow-sm ${
                          message.role === 'user'
                            ? 'bg-[linear-gradient(135deg,#d946ef,#8b5cf6)] text-white'
                            : 'border border-[#eee6fb] bg-white text-[#1d1531]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${message.role === 'user' ? 'bg-white/20' : 'bg-[#f3ecff] text-[#7c3aed]'}`}>
                            {message.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                          </div>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-[18px] border border-[#eee6fb] bg-white px-4 py-3 text-sm text-[#7f719b]">
                        AI is typing...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-[#efe7fb] bg-white p-2">
                <Button type="button" variant="ghost" size="icon" className="rounded-full text-[#7c3aed] hover:bg-[#f4edff]">
                  <Mic2 className="h-4 w-4" />
                </Button>
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask anything about your SaaS Vala system"
                  disabled={loading}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                <Button
                  onClick={() => void sendMessage()}
                  disabled={loading || !input.trim()}
                  className="rounded-full bg-[linear-gradient(135deg,#d946ef,#8b5cf6)] px-4 text-white hover:opacity-90"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-[24px] bg-white px-4 py-4">
              <div>
                <h3 className="text-[18px] font-semibold text-[#17132d]">Top Artist</h3>
                <div className="mt-3 space-y-2.5">
                  {ARTISTS.map((artist) => (
                    <button key={artist.id} type="button" className="flex w-full items-center gap-3 rounded-[16px] px-1 py-1.5 text-left transition hover:bg-[#faf6ff]">
                      <div className={`h-11 w-11 rounded-[14px] bg-gradient-to-br ${artist.accent} p-[1px] shadow-[0_10px_24px_rgba(168,85,247,0.12)]`}>
                        <div className="flex h-full w-full items-center justify-center rounded-[13px] bg-white/75 text-base">{artist.emoji}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1d1531]">{artist.name}</p>
                        <p className="text-[10px] text-[#9487ae]">{artist.followers} · {artist.plays}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button type="button" className="mt-2 text-xs font-medium text-[#6c5b8c]">See More</button>
              </div>

              <div>
                <h3 className="text-[18px] font-semibold text-[#17132d]">Quick Replies</h3>
                <div className="mt-3 space-y-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="w-full rounded-[14px] border border-[#eee6fb] bg-[#faf7ff] px-3 py-2.5 text-left text-[12px] text-[#3a2c58] transition hover:bg-[#f3ebff]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#24103d_0%,#17092a_100%)] p-4 text-white shadow-[0_20px_36px_rgba(33,16,66,0.28)]">
                <div className="rounded-[20px] bg-[linear-gradient(135deg,#d946ef,#8b5cf6)] p-[1px]">
                  <div className="flex h-40 items-end justify-center rounded-[19px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),rgba(255,255,255,0.08),transparent_72%)] pb-4 text-6xl">
                    🤖
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-[16px] font-semibold">Vala AI Assistant</p>
                  <p className="mt-1 text-[12px] text-white/65">Online</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-white/70">
                  <span>1:20</span>
                  <span>3:30</span>
                </div>
                <div className="mt-3 flex h-8 items-end justify-between gap-1 px-1">
                  {PLAYER_BARS.map((bar, index) => (
                    <span
                      key={`player-wave-${index}`}
                      className={`w-[3px] rounded-full ${index < 10 ? 'bg-white' : 'bg-white/35'}`}
                      style={{ height: `${bar}px` }}
                    />
                  ))}
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div ref={progressRef} className="h-2 rounded-full bg-[linear-gradient(90deg,#ffffff,#d8b4fe)]" />
                </div>
                <div className="mt-5 flex items-center justify-center gap-5">
                  <button type="button" className="text-white/70"><Mic2 className="h-4 w-4" /></button>
                  <button type="button" className="text-white/90"><SkipBack className="h-4 w-4" /></button>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#271042] shadow-[0_12px_24px_rgba(255,255,255,0.18)]"
                    onClick={() => setIsPlaying((value) => !value)}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                  </button>
                  <button type="button" className="text-white/90"><SkipForward className="h-4 w-4" /></button>
                  <button type="button" className="text-white/70"><MoreHorizontal className="h-4 w-4" /></button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
