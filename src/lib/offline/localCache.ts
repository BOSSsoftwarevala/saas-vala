/**
 * Local Cache System
 * Cache all data, preload critical data
 */

import React from 'react';
import { localApi } from './localApi';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  preloadTables: string[];
}

class LocalCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig = {
    maxSize: 1000,
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    preloadTables: ['users', 'products', 'categories'],
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Load cache from localStorage if available
    this.loadCacheFromStorage();

    // Preload critical data
    await this.preloadCriticalData();

    // Setup cache persistence
    this.setupCachePersistence();
  }

  async preloadCriticalData(): Promise<void> {
    for (const table of this.config.preloadTables) {
      try {
        const { data } = await localApi.select(table).execute();
        if ((data as any)?.data) {
          this.set(`${table}_all`, (data as any).data);
        }
      } catch (error) {
        console.error(`Failed to preload ${table}:`, error);
      }
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      key,
    };

    this.cache.set(key, entry);

    // Enforce max size
    this.enforceMaxSize();

    // Persist to localStorage
    this.saveCacheToStorage();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.saveCacheToStorage();
  }

  clear(): void {
    this.cache.clear();
    this.saveCacheToStorage();
  }

  private enforceMaxSize(): void {
    if (this.cache.size > this.config.maxSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, entries.length - this.config.maxSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private saveCacheToStorage(): void {
    try {
      const cacheData = Array.from(this.cache.entries());
      localStorage.setItem('saasvala_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }

  private loadCacheFromStorage(): void {
    try {
      const cacheData = localStorage.getItem('saasvala_cache');
      if (cacheData) {
        const entries = JSON.parse(cacheData);
        this.cache = new Map(entries);
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  private setupCachePersistence(): void {
    // Save cache on page unload
    window.addEventListener('beforeunload', () => {
      this.saveCacheToStorage();
    });

    // Clear expired entries periodically
    setInterval(() => {
      this.clearExpiredEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private clearExpiredEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    }

    this.saveCacheToStorage();
  }

  getOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return Promise.resolve(cached);
    }

    return fetchFn().then(data => {
      this.set(key, data, ttl);
      return data;
    });
  }

  invalidateTable(tableName: string): void {
    // Invalidate all cache entries related to a table
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tableName}_`) || key.includes(`_${tableName}_`)) {
        this.delete(key);
      }
    }
  }

  invalidatePattern(pattern: string): void {
    // Invalidate cache entries matching a pattern
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
      }
    }
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // Would need to track hits/misses
      entries,
    };
  }

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.enforceMaxSize();
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // React hook for cache access
  useCache<T>(key: string, fetchFn?: () => Promise<T>, ttl?: number): {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
  } {
    const [data, setData] = React.useState<T | null>(() => this.get<T>(key));
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    const refresh = React.useCallback(async () => {
      if (!fetchFn) return;

      setLoading(true);
      setError(null);

      try {
        const fetchedData = await fetchFn();
        this.set(key, fetchedData, ttl);
        setData(fetchedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }, [key, fetchFn, ttl]);

    React.useEffect(() => {
      // Check cache first
      const cached = this.get<T>(key);
      if (cached !== null) {
        setData(cached);
        return;
      }

      // Fetch if not cached and fetchFn provided
      if (fetchFn) {
        refresh();
      }
    }, [key, fetchFn, refresh]);

    return { data, loading, error, refresh };
  }
}

// Singleton instance
export const localCache = new LocalCache();
