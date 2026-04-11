import { EventEmitter } from 'events';
import * as https from 'https';
import { UltraLogger } from '../server/logger';
import { UltraDatabase } from '../server/database';

export interface AIProvider {
  id: string;
  name: string;
  type: 'openai' | 'elevenlabs' | 'stability' | 'claude' | 'gemini' | 'deepseek' | 'whisper';
  apiEndpoint: string;
  apiKey: string;
  enabled: boolean;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  pricing: {
    inputTokenPrice: number; // per 1K tokens
    outputTokenPrice: number; // per 1K tokens
  };
  features: string[];
  models: AIModel[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  type: 'text' | 'image' | 'audio' | 'embedding' | 'vision';
  maxTokens: number;
  contextWindow: number;
  pricing: {
    inputTokenPrice: number;
    outputTokenPrice: number;
  };
}

export interface APIUsage {
  id: string;
  userId: string;
  provider: string;
  model: string;
  type: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  requestTime: number;
  status: 'success' | 'error';
  errorMessage?: string;
  metadata: any;
  createdAt: Date;
}

export interface APIKey {
  id: string;
  userId: string;
  provider: string;
  keyName: string;
  apiKey: string;
  encrypted: boolean;
  permissions: string[];
  rateLimitOverride?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  lastUsed?: Date;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIRequest {
  provider: string;
  model: string;
  type: 'text' | 'image' | 'audio' | 'embedding' | 'vision';
  input: any;
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    size?: string; // for images
    voice?: string; // for audio
    language?: string; // for audio
  };
}

export interface AIResponse {
  success: boolean;
  output: any;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
  metadata: any;
  error?: string;
}

export class UltraAIAPISystem extends EventEmitter {
  private static instance: UltraAIAPISystem;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private providers: Map<string, AIProvider> = new Map();
  private apiKeys: Map<string, APIKey> = new Map();
  private usageTracker: Map<string, number[]> = new Map(); // Track usage per minute
  private rateLimitTracker: Map<string, number[]> = new Map();

  static getInstance(): UltraAIAPISystem {
    if (!UltraAIAPISystem.instance) {
      UltraAIAPISystem.instance = new UltraAIAPISystem();
    }
    return UltraAIAPISystem.instance;
  }

  constructor() {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize database tables
      await this.initializeDatabase();
      
      // Setup AI providers
      this.setupProviders();
      
      // Load existing API keys
      await this.loadAPIKeys();
      
      // Start cleanup intervals
      this.startCleanupIntervals();
      
      this.logger.info('ai-api-system', 'AI API system initialized', {
        providersCount: this.providers.size,
        apiKeysCount: this.apiKeys.size
      });

    } catch (error) {
      this.logger.error('ai-api-system', 'Failed to initialize AI API system', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS ai_providers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        api_endpoint TEXT NOT NULL,
        api_key TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        rate_limit JSONB,
        pricing JSONB,
        features JSONB,
        models JSONB
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS api_usage (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        model VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost DECIMAL(10, 6) DEFAULT 0,
        request_time INTEGER DEFAULT 0,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        key_name VARCHAR(255) NOT NULL,
        api_key TEXT NOT NULL,
        encrypted BOOLEAN DEFAULT TRUE,
        permissions JSONB,
        rate_limit_override JSONB,
        last_used TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(provider)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider)');
  }

  private setupProviders(): void {
    // OpenAI
    this.providers.set('openai', {
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      apiEndpoint: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || '',
      enabled: !!process.env.OPENAI_API_KEY,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 90000
      },
      pricing: {
        inputTokenPrice: 0.001,
        outputTokenPrice: 0.002
      },
      features: ['text-generation', 'embeddings', 'image-generation', 'audio'],
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          type: 'text',
          maxTokens: 8192,
          contextWindow: 8192,
          pricing: { inputTokenPrice: 0.03, outputTokenPrice: 0.06 }
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          type: 'text',
          maxTokens: 4096,
          contextWindow: 4096,
          pricing: { inputTokenPrice: 0.001, outputTokenPrice: 0.002 }
        },
        {
          id: 'dall-e-3',
          name: 'DALL-E 3',
          provider: 'openai',
          type: 'image',
          maxTokens: 0,
          contextWindow: 0,
          pricing: { inputTokenPrice: 0.04, outputTokenPrice: 0 }
        },
        {
          id: 'whisper-1',
          name: 'Whisper',
          provider: 'openai',
          type: 'audio',
          maxTokens: 0,
          contextWindow: 0,
          pricing: { inputTokenPrice: 0.006, outputTokenPrice: 0 }
        }
      ]
    });

