import { supabase } from '@/integrations/supabase/client';

// AI Provider Types
export type AIProvider = 
  | 'openai' 
  | 'anthropic' 
  | 'google' 
  | 'elevenlabs' 
  | 'stability' 
  | 'cohere' 
  | 'huggingface' 
  | 'replicate' 
  | 'together' 
  | 'perplexity'
  | 'mistral'
  | 'groq'
  | 'deepseek'
  | 'zhipu'
  | 'baichuan'
  | 'wenxin';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  type: 'text' | 'image' | 'audio' | 'video' | 'code' | 'embedding' | 'multimodal';
  capabilities: string[];
  maxTokens?: number;
  costPerToken?: number;
  description: string;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface VoiceConfig {
  provider: 'elevenlabs' | 'openai' | 'azure' | 'google';
  voiceId: string;
  model: string;
  speed?: number;
  pitch?: number;
  emotion?: string;
}

export interface ImageConfig {
  provider: 'stability' | 'openai' | 'midjourney' | 'dalle' | 'replicate';
  model: string;
  size?: string;
  quality?: string;
  style?: string;
  steps?: number;
}

export interface CodeConfig {
  provider: 'openai' | 'anthropic' | 'cohere' | 'deepseek' | 'mistral';
  model: string;
  language: string;
  framework?: string;
  includeTests?: boolean;
  includeDocs?: boolean;
}

// AI Models Registry
export const AI_MODELS: AIModel[] = [
  // OpenAI Models
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'analysis', 'math'],
    maxTokens: 128000,
    description: 'Most capable GPT-4 model for complex tasks'
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'analysis'],
    maxTokens: 8192,
    description: 'Advanced reasoning and coding capabilities'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    type: 'text',
    capabilities: ['conversation', 'coding', 'analysis'],
    maxTokens: 16384,
    description: 'Fast and efficient for most tasks'
  },
  {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    provider: 'openai',
    type: 'image',
    capabilities: ['image-generation', 'creative', 'design'],
    description: 'High-quality image generation'
  },
  {
    id: 'whisper-1',
    name: 'Whisper v1',
    provider: 'openai',
    type: 'audio',
    capabilities: ['speech-to-text', 'transcription', 'translation'],
    description: 'Speech recognition and transcription'
  },
  {
    id: 'tts-1',
    name: 'TTS v1',
    provider: 'openai',
    type: 'audio',
    capabilities: ['text-to-speech', 'voice-synthesis'],
    description: 'Text to speech conversion'
  },
  {
    id: 'embeddings-3',
    name: 'Text Embeddings 3',
    provider: 'openai',
    type: 'embedding',
    capabilities: ['embeddings', 'similarity', 'search'],
    description: 'Advanced text embeddings'
  },

  // Anthropic Models
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'analysis', 'creative'],
    maxTokens: 200000,
    description: 'Most capable Claude model for complex tasks'
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'analysis'],
    maxTokens: 200000,
    description: 'Balanced performance and speed'
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    type: 'text',
    capabilities: ['conversation', 'quick-response'],
    maxTokens: 200000,
    description: 'Fast and efficient for simple tasks'
  },

  // Google Models
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    type: 'multimodal',
    capabilities: ['text', 'image', 'video', 'audio', 'reasoning', 'coding'],
    maxTokens: 2000000,
    description: 'Multimodal model with huge context window'
  },
  {
    id: 'gemini-1.0-pro',
    name: 'Gemini 1.0 Pro',
    provider: 'google',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'analysis'],
    maxTokens: 32768,
    description: 'Powerful general-purpose model'
  },

  // ElevenLabs Models
  {
    id: 'eleven-multilingual-v2',
    name: 'Eleven Multilingual v2',
    provider: 'elevenlabs',
    type: 'audio',
    capabilities: ['text-to-speech', 'multilingual', 'voice-cloning'],
    description: 'High-quality multilingual voice synthesis'
  },
  {
    id: 'eleven-turbo-v2',
    name: 'Eleven Turbo v2',
    provider: 'elevenlabs',
    type: 'audio',
    capabilities: ['text-to-speech', 'low-latency'],
    description: 'Fast voice synthesis for real-time applications'
  },

  // Stability AI Models
  {
    id: 'stable-diffusion-xl',
    name: 'Stable Diffusion XL',
    provider: 'stability',
    type: 'image',
    capabilities: ['image-generation', 'high-resolution', 'creative'],
    description: 'High-quality image generation'
  },
  {
    id: 'stable-diffusion-3',
    name: 'Stable Diffusion 3',
    provider: 'stability',
    type: 'image',
    capabilities: ['image-generation', 'prompt-following'],
    description: 'Latest SD model with improved prompt adherence'
  },

  // Cohere Models
  {
    id: 'command-r-plus',
    name: 'Command R+',
    provider: 'cohere',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'analysis', 'rag'],
    maxTokens: 128000,
    description: 'Enterprise-grade model with RAG capabilities'
  },
  {
    id: 'command-r',
    name: 'Command R',
    provider: 'cohere',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'efficiency'],
    maxTokens: 128000,
    description: 'Efficient model for business applications'
  },

  // Mistral Models
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'multilingual'],
    maxTokens: 32000,
    description: 'Top-tier reasoning and multilingual capabilities'
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    provider: 'mistral',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'speed'],
    maxTokens: 32768,
    description: 'Mixture of experts model for fast inference'
  },

  // Groq Models
  {
    id: 'llama3-70b-8192',
    name: 'Llama 3 70B',
    provider: 'groq',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'speed'],
    maxTokens: 8192,
    description: 'Open-source model with ultra-fast inference'
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'speed'],
    maxTokens: 32768,
    description: 'Fast mixture of experts model'
  },

  // DeepSeek Models
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'deepseek',
    type: 'code',
    capabilities: ['coding', 'reasoning', 'analysis'],
    maxTokens: 16384,
    description: 'Specialized model for coding tasks'
  },

  // Chinese Models
  {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'zhipu',
    type: 'text',
    capabilities: ['reasoning', 'coding', 'chinese'],
    maxTokens: 128000,
    description: 'Advanced Chinese language model'
  },
  {
    id: 'ernie-4',
    name: 'ERNIE 4',
    provider: 'wenxin',
    type: 'text',
    capabilities: ['reasoning', 'chinese', 'knowledge'],
    maxTokens: 8192,
    description: 'Baidu\'s advanced knowledge model'
  }
];

