// External API Integration Service
import { leadGenerationDB } from './database.service';
import type { APIIntegration } from '@/types/lead-generation';

export class APIIntegrationService {
  /**
   * Add API integration
   */
  async addIntegration(provider: APIIntegration['provider'], apiKey: string): Promise<APIIntegration | null> {
    try {
      const integrationData: Partial<APIIntegration> = {
        provider,
        api_key: apiKey,
        is_active: true,
        rate_limit_per_hour: this.getDefaultRateLimit(provider),
        requests_today: 0,
      };
      
      return await leadGenerationDB.createAPIIntegration(integrationData);
    } catch (error) {
      console.error('Error adding API integration:', error);
      return null;
    }
  }

  /**
   * Get default rate limit for provider
   */
  private getDefaultRateLimit(provider: APIIntegration['provider']): number {
    const limits: { [key in APIIntegration['provider']]: number } = {
      hunter: 100,
      snov: 50,
      apollo: 200,
      serpapi: 100,
      dataforseo: 100,
      apify: 100,
      phantombuster: 50,
    };
    
    return limits[provider] || 100;
  }

  /**
   * Update API integration
   */
  async updateIntegration(id: string, updates: Partial<APIIntegration>): Promise<APIIntegration | null> {
    try {
      return await leadGenerationDB.updateAPIIntegration(id, updates);
    } catch (error) {
      console.error('Error updating API integration:', error);
      return null;
    }
  }

  /**
   * Delete API integration
   */
  async deleteIntegration(id: string): Promise<boolean> {
    try {
      // In production, this would delete from database
      // For now, we'll just deactivate it
      await this.updateIntegration(id, { is_active: false });
      return true;
    } catch (error) {
      console.error('Error deleting API integration:', error);
      return false;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(provider: APIIntegration['provider'], apiKey: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      switch (provider) {
        case 'hunter':
          return await this.testHunterConnection(apiKey);
        case 'snov':
          return await this.testSnovConnection(apiKey);
        case 'apollo':
          return await this.testApolloConnection(apiKey);
        case 'serpapi':
          return await this.testSerpAPIConnection(apiKey);
        case 'dataforseo':
          return await this.testDataForSEOConnection(apiKey);
        default:
          return { success: false, error: 'Unsupported provider' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test Hunter.io connection
   */
  private async testHunterConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Placeholder for Hunter.io API test
      // In production, this would:
      // 1. Make a test request to Hunter.io API
      // 2. Check if API key is valid
      // 3. Return success/failure
      
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hunter.io connection failed',
      };
    }
  }

  /**
   * Test Snov.io connection
   */
  private async testSnovConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Placeholder for Snov.io API test
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Snov.io connection failed',
      };
    }
  }

  /**
   * Test Apollo.io connection
   */
  private async testApolloConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Placeholder for Apollo.io API test
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Apollo.io connection failed',
      };
    }
  }

  /**
   * Test SerpAPI connection
   */
  private async testSerpAPIConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Placeholder for SerpAPI test
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SerpAPI connection failed',
      };
    }
  }

  /**
   * Test DataForSEO connection
   */
  private async testDataForSEOConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Placeholder for DataForSEO test
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DataForSEO connection failed',
      };
    }
  }

  /**
   * Check rate limit before making API request
   */
  async checkRateLimit(provider: APIIntegration['provider']): Promise<boolean> {
    try {
      const integrations = await leadGenerationDB.getAPIIntegrations(provider);
      
      if (!integrations || integrations.length === 0) {
        return false;
      }
      
      const integration = integrations[0];
      
      // Check if requests today exceed rate limit
      if (integration.requests_today >= integration.rate_limit_per_hour) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false;
    }
  }

  /**
   * Make API request with rate limiting
   */
  async makeAPIRequest<T>(
    provider: APIIntegration['provider'],
    requestFn: (apiKey: string) => Promise<T>
  ): Promise<T | null> {
    try {
      // Check rate limit
      const canProceed = await this.checkRateLimit(provider);
      
      if (!canProceed) {
        console.error(`Rate limit exceeded for ${provider}`);
        return null;
      }
      
      // Get API key
      const integrations = await leadGenerationDB.getAPIIntegrations(provider);
      
      if (!integrations || integrations.length === 0 || !integrations[0].api_key) {
        console.error(`No API key found for ${provider}`);
        return null;
      }
      
      const apiKey = integrations[0].api_key;
      
      // Make the request
      const result = await requestFn(apiKey);
      
      // Increment request counter
      await leadGenerationDB.incrementAPIRequests(provider);
      
      return result;
    } catch (error) {
      console.error(`Error making API request to ${provider}:`, error);
      return null;
    }
  }

  /**
   * Get API usage statistics
   */
  async getUsageStatistics(): Promise<{
    [key in APIIntegration['provider']]: {
      requests_today: number;
      rate_limit: number;
      usage_percentage: number;
    };
  }> {
    try {
      const integrations = await leadGenerationDB.getAPIIntegrations();
      
      const stats: any = {};
      
      for (const integration of integrations) {
        stats[integration.provider] = {
          requests_today: integration.requests_today,
          rate_limit: integration.rate_limit_per_hour,
          usage_percentage: Math.round(
            (integration.requests_today / integration.rate_limit_per_hour) * 100
          ),
        };
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting usage statistics:', error);
      return {} as any;
    }
  }

  /**
   * Reset daily request counters
   */
  async resetDailyCounters(): Promise<void> {
    try {
      const integrations = await leadGenerationDB.getAPIIntegrations();
      
      for (const integration of integrations) {
        await this.updateIntegration(integration.id, {
          requests_today: 0,
        });
      }
    } catch (error) {
      console.error('Error resetting daily counters:', error);
    }
  }

  /**
   * Get active integrations
   */
  async getActiveIntegrations(): Promise<APIIntegration[]> {
    try {
      const integrations = await leadGenerationDB.getAPIIntegrations();
      return integrations.filter(i => i.is_active);
    } catch (error) {
      console.error('Error getting active integrations:', error);
      return [];
    }
  }

  /**
   * Enable/disable integration
   */
  async toggleIntegration(id: string, isActive: boolean): Promise<APIIntegration | null> {
    return await this.updateIntegration(id, { is_active: isActive });
  }

  /**
   * Update API key
   */
  async updateApiKey(id: string, newApiKey: string): Promise<APIIntegration | null> {
    return await this.updateIntegration(id, { api_key: newApiKey });
  }

  /**
   * Update rate limit
   */
  async updateRateLimit(id: string, newRateLimit: number): Promise<APIIntegration | null> {
    return await this.updateIntegration(id, { rate_limit_per_hour: newRateLimit });
  }
}

export const apiIntegrationService = new APIIntegrationService();
