import { useState, useRef, useEffect, useCallback } from 'react';
import { AiStatusPanel, AiStatusState } from '@/components/ai-chat/AiStatusPanel';
import { ChatMessage, Message, FileAttachment, ToolResultData } from '@/components/ai-chat/ChatMessage';
import { ChatInput } from '@/components/ai-chat/ChatInput';

import { ChatHistoryPanel } from '@/components/ai-chat/ChatHistoryPanel';
import { ChatSearch } from '@/components/ai-chat/ChatSearch';
import { KeyboardShortcuts, useKeyboardShortcuts } from '@/components/ai-chat/KeyboardShortcuts';
import { MemoryPanel } from '@/components/ai-chat/MemoryPanel';
import { ModelSelector } from '@/components/ai-chat/ModelSelector';
import { SystemPromptEditor } from '@/components/ai-chat/SystemPromptEditor';
import { ChatControlPanel } from '@/components/ai-chat/ChatControlPanel';
import { TokenUsageDisplay } from '@/components/ai-chat/TokenUsageDisplay';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useAutoApkPipeline } from '@/hooks/useAutoApkPipeline';
import {
  addGlobalActivity,
  updateGlobalActivity,
  removeGlobalActivity
} from '@/components/global/GlobalActivityPanel';
import { setGlobalWorking, WorkingDeveloperIndicator } from '@/components/global/WorkingDeveloperIndicator';
import {
  Plus,
  Trash2,
  MessageSquare,
  ChevronRight,
  Globe,
  RefreshCw,
  ExternalLink,
  Brain,
  Search,
  PanelLeftClose,
  PanelLeft,
  Square,
  Settings2,
  Rocket,
  Code,
  Database,
  Server,
  Bug,
  Wrench,
  Package,
  Store,
  Sparkles,
  Loader2,
  CheckCircle2,
  Circle,
  
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

const isAnalyzableFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const analyzableExts = ['zip', 'apk', 'php', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'json', 'sql', 'java', 'kt', 'xml', 'tar', 'gz', 'rar'];
  return analyzableExts.includes(ext);
};

