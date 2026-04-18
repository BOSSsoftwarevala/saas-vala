// Usage Metering System for Key Management
import { supabase } from '@/lib/supabase';

export interface UsageMetric {
  id: string;
  user_id?: string;
  key_id?: string;
  metric_type: 'api_calls' | 'tokens' | 'activations' | 'validations' | 'downloads';
  value: number;
  unit: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsageStats {
  total_api_calls: number;
  total_tokens: number;
  total_activations: number;
  total_validations: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
}

export interface UserUsageReport {
  user_id: string;
  period: string;
  stats: UsageStats;
  by_key: Record<string, UsageStats>;
  cost: number;
}

export class UsageMeteringService {
  /**
   * Record usage metric
   */
  async recordMetric(
    metricType: UsageMetric['metric_type'],
    value: number,
    unit: string,
    userId?: string,
    keyId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('usage_metrics').insert({
        user_id: userId,
        key_id: keyId,
        metric_type: metricType,
        value,
        unit,
        timestamp: new Date().toISOString(),
        metadata,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error recording usage metric:', error);
      return false;
    }
  }

  /**
   * Record API call
   */
  async recordApiCall(
    userId?: string,
    keyId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    return this.recordMetric('api_calls', 1, 'call', userId, keyId, metadata);
  }

  /**
   * Record token usage
   */
  async recordTokenUsage(
    tokens: number,
    userId?: string,
    keyId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    return this.recordMetric('tokens', tokens, 'token', userId, keyId, metadata);
  }

  /**
   * Record activation
   */
  async recordActivation(
    userId?: string,
    keyId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    return this.recordMetric('activations', 1, 'activation', userId, keyId, metadata);
  }

  /**
   * Record validation
   */
  async recordValidation(
    userId?: string,
    keyId?: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    return this.recordMetric('validations', 1, 'validation', userId, keyId, metadata);
  }

  /**
   * Get usage stats for a period
   */
  async getUsageStats(
    startDate: Date,
    endDate: Date,
    userId?: string,
    keyId?: string
  ): Promise<UsageStats> {
    try {
      let query = supabase
        .from('usage_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (keyId) {
        query = query.eq('key_id', keyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const metrics = data as UsageMetric[];

      return {
        total_api_calls:
          metrics.filter(m => m.metric_type === 'api_calls').reduce((sum, m) => sum + m.value, 0),
        total_tokens:
          metrics.filter(m => m.metric_type === 'tokens').reduce((sum, m) => sum + m.value, 0),
        total_activations:
          metrics.filter(m => m.metric_type === 'activations').reduce((sum, m) => sum + m.value, 0),
        total_validations:
          metrics.filter(m => m.metric_type === 'validations').reduce((sum, m) => sum + m.value, 0),
        period: this.getPeriod(startDate, endDate),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return {
        total_api_calls: 0,
        total_tokens: 0,
        total_activations: 0,
        total_validations: 0,
        period: 'daily',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };
    }
  }

  /**
   * Get daily usage stats
   */
  async getDailyUsageStats(date?: Date, userId?: string, keyId?: string): Promise<UsageStats> {
    const targetDate = date || new Date();
    const startDate = new Date(targetDate.setHours(0, 0, 0, 0));
    const endDate = new Date(targetDate.setHours(23, 59, 59, 999));

    return this.getUsageStats(startDate, endDate, userId, keyId);
  }

  /**
   * Get weekly usage stats
   */
  async getWeeklyUsageStats(date?: Date, userId?: string, keyId?: string): Promise<UsageStats> {
    const targetDate = date || new Date();
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    return this.getUsageStats(startDate, endDate, userId, keyId);
  }

  /**
   * Get monthly usage stats
   */
  async getMonthlyUsageStats(date?: Date, userId?: string, keyId?: string): Promise<UsageStats> {
    const targetDate = date || new Date();
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    return this.getUsageStats(startDate, endDate, userId, keyId);
  }

  /**
   * Get user usage report
   */
  async getUserUsageReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UserUsageReport> {
    try {
      const stats = await this.getUsageStats(startDate, endDate, userId);

      // Get usage by key
      const { data: userKeys } = await supabase
        .from('keys')
        .select('id')
        .eq('assigned_user_id', userId)
        .is('deleted_at', null);

      const byKey: Record<string, UsageStats> = {};

      if (userKeys) {
        for (const key of userKeys) {
          const keyStats = await this.getUsageStats(startDate, endDate, userId, key.id);
          byKey[key.id] = keyStats;
        }
      }

      // Calculate cost (simplified - would need pricing rules)
      const cost = stats.total_tokens * 0.0001; // Example: $0.0001 per token

      return {
        user_id: userId,
        period: this.getPeriod(startDate, endDate),
        stats,
        by_key,
        cost,
      };
    } catch (error) {
      console.error('Error getting user usage report:', error);
      return {
        user_id: userId,
        period: 'daily',
        stats: {
          total_api_calls: 0,
          total_tokens: 0,
          total_activations: 0,
          total_validations: 0,
          period: 'daily',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        by_key: {},
        cost: 0,
      };
    }
  }

  /**
   * Get key usage report
   */
  async getKeyUsageReport(
    keyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageStats> {
    return this.getUsageStats(startDate, endDate, undefined, keyId);
  }

  /**
   * Get top users by usage
   */
  async getTopUsersByUsage(
    metricType: UsageMetric['metric_type'],
    limit = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ user_id: string; total_usage: number }[]> {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const { data, error } = await supabase
        .from('usage_metrics')
        .select('user_id, value')
        .eq('metric_type', metricType)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .not('user_id', 'is', null);

      if (error) throw error;

      const metrics = data as UsageMetric[];

      // Aggregate by user
      const userUsage: Record<string, number> = {};

      for (const metric of metrics) {
        if (metric.user_id) {
          userUsage[metric.user_id] = (userUsage[metric.user_id] || 0) + metric.value;
        }
      }

      // Sort and limit
      const sorted = Object.entries(userUsage)
        .map(([user_id, total_usage]) => ({ user_id, total_usage }))
        .sort((a, b) => b.total_usage - a.total_usage)
        .slice(0, limit);

      return sorted;
    } catch (error) {
      console.error('Error getting top users by usage:', error);
      return [];
    }
  }

  /**
   * Get top keys by usage
   */
  async getTopKeysByUsage(
    metricType: UsageMetric['metric_type'],
    limit = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ key_id: string; total_usage: number }[]> {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const { data, error } = await supabase
        .from('usage_metrics')
        .select('key_id, value')
        .eq('metric_type', metricType)
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .not('key_id', 'is', null);

      if (error) throw error;

      const metrics = data as UsageMetric[];

      // Aggregate by key
      const keyUsage: Record<string, number> = {};

      for (const metric of metrics) {
        if (metric.key_id) {
          keyUsage[metric.key_id] = (keyUsage[metric.key_id] || 0) + metric.value;
        }
      }

      // Sort and limit
      const sorted = Object.entries(keyUsage)
        .map(([key_id, total_usage]) => ({ key_id, total_usage }))
        .sort((a, b) => b.total_usage - a.total_usage)
        .slice(0, limit);

      return sorted;
    } catch (error) {
      console.error('Error getting top keys by usage:', error);
      return [];
    }
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(
    metricType: UsageMetric['metric_type'],
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{ timestamp: string; value: number }[]> {
    try {
      const { data, error } = await supabase
        .from('usage_metrics')
        .select('timestamp, value')
        .eq('metric_type', metricType)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const metrics = data as UsageMetric[];

      // Group by granularity
      const grouped: Record<string, number> = {};

      for (const metric of metrics) {
        const date = new Date(metric.timestamp);
        let key: string;

        if (granularity === 'hour') {
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        } else if (granularity === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
        } else {
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        }

        grouped[key] = (grouped[key] || 0) + metric.value;
      }

      // Convert to array
      const trends = Object.entries(grouped).map(([timestamp, value]) => ({
        timestamp,
        value,
      }));

      return trends;
    } catch (error) {
      console.error('Error getting usage trends:', error);
      return [];
    }
  }

  /**
   * Get usage summary for dashboard
   */
  async getUsageSummary(): Promise<{
    total_api_calls: number;
    total_tokens: number;
    total_activations: number;
    total_validations: number;
    today_api_calls: number;
    today_tokens: number;
    this_month_api_calls: number;
    this_month_tokens: number;
    active_users: number;
    active_keys: number;
  }> {
    try {
      const [todayStats, monthStats, totalStats] = await Promise.all([
        this.getDailyUsageStats(),
        this.getMonthlyUsageStats(),
        this.getUsageStats(
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          new Date()
        ),
      ]);

      // Get active users and keys
      const [activeUsersResult, activeKeysResult] = await Promise.all([
        supabase
          .from('usage_metrics')
          .select('user_id', { count: 'exact', head: true })
          .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('usage_metrics')
          .select('key_id', { count: 'exact', head: true })
          .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        total_api_calls: totalStats.total_api_calls,
        total_tokens: totalStats.total_tokens,
        total_activations: totalStats.total_activations,
        total_validations: totalStats.total_validations,
        today_api_calls: todayStats.total_api_calls,
        today_tokens: todayStats.total_tokens,
        this_month_api_calls: monthStats.total_api_calls,
        this_month_tokens: monthStats.total_tokens,
        active_users: activeUsersResult.count || 0,
        active_keys: activeKeysResult.count || 0,
      };
    } catch (error) {
      console.error('Error getting usage summary:', error);
      return {
        total_api_calls: 0,
        total_tokens: 0,
        total_activations: 0,
        total_validations: 0,
        today_api_calls: 0,
        today_tokens: 0,
        this_month_api_calls: 0,
        this_month_tokens: 0,
        active_users: 0,
        active_keys: 0,
      };
    }
  }

  /**
   * Clean up old usage metrics
   */
  async cleanupOldMetrics(daysOld = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { error, count } = await supabase
        .from('usage_metrics')
        .delete({ count: 'exact' })
        .lt('timestamp', cutoffDate.toISOString());

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error cleaning up old metrics:', error);
      return 0;
    }
  }

  /**
   * Get period from dates
   */
  private getPeriod(startDate: Date, endDate: Date): UsageStats['period'] {
    const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return 'daily';
    if (diffDays <= 7) return 'weekly';
    if (diffDays <= 30) return 'monthly';
    return 'yearly';
  }
}

export const usageMeteringService = new UsageMeteringService();
