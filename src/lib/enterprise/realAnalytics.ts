import { EnterpriseDatabase, Database } from '../supabase';

export interface AnalyticsEvent {
  id: string;
  type: string;
  category: 'product' | 'user' | 'system' | 'security' | 'api';
  action: string;
  userId?: string;
  productId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  value?: number;
}

export interface DailyStats {
  date: string;
  productViews: number;
  keyGenerations: number;
  serverDeploys: number;
  userRegistrations: number;
  activeUsers: number;
  apiCalls: number;
  errors: number;
  revenue?: number;
}

export interface ProductStats {
  productId: string;
  productName: string;
  totalViews: number;
  uniqueViews: number;
  keyActivations: number;
  deployments: number;
  revenue: number;
  avgRating: number;
  lastUpdated: Date;
}

export class RealAnalyticsManager {
  private static instance: RealAnalyticsManager;

  static getInstance(): RealAnalyticsManager {
    if (!RealAnalyticsManager.instance) {
      RealAnalyticsManager.instance = new RealAnalyticsManager();
    }
    return RealAnalyticsManager.instance;
  }

  async trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    const eventData: Database['public']['Tables']['analytics_events']['Insert'] = {
      type: event.type,
      category: event.category,
      action: event.action,
      user_id: event.userId,
      product_id: event.productId,
      metadata: event.metadata || {},
      value: event.value,
    };

