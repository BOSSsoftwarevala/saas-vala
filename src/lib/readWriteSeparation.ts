/**
 * Read/Write Separation Utility
 * Routes read operations through cache/optimized paths
 * Ensures writes go directly to primary database
 * Prevents database overload
 */

import { supabase } from '@/lib/supabase';
import { eventLogger, EventType } from './eventLogger';

export enum OperationType {
  READ = 'read',
  WRITE = 'write',
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ReadWriteSeparation {
  private static instance: ReadWriteSeparation;
  
  // In-memory cache for read operations
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL = 60000; // 60 seconds default TTL
  private maxCacheSize = 1000; // Maximum cache entries

  private constructor() {}

  static getInstance(): ReadWriteSeparation {
    if (!ReadWriteSeparation.instance) {
      ReadWriteSeparation.instance = new ReadWriteSeparation();
    }
    return ReadWriteSeparation.instance;
  }

  /**
   * Execute a read operation with caching
   * @param key Cache key
   * @param queryFn Query function to execute if cache miss
   * @param ttl Time to live in milliseconds (default: 60000)
   */
  async read<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      eventLogger.logSystemEvent('Cache Hit', { key });
      return cached.data as T;
    }

    // Cache miss - execute query
    eventLogger.logSystemEvent('Cache Miss', { key });
    
    try {
      const data = await queryFn();
      
      // Cache the result
      this.setCache(key, data, ttl);
      
      return data;
    } catch (error) {
      eventLogger.logError('Read Operation Failed', error as Error);
      throw error;
    }
  }

  /**
   * Execute a write operation directly to primary database
   * Invalidates relevant cache entries
   * @param operationType Type of write operation
   * @param table Database table
   * @param operationFn Write function to execute
   * @param cacheKeys Cache keys to invalidate after write
   */
  async write<T>(
    operationType: 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    operationFn: () => Promise<T>,
    cacheKeys: string[] = []
  ): Promise<T> {
    eventLogger.logSystemEvent('Write Operation Started', {
      operationType,
      table,
      cacheKeys,
    });

    try {
      // Execute write operation directly (no cache)
      const result = await operationFn();
      
      // Invalidate cache entries
      for (const key of cacheKeys) {
        this.invalidate(key);
      }

      // Invalidate table-specific cache
      this.invalidatePattern(`table:${table}:*`);

      eventLogger.logSystemEvent('Write Operation Completed', {
        operationType,
        table,
      });

      return result;
    } catch (error) {
      eventLogger.logError('Write Operation Failed', error as Error);
      throw error;
    }
  }

  /**
   * Set a cache entry
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.findOldestCacheKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    eventLogger.logSystemEvent('Cache Invalidated', { key });
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      eventLogger.logSystemEvent('Cache Pattern Invalidated', {
        pattern,
        count: keysToDelete.length,
      });
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    eventLogger.logSystemEvent('Cache Cleared', { previousSize: size });
  }

  /**
   * Find the oldest cache key for eviction
   */
  private findOldestCacheKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: this.calculateHitRate(),
      entries,
    };
  }

  private hitCount = 0;
  private missCount = 0;

  private calculateHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  /**
   * Generate a cache key for a table and query
   */
  generateCacheKey(table: string, query: string, params?: any): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `table:${table}:${query}:${paramString}`;
  }

  /**
   * Execute a batch read operation with parallel caching
   */
  async batchRead<T>(
    operations: Array<{ key: string; queryFn: () => Promise<T>; ttl?: number }>
  ): Promise<T[]> {
    const results = await Promise.all(
      operations.map(op => this.read(op.key, op.queryFn, op.ttl))
    );
    return results;
  }

  /**
   * Execute a batch write operation with cache invalidation
   */
  async batchWrite<T>(
    operations: Array<{
      operationType: 'INSERT' | 'UPDATE' | 'DELETE';
      table: string;
      operationFn: () => Promise<T>;
      cacheKeys?: string[];
    }>
  ): Promise<T[]> {
    const results = await Promise.all(
      operations.map(op =>
        this.write(op.operationType, op.table, op.operationFn, op.cacheKeys || [])
      )
    );
    return results;
  }
}

// Export singleton instance
export const readWriteSeparation = ReadWriteSeparation.getInstance();

// Export helper functions
export const cachedRead = <T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
) => readWriteSeparation.read(key, queryFn, ttl);

export const directWrite = <T>(
  operationType: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  operationFn: () => Promise<T>,
  cacheKeys?: string[]
) => readWriteSeparation.write(operationType, table, operationFn, cacheKeys);

export const invalidateCache = (key: string) => readWriteSeparation.invalidate(key);
export const clearAllCache = () => readWriteSeparation.clearCache();
export const getCacheStats = () => readWriteSeparation.getCacheStats();
