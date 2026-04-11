import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  aiIntegrationManager, 
  AIProvider, 
  AIModel 
} from '@/lib/ai-integrations';
import {
  Bot, Send, Code, Image, Volume2, MessageSquare, Zap, Play, Download,
  CheckCircle2, XCircle, Clock, TrendingUp, BarChart3, Activity,
  Lightbulb, Cpu, Globe, Database, Package, Rocket, Terminal,
  Mic, MicOff, Camera, Upload, FileText, Settings, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemoMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: 'text' | 'code' | 'image' | 'audio' | 'file';
  provider: AIProvider;
  model: string;
  timestamp: Date;
  metrics?: {
    responseTime: number;
    tokens: number;
    cost: number;
  };
  error?: string;
}

interface LiveDemoStats {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  totalCost: number;
  activeProviders: number;
  topProvider: AIProvider;
}

export default function LiveAIDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4-turbo');
  const [isGenerating, setIsGenerating] = useState(false);
  const [demoMode, setDemoMode] = useState<'chat' | 'code' | 'image' | 'voice'>('chat');
  const [stats, setStats] = useState<LiveDemoStats>({
    totalRequests: 0,
    successRate: 100,
    avgResponseTime: 0,
    totalCost: 0,
    activeProviders: 0,
    topProvider: 'openai'
  });
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [generatedAudio, setGeneratedAudio] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const providers: AIProvider[] = ['openai', 'anthropic', 'google', 'cohere', 'mistral', 'groq', 'deepseek', 'zhipu'];

  useEffect(() => {
    initializeDemo();
    const interval = updateStats;
    const timer = setInterval(interval, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeDemo = async () => {
    // Check available providers
    const activeProviders: AIProvider[] = [];
    for (const provider of providers) {
      try {
        const config = await aiIntegrationManager.getProviderConfig(provider);
        const apiKey = await aiIntegrationManager.getApiKey(provider);
        if (config && apiKey) {
          activeProviders.push(provider);
        }
      } catch (error) {
        console.log(`Provider ${provider} not configured`);
      }
    }
    setAvailableProviders(activeProviders);

    // Add welcome message
    const welcomeMessage: DemoMessage = {
      id: 'welcome',
      role: 'system',
      content: `🚀 Welcome to the **Live AI Demo**!

This is a real-time demonstration of the comprehensive AI integration system. You can:

💬 **Chat** with multiple AI providers
💻 **Generate code** with specialized models
🖼️ **Create images** with DALL-E and Stable Diffusion
🎤 **Synthesize speech** with ElevenLabs and OpenAI

**Available Providers:** ${activeProviders.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}

Select a provider and model, then start interacting with the AI!`,
      type: 'text',
      provider: 'system',
      model: 'demo',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  };

  const updateStats = () => {
    const userMessages = messages.filter(m => m.role === 'user');
    const successfulMessages = messages.filter(m => m.role === 'assistant' && !m.error);
    const responseTimes = messages
      .filter(m => m.metrics?.responseTime)
      .map(m => m.metrics!.responseTime);
    const totalCost = messages
      .filter(m => m.metrics?.cost)
      .reduce((sum, m) => sum + m.metrics!.cost, 0);

    const providerCounts = messages
      .filter(m => m.role === 'assistant')
      .reduce((acc, m) => {
        acc[m.provider] = (acc[m.provider] || 0) + 1;
        return acc;
      }, {} as Record<AIProvider, number>);

    const topProvider = Object.entries(providerCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] as AIProvider || 'openai';

    setStats({
      totalRequests: userMessages.length,
      successRate: userMessages.length > 0 ? (successfulMessages.length / userMessages.length) * 100 : 100,
      avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      totalCost,
      activeProviders: availableProviders.length,
      topProvider
    });
  };

  const addMessage = useCallback((message: Omit<DemoMessage, 'id' | 'timestamp'>) => {
    const newMessage: DemoMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const generateResponse = async (prompt: string, type: 'text' | 'code' | 'image' | 'audio') => {
    if (!availableProviders.includes(selectedProvider)) {
      toast.error(`Provider ${selectedProvider} is not configured`);
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      let response;
      let metrics;

      switch (type) {
        case 'text':
          response = await aiIntegrationManager.generateText(selectedProvider, prompt);
          metrics = {
            responseTime: Date.now() - startTime,
            tokens: response.usage?.totalTokens || 0,
            cost: response.usage?.totalTokens ? response.usage.totalTokens * 0.00001 : 0
          };
          addMessage({
            role: 'assistant',
            content: response.content,
            type: 'text',
            provider: selectedProvider,
            model: selectedModel,
            metrics
          });
          break;

        case 'code':
          response = await aiIntegrationManager.generateCode(selectedProvider, prompt, {
            provider: selectedProvider,
            model: selectedModel,
            language: 'typescript',
            framework: 'react',
            includeTests: true,
            includeDocs: true
          });
          metrics = {
            responseTime: Date.now() - startTime,
            tokens: response.usage?.totalTokens || 0,
            cost: response.usage?.totalTokens ? response.usage.totalTokens * 0.00001 : 0
          };
          addMessage({
            role: 'assistant',
            content: response.content,
            type: 'code',
            provider: selectedProvider,
            model: selectedModel,
            metrics
          });
          break;

        case 'image':
          const imageUrl = await aiIntegrationManager.generateImage(
            selectedProvider as 'openai' | 'stability',
            prompt,
            {
              provider: selectedProvider as 'openai' | 'stability',
              model: selectedProvider === 'openai' ? 'dall-e-3' : 'stable-diffusion-xl',
              size: '1024x1024',
              quality: 'standard',
              style: 'vivid'
            }
          );
          metrics = {
            responseTime: Date.now() - startTime,
            tokens: 0,
            cost: 0.04 // DALL-E roughly costs $0.04 per image
          };
          setGeneratedImage(imageUrl);
          addMessage({
            role: 'assistant',
            content: `Image generated: ${prompt}`,
            type: 'image',
            provider: selectedProvider,
            model: selectedModel,
            metrics
          });
          break;

        case 'audio':
          const audioBuffer = await aiIntegrationManager.generateVoice(
            selectedProvider as 'openai' | 'elevenlabs',
            prompt,
            {
              provider: selectedProvider as 'openai' | 'elevenlabs',
              voiceId: 'rachel',
              model: selectedProvider === 'openai' ? 'tts-1' : 'eleven-multilingual-v2',
              speed: 1.0
            }
          );
          metrics = {
            responseTime: Date.now() - startTime,
            tokens: 0,
            cost: 0.015 // TTS roughly costs $0.015 per 1000 characters
          };
          const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setGeneratedAudio(audioUrl);
          addMessage({
            role: 'assistant',
            content: `Audio generated: ${prompt}`,
            type: 'audio',
            provider: selectedProvider,
            model: selectedModel,
            metrics
          });
          break;
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} generated successfully`);
    } catch (error) {
      addMessage({
        role: 'assistant',
        content: `Error: ${error.message}`,
        type: 'text',
        provider: selectedProvider,
        model: selectedModel,
        error: error.message
      });
      toast.error(`Failed to generate ${type}: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: DemoMessage = {
      role: 'user',
      content: inputValue,
      type: demoMode === 'chat' ? 'text' : demoMode,
      provider: selectedProvider,
      model: selectedModel,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    const prompt = inputValue;
    setInputValue('');

    // Generate response based on mode
    generateResponse(prompt, demoMode as 'text' | 'code' | 'image' | 'audio');
  };

  const runQuickDemo = async () => {
    const demos = [
      { mode: 'chat' as const, prompt: "Explain quantum computing in simple terms" },
      { mode: 'code' as const, prompt: "Create a React component for a todo list with TypeScript" },
      { mode: 'image' as const, prompt: "A futuristic AI assistant helping developers code" },
      { mode: 'voice' as const, prompt: "Welcome to the live AI demonstration. This system showcases multiple AI providers working together seamlessly." }
    ];

    for (const demo of demos) {
      setDemoMode(demo.mode);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userMessage: DemoMessage = {
        role: 'user',
        content: demo.prompt,
        type: demo.mode,
        provider: selectedProvider,
        model: selectedModel,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      await generateResponse(demo.prompt, demo.mode);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  };

  const clearChat = () => {
    setMessages([]);
    setGeneratedImage('');
    setGeneratedAudio('');
    initializeDemo();
  };

  const exportChat = () => {
    const chatData = {
      messages,
      stats,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-demo-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Chat exported successfully');
  };

  const getAvailableModels = () => {
    return aiIntegrationManager.getModelsByProvider(selectedProvider);
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'chat': return <MessageSquare className="h-4 w-4" />;
      case 'code': return <Code className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'voice': return <Volume2 className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-500/20 text-green-400 border-green-500/30',
      anthropic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      google: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cohere: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      mistral: 'bg-red-500/20 text-red-400 border-red-500/30',
      groq: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      deepseek: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      zhipu: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
    };
    return colors[provider] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Live AI Demo</h1>
          <p className="text-sm text-muted-foreground">
            Real-time demonstration of multi-provider AI integration
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={runQuickDemo} disabled={isGenerating}>
            <Play className="h-4 w-4 mr-2" />
            Quick Demo
          </Button>
          <Button variant="outline" onClick={exportChat}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={clearChat}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.totalRequests}</div>
            <div className="text-xs text-muted-foreground">Total Requests</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.avgResponseTime.toFixed(0)}ms</div>
            <div className="text-xs text-muted-foreground">Avg Response</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.activeProviders}</div>
            <div className="text-xs text-muted-foreground">Active Providers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.topProvider}</div>
            <div className="text-xs text-muted-foreground">Top Provider</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chat Interface */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Interaction
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getProviderColor(selectedProvider)}>
                    {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
                  </Badge>
                  <Badge variant="secondary">{selectedModel}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode Selection */}
              <Tabs value={demoMode} onValueChange={(value) => setDemoMode(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-2">
                    <Code className="h-4 w-4" />
                    Code
                  </TabsTrigger>
                  <TabsTrigger value="image" className="gap-2">
                    <Image className="h-4 w-4" />
                    Image
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="gap-2">
                    <Volume2 className="h-4 w-4" />
                    Voice
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Messages */}
              <div className="h-[500px] overflow-y-auto space-y-4 p-4 bg-background rounded-lg border">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg p-3",
                        message.role === 'user'
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-xs", getProviderColor(message.provider))}>
                          {message.provider}
                        </Badge>
                        {message.metrics && (
                          <span className="text-xs text-muted-foreground">
                            {message.metrics.responseTime}ms
                          </span>
                        )}
                      </div>
                      
                      {message.type === 'code' ? (
                        <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                          {message.content}
                        </pre>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          {message.content.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                              {line || <br />}
                            </p>
                          ))}
                        </div>
                      )}
                      
                      {message.error && (
                        <p className="text-sm text-red-500 mt-2">{message.error}</p>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium">YOU</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Generated Content Display */}
              {(generatedImage || generatedAudio) && (
                <div className="space-y-2">
                  {generatedImage && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Generated Image</h4>
                      <img src={generatedImage} alt="Generated" className="max-w-full rounded-lg" />
                    </div>
                  )}
                  {generatedAudio && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Generated Audio</h4>
                      <audio controls className="w-full">
                        <source src={generatedAudio} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder={
                    demoMode === 'chat' ? "Type your message..." :
                    demoMode === 'code' ? "Describe the code you want to generate..." :
                    demoMode === 'image' ? "Describe the image you want to create..." :
                    "Enter text to synthesize as speech..."
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 min-h-[80px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isGenerating}
                  className="self-end"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Provider Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">AI Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as AIProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map(provider => (
                    <SelectItem key={provider} value={provider}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableModels().map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Available Providers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Available Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {providers.map(provider => {
                const isAvailable = availableProviders.includes(provider);
                return (
                  <div key={provider} className="flex items-center gap-2">
                    {isAvailable ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">{provider.charAt(0).toUpperCase() + provider.slice(1)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputValue("Explain machine learning in simple terms");
                  setDemoMode('chat');
                }}
                className="w-full justify-start"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                AI Explanation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputValue("Create a simple calculator component");
                  setDemoMode('code');
                }}
                className="w-full justify-start"
              >
                <Code className="h-4 w-4 mr-2" />
                Generate Code
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputValue("A beautiful sunset over mountains");
                  setDemoMode('image');
                }}
                className="w-full justify-start"
              >
                <Image className="h-4 w-4 mr-2" />
                Create Image
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInputValue("Hello, welcome to the AI demo!");
                  setDemoMode('voice');
                }}
                className="w-full justify-start"
              >
                <Volume2 className="h-4 w-4 mr-2" />
                Synthesize Speech
              </Button>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">System Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Integration Manager</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <div className="flex justify-between">
                <span>Real-time Updates</span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
              <div className="flex justify-between">
                <span>Multi-provider Support</span>
                <Badge variant="secondary">10+ Providers</Badge>
              </div>
              <div className="flex justify-between">
                <span>Model Types</span>
                <Badge variant="secondary">Text, Code, Image, Voice</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
