import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatSidebar } from '@/components/ai-chat/ChatSidebar';
import { ChatHeader } from '@/components/ai-chat/ChatHeader';
import { ChatMessage, Message, FileAttachment } from '@/components/ai-chat/ChatMessage';
import { ChatInput } from '@/components/ai-chat/ChatInput';
// DEPRECATED: Legacy FTP modal removed - Using VALA Server Agent
// import { HostingCredentialsModal, HostingCredentials } from '@/components/ai-chat/HostingCredentialsModal';
import { ThinkingIndicator } from '@/components/ai-chat/ThinkingIndicator';
import { AiStatusBar } from '@/components/ai-chat/AiStatusBar';
import { ChatHistoryPanel } from '@/components/ai-chat/ChatHistoryPanel';
import { ChatSearch } from '@/components/ai-chat/ChatSearch';
import { KeyboardShortcuts, useKeyboardShortcuts } from '@/components/ai-chat/KeyboardShortcuts';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { 
  addGlobalActivity, 
  updateGlobalActivity, 
  removeGlobalActivity 
} from '@/components/global/GlobalActivityPanel';
import { setGlobalWorking, WorkingDeveloperIndicator } from '@/components/global/WorkingDeveloperIndicator';

// Use AI Developer for full-stack capabilities with tool calling
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-developer`;

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

// Check if file is analyzable source code
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
  
  // AI Status tracking
  const [aiStatus, setAiStatus] = useState({
    tokensReceived: 0,
    elapsedTime: 0,
    error: null as string | null,
  });
  const aiTimerRef = useRef<number | null>(null);
  const aiStartTimeRef = useRef<number | null>(null);
  const aiTokensRef = useRef<number>(0); // Track tokens in real-time
  
  // DEPRECATED: Legacy hosting modal removed - Using VALA Server Agent system
  // const [showHostingModal, setShowHostingModal] = useState(false);
  // const [pendingDeployFile, setPendingDeployFile] = useState<...>(null);

  // History panel state
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  // Search panel state
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  
  // Shortcuts panel state
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Pinned messages state
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  
  // Context for thinking indicator
  const [thinkingContext, setThinkingContext] = useState<'analyzing' | 'fixing' | 'deploying' | 'general'>('general');

  const activeSession = sessions.find(s => s.id === activeSessionId);
 
   // AI Model selection
   const [selectedModel, setSelectedModel] = useState<string>(() => {
     return localStorage.getItem('saas-ai-model') || 'google/gemini-3-flash-preview';
   });
 
   // Save selected model to localStorage
   useEffect(() => {
     localStorage.setItem('saas-ai-model', selectedModel);
   }, [selectedModel]);

  // Pin/Unpin message handlers
  const handlePinMessage = useCallback((messageId: string) => {
    setPinnedMessages(prev => new Set([...prev, messageId]));
  }, []);

  const handleUnpinMessage = useCallback((messageId: string) => {
    setPinnedMessages(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  }, []);

  // Navigate to message from search
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

  // Restore chat to a specific message index
  const restoreToMessage = useCallback((messageIndex: number) => {
    if (!activeSessionId) return;
    
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: s.messages.slice(0, messageIndex + 1)
        };
      }
      return s;
    }));
  }, [activeSessionId]);

  // Clear current chat
  const clearCurrentChat = useCallback(() => {
    if (!activeSessionId) return;
    
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [] };
      }
      return s;
    }));
    toast.success('Chat cleared');
  }, [activeSessionId]);

  // Detect context from message content
  const detectThinkingContext = (content: string): 'analyzing' | 'fixing' | 'deploying' | 'general' => {
    const lower = content.toLowerCase();
    if (lower.includes('deploy') || lower.includes('server') || lower.includes('upload')) return 'deploying';
    if (lower.includes('fix') || lower.includes('error') || lower.includes('bug')) return 'fixing';
    if (lower.includes('analyze') || lower.includes('scan') || lower.includes('check') || lower.includes('security')) return 'analyzing';
    return 'general';
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
      body: JSON.stringify({
        messages: formattedMessages,
        stream: true,
        model: selectedModel,
      }),
    });

    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ error: 'Unknown error' }));
      const errorMsg = error.error || 'Failed to get AI response';
      if (resp.status === 429) {
        toast.error('⏳ Rate limit exceeded. Thoda wait karo aur try karo.');
      } else if (resp.status === 402) {
        toast.error('💳 AI credits khatam! Settings → Workspace → Usage mein credits add karo.', { duration: 8000 });
      } else {
        toast.error(errorMsg);
      }
      throw new Error(errorMsg);
    }

    // The ai-developer function currently responds with JSON (non-SSE).
    // Support both: SSE streaming when available, otherwise a JSON fallback.
    const contentType = resp.headers.get('content-type') || '';
    const isSse = contentType.includes('text/event-stream');

    if (!isSse) {
      const data = await resp.json().catch(() => ({} as any));
      const text =
        (typeof (data as any)?.response === 'string' && (data as any).response) ||
        (typeof (data as any)?.message === 'string' && (data as any).message) ||
        (typeof (data as any)?.content === 'string' && (data as any).content) ||
        '';

      onDelta(text || '');
      onDone();
      return;
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamDone = false;

    try {
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process all complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          // Clean up line
          if (line.endsWith('\r')) line = line.slice(0, -1);

          // Skip SSE comments (: OPENROUTER PROCESSING) and empty lines
          if (line.startsWith(':') || line.trim() === '') continue;

          // Skip non-data lines
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();

          // Check for stream end
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          // Parse and extract content
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content && typeof content === 'string') {
              onDelta(content);
            }
          } catch (parseError) {
            // JSON might be split across chunks - this is normal, skip invalid chunks
            console.debug('Skipping incomplete SSE chunk');
          }
        }
      }
    } catch (streamError) {
      console.error('Stream reading error:', streamError);
    }

    // Final flush for any remaining buffer content
    if (buffer.trim()) {
      for (const raw of buffer.split('\n')) {
        if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content && typeof content === 'string') {
            onDelta(content);
          }
        } catch {
          /* ignore incomplete final chunks */
        }
      }
    }

    onDone();
  }, [selectedModel]);

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
    let analysisResults: string[] = [];
    
    // Upload and analyze files if present
    if (files && files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      
      // Check for analyzable files
      const analyzableFiles = files.filter(f => isAnalyzableFile(f));
      
      if (analyzableFiles.length > 0) {
        toast.info('Uploading and analyzing files...');
        
        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          for (const file of analyzableFiles) {
            try {
              // Upload to storage
              const fileId = crypto.randomUUID();
              const filePath = `${user.id}/${fileId}-${file.name}`;
              
              const { error: uploadError } = await supabase.storage
                .from('source-code')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });
              
              if (!uploadError) {
                // Trigger auto-deploy pipeline for analysis
                const { data: pipelineResult, error: pipelineError } = await supabase.functions.invoke('auto-deploy-pipeline', {
                  body: { filePath, deploymentId: fileId }
                });
                
                if (!pipelineError && pipelineResult) {
                  // Format analysis results
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
                  
                  // VALA Agent System - No legacy modal needed
                  console.log('[VALA] File ready for deployment via Server Agent:', file.name);
                  
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
    
    // Set thinking context based on message
    setThinkingContext(detectThinkingContext(messageContent));

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
    setGlobalWorking(true);
    
    // Reset and start AI status tracking
    setAiStatus({ tokensReceived: 0, elapsedTime: 0, error: null });
    aiStartTimeRef.current = Date.now();
    aiTokensRef.current = 0;
    
    // Start elapsed time timer - updates both time AND tokens
    aiTimerRef.current = window.setInterval(() => {
      if (aiStartTimeRef.current) {
        setAiStatus({
          tokensReceived: aiTokensRef.current,
          elapsedTime: (Date.now() - aiStartTimeRef.current!) / 1000,
          error: null,
        });
      }
    }, 100);
 
   // Add global activity for AI processing
   const aiActivityId = 'ai-chat-' + Date.now();
   addGlobalActivity({
     id: aiActivityId,
     type: 'ai',
     title: 'AI Processing',
     status: 'processing',
     progress: 0,
     details: messageContent.slice(0, 50) + '...',
   });

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
      // Count approximate tokens (rough estimate: 1 token ≈ 4 chars)
      const currentTokens = Math.floor(assistantContent.length / 4);
      aiTokensRef.current = currentTokens; // Update ref for timer to read
      
     // Update global activity progress
     updateGlobalActivity(aiActivityId, { 
       progress: Math.min(95, assistantContent.length / 10),
       details: `${currentTokens} tokens received...`
     });
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
      
      // If we have analysis results, prepend them to the AI context
      let enhancedUserMessage = userMessage;
      if (analysisResults.length > 0) {
        enhancedUserMessage = {
          ...userMessage,
          content: `${userMessage.content}\n\n---\n**AUTO-ANALYSIS RESULTS:**\n${analysisResults.join('\n---\n')}\n\nBased on this analysis, please provide recommendations for:\n1. Missing database tables/schema needed\n2. Missing configurations or environment variables\n3. Security fixes required\n4. Dependencies to install\n5. Next steps for deployment`
        };
      }
      
      const currentSession = sessions.find(s => s.id === sessionId);
      const historyMessages = currentSession?.messages.slice(-10) || [];
      
      await streamChat(
        [...historyMessages, enhancedUserMessage],
        sessionId,
        (chunk) => {
          assistantContent += chunk;
          updateAssistantMessage(assistantContent);
        },
       () => {
         // Stop the timer
         if (aiTimerRef.current) {
           window.clearInterval(aiTimerRef.current);
           aiTimerRef.current = null;
         }
         setIsLoading(false);
         setGlobalWorking(false);
         updateGlobalActivity(aiActivityId, { 
           status: 'completed', 
           progress: 100,
           title: 'Response Generated',
           details: `Complete (${aiTokensRef.current} tokens)`
         });
         setTimeout(() => removeGlobalActivity(aiActivityId), 3000);
       }
      );
    } catch (error) {
      console.error('AI Chat error:', error);
      // Stop the timer on error
      if (aiTimerRef.current) {
        window.clearInterval(aiTimerRef.current);
        aiTimerRef.current = null;
      }
      setAiStatus(prev => ({ ...prev, error: 'Failed to get response' }));
      updateGlobalActivity(aiActivityId, { status: 'failed', details: 'Error occurred' });
      updateAssistantMessage('I apologize, but I encountered an error. Please try again.');
      setIsLoading(false);
      setGlobalWorking(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  // Handle voice conversation messages
  const handleVoiceMessage = useCallback((userText: string, aiResponse: string) => {
    let sessionId = activeSessionId;
    
    // Create new session if none active
    if (!sessionId) {
      const title = userText.slice(0, 40) + (userText.length > 40 ? '...' : '');
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

    // Add both messages
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `🎤 ${userText}`,
      timestamp: new Date()
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    };

    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const updatedMessages = [...s.messages, userMessage, assistantMessage];
        const title = s.messages.length === 0 
          ? userText.slice(0, 40) + (userText.length > 40 ? '...' : '')
          : s.title;
        return { ...s, messages: updatedMessages, title };
      }
      return s;
    }));
  }, [activeSessionId]);

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

  // DEPRECATED: Legacy FTP hosting deploy removed - Using VALA Server Agent system
  // All deployments now go through the server-agent edge function with token-based auth

  // Keyboard shortcuts - must be after all function definitions
  useKeyboardShortcuts({
    onNewChat: createNewSession,
    onExport: handleExport,
    onSearch: () => setShowSearchPanel(true),
    onHistory: () => setShowHistoryPanel(true),
    onClear: clearCurrentChat,
    onToggleSidebar: () => setSidebarOpen(!sidebarOpen),
    onShowShortcuts: () => setShowShortcuts(true),
  });

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left Sidebar - Sessions list only */}
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
        onOpenHistory={() => setShowHistoryPanel(true)}
        onClearChat={clearCurrentChat}
        onExport={handleExport}
      />

      {/* Main Chat Area - Full messages display like Lovable */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatHeader
          title={activeSession?.title || 'VALA AI'}
          onExport={handleExport}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          onOpenHistory={() => setShowHistoryPanel(true)}
          onClearChat={clearCurrentChat}
          onOpenSearch={() => setShowSearchPanel(true)}
          onOpenShortcuts={() => setShowShortcuts(true)}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />

        {/* AI Status Bar */}
        <AiStatusBar
          isLoading={isLoading}
          isConnected={true}
          tokensReceived={aiStatus.tokensReceived}
          elapsedTime={aiStatus.elapsedTime}
          error={aiStatus.error}
          model={selectedModel.split('/').pop() || 'gemini-3-flash'}
        />

        {/* Messages Area — scrollable, fills remaining space */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {activeSession && activeSession.messages.length > 0 ? (
            <div className="max-w-4xl mx-auto px-4 pb-32 pt-4">
              {activeSession.messages.map((message, index) => (
                <div key={message.id} id={`message-${message.id}`}>
                  <ChatMessage
                    message={message}
                    index={index}
                    isPinned={pinnedMessages.has(message.id)}
                    onPin={handlePinMessage}
                    onUnpin={handleUnpinMessage}
                  />
                </div>
              ))}
              {isLoading && (
                <ThinkingIndicator isActive={true} context={thinkingContext} />
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            /* Welcome screen when no messages */
            <div className="flex flex-col items-center justify-center min-h-full py-20 text-center px-8">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-lg">
                <span className="text-4xl">🤖</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">VALA AI</h2>
              <p className="text-muted-foreground mb-10 max-w-md text-base leading-relaxed">
                Full-Stack Developer + Business Automation Expert.<br />
                Kuch bhi poocho — code, deploy, analyze, audit.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl w-full">
                {[
                  { emoji: '🔍', text: 'GitHub repos audit karo' },
                  { emoji: '🚀', text: 'Server status check karo' },
                  { emoji: '💡', text: 'New product idea suggest karo' },
                  { emoji: '🛡️', text: 'Security scan karo' },
                  { emoji: '📊', text: 'System health report do' },
                  { emoji: '🔑', text: 'License key generate karo' },
                ].map(({ emoji, text }) => (
                  <button
                    key={text}
                    onClick={() => handleSuggestionClick(`${emoji} ${text}`)}
                    className="flex items-center gap-3 text-left p-4 rounded-xl border border-border/50 bg-card/40 hover:bg-card hover:border-primary/40 hover:shadow-md transition-all text-sm text-muted-foreground hover:text-foreground group"
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform">{emoji}</span>
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Input — sticky at bottom */}
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-md shadow-lg">
          <div className="max-w-4xl mx-auto">
            <ChatInput onSend={handleSend} isLoading={isLoading} onVoiceMessage={handleVoiceMessage} />
          </div>
        </div>
      </div>

      {/* History Panel */}
      <ChatHistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        messages={activeSession?.messages || []}
        onRestore={restoreToMessage}
      />

      {/* Search Dialog */}
      <ChatSearch
        isOpen={showSearchPanel}
        onClose={() => setShowSearchPanel(false)}
        messages={activeSession?.messages || []}
        onNavigateToMessage={handleNavigateToMessage}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcuts
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Working Developer Indicator */}
      <WorkingDeveloperIndicator forceWorking={isLoading} />
    </div>
  );
}