// AI Integration Manager
export class AIIntegrationManager {
  private static instance: AIIntegrationManager;
  private configs: Map<AIProvider, AIConfig> = new Map();
  private apiKeys: Map<AIProvider, string> = new Map();

  static getInstance(): AIIntegrationManager {
    if (!AIIntegrationManager.instance) {
      AIIntegrationManager.instance = new AIIntegrationManager();
    }
    return AIIntegrationManager.instance;
  }

  // Configuration Management
  async setProviderConfig(provider: AIProvider, config: Partial<AIConfig>): Promise<void> {
    const currentConfig = this.configs.get(provider) || {
      provider,
      apiKey: '',
      model: this.getDefaultModel(provider),
      temperature: 0.7,
      maxTokens: 4096,
      stream: false
    };

    const updatedConfig = { ...currentConfig, ...config };
    this.configs.set(provider, updatedConfig);

    // Save to database
    await this.saveConfigToDB(provider, updatedConfig);
  }

  async getProviderConfig(provider: AIProvider): Promise<AIConfig | null> {
    if (!this.configs.has(provider)) {
      await this.loadConfigFromDB(provider);
    }
    return this.configs.get(provider) || null;
  }

  async setApiKey(provider: AIProvider, apiKey: string): Promise<void> {
    this.apiKeys.set(provider, apiKey);
    
    // Save securely to database
    await this.saveApiKeyToDB(provider, apiKey);
  }

  async getApiKey(provider: AIProvider): Promise<string | null> {
    if (!this.apiKeys.has(provider)) {
      await this.loadApiKeyFromDB(provider);
    }
    return this.apiKeys.get(provider) || null;
  }

