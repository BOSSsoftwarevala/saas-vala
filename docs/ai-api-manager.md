# SaaS Vala AI API Manager Documentation

## Overview
This document outlines the comprehensive AI API Manager implemented across the SaaS Vala platform, providing unified access to 12+ AI providers with intelligent fallback systems, secure API key management, and cost optimization.

## Supported AI Providers

### 1. OpenAI
**Models**: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo, DALL-E 3, Whisper, TTS
**Capabilities**: Text generation, image generation, speech-to-text, text-to-speech
**Use Cases**: General reasoning, coding, analysis, content creation, voice processing

### 2. Anthropic (Claude)
**Models**: Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
**Capabilities**: Advanced reasoning, analysis, coding, creative writing
**Use Cases**: Complex problem-solving, long-form content, ethical reasoning

### 3. Google (Gemini)
**Models**: Gemini 1.5 Pro, Gemini 2.5 Flash, Gemini 3 Pro, Gemini 3 Flash
**Capabilities**: Multimodal reasoning, code generation, analysis
**Use Cases**: Multimodal tasks, large context processing, rapid inference

### 4. ElevenLabs
**Models**: Eleven Multilingual v2, Adam, Sam, etc.
**Capabilities**: Text-to-speech, voice synthesis, voice cloning
**Use Cases**: Voice generation, audio content, accessibility features

### 5. Stability AI
**Models**: Stable Diffusion XL, Stable Diffusion 2.1
**Capabilities**: Image generation, art creation, design
**Use Cases**: Visual content creation, marketing materials, concept art

### 6. Cohere
**Models**: Command R, Command R+
**Capabilities**: Text generation, analysis, RAG
**Use Cases**: Enterprise applications, document analysis, search

### 7. Mistral
**Models**: Mistral Large, Mistral 7B
**Capabilities**: Text generation, multilingual support
**Use Cases**: European language support, efficient inference

### 8. Groq
**Models**: Llama 3 70B, Mixtral 8x7B
**Capabilities**: High-speed inference, real-time responses
**Use Cases**: Real-time chat, rapid prototyping, low-latency applications

### 9. DeepSeek
**Models**: DeepSeek Coder V2, DeepSeek V2
**Capabilities**: Code generation, programming assistance
**Use Cases**: Software development, code review, debugging

### 10. Perplexity
**Models**: Mixtral 8x7B Instruct
**Capabilities**: Search-enhanced generation, real-time information
**Use Cases**: Research, fact-checking, current events

### 11. Additional Providers
- **HuggingFace**: Open source model access
- **Replicate**: Model deployment platform
- **Together**: Decentralized inference
- **Zhipu**: Chinese language models
- **Baichuan**: Multilingual models
- **Wenxin**: Baidu's AI models

## Architecture Overview

### 1. AI Integration Manager (`ai-integrations.ts`)

**Purpose**: Unified interface for all AI providers with automatic fallback and load balancing.

**Key Features**:
- Provider abstraction layer
- Automatic failover mechanisms
- Cost optimization
- Usage tracking
- Secure API key management

```typescript
export class AIIntegrationManager {
  private static instance: AIIntegrationManager;
  private configs = new Map<AIProvider, AIConfig>();
  private apiKeys = new Map<AIProvider, string>();
  
  async generateText(provider: AIProvider, prompt: string, options?: Partial<AIConfig>): Promise<AIResponse>
  async generateVoice(provider: string, text: string, config: VoiceConfig): Promise<ArrayBuffer>
  async generateImage(provider: string, prompt: string, config: ImageConfig): Promise<string>
  async setApiKey(provider: AIProvider, apiKey: string): Promise<void>
  async getApiKey(provider: AIProvider): Promise<string | null>
}
```

### 2. Model Registry

**Purpose**: Centralized catalog of all available AI models with capabilities and metadata.

```typescript
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
```

### 3. Configuration Management

**AI Config Structure**:
```typescript
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}
```

## Backend Infrastructure

### 1. Provider Configuration (`ai_provider_configs` table)

**Purpose**: Store provider settings, priorities, and connection details.

```sql
CREATE TABLE ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL UNIQUE,
  base_url TEXT,
  api_version VARCHAR(20),
  priority_order INTEGER DEFAULT 1,
  is_enabled BOOLEAN DEFAULT true,
  max_requests_per_minute INTEGER,
  max_tokens_per_minute INTEGER,
  cost_per_token DECIMAL(10,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Task Model Routing (`ai_task_model_routing` table)

**Purpose**: Intelligent routing of tasks to appropriate models with fallback chains.

```sql
CREATE TABLE ai_task_model_routing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(100) NOT NULL,
  primary_provider VARCHAR(50) NOT NULL,
  fallback_providers TEXT[],
  preferred_model VARCHAR(100),
  max_tokens INTEGER,
  temperature DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Failover System (`ai_failover_logs` table)

**Purpose**: Track failures and automatic fallbacks for reliability monitoring.

```sql
CREATE TABLE ai_failover_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(100),
  original_provider VARCHAR(50),
  fallback_provider VARCHAR(50),
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Usage Tracking (`ai_usage` table)

**Purpose**: Monitor usage, costs, and performance across all providers.

```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  task_type VARCHAR(100),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost DECIMAL(10,6),
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Fallback System

### 1. Primary/Fallback Chain

