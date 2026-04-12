// STEP 85: BACKPRESSURE CONTROL - If server slow, throttle client sends
export interface BackpressureConfig {
  maxConcurrentRequests: number;
  requestTimeout: number;
  slowRequestThreshold: number;
  throttleDelay: number;
  maxThrottleDelay: number;
  backpressureMultiplier: number;
  recoveryMultiplier: number;
}

export interface RequestMetrics {
  requestId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: string;
}

export class BackpressureController {
  private static instance: BackpressureController;
  private config: BackpressureConfig;
  private activeRequests = new Map<string, RequestMetrics>();
  private requestHistory: RequestMetrics[] = [];
  private currentThrottleDelay = 0;
  private isThrottling = false;
  private requestQueue: Array<() => Promise<any>> = [];
  private processingQueue = false;

  static getInstance(config?: Partial<BackpressureConfig>): BackpressureController {
    if (!BackpressureController.instance) {
      BackpressureController.instance = new BackpressureController(config);
    }
    return BackpressureController.instance;
  }

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = {
      maxConcurrentRequests: 5,
      requestTimeout: 10000, // 10 seconds
      slowRequestThreshold: 3000, // 3 seconds
      throttleDelay: 100, // Start with 100ms
      maxThrottleDelay: 5000, // Max 5 seconds
      backpressureMultiplier: 2,
      recoveryMultiplier: 0.8,
      ...config
    };