  // Text Generation
  async generateText(
    provider: AIProvider, 
    prompt: string, 
    options?: Partial<AIConfig>
  ): Promise<AIResponse> {
    const config = await this.getProviderConfig(provider);
    if (!config) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }

    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      throw new Error(`No API key found for provider: ${provider}`);
    }

    switch (provider) {
      case 'openai':
        return this.generateOpenAIText(prompt, { ...config, ...options }, apiKey);
      case 'anthropic':
        return this.generateAnthropicText(prompt, { ...config, ...options }, apiKey);
      case 'google':
        return this.generateGoogleText(prompt, { ...config, ...options }, apiKey);
      case 'cohere':
        return this.generateCohereText(prompt, { ...config, ...options }, apiKey);
      case 'mistral':
        return this.generateMistralText(prompt, { ...config, ...options }, apiKey);
      case 'groq':
        return this.generateGroqText(prompt, { ...config, ...options }, apiKey);
      case 'deepseek':
        return this.generateDeepSeekText(prompt, { ...config, ...options }, apiKey);
      case 'zhipu':
        return this.generateZhipuText(prompt, { ...config, ...options }, apiKey);
      default:
        throw new Error(`Text generation not supported for provider: ${provider}`);
    }
  }

  // Voice Generation
  async generateVoice(
    provider: 'elevenlabs' | 'openai' | 'azure' | 'google',
    text: string,
    config: VoiceConfig
  ): Promise<ArrayBuffer> {
    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      throw new Error(`No API key found for provider: ${provider}`);
    }

    switch (provider) {
      case 'elevenlabs':
        return this.generateElevenLabsVoice(text, config, apiKey);
      case 'openai':
        return this.generateOpenAIVoice(text, config, apiKey);
      case 'google':
        return this.generateGoogleVoice(text, config, apiKey);
      default:
        throw new Error(`Voice generation not supported for provider: ${provider}`);
    }
  }

  // Image Generation
  async generateImage(
    provider: 'stability' | 'openai' | 'midjourney' | 'dalle' | 'replicate',
    prompt: string,
    config: ImageConfig
  ): Promise<string> {
    const apiKey = await this.getApiKey(provider);
    if (!apiKey) {
      throw new Error(`No API key found for provider: ${provider}`);
    }

    switch (provider) {
      case 'openai':
        return this.generateOpenAIImage(prompt, config, apiKey);
      case 'stability':
        return this.generateStabilityImage(prompt, config, apiKey);
      default:
        throw new Error(`Image generation not supported for provider: ${provider}`);
    }
  }

  // Code Generation
  async generateCode(
    provider: AIProvider,
    prompt: string,
    config: CodeConfig
  ): Promise<AIResponse> {
    const codePrompt = `Generate ${config.language} code${config.framework ? ` using ${config.framework}` : ''}: ${prompt}

${config.includeTests ? 'Include comprehensive unit tests.' : ''}
${config.includeDocs ? 'Include detailed documentation and comments.' : ''}

Return only the code without explanations.`;

    return this.generateText(provider, codePrompt, {
      temperature: 0.2,
      maxTokens: 8192
    });
  }

  // Provider-specific implementations
  private async generateOpenAIText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: config.stream
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      provider: 'openai',
      usage: data.usage
    };
  }

  private async generateAnthropicText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          ...(config.systemPrompt ? [{ role: 'user', content: config.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0].text,
      model: data.model,
      provider: 'anthropic',
      usage: data.usage
    };
  }

  private async generateGoogleText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          ...(config.systemPrompt ? [{ parts: [{ text: config.systemPrompt }] }] : []),
          { parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.candidates[0].content.parts[0].text,
      model: config.model,
      provider: 'google',
      usage: data.usageMetadata
    };
  }

  private async generateElevenLabsVoice(text: string, config: VoiceConfig, apiKey: string): Promise<ArrayBuffer> {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: config.model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          speed: config.speed || 1.0,
          pitch: config.pitch || 0
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }

  private async generateOpenAIVoice(text: string, config: VoiceConfig, apiKey: string): Promise<ArrayBuffer> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: config.voiceId,
        speed: config.speed || 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS API error: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }

  private async generateOpenAIImage(prompt: string, config: ImageConfig, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: config.size || '1024x1024',
        quality: config.quality || 'standard',
        style: config.style || 'vivid'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI DALL-E API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].url;
  }

  private async generateStabilityImage(prompt: string, config: ImageConfig, apiKey: string): Promise<string> {
    const response = await fetch('https://api.stability.ai/v1/generation/' + config.model + '/text-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 512,
        width: 512,
        steps: config.steps || 20,
        samples: 1
      })
    });

    if (!response.ok) {
      throw new Error(`Stability AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    // Convert base64 to URL (in production, upload to storage)
    return `data:image/png;base64,${data.artifacts[0].base64}`;
  }

  // Placeholder implementations for other providers
  private async generateCohereText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    // Implementation for Cohere
    throw new Error('Cohere implementation not yet available');
  }

  private async generateMistralText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    // Implementation for Mistral
    throw new Error('Mistral implementation not yet available');
  }

  private async generateGroqText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    // Implementation for Groq
    throw new Error('Groq implementation not yet available');
  }

  private async generateDeepSeekText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    // Implementation for DeepSeek
    throw new Error('DeepSeek implementation not yet available');
  }

  private async generateZhipuText(prompt: string, config: AIConfig, apiKey: string): Promise<AIResponse> {
    // Implementation for Zhipu
    throw new Error('Zhipu implementation not yet available');
  }

  private async generateGoogleVoice(text: string, config: VoiceConfig, apiKey: string): Promise<ArrayBuffer> {
    // Implementation for Google TTS
    throw new Error('Google TTS implementation not yet available');
  }

  // Utility methods
  private getDefaultModel(provider: AIProvider): string {
    const modelMap: Record<AIProvider, string> = {
      'openai': 'gpt-3.5-turbo',
      'anthropic': 'claude-3-sonnet',
      'google': 'gemini-1.0-pro',
      'elevenlabs': 'eleven-multilingual-v2',
      'stability': 'stable-diffusion-xl',
      'cohere': 'command-r',
      'huggingface': 'microsoft/DialoGPT-medium',
      'replicate': 'meta/meta-llama-3-70b',
      'together': 'meta-llama/Llama-3-8b-chat-hf',
      'perplexity': 'mixtral-8x7b-instruct',
      'mistral': 'mistral-large',
      'groq': 'llama3-70b-8192',
      'deepseek': 'deepseek-coder-v2',
      'zhipu': 'glm-4',
      'baichuan': 'Baichuan2-13B-Chat',
      'wenxin': 'ernie-4'
    };
    return modelMap[provider];
  }

  private async saveConfigToDB(provider: AIProvider, config: AIConfig): Promise<void> {
    try {
      await supabase.from('ai_provider_configs').upsert({
        provider,
        config: JSON.stringify(config),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save config to DB:', error);
    }
  }

  private async loadConfigFromDB(provider: AIProvider): Promise<void> {
    try {
      const { data } = await supabase
        .from('ai_provider_configs')
        .select('config')
        .eq('provider', provider)
        .single();
      
      if (data) {
        this.configs.set(provider, JSON.parse(data.config));
      }
    } catch (error) {
      console.error('Failed to load config from DB:', error);
    }
  }

  private async saveApiKeyToDB(provider: AIProvider, apiKey: string): Promise<void> {
    try {
      // In production, encrypt this before storing
      await supabase.from('ai_api_keys').upsert({
        provider,
        encrypted_key: apiKey, // TODO: Implement encryption
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save API key to DB:', error);
    }
  }

  private async loadApiKeyFromDB(provider: AIProvider): Promise<void> {
    try {
      const { data } = await supabase
        .from('ai_api_keys')
        .select('encrypted_key')
        .eq('provider', provider)
        .single();
      
      if (data) {
        this.apiKeys.set(provider, data.encrypted_key); // TODO: Implement decryption
      }
    } catch (error) {
      console.error('Failed to load API key from DB:', error);
    }
  }

  // Public utility methods
  getAvailableModels(): AIModel[] {
    return AI_MODELS;
  }

  getModelsByProvider(provider: AIProvider): AIModel[] {
    return AI_MODELS.filter(model => model.provider === provider);
  }

  getModelsByType(type: AIModel['type']): AIModel[] {
    return AI_MODELS.filter(model => model.type === type);
  }

  getModelsByCapability(capability: string): AIModel[] {
    return AI_MODELS.filter(model => 
      model.capabilities.some(cap => cap.toLowerCase().includes(capability.toLowerCase()))
    );
  }
}

export const aiIntegrationManager = AIIntegrationManager.getInstance();