**Configuration Example**:
```json
{
  "task_type": "code_generation",
  "primary_provider": "openai",
  "fallback_providers": ["anthropic", "deepseek", "groq"],
  "preferred_model": "gpt-4-turbo",
  "max_tokens": 4000,
  "temperature": 0.1
}
```

### 2. Automatic Failover Logic

```typescript
async function executeWithFallback(taskType: string, prompt: string): Promise<AIResponse> {
  const routing = await getTaskRouting(taskType);
  
  for (const provider of [routing.primary_provider, ...routing.fallback_providers]) {
    try {
      const response = await aiManager.generateText(provider, prompt, {
        model: routing.preferred_model,
        maxTokens: routing.max_tokens,
        temperature: routing.temperature
      });
      
      // Log successful execution
      await logUsage(provider, response);
      return response;
      
    } catch (error) {
      // Log failure and try next provider
      await logFailover(taskType, provider, error);
      continue;
    }
  }
  
  throw new Error(`All providers failed for task: ${taskType}`);
}
```

### 3. Health Monitoring

**API Health Check**:
```typescript
async function checkProviderHealth(provider: AIProvider): Promise<HealthStatus> {
  const startTime = Date.now();
  
  try {
    const response = await aiManager.generateText(provider, "Hello", {
      maxTokens: 10
    });
    
    return {
      provider,
      status: 'healthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date()
    };
    
  } catch (error) {
    return {
      provider,
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error.message,
      lastChecked: new Date()
    };
  }
}
```

## Security & API Key Management

### 1. Secure Storage

**Database Encryption**:
- API keys encrypted at rest using AES-256
- Environment variables for production secrets
- Key rotation support with zero downtime

### 2. Access Control

**Role-Based Access**:
```sql
CREATE TABLE ai_role_access_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  can_access BOOLEAN DEFAULT true,
  max_requests_per_hour INTEGER,
  max_tokens_per_hour INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Rate Limiting

**Per-Role Limits**:
```sql
CREATE TABLE ai_rate_limit_controls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  requests_per_hour INTEGER NOT NULL,
  tokens_per_hour INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

## Cost Optimization

### 1. Intelligent Routing

**Cost-Based Selection**:
- Route to cheapest provider for simple tasks
- Use premium providers for complex tasks
- Consider token costs and response times

### 2. Usage Analytics

**Cost Tracking**:
```typescript
interface CostAnalysis {
  totalCost: number;
  costByProvider: Record<string, number>;
  costByTaskType: Record<string, number>;
  costPerUser: Record<string, number>;
  savingsFromFallback: number;
}
```

### 3. Budget Controls

**User Budgets**:
- Per-user spending limits
- Departmental budget tracking
- Real-time cost alerts

## Implementation Examples

### 1. Text Generation

```typescript
// Basic usage
const response = await aiManager.generateText('openai', 'Write a Python function', {
  model: 'gpt-4-turbo',
  temperature: 0.1,
  maxTokens: 1000
});

// With fallback
const response = await executeWithFallback('code_generation', 'Write a React component');
```

### 2. Voice Generation

```typescript
const audioBuffer = await aiManager.generateVoice('elevenlabs', 'Hello world', {
  voiceId: 'adam',
  model: 'eleven_multilingual_v2',
  speed: 1.0,
  emotion: 'neutral'
});
```

### 3. Image Generation

```typescript
const imageUrl = await aiManager.generateImage('stability', 'A beautiful sunset', {
  model: 'stable-diffusion-xl',
  size: '1024x1024',
  quality: 'high',
  steps: 50
});
```

## Monitoring & Analytics

### 1. Real-Time Dashboard

**Metrics Tracked**:
- Request volume by provider
- Response times and success rates
- Cost tracking and budget usage
- Error rates and failover events

### 2. Performance Analytics

**Key Metrics**:
- Average response time per provider
- Cost per successful request
- Fallback success rate
- User satisfaction scores

### 3. Alerting System

**Alert Conditions**:
- Provider downtime
- High error rates
- Budget overruns
- Unusual usage patterns

## Best Practices

### 1. Provider Selection
- Use OpenAI for general-purpose tasks
- Use Claude for complex reasoning
- Use Gemini for multimodal tasks
- Use Groq for real-time applications
- Use DeepSeek for code generation

### 2. Cost Management
- Set appropriate token limits
- Monitor usage regularly
- Use cheaper providers for simple tasks
- Implement caching for repeated requests

### 3. Reliability
- Always configure fallback providers
- Monitor provider health
- Implement circuit breakers
- Log all failures for analysis

### 4. Security
- Rotate API keys regularly
- Use environment variables for secrets
- Implement proper access controls
- Monitor for unusual usage patterns

## Troubleshooting

### Common Issues
1. **API Key Errors**: Verify keys are correctly stored and encrypted
2. **Rate Limiting**: Check per-provider and per-role limits
3. **Fallback Failures**: Ensure multiple providers are configured
4. **High Costs**: Review usage patterns and provider selection

### Debug Tools
- Provider health monitoring dashboard
- Usage analytics and cost tracking
- Failover log analysis
- Performance metrics visualization

---

This AI API Manager provides a comprehensive, reliable, and cost-effective solution for integrating multiple AI providers across the SaaS Vala platform, ensuring high availability and optimal performance for all AI-powered features.