    // ElevenLabs
    this.providers.set('elevenlabs', {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      type: 'elevenlabs',
      apiEndpoint: 'https://api.elevenlabs.io/v1',
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      enabled: !!process.env.ELEVENLABS_API_KEY,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 30000
      },
      pricing: {
        inputTokenPrice: 0.00015,
        outputTokenPrice: 0.0006
      },
      features: ['text-to-speech', 'voice-cloning'],
      models: [
        {
          id: 'eleven-monolingual-v1',
          name: 'Eleven Monolingual v1',
          provider: 'elevenlabs',
          type: 'audio',
          maxTokens: 0,
          contextWindow: 0,
          pricing: { inputTokenPrice: 0.00015, outputTokenPrice: 0.0006 }
        }
      ]
    });

    // Stability AI
    this.providers.set('stability', {
      id: 'stability',
      name: 'Stability AI',
      type: 'stability',
      apiEndpoint: 'https://api.stability.ai/v1',
      apiKey: process.env.STABILITY_API_KEY || '',
      enabled: !!process.env.STABILITY_API_KEY,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 10000
      },
      pricing: {
        inputTokenPrice: 0.01,
        outputTokenPrice: 0
      },
      features: ['image-generation', 'image-editing'],
      models: [
        {
          id: 'stable-diffusion-xl',
          name: 'Stable Diffusion XL',
          provider: 'stability',
          type: 'image',
          maxTokens: 0,
          contextWindow: 0,
          pricing: { inputTokenPrice: 0.04, outputTokenPrice: 0 }
        }
      ]
    });

    // Claude (Anthropic)
    this.providers.set('claude', {
      id: 'claude',
      name: 'Claude',
      type: 'claude',
      apiEndpoint: 'https://api.anthropic.com/v1',
      apiKey: process.env.CLAUDE_API_KEY || '',
      enabled: !!process.env.CLAUDE_API_KEY,
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      },
      pricing: {
        inputTokenPrice: 0.008,
        outputTokenPrice: 0.024
      },
      features: ['text-generation', 'analysis'],
      models: [
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'claude',
          type: 'text',
          maxTokens: 4096,
          contextWindow: 200000,
          pricing: { inputTokenPrice: 0.015, outputTokenPrice: 0.075 }
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'claude',
          type: 'text',
          maxTokens: 4096,
          contextWindow: 200000,
          pricing: { inputTokenPrice: 0.003, outputTokenPrice: 0.015 }
        }
      ]
    });

    // Google Gemini
    this.providers.set('gemini', {
      id: 'gemini',
      name: 'Google Gemini',
      type: 'gemini',
      apiEndpoint: 'https://generativelanguage.googleapis.com/v1',
      apiKey: process.env.GEMINI_API_KEY || '',
      enabled: !!process.env.GEMINI_API_KEY,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 32000
      },
      pricing: {
        inputTokenPrice: 0.000125,
        outputTokenPrice: 0.000375
      },
      features: ['text-generation', 'multimodal'],
      models: [
        {
          id: 'gemini-pro',
          name: 'Gemini Pro',
          provider: 'gemini',
          type: 'text',
          maxTokens: 8192,
          contextWindow: 32768,
          pricing: { inputTokenPrice: 0.00025, outputTokenPrice: 0.0005 }
        }
      ]
    });

    // DeepSeek
    this.providers.set('deepseek', {
      id: 'deepseek',
      name: 'DeepSeek',
      type: 'deepseek',
      apiEndpoint: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      enabled: !!process.env.DEEPSEEK_API_KEY,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 20000
      },
      pricing: {
        inputTokenPrice: 0.00014,
        outputTokenPrice: 0.00028
      },
      features: ['text-generation', 'code-generation'],
      models: [
        {
          id: 'deepseek-coder',
          name: 'DeepSeek Coder',
          provider: 'deepseek',
          type: 'text',
          maxTokens: 4096,
          contextWindow: 16384,
          pricing: { inputTokenPrice: 0.00014, outputTokenPrice: 0.00028 }
        }
      ]
    });

    this.logger.info('ai-api-system', `Setup ${this.providers.size} AI providers`);
  }

  private async loadAPIKeys(): Promise<void> {
    try {
      const rows = await this.database.query('SELECT * FROM api_keys WHERE is_active = true');
      
      for (const row of rows) {
        const apiKey: APIKey = {
          id: row.id,
          userId: row.user_id,
          provider: row.provider,
          keyName: row.key_name,
          apiKey: row.api_key,
          encrypted: row.encrypted,
          permissions: row.permissions || [],
          rateLimitOverride: row.rate_limit_override,
          lastUsed: row.last_used,
          usageCount: row.usage_count,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        
        this.apiKeys.set(apiKey.id, apiKey);
      }
      
      this.logger.info('ai-api-system', `Loaded ${this.apiKeys.size} API keys`);
    } catch (error) {
      this.logger.error('ai-api-system', 'Failed to load API keys', error as Error);
    }
  }

  async addAPIKey(
    userId: string,
    provider: string,
    keyName: string,
    apiKey: string,
    permissions: string[] = [],
    rateLimitOverride?: {
      requestsPerMinute: number;
      tokensPerMinute: number;
    }
  ): Promise<string> {
    const keyId = `apikey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw new Error(`Provider ${provider} not found`);
      }

      // Validate API key
      const isValid = await this.validateAPIKey(provider, apiKey);
      if (!isValid) {
        throw new Error('Invalid API key');
      }

      const newAPIKey: APIKey = {
        id: keyId,
        userId,
        provider,
        keyName,
        apiKey, // In production, this should be encrypted
        encrypted: false,
        permissions,
        rateLimitOverride,
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.database.query(`
        INSERT INTO api_keys (
          id, user_id, provider, key_name, api_key, encrypted, permissions,
          rate_limit_override, usage_count, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        newAPIKey.id,
        newAPIKey.userId,
        newAPIKey.provider,
        newAPIKey.keyName,
        newAPIKey.apiKey,
        newAPIKey.encrypted,
        JSON.stringify(newAPIKey.permissions),
        JSON.stringify(newAPIKey.rateLimitOverride),
        newAPIKey.usageCount,
        newAPIKey.isActive,
        newAPIKey.createdAt,
        newAPIKey.updatedAt
      ]);

      this.apiKeys.set(keyId, newAPIKey);

      this.logger.info('ai-api-system', `API key added: ${keyName}`, {
        keyId,
        provider,
        userId
      });

      this.emit('apiKeyAdded', newAPIKey);
      return keyId;

    } catch (error) {
      this.logger.error('ai-api-system', `Failed to add API key: ${keyName}`, error as Error);
      throw error;
    }
  }

  private async validateAPIKey(provider: string, apiKey: string): Promise<boolean> {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      return false;
    }

    try {
      // Make a simple test request to validate the key
      let testEndpoint = '';
      let testHeaders: Record<string, string> = {};

      switch (provider) {
        case 'openai':
          testEndpoint = '/models';
          testHeaders = { 'Authorization': `Bearer ${apiKey}` };
          break;
        case 'elevenlabs':
          testEndpoint = '/user';
          testHeaders = { 'xi-api-key': apiKey };
          break;
        case 'stability':
          testEndpoint = '/user/balance';
          testHeaders = { 'Authorization': `Bearer ${apiKey}` };
          break;
        case 'claude':
          testEndpoint = '/messages';
          testHeaders = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
          break;
        case 'gemini':
          testEndpoint = '/models';
          testHeaders = { 'x-goog-api-key': apiKey };
          break;
        case 'deepseek':
          testEndpoint = '/models';
          testHeaders = { 'Authorization': `Bearer ${apiKey}` };
          break;
        default:
          return false;
      }

      const response = await this.makeAPIRequest(provider, testEndpoint, 'GET', null, testHeaders);
      return response.statusCode < 400;

    } catch (error) {
      return false;
    }
  }

  async makeAIRequest(userId: string, request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const usageId = `usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check rate limits
      await this.checkRateLimits(userId, request.provider);

      // Get API key for user
      const apiKey = await this.getUserAPIKey(userId, request.provider);
      if (!apiKey) {
        throw new Error(`No API key found for provider ${request.provider}`);
      }

      // Make the API request
      const response = await this.executeAPIRequest(request, apiKey.apiKey);
      
      // Calculate usage and cost
      const usage = this.calculateUsage(request, response);
      
      // Record usage
      await this.recordUsage({
        id: usageId,
        userId,
        provider: request.provider,
        model: request.model,
        type: request.type,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: usage.cost,
        requestTime: Date.now() - startTime,
        status: 'success',
        metadata: response.metadata
      });

      // Update API key usage
      apiKey.lastUsed = new Date();
      apiKey.usageCount++;
      await this.updateAPIKeyUsage(apiKey);

      this.logger.info('ai-api-system', `AI request completed: ${request.provider}/${request.model}`, {
        userId,
        usageId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: usage.cost
      });

      return {
        success: true,
        output: response.output,
        usage,
        metadata: response.metadata
      };

    } catch (error) {
      // Record failed usage
      await this.recordUsage({
        id: usageId,
        userId,
        provider: request.provider,
        model: request.model,
        type: request.type,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        requestTime: Date.now() - startTime,
        status: 'error',
        errorMessage: error.message,
        metadata: {}
      });

      this.logger.error('ai-api-system', `AI request failed: ${request.provider}/${request.model}`, error as Error);
      
      return {
        success: false,
        output: null,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
        metadata: {},
        error: error.message
      };
    }
  }

  private async checkRateLimits(userId: string, provider: string): Promise<void> {
    const now = Date.now();
    const minuteAgo = now - 60000;

    // Clean old entries
    if (!this.rateLimitTracker.has(userId)) {
      this.rateLimitTracker.set(userId, []);
    }
    
    const userRequests = this.rateLimitTracker.get(userId)!.filter(time => time > minuteAgo);
    this.rateLimitTracker.set(userId, userRequests);

    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`Provider ${provider} not found`);
    }

    // Check request rate limit
    if (userRequests.length >= providerConfig.rateLimit.requestsPerMinute) {
      throw new Error('Rate limit exceeded: too many requests per minute');
    }

    // Add current request
    userRequests.push(now);
  }

  private async getUserAPIKey(userId: string, provider: string): Promise<APIKey | null> {
    const userKeys = Array.from(this.apiKeys.values()).filter(
      key => key.userId === userId && key.provider === provider && key.isActive
    );

    if (userKeys.length === 0) {
      return null;
    }

    // Return the most recently used key
    return userKeys.sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))[0];
  }

  private async executeAPIRequest(request: AIRequest, apiKey: string): Promise<any> {
    let endpoint = '';
    let method = 'POST';
    let body: any = null;
    let headers: Record<string, string> = {};

    switch (request.provider) {
      case 'openai':
        return await this.executeOpenAIRequest(request, apiKey);
      case 'elevenlabs':
        return await this.executeElevenLabsRequest(request, apiKey);
      case 'stability':
        return await this.executeStabilityRequest(request, apiKey);
      case 'claude':
        return await this.executeClaudeRequest(request, apiKey);
      case 'gemini':
        return await this.executeGeminiRequest(request, apiKey);
      case 'deepseek':
        return await this.executeDeepSeekRequest(request, apiKey);
      default:
        throw new Error(`Provider ${request.provider} not implemented`);
    }
  }

  private async executeOpenAIRequest(request: AIRequest, apiKey: string): Promise<any> {
    const provider = this.providers.get('openai')!;
    let endpoint = '';
    let body: any = {};

    switch (request.type) {
      case 'text':
        endpoint = '/chat/completions';
        body = {
          model: request.model,
          messages: request.input.messages || [{ role: 'user', content: request.input.prompt }],
          temperature: request.options?.temperature || 0.7,
          max_tokens: request.options?.maxTokens || 1000,
          top_p: request.options?.topP || 1,
          frequency_penalty: request.options?.frequencyPenalty || 0,
          presence_penalty: request.options?.presencePenalty || 0
        };
        break;
      case 'image':
        endpoint = '/images/generations';
        body = {
          model: request.model,
          prompt: request.input.prompt,
          n: request.input.n || 1,
          size: request.options?.size || '1024x1024',
          quality: request.input.quality || 'standard'
        };
        break;
      case 'audio':
        endpoint = '/audio/transcriptions';
        // This would need file upload handling
        throw new Error('Audio transcription not implemented yet');
      default:
        throw new Error(`Request type ${request.type} not supported for OpenAI`);
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await this.makeAPIRequest('openai', endpoint, 'POST', JSON.stringify(body), headers);
    const responseData = JSON.parse(response.data);

    return {
      output: responseData,
      metadata: {
        model: request.model,
        usage: responseData.usage
      }
    };
  }

  private async executeElevenLabsRequest(request: AIRequest, apiKey: string): Promise<any> {
    if (request.type !== 'audio') {
      throw new Error('ElevenLabs only supports audio generation');
    }

    const endpoint = '/text-to-speech';
    const body = {
      text: request.input.text,
      model_id: request.model,
      voice_settings: {
        stability: request.options?.stability || 0.75,
        similarity_boost: request.options?.similarity_boost || 0.75,
        style: request.options?.style || 0.0,
        use_speaker_boost: request.options?.useSpeakerBoost || false
      }
    };

    const headers = {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    };

    const response = await this.makeAPIRequest('elevenlabs', endpoint, 'POST', JSON.stringify(body), headers);
    
    return {
      output: response.data, // This would be audio data
      metadata: {
        model: request.model,
        voice: request.options?.voice
      }
    };
  }

  private async executeStabilityRequest(request: AIRequest, apiKey: string): Promise<any> {
    if (request.type !== 'image') {
      throw new Error('Stability AI only supports image generation');
    }

    const endpoint = '/text-to-image';
    const body = {
      text_prompts: [{ text: request.input.prompt }],
      cfg_scale: request.options?.cfgScale || 7,
      height: request.options?.height || 512,
      width: request.options?.width || 512,
      samples: request.input.n || 1,
      steps: request.options?.steps || 30
    };

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await this.makeAPIRequest('stability', endpoint, 'POST', JSON.stringify(body), headers);
    const responseData = JSON.parse(response.data);

    return {
      output: responseData.artifacts,
      metadata: {
        model: request.model,
        samples: responseData.artifacts.length
      }
    };
  }

  private async executeClaudeRequest(request: AIRequest, apiKey: string): Promise<any> {
    if (request.type !== 'text') {
      throw new Error('Claude only supports text generation');
    }

    const endpoint = '/messages';
    const body = {
      model: request.model,
      max_tokens: request.options?.maxTokens || 1000,
      messages: request.input.messages || [{ role: 'user', content: request.input.prompt }],
      temperature: request.options?.temperature || 0.7,
      top_p: request.options?.topP || 1
    };

    const headers = {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };

    const response = await this.makeAPIRequest('claude', endpoint, 'POST', JSON.stringify(body), headers);
    const responseData = JSON.parse(response.data);

    return {
      output: responseData,
      metadata: {
        model: request.model,
        usage: responseData.usage
      }
    };
  }

  private async executeGeminiRequest(request: AIRequest, apiKey: string): Promise<any> {
    const endpoint = `/models/${request.model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{
        parts: [{ text: request.input.prompt || request.input.messages[0].content }]
      }],
      generationConfig: {
        temperature: request.options?.temperature || 0.7,
        topP: request.options?.topP || 1,
        maxOutputTokens: request.options?.maxTokens || 1000
      }
    };

    const response = await this.makeAPIRequest('gemini', endpoint, 'POST', JSON.stringify(body));
    const responseData = JSON.parse(response.data);

    return {
      output: responseData,
      metadata: {
        model: request.model,
        usage: responseData.usageMetadata
      }
    };
  }

  private async executeDeepSeekRequest(request: AIRequest, apiKey: string): Promise<any> {
    if (request.type !== 'text') {
      throw new Error('DeepSeek only supports text generation');
    }

    const endpoint = '/chat/completions';
    const body = {
      model: request.model,
      messages: request.input.messages || [{ role: 'user', content: request.input.prompt }],
      temperature: request.options?.temperature || 0.7,
      max_tokens: request.options?.maxTokens || 1000,
      top_p: request.options?.topP || 1,
      frequency_penalty: request.options?.frequencyPenalty || 0,
      presence_penalty: request.options?.presencePenalty || 0
    };

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    const response = await this.makeAPIRequest('deepseek', endpoint, 'POST', JSON.stringify(body), headers);
    const responseData = JSON.parse(response.data);

    return {
      output: responseData,
      metadata: {
        model: request.model,
        usage: responseData.usage
      }
    };
  }

  private makeAPIRequest(provider: string, endpoint: string, method: string, body?: string, headers?: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        reject(new Error(`Provider ${provider} not found`));
        return;
      }

      const url = `${providerConfig.apiEndpoint}${endpoint}`;
      
      const options: https.RequestOptions = {
        hostname: new URL(url).hostname,
        port: 443,
        path: new URL(url).pathname + new URL(url).search,
        method,
        headers: headers || {},
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data,
            headers: res.headers
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  private calculateUsage(request: AIRequest, response: any): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  } {
    let inputTokens = 0;
    let outputTokens = 0;

    // Extract token usage from response metadata
    if (response.metadata?.usage) {
      inputTokens = response.metadata.usage.prompt_tokens || response.metadata.usage.input_tokens || 0;
      outputTokens = response.metadata.usage.completion_tokens || response.metadata.usage.output_tokens || 0;
    }

    // Calculate cost based on provider pricing
    const provider = this.providers.get(request.provider);
    let cost = 0;

    if (provider) {
      const model = provider.models.find(m => m.id === request.model);
      if (model) {
        cost = (inputTokens / 1000) * model.pricing.inputTokenPrice + 
               (outputTokens / 1000) * model.pricing.outputTokenPrice;
      }
    }

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost
    };
  }

  private async recordUsage(usage: Omit<APIUsage, 'id' | 'createdAt'>): Promise<void> {
    try {
      await this.database.query(`
        INSERT INTO api_usage (
          id, user_id, provider, model, type, input_tokens, output_tokens,
          cost, request_time, status, error_message, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        usage.id,
        usage.userId,
        usage.provider,
        usage.model,
        usage.type,
        usage.inputTokens,
        usage.outputTokens,
        usage.cost,
        usage.requestTime,
        usage.status,
        usage.errorMessage,
        JSON.stringify(usage.metadata),
        new Date()
      ]);
    } catch (error) {
      this.logger.error('ai-api-system', 'Failed to record usage', error as Error);
    }
  }

  private async updateAPIKeyUsage(apiKey: APIKey): Promise<void> {
    try {
      await this.database.query(`
        UPDATE api_keys 
        SET last_used = $1, usage_count = $2, updated_at = $3 
        WHERE id = $4
      `, [apiKey.lastUsed, apiKey.usageCount, new Date(), apiKey.id]);
    } catch (error) {
      this.logger.error('ai-api-system', 'Failed to update API key usage', error as Error);
    }
  }

  private startCleanupIntervals(): void {
    // Clean up rate limit tracking every hour
    setInterval(() => {
      const now = Date.now();
      const hourAgo = now - 3600000;
      
      for (const [userId, requests] of this.rateLimitTracker.entries()) {
        const recentRequests = requests.filter(time => time > hourAgo);
        this.rateLimitTracker.set(userId, recentRequests);
      }
    }, 3600000); // 1 hour
  }

  // Public API methods
  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  async getUsageStats(userId?: string, startDate?: Date, endDate?: Date): Promise<{
    totalRequests: number;
    totalCost: number;
    totalTokens: number;
    requestsByProvider: Record<string, number>;
    costByProvider: Record<string, number>;
    requestsByModel: Record<string, number>;
    averageRequestTime: number;
  }> {
    try {
      let query = 'SELECT * FROM api_usage WHERE 1=1';
      const params: any[] = [];
      
      if (userId) {
        query += ' AND user_id = $' + (params.length + 1);
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND created_at >= $' + (params.length + 1);
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND created_at <= $' + (params.length + 1);
        params.push(endDate);
      }

      const rows = await this.database.query(query, params);
      
      const stats = {
        totalRequests: rows.length,
        totalCost: 0,
        totalTokens: 0,
        requestsByProvider: {} as Record<string, number>,
        costByProvider: {} as Record<string, number>,
        requestsByModel: {} as Record<string, number>,
        averageRequestTime: 0
      };

      let totalRequestTime = 0;

      for (const row of rows) {
        stats.totalCost += parseFloat(row.cost);
        stats.totalTokens += row.input_tokens + row.output_tokens;
        totalRequestTime += row.request_time;
        
        stats.requestsByProvider[row.provider] = (stats.requestsByProvider[row.provider] || 0) + 1;
        stats.costByProvider[row.provider] = (stats.costByProvider[row.provider] || 0) + parseFloat(row.cost);
        stats.requestsByModel[row.model] = (stats.requestsByModel[row.model] || 0) + 1;
      }

      stats.averageRequestTime = rows.length > 0 ? totalRequestTime / rows.length : 0;

      return stats;

    } catch (error) {
      this.logger.error('ai-api-system', 'Failed to get usage stats', error as Error);
      throw error;
    }
  }

  async getAPIKeysByUserId(userId: string): Promise<APIKey[]> {
    return Array.from(this.apiKeys.values()).filter(key => key.userId === userId && key.isActive);
  }

  async deleteAPIKey(keyId: string, userId: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey || apiKey.userId !== userId) {
      return false;
    }

    try {
      await this.database.query('UPDATE api_keys SET is_active = false WHERE id = $1', [keyId]);
      apiKey.isActive = false;
      this.apiKeys.delete(keyId);

      this.logger.info('ai-api-system', `API key deleted: ${apiKey.keyName}`, {
        keyId,
        provider: apiKey.provider
      });

      this.emit('apiKeyDeleted', { keyId, name: apiKey.keyName });
      return true;

    } catch (error) {
      this.logger.error('ai-api-system', `Failed to delete API key: ${apiKey.keyName}`, error as Error);
      return false;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    providersCount: number;
    activeProviders: number;
    apiKeysCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const activeProviders = Array.from(this.providers.values()).filter(p => p.enabled).length;
    
    if (activeProviders === 0) {
      issues.push('No active AI providers');
    }

    return {
      healthy: issues.length === 0,
      providersCount: this.providers.size,
      activeProviders,
      apiKeysCount: this.apiKeys.size,
      issues
    };
  }
}

export default UltraAIAPISystem;
