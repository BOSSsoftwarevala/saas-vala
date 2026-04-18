/**
 * Performance Self-Optimize
 * Lazy load, cache hit, reduce re-render
 */

import React from 'react';

export interface PerformanceConfig {
  enableLazyLoad: boolean;
  enableMemoization: boolean;
  enableDebounce: boolean;
  enableThrottle: boolean;
  cacheSize: number;
}

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageRenderTime: number;
  renderCount: number;
  cacheHits: number;
  cacheMisses: number;
}

class PerformanceOptimize {
  private config: PerformanceConfig = {
    enableLazyLoad: true,
    enableMemoization: true,
    enableDebounce: true,
    enableThrottle: true,
    cacheSize: 100,
  };

  private cache: Map<string, any> = new Map();
  private metrics: PerformanceMetrics = {
    cacheHitRate: 0,
    averageRenderTime: 0,
    renderCount: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  private renderTimes: number[] = [];
  private debounceTimers: Map<string, any> = new Map();
  private throttleTimers: Map<string, any> = new Map();

  // Memoization cache
  memoize<T>(key: string, fn: () => T): T {
    if (this.config.enableMemoization && this.cache.has(key)) {
      this.metrics.cacheHits++;
      this.updateCacheHitRate();
      return this.cache.get(key);
    }

    this.metrics.cacheMisses++;
    const result = fn();

    if (this.config.enableMemoization) {
      this.enforceCacheSize();
      this.cache.set(key, result);
    }

    this.updateCacheHitRate();
    return result;
  }

  private enforceCacheSize(): void {
    if (this.cache.size > this.config.cacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, entries.length - this.config.cacheSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private updateCacheHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.metrics.cacheHits / total : 0;
  }

  // Debounce function
  debounce<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    if (!this.config.enableDebounce) {
      return fn;
    }

    return (...args: Parameters<T>) => {
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        fn(...args);
        this.debounceTimers.delete(key);
      }, delay);

      this.debounceTimers.set(key, timer);
    };
  }

  // Throttle function
  throttle<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    if (!this.config.enableThrottle) {
      return fn;
    }

    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (inThrottle) return;

      fn(...args);
      inThrottle = true;

      const existingTimer = this.throttleTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        inThrottle = false;
        this.throttleTimers.delete(key);
      }, limit);

      this.throttleTimers.set(key, timer);
    };
  }

  // Track render performance
  trackRender(renderFn: () => void): void {
    const startTime = performance.now();
    renderFn();
    const endTime = performance.now();

    const renderTime = endTime - startTime;
    this.renderTimes.push(renderTime);

    // Keep only last 100 render times
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    this.metrics.renderCount++;
    this.metrics.averageRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
  }

  // Lazy load component
  lazyLoad<T>(
    loader: () => Promise<T>,
    key: string
  ): Promise<T> {
    if (!this.config.enableLazyLoad) {
      return loader();
    }

    // Check if already loaded
    if (this.cache.has(`lazy_${key}`)) {
      this.metrics.cacheHits++;
      this.updateCacheHitRate();
      return Promise.resolve(this.cache.get(`lazy_${key}`));
    }

    this.metrics.cacheMisses++;
    this.updateCacheHitRate();

    return loader().then(result => {
      this.enforceCacheSize();
      this.cache.set(`lazy_${key}`, result);
      return result;
    });
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.cacheHitRate = 0;
  }

  // Clear specific cache entry
  clearCacheEntry(key: string): void {
    this.cache.delete(key);
  }

  // Get performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      cacheHitRate: 0,
      averageRenderTime: 0,
      renderCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
    this.renderTimes = [];
  }

  // Set configuration
  setConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get configuration
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  // Clear all timers
  clearTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.throttleTimers.clear();
  }

  // React HOC for memoization
  withMemo<P extends object>(
    Component: React.ComponentType<P>,
    keyFn?: (props: P) => string
  ): React.ComponentType<P> {
    return function WithMemoWrapper(props: P) {
      const key = keyFn ? keyFn(props) : JSON.stringify(props);
      const memoized = performanceOptimize.memoize(key, () => React.createElement(Component, props));
      return memoized;
    };
  }

  // React hook for debounced value
  useDebouncedValue<T>(value: T, delay: number, key: string = 'default'): T {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
      const debouncedFn = performanceOptimize.debounce(
        key,
        () => setDebouncedValue(value),
        delay
      );

      debouncedFn();

      return () => {
        const timer = performanceOptimize['debounceTimers'].get(key);
        if (timer) {
          clearTimeout(timer);
        }
      };
    }, [value, delay, key]);

    return debouncedValue;
  }

  // React hook for throttled value
  useThrottledValue<T>(value: T, limit: number, key: string = 'default'): T {
    const [throttledValue, setThrottledValue] = React.useState(value);

    React.useEffect(() => {
      const throttledFn = performanceOptimize.throttle(
        key,
        () => setThrottledValue(value),
        limit
      );

      throttledFn();

      return () => {
        const timer = performanceOptimize['throttleTimers'].get(key);
        if (timer) {
          clearTimeout(timer);
        }
      };
    }, [value, limit, key]);

    return throttledValue;
  }

  // React hook for lazy loading
  useLazy<T>(
    loader: () => Promise<T>,
    key: string
  ): {
    data: T | null;
    loading: boolean;
    error: Error | null;
  } {
    const [data, setData] = React.useState<T | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
      performanceOptimize.lazyLoad(loader, key)
        .then(setData)
        .catch(err => setError(err instanceof Error ? err : new Error('Unknown error')))
        .finally(() => setLoading(false));
    }, [loader, key]);

    return { data, loading, error };
  }
}

// Singleton instance
export const performanceOptimize = new PerformanceOptimize();
