import { useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

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

  const sendMessage = async () => {
    const prompt = input.trim();
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

      const reply =
        data?.reply ||
        data?.message ||
        data?.content ||
        (typeof data === 'string' ? data : 'I could not generate a response right now.');

      if (error) {
        throw error;
      }

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
    <div className="h-[calc(100vh-4rem)] bg-background p-4 md:p-6">
      <Card className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden border-border/60 bg-card/80">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">AI Chat</h1>
              <p className="text-sm text-muted-foreground">New WhatsApp-style AI workspace</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 bg-muted/20 px-4 py-5 md:px-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-[85%] items-start gap-3 rounded-2xl px-4 py-3 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/60 bg-background text-foreground'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm text-muted-foreground">
                  AI is typing...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 p-4">
          <div className="mx-auto flex max-w-4xl items-center gap-2">
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
            />
            <Button onClick={() => void sendMessage()} disabled={loading || !input.trim()}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