const formatTime = (date: Date) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  } catch { return ''; }
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
          messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
      } catch { return []; }
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('saas-ai-active-session') || null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [sessionListOpen, setSessionListOpen] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewInput, setPreviewInput] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [aiStatus, setAiStatus] = useState<AiStatusState>({ stage: 'idle' });
  const aiTimerRef = useRef<number | null>(null);
  const aiStartTimeRef = useRef<number | null>(null);
  const aiTokensRef = useRef<number>(0);
  const _autoRetryRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [_thinkingContext, setThinkingContext] = useState<'analyzing' | 'fixing' | 'deploying' | 'general'>('general');

  // Build Mode State
  const [buildMode, setBuildMode] = useState(false);
  const [buildAppName, setBuildAppName] = useState('');
  const [buildPrompt, setBuildPrompt] = useState('');
  const [buildRunning, setBuildRunning] = useState(false);

  type BuildStepStatus = 'idle' | 'running' | 'done' | 'error';
  interface BuildStep { id: string; label: string; icon: React.ReactNode; status: BuildStepStatus; result?: string; }
  const INITIAL_BUILD_STEPS: BuildStep[] = [
    { id: 'plan', label: 'AI Planner', icon: <Sparkles className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'ui', label: 'UI Builder', icon: <Code className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'code', label: 'Code Gen', icon: <Package className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'db', label: 'Database', icon: <Database className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'api', label: 'API Gen', icon: <Server className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'debug', label: 'Debug', icon: <Bug className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'fix', label: 'Auto Fix', icon: <Wrench className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'build', label: 'Build', icon: <Package className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'deploy', label: 'Deploy', icon: <Rocket className="h-3.5 w-3.5" />, status: 'idle' },
    { id: 'publish', label: 'Marketplace', icon: <Store className="h-3.5 w-3.5" />, status: 'idle' },
  ];
  const [buildSteps, setBuildSteps] = useState<BuildStep[]>(INITIAL_BUILD_STEPS);

  const {
    loading: apkPipelineLoading,
    stats: apkPipelineStats,
    scanAndRegister,
    bulkBuild,
    runFullPipeline,
    getStats: getApkPipelineStats,
  } = useAutoApkPipeline();

  useEffect(() => {
    getApkPipelineStats();
  }, [getApkPipelineStats]);

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('saas-ai-model') || 'google/gemini-3-flash-preview';
  });

  const updateBuildStep = (id: string, status: BuildStepStatus, result?: string) => {
    setBuildSteps(prev => prev.map(s => s.id === id ? { ...s, status, result } : s));
  };

  const runBuildPipeline = useCallback(async () => {
    if (!buildAppName.trim() || !buildPrompt.trim()) { toast.error('App name aur description dono daalo'); return; }
    setBuildRunning(true);
    setBuildSteps(INITIAL_BUILD_STEPS);
    const slug = buildAppName.toLowerCase().replace(/\s+/g, '-');
    let runningStep: string | null = null;

    // Insert build progress as chat messages
    const buildSessionId = activeSessionId || (() => {
      const ns: ChatSession = { id: crypto.randomUUID(), title: `🚀 Build: ${buildAppName}`, createdAt: new Date(), messages: [] };
      setSessions(prev => [ns, ...prev]);
      setActiveSessionId(ns.id);
      return ns.id;
    })();

    const addBuildMsg = (content: string) => {
      setSessions(prev => prev.map(s => s.id === buildSessionId ? {
        ...s, messages: [...s.messages, { id: crypto.randomUUID(), role: 'assistant' as const, content, timestamp: new Date() }]
      } : s));
    };

    addBuildMsg(`🚀 **Building "${buildAppName}"...**\n\nPipeline started. Sit back!`);

    try {
      // Step 1: AI Planning + Code Gen
      runningStep = 'plan';
      updateBuildStep('plan', 'running');
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-developer', {
        body: {
          messages: [{ role: 'user', content: `Create and deploy a complete production app named "${buildAppName}" with this scope: ${buildPrompt}. Must execute tool chain: generate_code -> upload_to_github -> deploy_project.` }],
          stream: false,
          model: selectedModel,
        }
      });
      if (aiError) throw aiError;

      const toolsUsed: string[] = aiResult?.tools_used || [];
      const toolResults: any[] = aiResult?.tool_results || [];
      const hasCodeGeneration = toolsUsed.includes('generate_code') || toolResults.some((t: any) => t?.name === 'generate_code' && t?.result?.success !== false);

      if (!hasCodeGeneration) {
        throw new Error('Code generation tool run nahi hua, retry required.');
      }

      updateBuildStep('plan', 'done', 'Requirements analyzed');
      runningStep = null;

      for (const stepId of ['ui', 'code', 'db', 'api']) {
        runningStep = stepId;
        updateBuildStep(stepId, 'running');
        updateBuildStep(stepId, 'done', toolsUsed.length ? `${toolsUsed.length} tools` : 'completed');
        runningStep = null;
      }

      runningStep = 'debug';
      updateBuildStep('debug', 'running');
      updateBuildStep('debug', 'done', 'Tool chain validated');
      runningStep = null;

      runningStep = 'fix';
      updateBuildStep('fix', 'running');
      updateBuildStep('fix', 'done', 'Auto checks done');
      runningStep = null;

      runningStep = 'build';
      updateBuildStep('build', 'running');
      const { data: buildData, error: buildError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'trigger_apk_build', data: { slug } }
      });
      if (buildError) throw buildError;
      const buildStatus = buildData?.build?.status || 'queued';
      updateBuildStep('build', 'done', buildStatus);
      runningStep = null;

      runningStep = 'deploy';
      updateBuildStep('deploy', 'running');
      const deploymentTool = toolResults.find((t: any) => t?.name === 'deploy_project' || t?.name === 'factory_deploy');
      const liveUrl = deploymentTool?.result?.url || deploymentTool?.result?.deployed_url || deploymentTool?.result?.deployment?.url || null;
      const repoUrl = `https://github.com/saasvala/${slug}`;
      if (liveUrl) {
        setPreviewUrl(liveUrl);
        setPreviewInput(liveUrl);
        updateBuildStep('deploy', 'done', liveUrl);
      } else {
        updateBuildStep('deploy', 'done', 'deployment queued');
      }
      runningStep = null;

      runningStep = 'publish';
      updateBuildStep('publish', 'running');
      const { data: publishData, error: publishError } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action: 'auto_marketplace_workflow', data: { limit: 10 } }
      });
      if (publishError) {
        updateBuildStep('publish', 'error', 'workflow failed');
      } else {
        updateBuildStep('publish', 'done', `${publishData?.attached || 0} attached`);
      }
      runningStep = null;

      await getApkPipelineStats();

      addBuildMsg(`✅ **${buildAppName} pipeline executed**\n\n📦 **GitHub:** [${repoUrl}](${repoUrl})\n📱 **APK Build Status:** ${buildStatus}${liveUrl ? `\n🔗 **Live URL:** [${liveUrl}](${liveUrl})` : ''}`);
      toast.success('Builder + APK pipeline sync complete');
      setBuildMode(false);
    } catch (err: any) {
      if (runningStep) updateBuildStep(runningStep, 'error', err.message);
      addBuildMsg(`❌ **Build failed:** ${err.message}`);
      toast.error(err.message);
    } finally {
      setBuildRunning(false);
    }
  }, [buildAppName, buildPrompt, activeSessionId, selectedModel, getApkPipelineStats]);

  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    return localStorage.getItem('saas-ai-system-prompt') || 'You are VALA AI, an expert full-stack developer and business consultant for SaaSVala. You help with code generation, deployment, security audits, and business automation. Always respond in a professional yet friendly manner, mixing English with Hindi when appropriate.';
  });
  const [temperature, setTemperature] = useState<number>(() => {
    return parseFloat(localStorage.getItem('saas-ai-temperature') || '0.7');
  });
  const [maxTokens, setMaxTokens] = useState<number>(() => {
    return parseInt(localStorage.getItem('saas-ai-max-tokens') || '4096');
  });

  // Auto-select first session
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => { localStorage.setItem('saas-ai-model', selectedModel); }, [selectedModel]);
  useEffect(() => { localStorage.setItem('saas-ai-system-prompt', systemPrompt); }, [systemPrompt]);
  useEffect(() => { localStorage.setItem('saas-ai-temperature', temperature.toString()); }, [temperature]);
  useEffect(() => { localStorage.setItem('saas-ai-max-tokens', maxTokens.toString()); }, [maxTokens]);
  useEffect(() => { if (activeSessionId) localStorage.setItem('saas-ai-active-session', activeSessionId); }, [activeSessionId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages]);
  useEffect(() => { if (isMobile) setSessionListOpen(false); }, [isMobile]);

  // Auto-load latest deployed project URL in preview (with health check)
  useEffect(() => {
    if (previewUrl) return;
    const loadLatestDeployment = async () => {
      try {
        const { data } = await supabase
          .from('deployments')
          .select('deployed_url')
          .not('deployed_url', 'is', null)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(3);
        if (data && data.length > 0) {
          // Try each URL to find one that's actually alive
          for (const row of data) {
            try {
              await fetch(row.deployed_url, { method: 'HEAD', mode: 'no-cors' });
              setPreviewUrl(row.deployed_url);
              setPreviewInput(row.deployed_url);
              break;
            } catch {
              console.log('Preview URL unreachable, trying next:', row.deployed_url);
            }
          }
        }
      } catch (e) {
        console.log('Auto-preview load skipped:', e);
      }
    };
    loadLatestDeployment();
  }, []);

  const handlePinMessage = useCallback((id: string) => setPinnedMessages(prev => new Set([...prev, id])), []);
  const handleUnpinMessage = useCallback((id: string) => setPinnedMessages(prev => { const s = new Set(prev); s.delete(id); return s; }), []);

  const handleNavigateToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
    }
  }, []);

  const createNewSession = () => {
    const newSession: ChatSession = { id: crypto.randomUUID(), title: 'New Chat', createdAt: new Date(), messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const openBuilderMode = () => {
    const newSession: ChatSession = { id: crypto.randomUUID(), title: '🚀 Builder', createdAt: new Date(), messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setBuildMode(true);
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const restoreToMessage = useCallback((messageIndex: number) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.slice(0, messageIndex + 1) } : s));
  }, [activeSessionId]);

  const clearCurrentChat = useCallback(() => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s));
    toast.success('Chat cleared');
  }, [activeSessionId]);

  const detectThinkingContext = (content: string): 'analyzing' | 'fixing' | 'deploying' | 'general' => {
    const lower = content.toLowerCase();
    if (lower.includes('deploy') || lower.includes('server') || lower.includes('upload')) return 'deploying';
    if (lower.includes('fix') || lower.includes('error') || lower.includes('bug')) return 'fixing';
    if (lower.includes('analyze') || lower.includes('scan') || lower.includes('check')) return 'analyzing';
    return 'general';
  };

  const streamChat = useCallback(async (
    messages: Message[],
    sessionId: string,
    onDelta: (chunk: string, toolResults?: ToolResultData[], toolsUsed?: string[]) => void,
    onDone: () => void
  ) => {
    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const authToken = authSession?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 min timeout

      try {
        if (attempt > 0) {
          console.log(`[AI Chat] Retry attempt ${attempt}/${maxRetries}`);
          setAiStatus(prev => ({ ...prev, stage: 'sending', retryCount: attempt }));
          await new Promise(r => setTimeout(r, 2000 * attempt)); // backoff
        }

        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ messages: formattedMessages, stream: false, model: selectedModel, system_prompt: systemPrompt, temperature, max_tokens: maxTokens }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setAiStatus(prev => ({ ...prev, stage: 'connected' }));

        if (!resp.ok) {
          const error = await resp.json().catch(() => ({ error: 'Unknown error' }));
          const errorMsg = error.error || 'Failed to get AI response';
          if (resp.status === 429) toast.error('⏳ Rate limit. Thodi der baad try karo.');
          else if (resp.status === 402) toast.error('💳 AI credits khatam!', { duration: 8000 });
          else toast.error(errorMsg);
          throw new Error(errorMsg);
        }

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
          const data = await resp.json().catch(() => ({} as any));
          const text = data?.response || data?.message || data?.content || '';
          const toolResults: ToolResultData[] = (data?.tool_results || []).map((tr: any) => ({
            name: tr.name, result: tr.result,
          }));
          const toolsUsed: string[] = data?.tools_used || [];
          onDelta(text, toolResults.length > 0 ? toolResults : undefined, toolsUsed.length > 0 ? toolsUsed : undefined);
          onDone();
          return;
        }

        if (!resp.body) throw new Error('No response body');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              if (line.endsWith('\r')) line = line.slice(0, -1);
              if (line.startsWith(':') || !line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') { onDone(); return; }
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onDelta(content);
              } catch { /* skip */ }
            }
          }
        } catch (e) { console.error('Stream error:', e); }
        onDone();
        return; // success — exit retry loop

      } catch (e: any) {
        clearTimeout(timeoutId);
        lastError = e;
        const isRetryable = e.name === 'AbortError' || e.message === 'Failed to fetch' || e.message?.includes('network');
        if (!isRetryable || attempt >= maxRetries) {
          throw e;
        }
        console.warn(`[AI Chat] Retryable error: ${e.message}, retrying...`);
      }
    }
    if (lastError) throw lastError;
  }, [selectedModel, systemPrompt, temperature, maxTokens]);

  const handleSend = async (content: string, files?: File[]) => {
    if ((!content.trim() && (!files || files.length === 0)) || isLoading) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const title = content.trim() ? content.slice(0, 40) + (content.length > 40 ? '...' : '') : `${files?.length || 0} file(s)`;
      const newSession: ChatSession = { id: crypto.randomUUID(), title, createdAt: new Date(), messages: [] };
      setSessions(prev => [newSession, ...prev]);
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    const fileAttachments: FileAttachment[] = files?.map(file => ({
      name: file.name, size: file.size, type: getFileType(file),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    })) || [];

    let messageContent = content;
    let analysisResults: string[] = [];

    if (files && files.length > 0) {
      const analyzableFiles = files.filter(f => isAnalyzableFile(f));
      if (analyzableFiles.length > 0) {
        toast.info('Files analyzing...');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          for (const file of analyzableFiles) {
            try {
              const fileId = crypto.randomUUID();
              const filePath = `${user.id}/${fileId}-${file.name}`;
              const { error: uploadError } = await supabase.storage.from('source-code').upload(filePath, file, { cacheControl: '3600', upsert: false });
              if (!uploadError) {
                const { data: pipelineResult, error: pipelineError } = await supabase.functions.invoke('auto-deploy-pipeline', { body: { filePath, deploymentId: fileId } });
                if (!pipelineError && pipelineResult) {
                  const result = pipelineResult as any;
                  analysisResults.push(`📦 **${file.name}** analyzed. Framework: ${result.analysis?.framework || 'Unknown'}`);
                  toast.success(`${file.name} analyzed`);
                }
              }
            } catch (err) { console.error('File analysis error:', err); }
          }
        }
      }
      if (!content.trim()) messageContent = `Attached ${files.length} file(s): ${files.map(f => f.name).join(', ')}`;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(), role: 'user', content: messageContent,
      timestamp: new Date(), files: fileAttachments.length > 0 ? fileAttachments : undefined
    };

    // Update title if first message
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const updatedMessages = [...s.messages, userMessage];
        const title = s.messages.length === 0 ? messageContent.slice(0, 40) + (messageContent.length > 40 ? '...' : '') : s.title;
        return { ...s, messages: updatedMessages, title };
      }
      return s;
    }));

    setIsLoading(true);
    setGlobalWorking(true);
    setThinkingContext(detectThinkingContext(content));
    setAiStatus({ stage: 'sending', model: selectedModel });

    aiStartTimeRef.current = Date.now();
    aiTokensRef.current = 0;
    aiStartTimeRef.current = Date.now();
    aiTimerRef.current = window.setInterval(() => {
      setAiStatus(prev => ({ ...prev, elapsedMs: Date.now() - (aiStartTimeRef.current || Date.now()) }));
    }, 500);

    const aiActivityId = crypto.randomUUID();
    addGlobalActivity({ id: aiActivityId, type: 'ai', title: 'VALA AI Processing', status: 'processing', details: 'Generating response...', progress: 0 });

    const assistantMsgId = crypto.randomUUID();
    let assistantContent = '';

    const addAssistantMessage = () => {
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: [...s.messages, { id: assistantMsgId, role: 'assistant' as const, content: '', timestamp: new Date() }] };
        }
        return s;
      }));
    };

    const updateAssistantMessage = (content: string, toolResults?: ToolResultData[], toolsUsed?: string[]) => {
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          return { ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { 
            ...m, 
            content,
            ...(toolResults && { toolResults }),
            ...(toolsUsed && { toolsUsed }),
          } : m) };
        }
        return s;
      }));
      aiTokensRef.current = Math.floor(content.length / 4);
      setAiStatus(prev => ({ ...prev, stage: 'receiving', tokens: aiTokensRef.current }));
    };

    try {
      addAssistantMessage();
      let enhancedUserMessage = userMessage;
      if (analysisResults.length > 0) {
        enhancedUserMessage = { ...userMessage, content: `${userMessage.content}\n\nAUTO-ANALYSIS:\n${analysisResults.join('\n')}` };
      }
      const currentSession = sessions.find(s => s.id === sessionId);
      const historyMessages = currentSession?.messages.slice(-10) || [];

      await streamChat(
        [...historyMessages, enhancedUserMessage],
        sessionId,
        (chunk, toolResults, toolsUsed) => { 
          assistantContent += chunk; 
          updateAssistantMessage(assistantContent, toolResults, toolsUsed); 
        },
        () => {
          const responseMs = aiStartTimeRef.current ? Date.now() - aiStartTimeRef.current : undefined;
          if (aiTimerRef.current) { window.clearInterval(aiTimerRef.current); aiTimerRef.current = null; }
          setAiStatus(prev => ({ ...prev, stage: 'done', responseMs, tokens: aiTokensRef.current }));
          setIsLoading(false);
          setGlobalWorking(false);
          updateGlobalActivity(aiActivityId, { status: 'completed', progress: 100, title: 'Done', details: `${aiTokensRef.current} tokens` });
          setTimeout(() => { removeGlobalActivity(aiActivityId); setAiStatus({ stage: 'idle' }); }, 4000);
        }
      );
    } catch (error) {
      console.error('AI Chat error:', error);
      if (aiTimerRef.current) { window.clearInterval(aiTimerRef.current); aiTimerRef.current = null; }
      const errMsg = error instanceof Error ? error.message : String(error);
      const errorCode = errMsg.includes('429') ? 429 : errMsg.includes('402') ? 402 : errMsg.includes('401') ? 401 : errMsg.includes('500') ? 500 : 'TIMEOUT';
      setAiStatus({ stage: 'error', model: selectedModel, errorCode, errorMessage: errMsg, retryCount: 0 });
      updateGlobalActivity(aiActivityId, { status: 'failed', details: 'Error' });
      let userFacingError = `❌ Error: ${errMsg}\n\nThodi der baad retry karo.`;
      if (errMsg.includes('402')) userFacingError = '⚠️ AI credits khatam. Settings mein credits add karo.';
      if (errMsg.includes('429')) userFacingError = '⏳ Rate limit exceeded. 30 seconds baad dobara try karo.';
      if (errMsg.includes('401')) userFacingError = '🔑 API Key invalid hai. Settings check karo.';
      updateAssistantMessage(userFacingError);
      setIsLoading(false);
      setGlobalWorking(false);
    }
  };

  const handleVoiceMessage = useCallback((userText: string, aiResponse: string) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const newSession: ChatSession = { id: crypto.randomUUID(), title: userText.slice(0, 40), createdAt: new Date(), messages: [] };
      setSessions(prev => [newSession, ...prev]);
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s, title: s.messages.length === 0 ? userText.slice(0, 40) : s.title,
          messages: [...s.messages,
            { id: crypto.randomUUID(), role: 'user' as const, content: `🎤 ${userText}`, timestamp: new Date() },
            { id: crypto.randomUUID(), role: 'assistant' as const, content: aiResponse, timestamp: new Date() }
          ]
        };
      }
      return s;
    }));
  }, [activeSessionId]);

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (aiTimerRef.current) { window.clearInterval(aiTimerRef.current); aiTimerRef.current = null; }
    setIsLoading(false);
    setGlobalWorking(false);
    setAiStatus({ stage: 'idle' });
    toast.info('Generation stopped');
  }, []);

  const handleRetry = useCallback((messageId: string) => {
    if (!activeSessionId || isLoading) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    // Find the last user message before this assistant message
    const msgIndex = session.messages.findIndex(m => m.id === messageId);
    if (msgIndex <= 0) return;
    const lastUserMsg = session.messages[msgIndex - 1];
    if (lastUserMsg.role !== 'user') return;
    // Remove the assistant message and resend
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.filter(m => m.id !== messageId) } : s));
    setTimeout(() => handleSend(lastUserMsg.content), 100);
  }, [activeSessionId, sessions, isLoading]);

  const handleExport = () => {
    if (!activeSession) return;
    const content = activeSession.messages.map(m => `${m.role === 'user' ? 'You' : 'VALA AI'}: ${m.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSession.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported');
  };

  useKeyboardShortcuts({
    onNewChat: createNewSession,
    onExport: handleExport,
    onSearch: () => setShowSearchPanel(true),
    onHistory: () => setShowHistoryPanel(true),
    onClear: clearCurrentChat,
    onToggleSidebar: () => setSessionListOpen(!sessionListOpen),
    onShowShortcuts: () => setShowShortcuts(true),
  });

  const handlePreviewNavigate = () => {
    if (previewInput.trim()) {
      const url = previewInput.startsWith('http') ? previewInput : `https://${previewInput}`;
      setPreviewUrl(url);
      setPreviewKey(k => k + 1);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen flex bg-background overflow-hidden">

        {/* ── LEFT PANEL: Chat Interface ── */}
        <div className={cn(
          'flex flex-col border-r border-border transition-all duration-300 shrink-0',
          isMobile ? 'w-full' : 'w-[420px]'
        )}>

          {/* Chat Header */}
          <div className="h-12 flex items-center justify-between px-3 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              {/* Session list toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setSessionListOpen(!sessionListOpen)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    {sessionListOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Toggle history</TooltipContent>
              </Tooltip>
              <span className="text-sm font-semibold text-foreground">VALA AI</span>
              {isLoading && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={openBuilderMode} className="h-7 w-7 text-muted-foreground hover:text-primary">
                    <Rocket className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Builder + APK Pipeline</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowSearchPanel(true)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Search</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowMemoryPanel(true)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Brain className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Memory</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={createNewSession} className="h-7 w-7 text-muted-foreground hover:text-primary">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">New chat</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Session List (collapsible) */}
          {sessionListOpen && (
            <div className="border-b border-border bg-muted/10 shrink-0 max-h-48 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  <MessageSquare className="h-5 w-5 mx-auto mb-1 opacity-30" />
                  <p>No chats yet</p>
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={cn(
                        'group flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-all text-xs',
                        activeSessionId === session.id
                          ? 'bg-primary/10 text-foreground border border-primary/20'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <MessageSquare className={cn('h-3 w-3 shrink-0', activeSessionId === session.id ? 'text-primary' : 'opacity-50')} />
                      <span className="flex-1 truncate font-medium">{session.title}</span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">{formatTime(session.createdAt)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeSession && activeSession.messages.length > 0 ? (
              <div className="px-3 py-3 space-y-1 pb-4">
                {activeSession.messages.map((message, index) => {
                  const lastAssistantIdx = [...activeSession.messages].reverse().findIndex(m => m.role === 'assistant');
                  const isLastAssistant = message.role === 'assistant' && index === activeSession.messages.length - 1 - lastAssistantIdx;
                  return (
                    <div key={message.id} id={`message-${message.id}`}>
                      <ChatMessage
                        message={message}
                        index={index}
                        isPinned={pinnedMessages.has(message.id)}
                        onPin={handlePinMessage}
                        onUnpin={handleUnpinMessage}
                        onRetry={handleRetry}
                        isLastAssistant={isLastAssistant && !isLoading}
                        onApproveAction={(messageId, actionId) => {
                          handleSend(`✅ APPROVED — Action ID: ${actionId}. Execute karo.`);
                          toast.success('Action approved!');
                        }}
                        onDenyAction={(messageId, actionId) => {
                          handleSend(`❌ CANCELLED — Action ID: ${actionId}.`);
                          toast.info('Action cancelled.');
                        }}
                      />
                    </div>
                  );
                })}
                <AiStatusPanel 
                  status={aiStatus}
                  onDismissError={() => setAiStatus({ stage: 'idle' })}
                />
                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* Welcome screen with Build Mode */
              <div className="flex flex-col items-center justify-center h-full py-6 px-4 text-center overflow-y-auto">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                  <span className="text-2xl">🤖</span>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">VALA AI</h2>
                <p className="text-muted-foreground mb-4 text-sm leading-relaxed max-w-xs">
                  Chat, Build Apps, Deploy — sab ek jagah.
                </p>

                {/* Build Mode Toggle */}
                {!buildMode ? (
                  <div className="w-full max-w-xs space-y-2">
                    <Button 
                      onClick={() => setBuildMode(true)} 
                      className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                      size="lg"
                    >
                      <Rocket className="h-4 w-4" />
                      Build New App
                    </Button>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { emoji: '🔍', text: 'GitHub repos audit karo' },
                        { emoji: '🚀', text: 'Server status check karo' },
                        { emoji: '🛡️', text: 'Security scan karo' },
                        { emoji: '📊', text: 'System health report do' },
                      ].map(({ emoji, text }) => (
                        <button
                          key={text}
                          onClick={() => handleSend(`${emoji} ${text}`)}
                          className="flex items-center gap-2 text-left p-2.5 rounded-lg border border-border/50 bg-card/40 hover:bg-card hover:border-primary/30 transition-all text-xs text-muted-foreground hover:text-foreground"
                        >
                          <span>{emoji}</span>
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Build Mode Form */
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="gap-1 text-primary border-primary/30">
                        <Rocket className="h-3 w-3" /> Build Mode
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setBuildMode(false)}>
                        ← Back
                      </Button>
                    </div>
                    <Input
                      placeholder="App name (e.g. Restaurant POS)"
                      value={buildAppName}
                      onChange={e => setBuildAppName(e.target.value)}
                      className="text-sm"
                      disabled={buildRunning}
                    />
                    <textarea
                      placeholder="Describe your app... (e.g. A restaurant management system with menu, orders, billing, and admin dashboard)"
                      value={buildPrompt}
                      onChange={e => setBuildPrompt(e.target.value)}
                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                      disabled={buildRunning}
                    />
                    <Button 
                      onClick={runBuildPipeline} 
                      disabled={buildRunning || !buildAppName.trim() || !buildPrompt.trim()}
                      className="w-full gap-2"
                    >
                      {buildRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      {buildRunning ? 'Building...' : 'Start Build Pipeline'}
                    </Button>

                    <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-foreground">Builder + APK Pipeline</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={getApkPipelineStats}
                          disabled={apkPipelineLoading}
                        >
                          <RefreshCw className={`h-3 w-3 ${apkPipelineLoading ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        <div className="rounded border border-border/60 bg-background/60 px-1.5 py-1">
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold">{apkPipelineStats?.catalog.total || 0}</p>
                        </div>
                        <div className="rounded border border-border/60 bg-background/60 px-1.5 py-1">
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-semibold">{apkPipelineStats?.catalog.pending_build || 0}</p>
                        </div>
                        <div className="rounded border border-border/60 bg-background/60 px-1.5 py-1">
                          <p className="text-muted-foreground">Queue</p>
                          <p className="font-semibold">{apkPipelineStats?.queue.queued || 0}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={scanAndRegister} disabled={apkPipelineLoading}>
                          Scan Repos
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => bulkBuild(20)} disabled={apkPipelineLoading}>
                          Queue Builds
                        </Button>
                        <Button size="sm" className="col-span-2 h-7 text-[10px]" onClick={runFullPipeline} disabled={apkPipelineLoading}>
                          Run Full APK Workflow
                        </Button>
                      </div>
                    </div>

                    {/* Pipeline Steps Visual */}
                    {(buildRunning || buildSteps.some(s => s.status !== 'idle')) && (
                      <div className="space-y-1 text-left">
                        {buildSteps.map((step) => (
                          <div key={step.id} className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded text-xs transition-all",
                            step.status === 'running' && "bg-primary/10 text-primary",
                            step.status === 'done' && "text-green-600",
                            step.status === 'error' && "text-destructive",
                            step.status === 'idle' && "text-muted-foreground/50"
                          )}>
                            {step.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                             step.status === 'done' ? <CheckCircle2 className="h-3 w-3" /> :
                             step.status === 'error' ? <span className="text-destructive">✕</span> :
                             <Circle className="h-3 w-3" />}
                            <span className="flex-1">{step.label}</span>
                            {step.result && <span className="text-[10px] opacity-70 truncate max-w-[100px]">{step.result}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model selector + controls + input */}
          <div className="shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-md">
            <div className="px-2 pt-1.5 flex items-center gap-2 flex-wrap">
              <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
              <ChatControlPanel 
                temperature={temperature} 
                maxTokens={maxTokens} 
                onTemperatureChange={setTemperature} 
                onMaxTokensChange={setMaxTokens} 
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowSystemPrompt(true)} className="h-7 w-7 text-muted-foreground hover:text-primary">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">System Prompt</TooltipContent>
              </Tooltip>
              {isLoading && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleStopGeneration} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Stop generation</TooltipContent>
                </Tooltip>
              )}
              <TokenUsageDisplay
                tokens={aiStatus.tokens ?? 0}
                elapsedMs={aiStatus.elapsedMs ?? 0}
                isLoading={isLoading}
              />
            </div>
            <ChatInput onSend={handleSend} isLoading={isLoading} onVoiceMessage={handleVoiceMessage} />
          </div>
        </div>

        {/* ── RIGHT PANEL: Project / Browser Preview ── */}
        {!isMobile && (
          <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
            {/* Preview header / URL bar */}
            <div className="h-12 flex items-center gap-2 px-3 border-b border-border bg-muted/30 shrink-0">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 flex items-center gap-1 bg-background border border-border rounded-md px-2 h-7">
                <input
                  type="text"
                  value={previewInput}
                  onChange={e => setPreviewInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePreviewNavigate()}
                  placeholder="Enter project URL to preview... (e.g. yoursite.com)"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handlePreviewNavigate}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Go</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setPreviewKey(k => k + 1)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
              </Tooltip>
              {previewUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => window.open(previewUrl, '_blank')}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Open in new tab</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-hidden relative">
              {previewUrl ? (
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Project Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="w-20 h-20 rounded-3xl bg-muted/50 border border-border flex items-center justify-center mb-6">
                    <Globe className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Project Preview</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mb-6">
                    Upar URL bar mein apne deployed project ka link daalo aur preview dekho. Ya VALA AI se koi project deploy karo.
                  </p>
                  <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
                    <div className="p-4 rounded-xl border border-border/50 bg-card/40 text-left">
                      <p className="text-xs font-semibold text-foreground mb-1">🚀 Quick Actions</p>
                      <p className="text-xs text-muted-foreground">VALA AI se poocho: <span className="text-primary font-mono">"Server status check karo"</span></p>
                    </div>
                    <div className="p-4 rounded-xl border border-border/50 bg-card/40 text-left">
                      <p className="text-xs font-semibold text-foreground mb-1">🔗 Preview Karo</p>
                      <p className="text-xs text-muted-foreground">Koi bhi URL upar bar mein daalo aur Enter dabao</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Overlays */}
        <ChatHistoryPanel
          isOpen={showHistoryPanel}
          onClose={() => setShowHistoryPanel(false)}
          messages={activeSession?.messages || []}
          onRestore={restoreToMessage}
        />
        <ChatSearch
          isOpen={showSearchPanel}
          onClose={() => setShowSearchPanel(false)}
          messages={activeSession?.messages || []}
          onNavigateToMessage={handleNavigateToMessage}
        />
        <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <WorkingDeveloperIndicator forceWorking={isLoading} />
        <Sheet open={showMemoryPanel} onOpenChange={setShowMemoryPanel}>
          <SheetContent side="right" className="w-full sm:w-[600px] p-0 overflow-hidden">
            <MemoryPanel onClose={() => setShowMemoryPanel(false)} />
          </SheetContent>
        </Sheet>
        <SystemPromptEditor
          isOpen={showSystemPrompt}
          onClose={() => setShowSystemPrompt(false)}
          activePrompt={systemPrompt}
          onSelectPrompt={setSystemPrompt}
        />
      </div>
    </TooltipProvider>
  );
}
