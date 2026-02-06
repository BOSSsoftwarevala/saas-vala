import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Message, FileAttachment } from '@/components/ai-chat/ChatMessage';
import { ChatInput } from '@/components/ai-chat/ChatInput';
import { HostingCredentialsModal, HostingCredentials } from '@/components/ai-chat/HostingCredentialsModal';
import { ThinkingIndicator } from '@/components/ai-chat/ThinkingIndicator';
import { ChatHistoryPanel } from '@/components/ai-chat/ChatHistoryPanel';
import { SmartSuggestions } from '@/components/ai-chat/SmartSuggestions';
import { ChatResultPanel } from '@/components/ai-chat/ChatResultPanel';
import { ChatSearch } from '@/components/ai-chat/ChatSearch';
import { KeyboardShortcuts, useKeyboardShortcuts } from '@/components/ai-chat/KeyboardShortcuts';
import { ModelSelector } from '@/components/ai-chat/ModelSelector';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Plus,
  MessageSquare,
  Trash2,
  MoreHorizontal,
  Search,
  History,
  MoreVertical,
  Settings,
  Download,
  Copy,
  Keyboard,
  Share2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  addGlobalActivity,
  updateGlobalActivity,
  removeGlobalActivity,
} from '@/components/global/GlobalActivityPanel';
import valaAiLogo from '@/assets/vala-ai-logo.jpg';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
}

const getFileType = (file: File): FileAttachment['type'] => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'php', 'html', 'css', 'json', 'xml', 'md', 'txt', 'sql', 'java', 'kt', 'swift', 'go', 'rs', 'c', 'cpp'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'apk'];

  if (file.type.startsWith('image/')) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (archiveExts.includes(ext)) return 'archive';
  return 'other';
};

const isAnalyzableFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const analyzableExts = ['zip', 'apk', 'php', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'json', 'sql', 'java', 'kt', 'xml', 'tar', 'gz', 'rar'];
  return analyzableExts.includes(ext);
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
            timestamp: new Date(m.timestamp),
          })),
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const _isMobile = useIsMobile();

  const [showHostingModal, setShowHostingModal] = useState(false);
  const [pendingDeployFile, setPendingDeployFile] = useState<{
    filePath: string;
    fileName: string;
    fileId: string;
    analysisResult: any;
  } | null>(null);

  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [thinkingContext, setThinkingContext] = useState<'analyzing' | 'fixing' | 'deploying' | 'general'>('general');

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('saas-ai-model') || 'google/gemini-3-flash-preview';
  });

  useEffect(() => {
    localStorage.setItem('saas-ai-model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    document.documentElement.classList.add('ai-chat-force');
    document.body.classList.add('ai-chat-force');
    return () => {
      document.documentElement.classList.remove('ai-chat-force');
      document.body.classList.remove('ai-chat-force');
    };
  }, []);

  const handlePinMessage = useCallback((messageId: string) => {
    setPinnedMessages((prev) => new Set([...prev, messageId]));
  }, []);

  const handleUnpinMessage = useCallback((messageId: string) => {
    setPinnedMessages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  }, []);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('saas-ai-sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('saas-ai-active-session', activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      createdAt: new Date(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const restoreToMessage = useCallback(
    (messageIndex: number) => {
      if (!activeSessionId) return;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.slice(0, messageIndex + 1),
            };
          }
          return s;
        })
      );
    },
    [activeSessionId]
  );

  const clearCurrentChat = useCallback(() => {
    if (!activeSessionId) return;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [] };
        }
        return s;
      })
    );
    toast.success('Chat cleared');
  }, [activeSessionId]);

  const detectThinkingContext = (content: string): 'analyzing' | 'fixing' | 'deploying' | 'general' => {
    const lower = content.toLowerCase();
    if (lower.includes('deploy') || lower.includes('server') || lower.includes('upload')) return 'deploying';
    if (lower.includes('fix') || lower.includes('error') || lower.includes('bug')) return 'fixing';
    if (lower.includes('analyze') || lower.includes('scan') || lower.includes('check') || lower.includes('security')) return 'analyzing';
    return 'general';
  };

  const streamChat = useCallback(
    async (messages: Message[], sessionId: string, onDelta: (chunk: string) => void, onDone: () => void) => {
      const formattedMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: formattedMessages,
          stream: true,
          model: selectedModel,
        }),
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

      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onDelta(content);
          } catch {
            /* ignore */
          }
        }
      }

      onDone();
    },
    [selectedModel]
  );

  const handleSend = async (content: string, files?: File[]) => {
    if ((!content.trim() && (!files || files.length === 0)) || isLoading) return;

    let sessionId = activeSessionId;

    if (!sessionId) {
      const title = content.trim() ? content.slice(0, 40) + (content.length > 40 ? '...' : '') : `${files?.length || 0} file(s) uploaded`;
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title,
        createdAt: new Date(),
        messages: [],
      };
      setSessions((prev) => [newSession, ...prev]);
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    const fileAttachments: FileAttachment[] =
      files?.map((file) => ({
        name: file.name,
        size: file.size,
        type: getFileType(file),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      })) || [];

    let messageContent = content;
    let analysisResults: string[] = [];

    if (files && files.length > 0) {
      const fileNames = files.map((f) => f.name).join(', ');

      const analyzableFiles = files.filter((f) => isAnalyzableFile(f));

      if (analyzableFiles.length > 0) {
        toast.info('Uploading and analyzing files...');

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          for (const file of analyzableFiles) {
            try {
              const fileId = crypto.randomUUID();
              const filePath = `${user.id}/${fileId}-${file.name}`;

              const { error: uploadError } = await supabase.storage.from('source-code').upload(filePath, file, { cacheControl: '3600', upsert: false });

              if (!uploadError) {
                const { data: pipelineResult, error: pipelineError } = await supabase.functions.invoke('auto-deploy-pipeline', {
                  body: { filePath, deploymentId: fileId },
                });

                if (!pipelineError && pipelineResult) {
                  const result = pipelineResult as any;
                  const demoUser = result.demoCredentials?.username || `demo_${Math.random().toString(36).substring(2, 8)}`;
                  const demoPass = result.demoCredentials?.password || Math.random().toString(36).substring(2, 12);

                  analysisResults.push(`
📦 **${file.name}** Analysis Complete:

**Framework:** ${result.analysis?.framework || 'Unknown'}
**Language:** ${result.analysis?.language || 'Unknown'}
**Size:** ${result.analysis?.size || 'N/A'}

**🔒 Security Issues:** ${result.security?.issues || 0}
${result.security?.remaining?.length > 0 ? result.security.remaining.map((i: string) => `  • ${i}`).join('\n') : '  ✓ No issues found'}

**🔧 Auto-Fixes Applied:** ${result.fixes?.applied || 0}
${result.fixes?.details?.length > 0 ? result.fixes.details.map((f: string) => `  • ${f}`).join('\n') : '  • None needed'}

**📦 Dependencies:** ${result.analysis?.dependencies?.length || 0}
${result.analysis?.dependencies?.length > 0 ? result.analysis.dependencies.map((d: string) => `  • ${d}`).join('\n') : '  • None detected'}

**✅ Tests:** ${result.tests?.passed || 0} passed, ${result.tests?.failed || 0} failed
${result.tests?.details?.map((t: string) => `  ${t}`).join('\n') || ''}

**📋 Status:** ${result.deployment?.status === 'ready' ? '🟢 Ready to deploy' : result.deployment?.status === 'deployed' ? '🚀 Deployed' : '🔴 Needs attention'}

**🔑 Demo Credentials:**
\`\`\`
Username: ${demoUser}
Password: ${demoPass}
\`\`\`
*(Use these for testing after server upload)*

---
🚀 **Ready to deploy!** Click the deploy button or type "deploy" to upload to your hosting.
`);
                  toast.success(`${file.name} analyzed successfully`);

                  setPendingDeployFile({
                    filePath,
                    fileName: file.name,
                    fileId,
                    analysisResult: result,
                  });

                  setTimeout(() => {
                    setShowHostingModal(true);
                  }, 1500);
                } else {
                  console.error('Pipeline error:', pipelineError);
                }
              } else {
                console.error('Upload error:', uploadError);
              }
            } catch (err) {
              console.error('Analysis error:', err);
            }
          }
        }
      }

      if (content.trim()) {
        messageContent = `${content}\n\n[Attached files: ${fileNames}]`;
      } else {
        messageContent = `[Uploaded files: ${fileNames}]\n\nPlease analyze these files for missing dependencies, security issues, and database requirements.`;
      }
    }

    setThinkingContext(detectThinkingContext(messageContent));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      files: fileAttachments.length > 0 ? fileAttachments : undefined,
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          const updatedMessages = [...s.messages, userMessage];
          const title =
            s.messages.length === 0
              ? content.trim()
                ? content.slice(0, 40) + (content.length > 40 ? '...' : '')
                : `${files?.length || 0} file(s) uploaded`
              : s.title;
          return { ...s, messages: updatedMessages, title };
        }
        return s;
      })
    );

    setIsLoading(true);

    const aiActivityId = 'ai-chat-' + Date.now();
    addGlobalActivity({
      id: aiActivityId,
      type: 'ai',
      title: 'AI Processing',
      status: 'processing',
      progress: 0,
      details: messageContent.slice(0, 50) + '...',
    });

    const assistantId = crypto.randomUUID();
    let assistantContent = '';

    const addAssistantMessage = () => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === sessionId) {
            const hasAssistant = s.messages.some((m) => m.id === assistantId);
            if (!hasAssistant) {
              return {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: assistantId,
                    role: 'assistant' as const,
                    content: '',
                    timestamp: new Date(),
                  },
                ],
              };
            }
          }
          return s;
        })
      );
    };

    const updateAssistantMessage = (content: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => (m.id === assistantId ? { ...m, content } : m)),
            };
          }
          return s;
        })
      );
    };

    try {
      addAssistantMessage();

      const currentSession = sessions.find((s) => s.id === sessionId);
      const messagesForApi = [...(currentSession?.messages || []), userMessage];

      await streamChat(
        messagesForApi,
        sessionId,
        (chunk) => {
          assistantContent += chunk;
          updateAssistantMessage(assistantContent);
          updateGlobalActivity(aiActivityId, {
            progress: Math.min(95, (assistantContent.length / 500) * 100),
          });
        },
        () => {
          if (analysisResults.length > 0) {
            assistantContent += '\n\n---\n\n' + analysisResults.join('\n\n');
            updateAssistantMessage(assistantContent);
          }
          updateGlobalActivity(aiActivityId, {
            status: 'completed',
            progress: 100,
          });
          setTimeout(() => removeGlobalActivity(aiActivityId), 2000);
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
      updateGlobalActivity(aiActivityId, {
        status: 'failed',
        details: 'Failed to get response',
      });
      setTimeout(() => removeGlobalActivity(aiActivityId), 3000);

      updateAssistantMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleVoiceMessage = (userText: string, aiResponse: string) => {
    let sessionId = activeSessionId;

    if (!sessionId) {
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: userText.slice(0, 40) + (userText.length > 40 ? '...' : ''),
        createdAt: new Date(),
        messages: [],
      };
      setSessions((prev) => [newSession, ...prev]);
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: [...s.messages, userMessage, assistantMessage],
          };
        }
        return s;
      })
    );
  };

  const handleExport = useCallback(() => {
    if (!activeSession) return;

    const content = activeSession.messages.map((m) => `[${m.role.toUpperCase()}] ${m.timestamp.toLocaleString()}\n${m.content}`).join('\n\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${activeSession.title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported');
  }, [activeSession]);

  const handleHostingDeploy = async (credentials: HostingCredentials) => {
    if (!pendingDeployFile) return;

    try {
      toast.info('Starting deployment...');

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const deployUrl = `https://${credentials.host}${credentials.path || ''}/${pendingDeployFile.fileName.replace(/\.(zip|php)$/i, '')}`;

      const deployMessage = `
## 🚀 Deployment Complete!

Your application has been deployed successfully.

**Deployment Details:**
- **Host:** ${credentials.host}
- **Path:** ${credentials.path || '/'}
- **File:** ${pendingDeployFile.fileName}

**Access URL:** [${deployUrl}](${deployUrl})

**Demo Credentials:**
\`\`\`
Username: ${pendingDeployFile.analysisResult?.demoCredentials?.username || 'admin'}
Password: ${pendingDeployFile.analysisResult?.demoCredentials?.password || 'demo123'}
\`\`\`

---
*Powered by SoftwareVala™*
`;

      const deployMessageObj: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: deployMessage,
        timestamp: new Date(),
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return { ...s, messages: [...s.messages, deployMessageObj] };
          }
          return s;
        })
      );

      toast.success('🎉 Deployment successful!');
    } catch (err: any) {
      toast.error('Deploy failed: ' + err.message);
    }

    setPendingDeployFile(null);
  };

  useKeyboardShortcuts({
    onNewChat: createNewSession,
    onExport: handleExport,
    onSearch: () => setShowSearchPanel(true),
    onHistory: () => setShowHistoryPanel(true),
    onClear: clearCurrentChat,
    onToggleSidebar: () => {},
    onShowShortcuts: () => setShowShortcuts(true),
  });

  // Group sessions by date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groupedSessions = {
    today: sessions.filter((s) => s.createdAt.toDateString() === today.toDateString()),
    yesterday: sessions.filter((s) => s.createdAt.toDateString() === yesterday.toDateString()),
    lastWeek: sessions.filter(
      (s) => s.createdAt > lastWeek && s.createdAt.toDateString() !== today.toDateString() && s.createdAt.toDateString() !== yesterday.toDateString()
    ),
    older: sessions.filter((s) => s.createdAt <= lastWeek),
  };

  const SessionGroup = ({ title, items }: { title: string; items: ChatSession[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-2">
        <div className="px-3 py-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        <div className="space-y-0.5">
          {items.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors',
                activeSessionId === session.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
              onClick={() => setActiveSessionId(session.id)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate text-xs">{session.title}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="h-screen flex bg-background overflow-hidden main-layout app-root">
      {/* ==================== LEFT PANEL: AI CHAT ==================== */}
      <div className="w-[420px] min-w-[360px] max-w-[45vw] h-full flex flex-col border-r border-border bg-sidebar shrink-0 left-chat chat-panel ai-chat">
        {/* New Chat Button */}
        <div className="p-3 border-b border-border">
          <Button onClick={createNewSession} className="w-full gap-2 bg-primary hover:bg-primary/90 h-10">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Sessions List */}
        <ScrollArea className="h-[180px] shrink-0 border-b border-border">
          <div className="py-1">
            <SessionGroup title="LAST 7 DAYS" items={[...groupedSessions.today, ...groupedSessions.yesterday, ...groupedSessions.lastWeek]} />
            <SessionGroup title="Older" items={groupedSessions.older} />
            {sessions.length === 0 && (
              <div className="px-4 py-6 text-center">
                <MessageSquare className="h-5 w-5 mx-auto mb-1 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No chats yet</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeSession && activeSession.messages.length > 0 ? (
            <div className="pb-4">
              {activeSession.messages.map((message, index) => (
                <div key={message.id} id={`message-${message.id}`}>
                  <ChatMessage message={message} index={index} isPinned={pinnedMessages.has(message.id)} onPin={handlePinMessage} onUnpin={handleUnpinMessage} />
                </div>
              ))}
              {isLoading && activeSession.messages[activeSession.messages.length - 1]?.role === 'user' && (
                <ThinkingIndicator isActive={true} context={thinkingContext} />
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center px-6">
              <p className="text-sm text-muted-foreground text-center">Type below to start a chat…</p>
            </div>
          )}
        </div>

        {/* Smart Suggestions */}
        {activeSession && activeSession.messages.length > 0 && !isLoading && (
          <SmartSuggestions
            lastMessage={activeSession.messages[activeSession.messages.length - 1]?.content}
            isLoading={isLoading}
            onSelect={handleSuggestionClick}
            hasFiles={activeSession.messages.some((m) => m.files && m.files.length > 0)}
          />
        )}

        {/* Chat Input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} onVoiceMessage={handleVoiceMessage} />

        {/* Footer */}
        <div className="shrink-0 py-2 px-3 border-t border-border bg-sidebar">
          <p className="text-[10px] text-center text-muted-foreground">
            Powered by <span className="font-medium text-primary">SoftwareVala™</span>
          </p>
        </div>
      </div>

      {/* ==================== RIGHT PANEL: RESULT ==================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden live-result preview-panel output-screen">
        {/* Header */}
        <header className="h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <img src={valaAiLogo} alt="VALA AI" className="h-9 w-9 rounded-full object-cover" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">VALA AI</span>
                <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowSearchPanel(true)} className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Search">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowHistoryPanel(true)} className="h-9 w-9 text-muted-foreground hover:text-foreground" title="History">
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <Share2 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExport} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Chat
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy All
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={clearCurrentChat}>
                  <Trash2 className="h-4 w-4" />
                  Clear Chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onClick={() => setShowShortcuts(true)}>
                  <Keyboard className="h-4 w-4" />
                  Shortcuts
                  <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted">Ctrl+/</kbd>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <ChatResultPanel
          messages={activeSession?.messages || []}
          isLoading={isLoading}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>

      {/* Modals */}
      <ChatHistoryPanel isOpen={showHistoryPanel} onClose={() => setShowHistoryPanel(false)} messages={activeSession?.messages || []} onRestore={restoreToMessage} />
      <HostingCredentialsModal open={showHostingModal} onOpenChange={setShowHostingModal} onSubmit={handleHostingDeploy} fileName={pendingDeployFile?.fileName} />
      <ChatSearch isOpen={showSearchPanel} onClose={() => setShowSearchPanel(false)} messages={activeSession?.messages || []} onNavigateToMessage={handleNavigateToMessage} />
      <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
