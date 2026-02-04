import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User, Sparkles, History, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hello! I'm your SaaS VALA AI assistant. I can help you with product management, customer support, license key queries, and more. How can I assist you today?",
    timestamp: new Date(),
  },
];

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponses = [
        "I understand your query. Let me help you with that. Based on your product catalog, I can see you have 24 active products. Would you like me to provide more details?",
        "Great question! For license key management, you can use the Keys module to generate, suspend, or renew keys. The auto-billing feature integrates with your wallet.",
        "I can help you analyze your server deployments. Currently, you have 3 servers online, 1 deploying, and 1 offline. Would you like me to investigate the offline server?",
        "Your revenue has increased by 23% this month! The top-performing products are Enterprise CRM and Inventory Pro. Shall I generate a detailed report?",
      ];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-12rem)] flex gap-6">
        {/* Sidebar - Chat History */}
        <div className="hidden lg:block w-64 glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-foreground flex items-center gap-2">
              <History className="h-4 w-4" />
              Chat History
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start gap-2 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-4 w-4" />
              Current Chat
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              Product inquiry - 2h ago
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              License issue - Yesterday
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              Server help - 2 days ago
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 glass-card rounded-xl flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-gradient flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground">SaaS VALA AI</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="status-dot status-online" />
                Always online
              </p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 animate-fade-in',
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback
                      className={cn(
                        message.role === 'user'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-orange-gradient text-white'
                      )}
                    >
                      {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-xl px-4 py-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-orange-gradient text-white">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your SaaS..."
                className="flex-1 bg-muted/50 border-border"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="bg-orange-gradient hover:opacity-90 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Powered by <span className="text-primary font-semibold">SoftwareVala™</span> AI
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
