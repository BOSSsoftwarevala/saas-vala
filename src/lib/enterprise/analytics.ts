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

export interface SystemMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  activeConnections: number;
  responseTime: number;
  errorRate: number;
}

export class AnalyticsManager {
  private static instance: AnalyticsManager;
  private events: AnalyticsEvent[] = [];
  private dailyStats: Map<string, DailyStats> = new Map();
  private productStats: Map<string, ProductStats> = new Map();
  private systemMetrics: SystemMetrics[] = [];

  static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }

  async trackEvent(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    this.events.push(analyticsEvent);
    
    // Update relevant stats
    await this.updateStats(analyticsEvent);
    
    // Save to database
    await this.saveEventToDB(analyticsEvent);
    
    // Keep only last 10000 events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  async getDailyStats(startDate: Date, endDate: Date): Promise<DailyStats[]> {
    const stats: DailyStats[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      let dayStats = this.dailyStats.get(dateStr);
      
      if (!dayStats) {
        dayStats = await this.fetchDailyStatsFromDB(dateStr);
        this.dailyStats.set(dateStr, dayStats);
      }
      
      stats.push(dayStats);
      current.setDate(current.getDate() + 1);
    }
    
    return stats;
  }

  async getProductStats(productId?: string, days: number = 30): Promise<ProductStats[]> {
    if (productId) {
      const stats = this.productStats.get(productId);
      if (stats) return [stats];
      
      const dbStats = await this.fetchProductStatsFromDB(productId);
      this.productStats.set(productId, dbStats);
      return [dbStats];
    }
    
    // Return stats for all products
    return Array.from(this.productStats.values());
  }

  async getSystemMetrics(hours: number = 24): Promise<SystemMetrics[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.systemMetrics.filter(m => m.timestamp >= cutoff);
  }

  async getTopProducts(metric: 'views' | 'revenue' | 'deployments', limit: number = 10): Promise<ProductStats[]> {
    const allStats = Array.from(this.productStats.values());
    
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

  async getUserActivity(userId: string, days: number = 30): Promise<AnalyticsEvent[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return this.events.filter(e => 
      e.userId === userId && e.timestamp >= cutoff
    );
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

  private async updateStats(event: AnalyticsEvent): Promise<void> {
    const dateStr = event.timestamp.toISOString().split('T')[0];
    let dayStats = this.dailyStats.get(dateStr);
    
    if (!dayStats) {
      dayStats = {
        date: dateStr,
        productViews: 0,
        keyGenerations: 0,
        serverDeploys: 0,
        userRegistrations: 0,
        activeUsers: 0,
        apiCalls: 0,
        errors: 0,
      };
      this.dailyStats.set(dateStr, dayStats);
    }

    // Update daily stats based on event type
    switch (event.action) {
      case 'product_view':
        dayStats.productViews++;
        break;
      case 'key_generated':
        dayStats.keyGenerations++;
        break;
      case 'server_deployed':
        dayStats.serverDeploys++;
        break;
      case 'user_registered':
        dayStats.userRegistrations++;
        break;
      case 'api_call':
        dayStats.apiCalls++;
        break;
      case 'error':
        dayStats.errors++;
        break;
    }

    // Update product stats if applicable
    if (event.productId) {
      await this.updateProductStats(event.productId, event);
    }
  }

  private async updateProductStats(productId: string, event: AnalyticsEvent): Promise<void> {
    let productStats = this.productStats.get(productId);
    
    if (!productStats) {
      productStats = {
        productId,
        productName: `Product ${productId}`,
        totalViews: 0,
        uniqueViews: 0,
        keyActivations: 0,
        deployments: 0,
        revenue: 0,
        avgRating: 0,
        lastUpdated: new Date(),
      };
      this.productStats.set(productId, productStats);
    }

    switch (event.action) {
      case 'product_view':
        productStats.totalViews++;
        break;
      case 'key_activated':
        productStats.keyActivations++;
        break;
      case 'server_deployed':
        productStats.deployments++;
        break;
    }

    productStats.lastUpdated = new Date();
  }

  private async generateDailyReport(date: Date): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    const stats = this.dailyStats.get(dateStr) || await this.fetchDailyStatsFromDB(dateStr);
    const metrics = await this.getSystemMetrics(24);
    
    return {
      date: dateStr,
      summary: stats,
      metrics: {
        avgCpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length,
        avgMemoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
        avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
        totalErrors: metrics.reduce((sum, m) => sum + m.errorRate, 0),
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

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveEventToDB(event: AnalyticsEvent): Promise<void> {
    // Implement database save logic
  }

  private async fetchDailyStatsFromDB(date: string): Promise<DailyStats> {
    // Implement database fetch logic
    return {
      date,
      productViews: 0,
      keyGenerations: 0,
      serverDeploys: 0,
      userRegistrations: 0,
      activeUsers: 0,
      apiCalls: 0,
      errors: 0,
    };
  }

  private async fetchProductStatsFromDB(productId: string): Promise<ProductStats> {
    // Implement database fetch logic
    return {
      productId,
      productName: `Product ${productId}`,
      totalViews: 0,
      uniqueViews: 0,
      keyActivations: 0,
      deployments: 0,
      revenue: 0,
      avgRating: 0,
      lastUpdated: new Date(),
    };
  }

  clearCache(): void {
    this.events = [];
    this.dailyStats.clear();
    this.productStats.clear();
    this.systemMetrics = [];
  }
}
