/**
 * AI Self-Heal
 * Use cached response and fallback logic on AI fail
 */

import { selfHealingEngine } from './selfHealingEngine';

export interface AIRequest {
  id: string;
  prompt: string;
  context?: any;
  timestamp: string;
}

export interface AIResponse {
  id: string;
  requestId: string;
  response: string;
  success: boolean;
  fromCache: boolean;
  fromFallback: boolean;
  timestamp: string;
}

export interface AIHealResult {
  requestId: string;
  healed: boolean;
  oldResponse?: string;
  newResponse?: string;
  actions: string[];
  errors: string[];
  timestamp: string;
}

class AISelfHeal {
  private responseCache: Map<string, AIResponse> = new Map();
  private requestQueue: Map<string, AIRequest> = new Map();
  private maxCacheSize = 100;
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  async healAIResponse(requestId: string): Promise<AIHealResult> {
    const result: AIHealResult = {
      requestId,
      healed: false,
      actions: [],
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      const request = this.requestQueue.get(requestId);

      if (!request) {
        result.errors.push('Request not found');
        return result;
      }

      // Check if we have a cached response
      const cachedResponse = this.getCachedResponse(request.prompt);

      if (cachedResponse) {
        result.healed = true;
        result.newResponse = cachedResponse.response;
        result.actions.push('Used cached response');

        // Store as current response
        this.responseCache.set(requestId, {
          id: crypto.randomUUID(),
          requestId,
          response: cachedResponse.response,
          success: true,
          fromCache: true,
          fromFallback: false,
          timestamp: new Date().toISOString(),
        });

        selfHealingEngine.handleEvent({
          type: 'api_fail',
          severity: 'low',
          module: 'ai_self_heal',
          message: `AI response healed using cache for request ${requestId}`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'cached_response_used',
        });

        return result;
      }

      // Use fallback logic
      result.actions.push('Using fallback logic');
      const fallbackResponse = this.generateFallbackResponse(request);

      if (fallbackResponse) {
        result.healed = true;
        result.newResponse = fallbackResponse;
        result.actions.push('Generated fallback response');

        // Store as current response
        this.responseCache.set(requestId, {
          id: crypto.randomUUID(),
          requestId,
          response: fallbackResponse,
          success: true,
          fromCache: false,
          fromFallback: true,
          timestamp: new Date().toISOString(),
        });

        selfHealingEngine.handleEvent({
          type: 'api_fail',
          severity: 'medium',
          module: 'ai_self_heal',
          message: `AI response healed using fallback for request ${requestId}`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'fallback_response_used',
        });
      } else {
        result.errors.push('Failed to generate fallback response');
      }

    } catch (error) {
      result.errors.push(`AI heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private getCachedResponse(prompt: string): AIResponse | null {
    // Check cache for similar prompts
    for (const [key, response] of this.responseCache) {
      if (this.isSimilarPrompt(prompt, response.requestId) && response.success) {
        // Check if cache is still valid
        const age = Date.now() - new Date(response.timestamp).getTime();
        if (age < this.cacheTTL) {
          return response;
        }
      }
    }
    return null;
  }

  private isSimilarPrompt(prompt1: string, prompt2: string): boolean {
    // Simple similarity check - in production, use more sophisticated comparison
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const similarity = this.calculateSimilarity(normalize(prompt1), normalize(prompt2));
    return similarity > 0.8;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateFallbackResponse(request: AIRequest): string {
    // Generate a generic fallback response based on the prompt
    const prompt = request.prompt.toLowerCase();

    if (prompt.includes('product') || prompt.includes('recommend')) {
      return 'Based on your request, I recommend checking our marketplace for the latest products. You can browse by category to find what suits your needs.';
    }

    if (prompt.includes('order') || prompt.includes('purchase')) {
      return 'To place an order, please navigate to the product page and click the purchase button. If you have any issues with an existing order, please check your orders page.';
    }

    if (prompt.includes('wallet') || prompt.includes('balance') || prompt.includes('payment')) {
      return 'You can check your wallet balance and payment history in the wallet section. For payment issues, please ensure your payment method is valid.';
    }

    if (prompt.includes('key') || prompt.includes('license')) {
      return 'Your license keys are available in the license keys section after purchase. If you\'re missing a key, please contact support.';
    }

    if (prompt.includes('help') || prompt.includes('support')) {
      return 'I\'m here to help! You can ask me about products, orders, wallet, license keys, or any other topic. For urgent issues, please contact our support team.';
    }

    // Generic fallback
    return 'I apologize, but I\'m unable to process your request at the moment. Please try again later or contact our support team for assistance.';
  }

  async queueAIRequest(prompt: string, context?: any): Promise<string> {
    const requestId = crypto.randomUUID();

    const request: AIRequest = {
      id: requestId,
      prompt,
      context,
      timestamp: new Date().toISOString(),
    };

    this.requestQueue.set(requestId, request);

    // Simulate AI processing (in real implementation, call actual AI API)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate AI failure (20% chance)
    const success = Math.random() > 0.2;

    if (success) {
      const response: AIResponse = {
        id: crypto.randomUUID(),
        requestId,
        response: this.generateMockResponse(prompt),
        success: true,
        fromCache: false,
        fromFallback: false,
        timestamp: new Date().toISOString(),
      };

      this.responseCache.set(requestId, response);
      return requestId;
    } else {
      // Auto-heal on failure
      await this.healAIResponse(requestId);
      return requestId;
    }
  }

  private generateMockResponse(prompt: string): string {
    // Generate a mock response for testing
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes('hello') || promptLower.includes('hi')) {
      return 'Hello! How can I help you today?';
    }

    if (promptLower.includes('product')) {
      return 'We have a variety of products available in our marketplace. You can browse by category to find what you\'re looking for.';
    }

    return 'I understand your request. Let me help you with that.';
  }

  getAIResponse(requestId: string): AIResponse | undefined {
    return this.responseCache.get(requestId);
  }

  getAllResponses(): AIResponse[] {
    return Array.from(this.responseCache.values());
  }

  clearCache(): void {
    this.responseCache.clear();
  }

  clearOldCache(): void {
    const now = Date.now();

    for (const [key, response] of this.responseCache) {
      const age = now - new Date(response.timestamp).getTime();
      if (age > this.cacheTTL) {
        this.responseCache.delete(key);
      }
    }
  }

  setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    this.enforceCacheSize();
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
    this.clearOldCache();
  }

  private enforceCacheSize(): void {
    if (this.responseCache.size > this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.responseCache.entries())
        .sort((a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime());

      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
      for (const [key] of toRemove) {
        this.responseCache.delete(key);
      }
    }
  }

  async getAIHealthSummary(): Promise<{
    totalRequests: number;
    successfulResponses: number;
    cachedResponses: number;
    fallbackResponses: number;
    failedResponses: number;
  }> {
    let successfulResponses = 0;
    let cachedResponses = 0;
    let fallbackResponses = 0;
    let failedResponses = 0;

    for (const response of this.responseCache.values()) {
      if (response.success) {
        successfulResponses++;
        if (response.fromCache) cachedResponses++;
        if (response.fromFallback) fallbackResponses++;
      } else {
        failedResponses++;
      }
    }

    return {
      totalRequests: this.requestQueue.size,
      successfulResponses,
      cachedResponses,
      fallbackResponses,
      failedResponses,
    };
  }
}

// Singleton instance
export const aiSelfHeal = new AISelfHeal();
