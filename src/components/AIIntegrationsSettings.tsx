import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  aiIntegrationManager, 
  AIProvider, 
  AIModel, 
  AIConfig, 
  VoiceConfig, 
  ImageConfig, 
  CodeConfig 
} from '@/lib/ai-integrations';
import {
  Bot, Settings, Key, Zap, Globe, Volume2, Image, Code,
  CheckCircle2, AlertCircle, Eye, EyeOff, Save, TestTube,
  RefreshCw, Upload, Download, Copy, Trash2, Plus
} from 'lucide-react';

interface ProviderStatus {
  provider: AIProvider;
  configured: boolean;
  apiKeyExists: boolean;
  lastTested?: Date;
  status: 'success' | 'error' | 'pending';
}

export default function AIIntegrationsSettings() {
  const [activeTab, setActiveTab] = useState('text');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
  const [configs, setConfigs] = useState<Map<AIProvider, AIConfig>>(new Map());
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [showApiKeys, setShowApiKeys] = useState<Set<AIProvider>>(new Set());
  const [testResults, setTestResults] = useState<Map<AIProvider, string>>(new Map());

  const providers: AIProvider[] = [
    'openai', 'anthropic', 'google', 'elevenlabs', 'stability', 
    'cohere', 'mistral', 'groq', 'deepseek', 'zhipu'
  ];

  const providerInfo: Record<AIProvider, { name: string; description: string; icon: JSX.Element }> = {
    'openai': { 
      name: 'OpenAI', 
      description: 'GPT models, DALL-E, Whisper, TTS',
      icon: <Bot className="h-4 w-4" />
    },
    'anthropic': { 
      name: 'Anthropic', 
      description: 'Claude models for advanced reasoning',
      icon: <Settings className="h-4 w-4" />
    },
    'google': { 
      name: 'Google AI', 
      description: 'Gemini models with multimodal capabilities',
      icon: <Zap className="h-4 w-4" />
    },
    'elevenlabs': { 
      name: 'ElevenLabs', 
      description: 'Advanced voice synthesis and cloning',
      icon: <Volume2 className="h-4 w-4" />
    },
    'stability': { 
      name: 'Stability AI', 
      description: 'Stable Diffusion image generation',
      icon: <Image className="h-4 w-4" />
    },
    'cohere': { 
      name: 'Cohere', 
      description: 'Enterprise-grade language models',
      icon: <Code className="h-4 w-4" />
    },
    'mistral': { 
      name: 'Mistral', 
      description: 'European AI models with multilingual support',
      icon: <Globe className="h-4 w-4" />
    },
    'groq': { 
      name: 'Groq', 
      description: 'Ultra-fast inference for open models',
      icon: <Zap className="h-4 w-4" />
    },
    'deepseek': { 
      name: 'DeepSeek', 
      description: 'Specialized coding models',
      icon: <Code className="h-4 w-4" />
    },
    'zhipu': { 
      name: 'Zhipu AI', 
      description: 'Chinese language models (GLM)',
      icon: <Globe className="h-4 w-4" />
    }
  };

  useEffect(() => {
    loadProviderStatuses();
  }, []);

  const loadProviderStatuses = async () => {
    const statuses: ProviderStatus[] = [];
    
    for (const provider of providers) {
      try {
        const config = await aiIntegrationManager.getProviderConfig(provider);
        const apiKey = await aiIntegrationManager.getApiKey(provider);
        
        statuses.push({
          provider,
          configured: !!config,
          apiKeyExists: !!apiKey,
          status: apiKey ? 'success' : 'pending'
        });
      } catch (error) {
        statuses.push({
          provider,
          configured: false,
          apiKeyExists: false,
          status: 'error'
        });
      }
    }
    
    setProviderStatuses(statuses);
  };

  const handleApiKeyChange = async (provider: AIProvider, apiKey: string) => {
    try {
      if (apiKey.trim()) {
        await aiIntegrationManager.setApiKey(provider, apiKey.trim());
        toast.success(`${providerInfo[provider].name} API key saved`);
      } else {
        // Clear API key logic would go here
        toast.info(`${providerInfo[provider].name} API key cleared`);
      }
      await loadProviderStatuses();
    } catch (error) {
      toast.error(`Failed to save ${providerInfo[provider].name} API key`);
    }
  };

  const handleConfigChange = async (provider: AIProvider, updates: Partial<AIConfig>) => {
    try {
      await aiIntegrationManager.setProviderConfig(provider, updates);
      toast.success(`${providerInfo[provider].name} configuration updated`);
      await loadProviderStatuses();
    } catch (error) {
      toast.error(`Failed to update ${providerInfo[provider].name} configuration`);
    }
  };

  const testProvider = async (provider: AIProvider) => {
    try {
      setTestResults(prev => new Map(prev).set(provider, 'Testing...'));
      
      const testPrompt = "Hello! Please respond with 'Test successful' if you can read this.";
      const response = await aiIntegrationManager.generateText(provider, testPrompt);
      
      if (response.content.includes('Test successful') || response.content.length > 0) {
        setTestResults(prev => new Map(prev).set(provider, '✅ Connection successful'));
        toast.success(`${providerInfo[provider].name} is working correctly`);
      } else {
        setTestResults(prev => new Map(prev).set(provider, '⚠️ Unexpected response'));
        toast.warning(`${providerInfo[provider].name} responded but may have issues`);
      }
    } catch (error) {
      setTestResults(prev => new Map(prev).set(provider, `❌ Error: ${error.message}`));
      toast.error(`${providerInfo[provider].name} test failed`);
    }
  };

  const getAvailableModels = (provider: AIProvider): AIModel[] => {
    return aiIntegrationManager.getModelsByProvider(provider);
  };

  const toggleApiKeyVisibility = (provider: AIProvider) => {
    setShowApiKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Settings className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Configure and manage all AI providers and models
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="text">Text Models</TabsTrigger>
          <TabsTrigger value="voice">Voice Models</TabsTrigger>
          <TabsTrigger value="image">Image Models</TabsTrigger>
          <TabsTrigger value="code">Code Models</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Text Generation Providers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {providers
                .filter(p => ['openai', 'anthropic', 'google', 'cohere', 'mistral', 'groq', 'deepseek', 'zhipu'].includes(p))
                .map(provider => {
                  const info = providerInfo[provider];
                  const status = providerStatuses.find(s => s.provider === provider);
                  const models = getAvailableModels(provider);
                  const testResult = testResults.get(provider);
                  const showKey = showApiKeys.has(provider);

                  return (
                    <div key={provider} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded bg-primary/10">
                            {info.icon}
                          </div>
                          <div>
                            <h3 className="font-medium">{info.name}</h3>
                            <p className="text-sm text-muted-foreground">{info.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {status?.configured && (
                            <Badge variant="secondary" className="text-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Configured
                            </Badge>
                          )}
                          {status?.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`${provider}-api-key`}>API Key</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${provider}-api-key`}
                              type={showKey ? 'text' : 'password'}
                              placeholder={`Enter ${info.name} API key`}
                              onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleApiKeyVisibility(provider)}
                            >
                              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`${provider}-model`}>Model</Label>
                          <Select
                            value={configs.get(provider)?.model || ''}
                            onValueChange={(value) => handleConfigChange(provider, { model: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map(model => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex flex-col">
                                    <span>{model.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {model.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={`${provider}-temperature`}>Temperature</Label>
                          <Input
                            id={`${provider}-temperature`}
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            placeholder="0.7"
                            onChange={(e) => handleConfigChange(provider, { 
                              temperature: parseFloat(e.target.value) 
                            })}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`${provider}-max-tokens`}>Max Tokens</Label>
                          <Input
                            id={`${provider}-max-tokens`}
                            type="number"
                            min="1"
                            max="32000"
                            placeholder="4096"
                            onChange={(e) => handleConfigChange(provider, { 
                              maxTokens: parseInt(e.target.value) 
                            })}
                          />
                        </div>

                        <div className="flex items-end">
                          <Button
                            onClick={() => testProvider(provider)}
                            disabled={!status?.apiKeyExists}
                            className="w-full"
                          >
                            <TestTube className="h-4 w-4 mr-2" />
                            Test Connection
                          </Button>
                        </div>
                      </div>

                      {testResult && (
                        <div className="text-sm p-2 rounded bg-muted">
                          {testResult}
                        </div>
                      )}

                      <div>
                        <Label htmlFor={`${provider}-system-prompt`}>System Prompt (Optional)</Label>
                        <Textarea
                          id={`${provider}-system-prompt`}
                          placeholder="Enter system prompt for this provider..."
                          rows={3}
                          onChange={(e) => handleConfigChange(provider, { 
                            systemPrompt: e.target.value 
                          })}
                        />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Voice Generation Providers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {['elevenlabs', 'openai', 'google'].map(provider => {
                const info = providerInfo[provider as AIProvider];
                const status = providerStatuses.find(s => s.provider === provider);
                const showKey = showApiKeys.has(provider as AIProvider);

                return (
                  <div key={provider} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-primary/10">
                          {info.icon}
                        </div>
                        <div>
                          <h3 className="font-medium">{info.name}</h3>
                          <p className="text-sm text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      {status?.configured && (
                        <Badge variant="secondary" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`${provider}-voice-api-key`}>API Key</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider}-voice-api-key`}
                            type={showKey ? 'text' : 'password'}
                            placeholder={`Enter ${info.name} API key`}
                            onChange={(e) => handleApiKeyChange(provider as AIProvider, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleApiKeyVisibility(provider as AIProvider)}
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`${provider}-voice-model`}>Voice Model</Label>
                        <Select defaultValue="default">
                          <SelectTrigger>
                            <SelectValue placeholder="Select voice model" />
                          </SelectTrigger>
                          <SelectContent>
                            {provider === 'elevenlabs' && (
                              <>
                                <SelectItem value="eleven-multilingual-v2">Eleven Multilingual v2</SelectItem>
                                <SelectItem value="eleven-turbo-v2">Eleven Turbo v2</SelectItem>
                              </>
                            )}
                            {provider === 'openai' && (
                              <>
                                <SelectItem value="tts-1">TTS v1</SelectItem>
                                <SelectItem value="tts-1-hd">TTS v1 HD</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Voice ID</Label>
                        <Input placeholder="e.g., rachel, adam, etc." />
                      </div>
                      <div>
                        <Label>Speed</Label>
                        <Input type="number" min="0.25" max="4" step="0.1" placeholder="1.0" />
                      </div>
                      <div>
                        <Label>Pitch</Label>
                        <Input type="number" min="-20" max="20" placeholder="0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Image Generation Providers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {['openai', 'stability'].map(provider => {
                const info = providerInfo[provider as AIProvider];
                const status = providerStatuses.find(s => s.provider === provider);
                const showKey = showApiKeys.has(provider as AIProvider);

                return (
                  <div key={provider} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-primary/10">
                          {info.icon}
                        </div>
                        <div>
                          <h3 className="font-medium">{info.name}</h3>
                          <p className="text-sm text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      {status?.configured && (
                        <Badge variant="secondary" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`${provider}-image-api-key`}>API Key</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider}-image-api-key`}
                            type={showKey ? 'text' : 'password'}
                            placeholder={`Enter ${info.name} API key`}
                            onChange={(e) => handleApiKeyChange(provider as AIProvider, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleApiKeyVisibility(provider as AIProvider)}
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`${provider}-image-model`}>Image Model</Label>
                        <Select defaultValue="default">
                          <SelectTrigger>
                            <SelectValue placeholder="Select image model" />
                          </SelectTrigger>
                          <SelectContent>
                            {provider === 'openai' && (
                              <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                            )}
                            {provider === 'stability' && (
                              <>
                                <SelectItem value="stable-diffusion-xl">Stable Diffusion XL</SelectItem>
                                <SelectItem value="stable-diffusion-3">Stable Diffusion 3</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label>Size</Label>
                        <Select defaultValue="1024x1024">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="512x512">512x512</SelectItem>
                            <SelectItem value="1024x1024">1024x1024</SelectItem>
                            <SelectItem value="1792x1024">1792x1024</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quality</Label>
                        <Select defaultValue="standard">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Style</Label>
                        <Select defaultValue="vivid">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vivid">Vivid</SelectItem>
                            <SelectItem value="natural">Natural</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Steps</Label>
                        <Input type="number" min="10" max="50" placeholder="20" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Code Generation Providers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {['openai', 'anthropic', 'deepseek', 'mistral'].map(provider => {
                const info = providerInfo[provider];
                const models = getAvailableModels(provider).filter(m => m.type === 'code' || m.capabilities.includes('coding'));

                return (
                  <div key={provider} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-primary/10">
                          {info.icon}
                        </div>
                        <div>
                          <h3 className="font-medium">{info.name}</h3>
                          <p className="text-sm text-muted-foreground">{info.description}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {models.length} code models
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <Label>Available Code Models</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {models.map(model => (
                          <div key={model.id} className="flex items-center gap-2 p-2 border rounded">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <div>
                              <div className="font-medium text-sm">{model.name}</div>
                              <div className="text-xs text-muted-foreground">{model.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Default Language</Label>
                        <Select defaultValue="typescript">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="typescript">TypeScript</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="java">Java</SelectItem>
                            <SelectItem value="go">Go</SelectItem>
                            <SelectItem value="rust">Rust</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Framework</Label>
                        <Select defaultValue="react">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="react">React</SelectItem>
                            <SelectItem value="vue">Vue</SelectItem>
                            <SelectItem value="angular">Angular</SelectItem>
                            <SelectItem value="express">Express</SelectItem>
                            <SelectItem value="fastapi">FastAPI</SelectItem>
                            <SelectItem value="django">Django</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <Switch id="include-tests" />
                        <Label htmlFor="include-tests">Include Tests</Label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Import Config
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Config
            </Button>
            <Button variant="outline" className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Settings
            </Button>
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Test All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
