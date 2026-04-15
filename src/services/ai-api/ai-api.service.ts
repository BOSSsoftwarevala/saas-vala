// AI API Management Service with Priority System and Auto Failover
import { supabase } from '@/integrations/supabase/client';
import type {
  AIAPIIntegration,
  AIAPIUsageLog,
  AIAPIRequest,
  AIAPIResponse,
  AIAPIUsageStats,
  AIAPIHealthStatus,
  RequestType,
  AIAPIConfig,
  CostControlConfig,
} from '@/types/ai-api-management';
import { AI_PROVIDERS, DEFAULT_USAGE_MAPPING } from '@/types/ai-api-management';

export class AIApiService {
  private rateLimitDelay = 100;
  private maxRetries = 3;
  private requestQueue: Map<string, Promise<AIAPIResponse>> = new Map();

  /**
   * Get all AI API integrations
   */
  async getAPIIntegrations(filters?: {
    category?: string;
    is_enabled?: boolean;
    billing_enabled?: boolean;
    priority?: number;
  }): Promise<AIAPIIntegration[]> {
    try {
      let query = supabase
        .from('ai_api_integrations')
        .select('*')
        .order('priority', { ascending: true });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.is_enabled !== undefined) {
        query = query.eq('is_enabled', filters.is_enabled);
      }
      if (filters?.billing_enabled !== undefined) {
        query = query.eq('billing_enabled', filters.billing_enabled);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as AIAPIIntegration[]) || [];
    } catch (error) {
      console.error('Error getting AI API integrations:', error);
      return [];
    }
  }

  /**
   * Get AI API integration by ID
   */
  async getAPIIntegrationById(id: string): Promise<AIAPIIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('ai_api_integrations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as AIAPIIntegration;
    } catch (error) {
      console.error('Error getting AI API integration:', error);
      return null;
    }
  }

  /**
   * Create AI API integration
   */
  async createAPIIntegration(
    integration: Partial<AIAPIIntegration>
  ): Promise<AIAPIIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('ai_api_integrations')
        .insert({
          ...integration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as AIAPIIntegration;
    } catch (error) {
      console.error('Error creating AI API integration:', error);
      return null;
    }
  }

  /**
   * Update AI API integration
   */
  async updateAPIIntegration(
    id: string,
    updates: Partial<AIAPIIntegration>
  ): Promise<AIAPIIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('ai_api_integrations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AIAPIIntegration;
    } catch (error) {
      console.error('Error updating AI API integration:', error);
      return null;
    }
  }

  /**
   * Delete AI API integration
   */
  async deleteAPIIntegration(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_api_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting AI API integration:', error);
      return false;
    }
  }

  /**
   * Toggle API integration enabled status
   */
  async toggleAPIEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_api_integrations')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling API enabled status:', error);
      return false;
    }
  }

  /**
   * Toggle API billing enabled status
   */
  async toggleBillingEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_api_integrations')
        .update({ billing_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling billing enabled status:', error);
      return false;
    }
  }

  /**
   * Make AI API request with priority and auto failover
   */
  async makeAPIRequest(
    request: AIAPIRequest,
    userId?: string,
    preferredProvider?: string
  ): Promise<AIAPIResponse> {
    const requestKey = `${request.request_type}-${request.prompt}-${Date.now()}`;
    
    // Check if request is already in progress
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey)!;
    }

    const requestPromise = this.executeAPIRequest(request, userId, preferredProvider);
    this.requestQueue.set(requestKey, requestPromise);

    try {
      const response = await requestPromise;
      return response;
    } finally {
      this.requestQueue.delete(requestKey);
    }
  }

  /**
   * Execute API request with failover logic
   */
  private async executeAPIRequest(
    request: AIAPIRequest,
    userId?: string,
    preferredProvider?: string
  ): Promise<AIAPIResponse> {
    const startTime = Date.now();

    try {
      // Get available APIs for this request type
      const apis = await this.getAvailableAPIsForRequest(
        request.request_type,
        preferredProvider
      );

      if (apis.length === 0) {
        return {
          success: false,
          tokens_used: 0,
          cost: 0,
          response_time_ms: Date.now() - startTime,
          api_provider: 'none',
          error: 'No available APIs for this request type',
        };
      }

      // Try APIs in priority order
      for (const api of apis) {
        try {
          // Check budget limits
          if (!await this.checkBudgetLimit(api.id)) {
            console.warn(`Budget limit exceeded for ${api.provider}`);
            continue;
          }

          // Make the API call
          const response = await this.callAPI(api, request, userId);

          // Log successful request
          await this.logAPIRequest({
            api_integration_id: api.id,
            user_id: userId,
            request_type: request.request_type,
            tokens_used: response.tokens_used,
            cost: response.cost,
            response_time_ms: response.response_time_ms,
            status: 'success',
            metadata: request.metadata || {},
          });

          // Update API usage
          await this.incrementUsage(api.id, response.tokens_used, response.cost);

          return response;
        } catch (error) {
          console.error(`API call failed for ${api.provider}:`, error);

          // Log failed request
          await this.logAPIRequest({
            api_integration_id: api.id,
            user_id: userId,
            request_type: request.request_type,
            tokens_used: 0,
            cost: 0,
            response_time_ms: Date.now() - startTime,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            metadata: request.metadata || {},
          });

          // Update fail count
          await this.incrementFailCount(api.id);

          // Try fallback if enabled
          if (api.auto_failover_enabled) {
            continue;
          } else {
            throw error;
          }
        }
      }

      // All APIs failed
      return {
        success: false,
        tokens_used: 0,
        cost: 0,
        response_time_ms: Date.now() - startTime,
        api_provider: 'none',
        error: 'All APIs failed',
      };
    } catch (error) {
      return {
        success: false,
        tokens_used: 0,
        cost: 0,
        response_time_ms: Date.now() - startTime,
        api_provider: 'none',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available APIs for a request type based on priority
   */
  private async getAvailableAPIsForRequest(
    requestType: RequestType,
    preferredProvider?: string
  ): Promise<AIAPIIntegration[]> {
    const allApis = await this.getAPIIntegrations({
      is_enabled: true,
      billing_enabled: true,
    });

    // Filter APIs that support this request type
    const supportedApis = allApis.filter(
      api => api.usage_mapping.includes(requestType)
    );

    // Sort by priority
    const sortedApis = supportedApis.sort((a, b) => a.priority - b.priority);

    // If preferred provider is specified, move it to the front
    if (preferredProvider) {
      const preferred = sortedApis.find(api => api.provider === preferredProvider);
      if (preferred) {
        const others = sortedApis.filter(api => api.provider !== preferredProvider);
        return [preferred, ...others];
      }
    }

    return sortedApis;
  }

  /**
   * Check budget limit for an API
   */
  private async checkBudgetLimit(apiId: string): Promise<boolean> {
    try {
      const api = await this.getAPIIntegrationById(apiId);
      if (!api) return false;

      if (!api.daily_budget_limit) return true;

      return api.daily_cost_today < api.daily_budget_limit;
    } catch (error) {
      console.error('Error checking budget limit:', error);
      return false;
    }
  }

  /**
   * Call the actual API
   */
  private async callAPI(
    api: AIAPIIntegration,
    request: AIAPIRequest,
    userId?: string
  ): Promise<AIAPIResponse> {
    const startTime = Date.now();

    try {
      // This is a placeholder for the actual API call
      // In production, this would make the actual HTTP request to the API endpoint
      // with the appropriate headers and body based on the provider

      // Simulate API call
      await this.delay(100);

      const tokensUsed = request.prompt.length + (request.max_tokens || 500);
      const cost = (tokensUsed / 1000) * api.cost_per_1k_tokens;

      return {
        success: true,
        data: `Generated content for: ${request.prompt}`,
        tokens_used: tokensUsed,
        cost,
        response_time_ms: Date.now() - startTime,
        api_provider: api.provider,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Log API request
   */
  private async logAPIRequest(log: Partial<AIAPIUsageLog>): Promise<void> {
    try {
      await supabase.from('ai_api_usage_logs').insert({
        ...log,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging API request:', error);
    }
  }

  /**
   * Increment API usage
   */
  private async incrementUsage(
    apiId: string,
    tokens: number,
    cost: number
  ): Promise<void> {
    try {
      await supabase.rpc('increment_ai_api_usage', {
        p_api_id: apiId,
        p_tokens: tokens,
        p_cost: cost,
      });
    } catch (error) {
      console.error('Error incrementing API usage:', error);
    }
  }

  /**
   * Increment fail count
   */
  private async incrementFailCount(apiId: string): Promise<void> {
    try {
      await supabase
        .from('ai_api_integrations')
        .update({
          fail_count: supabase.raw('fail_count + 1'),
          last_error_at: new Date().toISOString(),
        })
        .eq('id', apiId);
    } catch (error) {
      console.error('Error incrementing fail count:', error);
    }
  }

  /**
   * Get API usage logs
   */
  async getAPIUsageLogs(filters?: {
    api_integration_id?: string;
    user_id?: string;
    request_type?: RequestType;
    start_date?: string;
    end_date?: string;
  }): Promise<AIAPIUsageLog[]> {
    try {
      let query = supabase
        .from('ai_api_usage_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.api_integration_id) {
        query = query.eq('api_integration_id', filters.api_integration_id);
      }
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters?.request_type) {
        query = query.eq('request_type', filters.request_type);
      }
      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as AIAPIUsageLog[]) || [];
    } catch (error) {
      console.error('Error getting API usage logs:', error);
      return [];
    }
  }

  /**
   * Get API usage statistics
   */
  async getAPIUsageStats(
    startDate?: string,
    endDate?: string
  ): Promise<AIAPIUsageStats> {
    try {
      const logs = await this.getAPIUsageLogs({
        start_date: startDate,
        end_date: endDate,
      });

      const totalRequests = logs.length;
      const totalTokens = logs.reduce((sum, log) => sum + log.tokens_used, 0);
      const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
      const avgResponseTime =
        totalRequests > 0
          ? logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) /
            totalRequests
          : 0;
      const successRate =
        totalRequests > 0
          ? (logs.filter(log => log.status === 'success').length / totalRequests) *
            100
          : 0;

      // Group by request type
      const byRequestType: {
        [key in RequestType]: { requests: number; tokens: number; cost: number };
      } = {
        seo: { requests: 0, tokens: 0, cost: 0 },
        chat: { requests: 0, tokens: 0, cost: 0 },
        critical: { requests: 0, tokens: 0, cost: 0 },
        image: { requests: 0, tokens: 0, cost: 0 },
        voice: { requests: 0, tokens: 0, cost: 0 },
        translation: { requests: 0, tokens: 0, cost: 0 },
        automation: { requests: 0, tokens: 0, cost: 0 },
        analytics: { requests: 0, tokens: 0, cost: 0 },
      };

      logs.forEach(log => {
        if (byRequestType[log.request_type]) {
          byRequestType[log.request_type].requests++;
          byRequestType[log.request_type].tokens += log.tokens_used;
          byRequestType[log.request_type].cost += log.cost;
        }
      });

      // Group by provider
      const byProvider: {
        [provider: string]: {
          requests: number;
          tokens: number;
          cost: number;
          success_rate: number;
        };
      } = {};

      const providerLogs: { [key: string]: AIAPIUsageLog[] } = {};
      logs.forEach(log => {
        const api = await this.getAPIIntegrationById(log.api_integration_id);
        if (api) {
          if (!providerLogs[api.provider]) {
            providerLogs[api.provider] = [];
          }
          providerLogs[api.provider].push(log);
        }
      });

      Object.keys(providerLogs).forEach(provider => {
        const providerRequestLogs = providerLogs[provider];
        const providerRequests = providerRequestLogs.length;
        const providerTokens = providerRequestLogs.reduce(
          (sum, log) => sum + log.tokens_used,
          0
        );
        const providerCost = providerRequestLogs.reduce(
          (sum, log) => sum + log.cost,
          0
        );
        const providerSuccessRate =
          providerRequests > 0
            ? (providerRequestLogs.filter(log => log.status === 'success')
                .length /
                providerRequests) *
              100
            : 0;

        byProvider[provider] = {
          requests: providerRequests,
          tokens: providerTokens,
          cost: providerCost,
          success_rate: providerSuccessRate,
        };
      });

      return {
        total_requests: totalRequests,
        total_tokens: totalTokens,
        total_cost: totalCost,
        avg_response_time: avgResponseTime,
        success_rate: successRate,
        by_request_type: byRequestType,
        by_provider: byProvider,
      };
    } catch (error) {
      console.error('Error getting API usage stats:', error);
      return {
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
        avg_response_time: 0,
        success_rate: 0,
        by_request_type: {
          seo: { requests: 0, tokens: 0, cost: 0 },
          chat: { requests: 0, tokens: 0, cost: 0 },
          critical: { requests: 0, tokens: 0, cost: 0 },
          image: { requests: 0, tokens: 0, cost: 0 },
          voice: { requests: 0, tokens: 0, cost: 0 },
          translation: { requests: 0, tokens: 0, cost: 0 },
          automation: { requests: 0, tokens: 0, cost: 0 },
          analytics: { requests: 0, tokens: 0, cost: 0 },
        },
        by_provider: {},
      };
    }
  }

  /**
   * Get API health status
   */
  async getAPIHealthStatus(): Promise<AIAPIHealthStatus[]> {
    try {
      const apis = await this.getAPIIntegrations({ is_enabled: true });
      const healthStatuses: AIAPIHealthStatus[] = [];

      for (const api of apis) {
        const logs = await this.getAPIUsageLogs({
          api_integration_id: api.id,
          start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        });

        const successCount = logs.filter(log => log.status === 'success').length;
        const failCount = logs.filter(log => log.status === 'failed').length;
        const totalRequests = successCount + failCount;
        const successRate =
          totalRequests > 0 ? (successCount / totalRequests) * 100 : 100;

        const avgResponseTime =
          successCount > 0
            ? logs
                .filter(log => log.status === 'success')
                .reduce((sum, log) => sum + (log.response_time_ms || 0), 0) /
              successCount
            : 0;

        const isWithinBudget = !api.daily_budget_limit || api.daily_cost_today < api.daily_budget_limit;

        healthStatuses.push({
          provider: api.provider,
          is_healthy: successRate > 80 && api.fail_count < 5,
          last_check: api.last_used_at || new Date().toISOString(),
          avg_response_time: avgResponseTime,
          success_rate: successRate,
          fail_count: api.fail_count,
          is_within_budget: isWithinBudget,
          is_rate_limited: false, // Would need to check actual rate limit status
        });
      }

      return healthStatuses;
    } catch (error) {
      console.error('Error getting API health status:', error);
      return [];
    }
  }

  /**
   * Reset daily usage for all APIs
   */
  async resetDailyUsage(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('reset_daily_ai_api_usage');
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error resetting daily usage:', error);
      return false;
    }
  }

  /**
   * Update cost control config for an API
   */
  async updateCostControl(
    apiId: string,
    config: CostControlConfig
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_api_integrations')
        .update({
          daily_budget_limit: config.daily_budget_limit,
          max_tokens_per_request: config.max_tokens_per_request,
          config: {
            alert_threshold_percent: config.alert_threshold_percent,
            enable_auto_pause: config.enable_auto_pause,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', apiId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating cost control:', error);
      return false;
    }
  }

  /**
   * Initialize all 105 AI providers in the database
   */
  async initializeAllProviders(): Promise<number> {
    let initialized = 0;

    for (const provider of AI_PROVIDERS) {
      try {
        // Check if provider already exists
        const existing = await this.getAPIIntegrationById(provider.id);
        if (existing) {
          continue;
        }

        // Get usage mapping for this provider
        const usageMapping = DEFAULT_USAGE_MAPPING[
          Object.keys(DEFAULT_USAGE_MAPPING).find(
            key => DEFAULT_USAGE_MAPPING[key as RequestType].preferred_provider === provider.id ||
              DEFAULT_USAGE_MAPPING[key as RequestType].fallback_providers.includes(provider.id)
          ) as RequestType
        ]?.fallback_providers.includes(provider.id) 
          ? Object.keys(DEFAULT_USAGE_MAPPING).filter(
              key => DEFAULT_USAGE_MAPPING[key as RequestType].fallback_providers.includes(provider.id)
            ) as RequestType[]
          : provider.supported_request_types;

        await this.createAPIIntegration({
          name: provider.name,
          provider: provider.provider,
          category: provider.category,
          sub_category: provider.sub_category,
          api_endpoint: provider.api_endpoint,
          priority: 1,
          is_active: true,
          is_enabled: true,
          billing_enabled: true,
          cost_per_1k_tokens: provider.default_cost_per_1k_tokens,
          max_tokens_per_request: provider.default_max_tokens,
          auto_failover_enabled: true,
          usage_mapping: usageMapping || provider.supported_request_types,
          config: {},
        });

        initialized++;
      } catch (error) {
        console.error(`Error initializing provider ${provider.id}:`, error);
      }
    }

    return initialized;
  }

  /**
   * Get all available providers
   */
  getAllProviders(): typeof AI_PROVIDERS {
    return AI_PROVIDERS;
  }

  /**
   * Get providers by category
   */
  getProvidersByCategory(categoryId: number): typeof AI_PROVIDERS {
    return AI_PROVIDERS.filter(provider => provider.category_id === categoryId);
  }

  /**
   * Get usage mapping
   */
  getUsageMapping(): typeof DEFAULT_USAGE_MAPPING {
    return DEFAULT_USAGE_MAPPING;
  }

  /**
   * Utility function for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aiApiService = new AIApiService();