    this.startMetricsCleanup();
  }

  // Execute request with backpressure control
  async executeRequest<T>(
    requestId: string,
    requestFunction: () => Promise<T>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    // Check if we should throttle
    if (this.shouldThrottle()) {
      await this.applyThrottle();
    }

    // Wait if too many concurrent requests
    while (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      await this.delay(50);
    }

    // Track request
    const metrics: RequestMetrics = {
      requestId,
      startTime: Date.now()
    };
    this.activeRequests.set(requestId, metrics);

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(requestFunction, this.config.requestTimeout);
      
      // Record success
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;
      
      this.recordRequest(metrics);
      this.adjustThrottleDelay(metrics);
      
      return result;
    } catch (error) {
      // Record failure
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = false;
      metrics.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.recordRequest(metrics);
      this.adjustThrottleDelay(metrics);
      
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  // Execute request with timeout
  private async executeWithTimeout<T>(
    requestFunction: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      requestFunction()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Check if we should throttle
  private shouldThrottle(): boolean {
    // Check recent request performance
    const recentRequests = this.getRecentRequests(10); // Last 10 requests
    
    if (recentRequests.length === 0) return false;

    const slowRequests = recentRequests.filter(req => 
      req.duration && req.duration > this.config.slowRequestThreshold
    ).length;

    const failedRequests = recentRequests.filter(req => 
      req.success === false
    ).length;

    // Throttle if >30% of recent requests are slow or failed
    const slowOrFailedRatio = (slowRequests + failedRequests) / recentRequests.length;
    
    return slowOrFailedRatio > 0.3;
  }

  // Apply throttle delay
  private async applyThrottle(): Promise<void> {
    if (this.currentThrottleDelay > 0) {
      console.log(`Applying backpressure throttle: ${this.currentThrottleDelay}ms`);
      await this.delay(this.currentThrottleDelay);
      this.isThrottling = true;
    }
  }

  // Adjust throttle delay based on request performance
  private adjustThrottleDelay(metrics: RequestMetrics): void {
    if (!metrics.duration) return;

    const isSlow = metrics.duration > this.config.slowRequestThreshold;
    const isFailed = metrics.success === false;

    if (isSlow || isFailed) {
      // Increase throttle delay
      this.currentThrottleDelay = Math.min(
        this.currentThrottleDelay * this.config.backpressureMultiplier,
        this.config.maxThrottleDelay
      );
      
      console.warn(`Backpressure increased to ${this.currentThrottleDelay}ms due to ${isFailed ? 'failure' : 'slow response'}`);
    } else if (metrics.duration < this.config.slowRequestThreshold / 2) {
      // Fast response, reduce throttle delay
      this.currentThrottleDelay = Math.max(
        this.currentThrottleDelay * this.config.recoveryMultiplier,
        this.config.throttleDelay
      );
      
      if (this.currentThrottleDelay <= this.config.throttleDelay) {
        this.isThrottling = false;
      }
    }
  }

  // Record request metrics
  private recordRequest(metrics: RequestMetrics): void {
    this.requestHistory.push(metrics);
    
    // Keep only last 100 requests
    if (this.requestHistory.length > 100) {
      this.requestHistory = this.requestHistory.slice(-100);
    }
  }

  // Get recent requests
  private getRecentRequests(count: number): RequestMetrics[] {
    return this.requestHistory.slice(-count);
  }

  // Get backpressure status
  getBackpressureStatus(): {
    isActive: boolean;
    currentDelay: number;
    activeRequests: number;
    maxConcurrent: number;
    recentPerformance: {
      avgDuration: number;
      successRate: number;
      slowRequestRate: number;
    };
  } {
    const recentRequests = this.getRecentRequests(20);
    const avgDuration = recentRequests.length > 0
      ? recentRequests.reduce((sum, req) => sum + (req.duration || 0), 0) / recentRequests.length
      : 0;
    
    const successRate = recentRequests.length > 0
      ? recentRequests.filter(req => req.success).length / recentRequests.length
      : 1;
    
    const slowRequestRate = recentRequests.length > 0
      ? recentRequests.filter(req => req.duration && req.duration > this.config.slowRequestThreshold).length / recentRequests.length
      : 0;

    return {
      isActive: this.isThrottling,
      currentDelay: this.currentThrottleDelay,
      activeRequests: this.activeRequests.size,
      maxConcurrent: this.config.maxConcurrentRequests,
      recentPerformance: {
        avgDuration,
        successRate,
        slowRequestRate
      }
    };
  }

  // Reset backpressure (useful for testing or recovery)
  resetBackpressure(): void {
    this.currentThrottleDelay = this.config.throttleDelay;
    this.isThrottling = false;
    console.log('Backpressure controller reset');
  }

  // Update configuration
  updateConfig(newConfig: Partial<BackpressureConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Backpressure config updated:', newConfig);
  }

  // Get request statistics
  getRequestStats(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageDuration: number;
    slowRequests: number;
  } {
    const totalRequests = this.requestHistory.length;
    const successfulRequests = this.requestHistory.filter(req => req.success).length;
    const failedRequests = this.requestHistory.filter(req => req.success === false).length;
    const slowRequests = this.requestHistory.filter(req => 
      req.duration && req.duration > this.config.slowRequestThreshold
    ).length;
    
    const averageDuration = totalRequests > 0
      ? this.requestHistory.reduce((sum, req) => sum + (req.duration || 0), 0) / totalRequests
      : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageDuration,
      slowRequests
    };
  }

  // Queue-based request execution for high-volume scenarios
  async queueRequest<T>(
    requestFunction: () => Promise<T>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedRequest = async () => {
        try {
          const result = await requestFunction();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      this.requestQueue.push(wrappedRequest);
      this.processQueue();
    });
  }

  // Process request queue
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
        await this.delay(50);
        continue;
      }

      const request = this.requestQueue.shift();
      if (request) {
        // Execute without blocking the queue
        request().catch(error => {
          console.error('Queued request failed:', error);
        });
      }
    }

    this.processingQueue = false;
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup old metrics
  private startMetricsCleanup(): void {
    setInterval(() => {
      // Keep only last 100 requests
      if (this.requestHistory.length > 100) {
        this.requestHistory = this.requestHistory.slice(-100);
      }
    }, 60000); // Every minute
  }

  // Get health status
  getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const status = this.getBackpressureStatus();
    const { successRate, slowRequestRate } = status.recentPerformance;

    if (successRate >= 0.95 && slowRequestRate < 0.1) {
      return 'healthy';
    } else if (successRate >= 0.8 && slowRequestRate < 0.3) {
      return 'degraded';
    } else {
      return 'critical';
    }
  }

  // Destroy controller
  destroy(): void {
    this.activeRequests.clear();
    this.requestHistory = [];
    this.requestQueue = [];
    this.processingQueue = false;
  }
}

export const backpressureController = BackpressureController.getInstance();
