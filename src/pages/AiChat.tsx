import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatSidebar } from '@/components/ai-chat/ChatSidebar';
import { ChatHeader } from '@/components/ai-chat/ChatHeader';
import { ChatMessage, Message, FileAttachment } from '@/components/ai-chat/ChatMessage';
import { ChatInput } from '@/components/ai-chat/ChatInput';
import { EmptyState } from '@/components/ai-chat/EmptyState';
import { HostingCredentialsModal, HostingCredentials } from '@/components/ai-chat/HostingCredentialsModal';
import { ThinkingIndicator } from '@/components/ai-chat/ThinkingIndicator';
import { ChatHistoryPanel } from '@/components/ai-chat/ChatHistoryPanel';
import { SmartSuggestions } from '@/components/ai-chat/SmartSuggestions';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

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
  
  // Hosting modal state
  const [showHostingModal, setShowHostingModal] = useState(false);
  const [pendingDeployFile, setPendingDeployFile] = useState<{
    filePath: string;
    fileName: string;
    fileId: string;
    analysisResult: any;
  } | null>(null);

  // History panel state
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  // Context for thinking indicator
  const [thinkingContext, setThinkingContext] = useState<'analyzing' | 'fixing' | 'deploying' | 'general'>('general');

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
                  
                  // Save for deployment
                  setPendingDeployFile({
                    filePath,
                    fileName: file.name,
                    fileId,
                    analysisResult: result
                  });
                  
                  // Auto-show hosting modal after short delay
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

  // Handle hosting credentials submission and deploy
  const handleHostingDeploy = async (credentials: HostingCredentials) => {
    if (!pendingDeployFile) return;
    
    toast.info('🚀 Starting deployment to your server...');
    
    try {
      const { data, error } = await supabase.functions.invoke('auto-deploy-pipeline', {
        body: {
          filePath: pendingDeployFile.filePath,
          deploymentId: pendingDeployFile.fileId,
          hostingCredentials: {
            type: credentials.type,
            host: credentials.host,
            username: credentials.username,
            password: credentials.password,
            port: parseInt(credentials.port),
            path: credentials.path,
          }
        }
      });

      if (error) {
        toast.error('Deployment failed: ' + error.message);
        return;
      }

      // Add deployment result to chat
      const deployResult = data as any;
       const demoUser = deployResult.demoCredentials?.username || 'demo_user';
       const demoPass = deployResult.demoCredentials?.password || 'demo123';
       
       const deployMessage = `
 🚀 **DEPLOYMENT PIPELINE COMPLETE!**
 
 **Status:** ${deployResult.deployment?.status === 'ready' ? '✅ Ready for Transfer' : deployResult.deployment?.status === 'failed' ? '❌ Failed' : '⚠️ ' + deployResult.deployment?.status}
 
 **Framework Detected:** ${deployResult.analysis?.framework || 'Unknown'}
 **Language:** ${deployResult.analysis?.language || 'Unknown'}
 **File Size:** ${deployResult.analysis?.size || 'N/A'}
 
 ---
 
 **📊 Analysis Summary:**
 - Security fixes applied: ${deployResult.fixes?.applied || 0}
 - Security issues found: ${deployResult.security?.issues || 0}
 - Tests passed: ${deployResult.tests?.passed || 0}
 
 ---
 
 **🔑 DEMO CREDENTIALS:**
 \`\`\`
 Username: ${demoUser}
 Password: ${demoPass}
 \`\`\`
 *(Use these for testing after uploading to your server)*
 
 ---
 
 ${deployResult.deployment?.url ? `**Target URL:** ${deployResult.deployment.url}` : ''}
 ${credentials.domain ? `**Domain:** ${credentials.domain}` : ''}
 
 **⚠️ Note:** File is analyzed and ready. For actual server upload, please use FTP client (FileZilla) or your hosting panel to upload the file from our storage.
 
 *Powered by SoftwareVala™*
 `;

      // Add to session
      const deployMessageObj: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: deployMessage,
        timestamp: new Date()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, deployMessageObj] };
        }
        return s;
      }));

      toast.success('🎉 Deployment successful!');
      
    } catch (err: any) {
      toast.error('Deploy failed: ' + err.message);
    }
    
    setPendingDeployFile(null);
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
          onOpenHistory={() => setShowHistoryPanel(true)}
          onClearChat={clearCurrentChat}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!activeSession || activeSession.messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="pb-4">
              {activeSession.messages.map((message, index) => (
                <ChatMessage key={message.id} message={message} index={index} />
              ))}
              {/* Enhanced Thinking Indicator */}
              <ThinkingIndicator 
                isActive={isLoading && activeSession.messages[activeSession.messages.length - 1]?.role === 'user'} 
                context={thinkingContext}
              />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Smart Suggestions */}
        {activeSession && activeSession.messages.length > 0 && !isLoading && (
          <SmartSuggestions
            lastMessage={activeSession.messages[activeSession.messages.length - 1]?.content}
            isLoading={isLoading}
            onSelect={handleSuggestionClick}
            hasFiles={activeSession.messages.some(m => m.files && m.files.length > 0)}
          />
        )}

        {/* Input Area */}
        <ChatInput onSend={handleSend} isLoading={isLoading} onVoiceMessage={handleVoiceMessage} />
      </div>

      {/* History Panel */}
      <ChatHistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        messages={activeSession?.messages || []}
        onRestore={restoreToMessage}
      />

      {/* Hosting Credentials Modal */}
      <HostingCredentialsModal
        open={showHostingModal}
        onOpenChange={setShowHostingModal}
        onSubmit={handleHostingDeploy}
        fileName={pendingDeployFile?.fileName}
      />
    </div>
  );
}