    await EnterpriseDatabase.trackEvent(eventData);
  }

  async getDailyStats(startDate: Date, endDate: Date): Promise<DailyStats[]> {
    const stats: DailyStats[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayStart = new Date(dateStr + 'T00:00:00.000Z').toISOString();
      const dayEnd = new Date(dateStr + 'T23:59:59.999Z').toISOString();
      
      // Get events for this day
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('timestamp', dayStart)
        .lte('timestamp', dayEnd);
      
      if (error) throw error;

      const dayStats: DailyStats = {
        date: dateStr,
        productViews: events.filter(e => e.action === 'product_view').length,
        keyGenerations: events.filter(e => e.action === 'key_generated').length,
        serverDeploys: events.filter(e => e.action === 'server_deployed').length,
        userRegistrations: events.filter(e => e.action === 'user_registered').length,
        activeUsers: new Set(events.filter(e => e.user_id).map(e => e.user_id)).size,
        apiCalls: events.filter(e => e.category === 'api').length,
        errors: events.filter(e => e.action === 'error').length,
      };

      stats.push(dayStats);
      current.setDate(current.getDate() + 1);
    }
    
    return stats;
  }

  async getProductStats(productId?: string, days: number = 30): Promise<ProductStats[]> {
    if (productId) {
      // Get specific product stats
      const product = await this.getProductById(productId);
      if (!product) return [];

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const cutoffStr = cutoff.toISOString();

      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('product_id', productId)
        .gte('timestamp', cutoffStr);
      
      if (error) throw error;

      const stats: ProductStats = {
        productId: product.id,
        productName: product.name,
        totalViews: events.filter(e => e.action === 'product_view').length,
        uniqueViews: new Set(events.filter(e => e.action === 'product_view' && e.user_id).map(e => e.user_id)).size,
        keyActivations: events.filter(e => e.action === 'key_activated').length,
        deployments: events.filter(e => e.action === 'server_deployed').length,
        revenue: events.filter(e => e.action === 'payment_completed').reduce((sum, e) => sum + (e.value || 0), 0),
        avgRating: 0, // Would come from a ratings table
        lastUpdated: new Date(),
      };

      return [stats];
    }
    
    // Get all products stats
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active');
    
    if (error) throw error;

    const allStats: ProductStats[] = [];
    for (const product of products) {
      const productStats = await this.getProductStats(product.id, days);
      allStats.push(...productStats);
    }

    return allStats;
  }

  async getUserActivity(userId: string, days: number = 30): Promise<AnalyticsEvent[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString();

    const { data, error } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', cutoffStr)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;

    return data.map(event => ({
      id: event.id,
      type: event.type,
      category: event.category,
      action: event.action,
      userId: event.user_id,
      productId: event.product_id,
      metadata: event.metadata,
      timestamp: new Date(event.timestamp),
      value: event.value,
    }));
  }

  async getTopProducts(metric: 'views' | 'revenue' | 'deployments', limit: number = 10): Promise<ProductStats[]> {
    const allStats = await this.getProductStats(undefined, 30);
    
    return allStats
      .sort((a, b) => {
        switch (metric) {
          case 'views':
            return b.totalViews - a.totalViews;
          case 'revenue':
            return b.revenue - a.revenue;
          case 'deployments':
            return b.deployments - a.deployments;
          default:
            return 0;
        }
      })
      .slice(0, limit);
  }

  async generateReport(type: 'daily' | 'weekly' | 'monthly', date?: Date): Promise<any> {
    const reportDate = date || new Date();
    
    switch (type) {
      case 'daily':
        return this.generateDailyReport(reportDate);
      case 'weekly':
        return this.generateWeeklyReport(reportDate);
      case 'monthly':
        return this.generateMonthlyReport(reportDate);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private async generateDailyReport(date: Date): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    const stats = await this.getDailyStats(date, date);
    
    if (stats.length === 0) {
      return { date: dateStr, summary: null, metrics: null, topProducts: [] };
    }

    const dayStats = stats[0];
    
    return {
      date: dateStr,
      summary: dayStats,
      metrics: {
        avgResponseTime: 0, // Would come from performance monitoring
        totalErrors: dayStats.errors,
        conversionRate: dayStats.userRegistrations > 0 ? (dayStats.keyGenerations / dayStats.userRegistrations) * 100 : 0,
      },
      topProducts: await this.getTopProducts('views', 5),
    };
  }

  private async generateWeeklyReport(date: Date): Promise<any> {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const dailyStats = await this.getDailyStats(weekStart, weekEnd);
    
    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      summary: {
        totalProductViews: dailyStats.reduce((sum, day) => sum + day.productViews, 0),
        totalKeyGenerations: dailyStats.reduce((sum, day) => sum + day.keyGenerations, 0),
        totalServerDeploys: dailyStats.reduce((sum, day) => sum + day.serverDeploys, 0),
        totalUserRegistrations: dailyStats.reduce((sum, day) => sum + day.userRegistrations, 0),
        totalErrors: dailyStats.reduce((sum, day) => sum + day.errors, 0),
      },
      dailyBreakdown: dailyStats,
    };
  }

  private async generateMonthlyReport(date: Date): Promise<any> {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const dailyStats = await this.getDailyStats(monthStart, monthEnd);
    const topProducts = await this.getTopProducts('revenue', 10);
    
    return {
      month: monthStart.toISOString().slice(0, 7),
      summary: {
        totalProductViews: dailyStats.reduce((sum, day) => sum + day.productViews, 0),
        totalKeyGenerations: dailyStats.reduce((sum, day) => sum + day.keyGenerations, 0),
        totalServerDeploys: dailyStats.reduce((sum, day) => sum + day.serverDeploys, 0),
        totalUserRegistrations: dailyStats.reduce((sum, day) => sum + day.userRegistrations, 0),
        totalRevenue: dailyStats.reduce((sum, day) => sum + (day.revenue || 0), 0),
        totalErrors: dailyStats.reduce((sum, day) => sum + day.errors, 0),
      },
      topProducts,
      dailyTrends: dailyStats,
    };
  }

  private async getProductById(productId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getRealtimeMetrics(): Promise<{
    activeUsers: number;
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
  }> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneMinuteAgoStr = oneMinuteAgo.toISOString();

    // Get recent events
    const { data: recentEvents, error } = await supabase
      .from('analytics_events')
      .select('*')
      .gte('timestamp', oneMinuteAgoStr);
    
    if (error) throw error;

    const activeUsers = new Set(recentEvents.filter(e => e.user_id).map(e => e.user_id)).size;
    const requestsPerMinute = recentEvents.filter(e => e.category === 'api').length;
    const errors = recentEvents.filter(e => e.action === 'error').length;
    const errorRate = recentEvents.length > 0 ? (errors / recentEvents.length) * 100 : 0;

    return {
      activeUsers,
      requestsPerMinute,
      errorRate,
      avgResponseTime: 0, // Would come from performance monitoring
    };
  }

  async createDashboardCache(ttl: number = 300): Promise<void> {
    // Cache commonly requested data
    const cacheKey = `dashboard_cache_${Date.now()}`;
    
    const cacheData = {
      dailyStats: await this.getDailyStats(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
      topProducts: await this.getTopProducts('views', 5),
      realtimeMetrics: await this.getRealtimeMetrics(),
      cachedAt: new Date().toISOString(),
      ttl,
    };

    // In a real implementation, you'd store this in Redis or similar
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  }
}

// React hooks for analytics
export function useAnalytics(userId?: string) {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const trackEvent = useCallback(async (event: Omit<AnalyticsEvent, 'id' | 'timestamp'>) => {
    try {
      const analytics = RealAnalyticsManager.getInstance();
      await analytics.trackEvent(event);
    } catch (err) {
      console.error('Failed to track event:', err);
    }
  }, []);

  const loadUserActivity = useCallback(async (days: number = 30) => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const analytics = RealAnalyticsManager.getInstance();
      const userEvents = await analytics.getUserActivity(userId, days);
      setEvents(userEvents);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user activity');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { events, loading, error, trackEvent, loadUserActivity };
}

export function useRealtimeMetrics() {
  const [metrics, setMetrics] = useState({
    activeUsers: 0,
    requestsPerMinute: 0,
    errorRate: 0,
    avgResponseTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const analytics = RealAnalyticsManager.getInstance();
        const realtimeMetrics = await analytics.getRealtimeMetrics();
        setMetrics(realtimeMetrics);
      } catch (error) {
        console.error('Failed to load realtime metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return { metrics, loading };
}

// React imports
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export default RealAnalyticsManager;
