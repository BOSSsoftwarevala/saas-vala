import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatSidebar } from '@/components/ai-chat/ChatSidebar';
import { ChatHeader } from '@/components/ai-chat/ChatHeader';
import { ChatMessage, Message, FileAttachment } from '@/components/ai-chat/ChatMessage';
import { ChatInput } from '@/components/ai-chat/ChatInput';
import { EmptyState } from '@/components/ai-chat/EmptyState';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
}

const getFileType = (file: File): FileAttachment['type'] => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'php', 'html', 'css', 'json', 'xml', 'md', 'txt'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
  
  if (file.type.startsWith('image/')) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (archiveExts.includes(ext)) return 'archive';
  return 'other';
};

export default function AiChat() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('saas-ai-sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }));
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('saas-ai-active-session') || null;
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('saas-ai-sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('saas-ai-active-session', activeSessionId);
    }
  }, [activeSessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  // Close sidebar on mobile by default
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      createdAt: new Date(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (isMobile) setSidebarOpen(false);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const streamChat = useCallback(async (
    messages: Message[],
    sessionId: string,
    onDelta: (chunk: string) => void,
    onDone: () => void
  ) => {
    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: formattedMessages, stream: true }),
    });

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ error: 'Unknown error' }));
      if (resp.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment.');
      } else if (resp.status === 402) {
        toast.error('AI credits depleted. Please add funds.');
      } else {
        toast.error(error.error || 'Failed to get AI response');
      }
      throw new Error(error.error || 'Stream failed');
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }

    // Final flush
    if (buffer.trim()) {
      for (let raw of buffer.split('\n')) {
        if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  }, []);

  const handleSend = async (content: string, files?: File[]) => {
    if ((!content.trim() && (!files || files.length === 0)) || isLoading) return;

    let sessionId = activeSessionId;
    
    // Create new session if none active
    if (!sessionId) {
      const title = content.trim() 
        ? content.slice(0, 40) + (content.length > 40 ? '...' : '')
        : `${files?.length || 0} file(s) uploaded`;
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title,
        createdAt: new Date(),
        messages: []
      };
      setSessions(prev => [newSession, ...prev]);
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    // Convert files to attachments
    const fileAttachments: FileAttachment[] = files?.map(file => ({
      name: file.name,
      size: file.size,
      type: getFileType(file),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    })) || [];

    // Build message content including file info
    let messageContent = content;
    if (files && files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      if (content.trim()) {
        messageContent = `${content}\n\n[Attached files: ${fileNames}]`;
      } else {
        messageContent = `[Uploaded files: ${fileNames}]`;
      }
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      files: fileAttachments.length > 0 ? fileAttachments : undefined
    };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const updatedMessages = [...s.messages, userMessage];
        const title = s.messages.length === 0 
          ? (content.trim() 
              ? content.slice(0, 40) + (content.length > 40 ? '...' : '')
              : `${files?.length || 0} file(s) uploaded`)
          : s.title;
        return { ...s, messages: updatedMessages, title };
      }
      return s;
    }));

    setIsLoading(true);

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID();
    let assistantContent = '';

    const addAssistantMessage = () => {
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          const hasAssistant = s.messages.some(m => m.id === assistantId);
          if (!hasAssistant) {
            return {
              ...s,
              messages: [...s.messages, {
                id: assistantId,
                role: 'assistant' as const,
                content: '',
                timestamp: new Date()
              }]
            };
          }
        }
        return s;
      }));
    };

    const updateAssistantMessage = (newContent: string) => {
      assistantContent = newContent;
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => 
              m.id === assistantId ? { ...m, content: newContent } : m
            )
          };
        }
        return s;
      }));
    };

    try {
      addAssistantMessage();
      
      const currentSession = sessions.find(s => s.id === sessionId);
      const historyMessages = currentSession?.messages.slice(-10) || [];
      
      await streamChat(
        [...historyMessages, userMessage],
        sessionId,
        (chunk) => {
          assistantContent += chunk;
          updateAssistantMessage(assistantContent);
        },
        () => setIsLoading(false)
      );
    } catch (error) {
      console.error('AI Chat error:', error);
      updateAssistantMessage('I apologize, but I encountered an error. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleExport = () => {
    if (!activeSession) return;
    
    const content = activeSession.messages
      .map(m => `${m.role === 'user' ? 'You' : 'SaaS VALA AI'}: ${m.content}`)
      .join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSession.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported successfully');
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          if (isMobile) setSidebarOpen(false);
        }}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <ChatHeader 
          title={activeSession?.title || 'SaaS VALA AI'} 
          onExport={handleExport}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession || activeSession.messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="pb-4">
              {activeSession.messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && activeSession.messages[activeSession.messages.length - 1]?.role === 'user' && (
                <div className="py-6 px-4 md:px-6 bg-muted/20">
                  <div className="max-w-3xl mx-auto flex gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground mb-2">SaaS VALA AI</div>
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
