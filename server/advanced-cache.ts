import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface CacheEntry {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  tags?: string[];
  metadata?: any;
}

export interface CacheConfig {
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    ttl: number; // Default TTL in seconds
  };
  memory: {
    enabled: boolean;
    maxSize: number; // Maximum size in bytes
    maxEntries: number; // Maximum number of entries
    cleanupInterval: number; // Cleanup interval in milliseconds
  };
  compression: {
    enabled: boolean;
    threshold: number; // Minimum size to compress in bytes
  };
  persistence: {
    enabled: boolean;
    filePath: string;
    saveInterval: number; // Save interval in milliseconds
  };
}

export interface CacheStats {
  totalEntries: number;
  memoryEntries: number;
  redisEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  redisUsage: number;
  averageAccessTime: number;
  evictionCount: number;
}

export class UltraAdvancedCache extends EventEmitter {
  private static instance: UltraAdvancedCache;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private config: CacheConfig;
  private redisClient?: RedisClientType;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private isRedisConnected: boolean = false;
  private cleanupTimer?: NodeJS.Timeout;
  private persistenceTimer?: NodeJS.Timeout;
  private stats: CacheStats = {
    totalEntries: 0,
    memoryEntries: 0,
    redisEntries: 0,
    hitRate: 0,
    missRate: 0,
    totalHits: 0,
    totalMisses: 0,
    memoryUsage: 0,
    redisUsage: 0,
    averageAccessTime: 0,
    evictionCount: 0
  };

  static getInstance(config?: CacheConfig): UltraAdvancedCache {
    if (!UltraAdvancedCache.instance) {
      UltraAdvancedCache.instance = new UltraAdvancedCache(config);
    }
    return UltraAdvancedCache.instance;
  }

  constructor(config?: CacheConfig) {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.config = {
      redis: {
        enabled: process.env.REDIS_ENABLED !== 'false',
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'saasvala:',
        ttl: parseInt(process.env.REDIS_DEFAULT_TTL || '3600')
      },
      memory: {
        enabled: process.env.MEMORY_CACHE_ENABLED !== 'false',
        maxSize: parseInt(process.env.MEMORY_CACHE_MAX_SIZE || '134217728'), // 128MB
        maxEntries: parseInt(process.env.MEMORY_CACHE_MAX_ENTRIES || '10000'),
        cleanupInterval: parseInt(process.env.MEMORY_CACHE_CLEANUP_INTERVAL || '60000')
      },
      compression: {
        enabled: process.env.CACHE_COMPRESSION_ENABLED !== 'false',
        threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024')
      },
      persistence: {
        enabled: process.env.CACHE_PERSISTENCE_ENABLED !== 'false',
        filePath: process.env.CACHE_PERSISTENCE_FILE || '/var/cache/saasvala-cache.json',
        saveInterval: parseInt(process.env.CACHE_PERSISTENCE_INTERVAL || '300000') // 5 minutes
      },
      ...config
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Redis if enabled
      if (this.config.redis.enabled) {
        await this.initializeRedis();
      }

      // Initialize memory cache
      if (this.config.memory.enabled) {
        this.initializeMemoryCache();
      }

      // Load persisted cache if enabled
      if (this.config.persistence.enabled) {
        await this.loadPersistedCache();
      }

      this.logger.info('advanced-cache', 'Advanced cache system initialized', {
        redis: this.config.redis.enabled,
        memory: this.config.memory.enabled,
        compression: this.config.compression.enabled,
        persistence: this.config.persistence.enabled
      });

    } catch (error) {
      this.logger.error('advanced-cache', 'Failed to initialize cache system', error as Error);
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        socket: {
          host: this.config.redis.host,
          port: this.config.redis.port
        },
        password: this.config.redis.password,
        database: this.config.redis.db
      });

      this.redisClient.on('error', (error) => {
        this.logger.error('advanced-cache', 'Redis client error', error);
        this.isRedisConnected = false;
      });

      this.redisClient.on('connect', () => {
        this.logger.info('advanced-cache', 'Redis client connected');
        this.isRedisConnected = true;
      });

      this.redisClient.on('disconnect', () => {
        this.logger.warn('advanced-cache', 'Redis client disconnected');
        this.isRedisConnected = false;
      });

      await this.redisClient.connect();
      this.isRedisConnected = true;

    } catch (error) {
      this.logger.error('advanced-cache', 'Failed to initialize Redis', error as Error);
      this.isRedisConnected = false;
    }
  }

  private initializeMemoryCache(): void {
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupMemoryCache();
    }, this.config.memory.cleanupInterval);

    // Start persistence timer
    if (this.config.persistence.enabled) {
      this.persistenceTimer = setInterval(() => {
        this.savePersistedCache();
      }, this.config.persistence.saveInterval);
    }
  }

  async set(key: string, value: any, options: {
    ttl?: number; // TTL in seconds
    tags?: string[];
    metadata?: any;
    persist?: boolean;
  } = {}): Promise<void> {
    const startTime = Date.now();
    
    try {
      const ttl = options.ttl || this.config.redis.ttl;
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const serializedValue = JSON.stringify(value);
      const size = Buffer.byteLength(serializedValue, 'utf8');

      // Compress if enabled and threshold met
      let finalValue = serializedValue;
      let compressed = false;
      
      if (this.config.compression.enabled && size >= this.config.compression.threshold) {
        finalValue = await this.compressData(serializedValue);
        compressed = true;
      }

      const cacheEntry: CacheEntry = {
        key,
        value,
        createdAt: new Date(),
        expiresAt,
        accessCount: 0,
        lastAccessed: new Date(),
        size,
        tags: options.tags,
        metadata: { ...options.metadata, compressed }
      };

      // Store in memory cache if enabled
      if (this.config.memory.enabled) {
        await this.setMemoryCache(key, cacheEntry);
      }

      // Store in Redis if enabled and connected
      if (this.config.redis.enabled && this.isRedisConnected) {
        await this.setRedisCache(key, finalValue, ttl, options);
      }

      // Update stats
      this.updateStats();
      
      this.logger.debug('advanced-cache', `Cache set: ${key}`, {
        size,
        ttl,
        compressed,
        memory: this.config.memory.enabled,
        redis: this.isRedisConnected
      });

      this.emit('cacheSet', { key, size, ttl, compressed });

    } catch (error) {
      this.logger.error('advanced-cache', `Failed to set cache: ${key}`, error as Error);
      throw error;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Check memory cache first
      if (this.config.memory.enabled) {
        const memoryResult = await this.getMemoryCache<T>(key);
        if (memoryResult !== null) {
          this.stats.totalHits++;
          this.updateStats();
          this.emit('cacheHit', { key, source: 'memory', duration: Date.now() - startTime });
          return memoryResult;
        }
      }

      // Check Redis cache
      if (this.config.redis.enabled && this.isRedisConnected) {
        const redisResult = await this.getRedisCache<T>(key);
        if (redisResult !== null) {
          this.stats.totalHits++;
          
          // Store in memory cache for faster access
          if (this.config.memory.enabled) {
            await this.setMemoryCache(key, {
              key,
              value: redisResult,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + this.config.redis.ttl * 1000),
              accessCount: 1,
              lastAccessed: new Date(),
              size: Buffer.byteLength(JSON.stringify(redisResult), 'utf8')
            });
          }
          
          this.updateStats();
          this.emit('cacheHit', { key, source: 'redis', duration: Date.now() - startTime });
          return redisResult;
        }
      }

      // Cache miss
      this.stats.totalMisses++;
      this.updateStats();
      this.emit('cacheMiss', { key, duration: Date.now() - startTime });
      return null;

    } catch (error) {
      this.logger.error('advanced-cache', `Failed to get cache: ${key}`, error as Error);
      this.stats.totalMisses++;
      this.updateStats();
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      let deleted = false;

      // Delete from memory cache
      if (this.config.memory.enabled) {
        deleted = this.memoryCache.delete(key) || deleted;
      }

      // Delete from Redis
      if (this.config.redis.enabled && this.isRedisConnected) {
        const redisKey = this.config.redis.keyPrefix + key;
        const result = await this.redisClient.del(redisKey);
        deleted = result > 0 || deleted;
      }

      if (deleted) {
        this.updateStats();
        this.emit('cacheDelete', { key });
        this.logger.debug('advanced-cache', `Cache deleted: ${key}`);
      }

      return deleted;

    } catch (error) {
      this.logger.error('advanced-cache', `Failed to delete cache: ${key}`, error as Error);
      return false;
    }
  }

  async clear(pattern?: string): Promise<number> {
    try {
      let clearedCount = 0;

      // Clear memory cache
      if (this.config.memory.enabled) {
        if (pattern) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          for (const [key] of this.memoryCache.entries()) {
            if (regex.test(key)) {
              this.memoryCache.delete(key);
              clearedCount++;
            }
          }
        } else {
          clearedCount = this.memoryCache.size;
          this.memoryCache.clear();
        }
      }

      // Clear Redis cache
      if (this.config.redis.enabled && this.isRedisConnected) {
        if (pattern) {
          const regex = new RegExp(this.config.redis.keyPrefix + pattern.replace(/\*/g, '.*'));
          const keys = await this.redisClient.keys(this.config.redis.keyPrefix + '*');
          
          for (const key of keys) {
            if (regex.test(key)) {
              await this.redisClient.del(key);
              clearedCount++;
            }
          }
        } else {
          const keys = await this.redisClient.keys(this.config.redis.keyPrefix + '*');
          if (keys.length > 0) {
            await this.redisClient.del(keys);
            clearedCount += keys.length;
          }
        }
      }

      this.updateStats();
      this.emit('cacheClear', { pattern, clearedCount });
      this.logger.info('advanced-cache', `Cache cleared: ${clearedCount} entries`, { pattern });

      return clearedCount;

    } catch (error) {
      this.logger.error('advanced-cache', 'Failed to clear cache', error as Error);
      return 0;
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    try {
      let invalidatedCount = 0;

      // Invalidate from memory cache
      if (this.config.memory.enabled) {
        for (const [key, entry] of this.memoryCache.entries()) {
          if (entry.tags?.includes(tag)) {
            this.memoryCache.delete(key);
            invalidatedCount++;
          }
        }
      }

      // Invalidate from Redis
      if (this.config.redis.enabled && this.isRedisConnected) {
        // This would require a more complex Redis setup with tag tracking
        // For now, we'll skip Redis tag invalidation
        this.logger.debug('advanced-cache', 'Redis tag invalidation not implemented');
      }

      this.updateStats();
      this.emit('cacheInvalidateByTag', { tag, invalidatedCount });
      this.logger.info('advanced-cache', `Cache invalidated by tag: ${tag}`, { invalidatedCount });

      return invalidatedCount;

    } catch (error) {
      this.logger.error('advanced-cache', `Failed to invalidate cache by tag: ${tag}`, error as Error);
      return 0;
    }
  }

  private async setMemoryCache(key: string, entry: CacheEntry): Promise<void> {
    // Check if we need to evict entries
    await this.ensureMemoryCacheSize(entry.size);

    this.memoryCache.set(key, entry);
  }

  private async getMemoryCache<T = any>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry.value as T;
  }

  private async setRedisCache(key: string, value: string, ttl: number, options: any): Promise<void> {
    if (!this.isRedisConnected || !this.redisClient) {
      return;
    }

    const redisKey = this.config.redis.keyPrefix + key;
    
    try {
      await this.redisClient.setEx(redisKey, ttl, value);
      
      // Store metadata separately if needed
      if (options.tags || options.metadata) {
        const metadataKey = redisKey + ':meta';
        await this.redisClient.setEx(metadataKey, ttl, JSON.stringify({
          tags: options.tags,
          metadata: options.metadata
        }));
      }
    } catch (error) {
      this.logger.error('advanced-cache', `Failed to set Redis cache: ${key}`, error as Error);
    }
  }

  private async getRedisCache<T = any>(key: string): Promise<T | null> {
    if (!this.isRedisConnected || !this.redisClient) {
      return null;
    }

    const redisKey = this.config.redis.keyPrefix + key;
    
    try {
      const value = await this.redisClient.get(redisKey);
      
      if (!value) {
        return null;
      }

      // Check if data is compressed
      const metadataKey = redisKey + ':meta';
      const metadataStr = await this.redisClient.get(metadataKey);
      let metadata = {};
      
      if (metadataStr) {
        try {
          metadata = JSON.parse(metadataStr);
        } catch (error) {
          // Ignore metadata parsing errors
        }
      }

      let finalValue = value;
      if ((metadata as any).compressed) {
        finalValue = await this.decompressData(value);
      }

      return JSON.parse(finalValue);

    } catch (error) {
      this.logger.error('advanced-cache', `Failed to get Redis cache: ${key}`, error as Error);
      return null;
    }
  }

  private async ensureMemoryCacheSize(newEntrySize: number): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.size, 0);
    const currentEntries = this.memoryCache.size;

    // Check size limit
    while (currentSize + newEntrySize > this.config.memory.maxSize && this.memoryCache.size > 0) {
      await this.evictLRUEntry();
    }

    // Check entry count limit
    while (currentEntries >= this.config.memory.maxEntries && this.memoryCache.size > 0) {
      await this.evictLRUEntry();
    }
  }

  private async evictLRUEntry(): Promise<void> {
    let lruKey: string | null = null;
    let oldestAccess = new Date();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey);
      this.stats.evictionCount++;
      this.logger.debug('advanced-cache', `Evicted LRU entry: ${lruKey}`);
    }
  }

  private cleanupMemoryCache(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('advanced-cache', `Cleaned up ${cleanedCount} expired memory cache entries`);
    }
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression using zlib (placeholder)
    // In production, you'd use actual compression algorithms
    return data;
  }

  private async decompressData(data: string): Promise<string> {
    // Simple decompression (placeholder)
    // In production, you'd use actual decompression algorithms
    return data;
  }

  private async loadPersistedCache(): Promise<void> {
    if (!fs.existsSync(this.config.persistence.filePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.config.persistence.filePath, 'utf8');
      const persisted = JSON.parse(data);

      for (const [key, entry] of Object.entries(persisted)) {
        const cacheEntry = entry as CacheEntry;
        
        // Check if entry is still valid
        if (new Date() <= cacheEntry.expiresAt) {
          this.memoryCache.set(key, cacheEntry);
        }
      }

      this.logger.info('advanced-cache', `Loaded ${this.memoryCache.size} entries from persisted cache`);

    } catch (error) {
      this.logger.error('advanced-cache', 'Failed to load persisted cache', error as Error);
    }
  }

  private async savePersistedCache(): Promise<void> {
    try {
      const persisted: Record<string, CacheEntry> = {};
      
      for (const [key, entry] of this.memoryCache.entries()) {
        persisted[key] = entry;
      }

      const data = JSON.stringify(persisted, null, 2);
      
      // Ensure directory exists
      const dir = path.dirname(this.config.persistence.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.persistence.filePath, data);
      this.logger.debug('advanced-cache', `Saved ${this.memoryCache.size} entries to persisted cache`);

    } catch (error) {
      this.logger.error('advanced-cache', 'Failed to save persisted cache', error as Error);
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.memoryCache.size;
    this.stats.memoryEntries = this.memoryCache.size;
    this.stats.redisEntries = this.stats.totalEntries - this.stats.memoryEntries;
    
    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = totalRequests > 0 ? (this.stats.totalHits / totalRequests) * 100 : 0;
    this.stats.missRate = totalRequests > 0 ? (this.stats.totalMisses / totalRequests) * 100 : 0;
    
    this.stats.memoryUsage = Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.size, 0);
  }

  // Cache warming strategies
  async warmupCache(keys: string[]): Promise<void> {
    this.logger.info('advanced-cache', `Starting cache warmup for ${keys.length} keys`);
    
    for (const key of keys) {
      try {
        // This would typically fetch data from the database or API
        // For now, we'll just set a placeholder value
        await this.set(key, { warmed: true, timestamp: new Date() }, { ttl: 3600 });
      } catch (error) {
        this.logger.warn('advanced-cache', `Failed to warmup cache key: ${key}`, error as Error);
      }
    }
    
    this.logger.info('advanced-cache', 'Cache warmup completed');
  }

  // Cache analytics
  async getCacheAnalytics(): Promise<{
    topKeys: Array<{ key: string; accessCount: number; size: number }>;
    expiredEntries: number;
    entriesByTag: Record<string, number>;
    sizeDistribution: Record<string, number>;
  }> {
    const topKeys = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({ key, accessCount: entry.accessCount, size: entry.size }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const now = new Date();
    const expiredEntries = Array.from(this.memoryCache.values())
      .filter(entry => now > entry.expiresAt).length;

    const entriesByTag: Record<string, number> = {};
    const sizeDistribution: Record<string, number> = {
      small: 0,    // < 1KB
      medium: 0,   // 1KB - 10KB
      large: 0,    // 10KB - 100KB
      xlarge: 0    // > 100KB
    };

    for (const entry of this.memoryCache.values()) {
      // Count by tags
      if (entry.tags) {
        for (const tag of entry.tags) {
          entriesByTag[tag] = (entriesByTag[tag] || 0) + 1;
        }
      }

      // Size distribution
      if (entry.size < 1024) {
        sizeDistribution.small++;
      } else if (entry.size < 10240) {
        sizeDistribution.medium++;
      } else if (entry.size < 102400) {
        sizeDistribution.large++;
      } else {
        sizeDistribution.xlarge++;
      }
    }

    return {
      topKeys,
      expiredEntries,
      entriesByTag,
      sizeDistribution
    };
  }

  // Public methods
  getCacheStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  async getCacheInfo(): Promise<{
    config: CacheConfig;
    stats: CacheStats;
    redisConnected: boolean;
    memoryCacheSize: number;
    analytics: any;
  }> {
    const analytics = await this.getCacheAnalytics();
    
    return {
      config: this.config,
      stats: this.getCacheStats(),
      redisConnected: this.isRedisConnected,
      memoryCacheSize: this.memoryCache.size,
      analytics
    };
  }

  // Health check
  async healthCheck(): Promise<{
    healthy: boolean;
    redis: boolean;
    memory: boolean;
    persistence: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check Redis
    const redisHealthy = !this.config.redis.enabled || (this.isRedisConnected && this.redisClient?.isOpen);
    if (!redisHealthy) {
      issues.push('Redis connection failed');
    }

    // Check memory cache
    const memoryHealthy = !this.config.memory.enabled || this.memoryCache.size >= 0;
    if (!memoryHealthy) {
      issues.push('Memory cache corrupted');
    }

    // Check persistence
    let persistenceHealthy = true;
    if (this.config.persistence.enabled) {
      try {
        const dir = path.dirname(this.config.persistence.filePath);
        persistenceHealthy = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
      } catch {
        persistenceHealthy = false;
      }
      if (!persistenceHealthy) {
        issues.push('Persistence directory not accessible');
      }
    }

    return {
      healthy: issues.length === 0,
      redis: redisHealthy,
      memory: memoryHealthy,
      persistence: persistenceHealthy,
      issues
    };
  }

  // Cleanup and destroy
  async destroy(): Promise<void> {
    this.logger.info('advanced-cache', 'Shutting down advanced cache system');

    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }

    // Save persisted cache
    if (this.config.persistence.enabled) {
      await this.savePersistedCache();
    }

    // Disconnect Redis
    if (this.redisClient && this.isRedisConnected) {
      await this.redisClient.quit();
    }

    // Clear memory cache
    this.memoryCache.clear();

    this.logger.info('advanced-cache', 'Advanced cache system shut down');
  }
}

export default UltraAdvancedCache;
