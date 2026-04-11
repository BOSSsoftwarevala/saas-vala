export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt?: Date;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  defaultTTL?: number; // Default time-to-live in milliseconds
  maxSize?: number; // Maximum number of entries
  cleanupInterval?: number; // Cleanup interval in milliseconds
  enableMetrics?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    hitRate: 0,
    size: 0,
    memoryUsage: 0,
  };
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  static getInstance(config?: CacheConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  constructor(config: CacheConfig = {}) {
    this.config = {
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 60000, // 1 minute
      enableMetrics: true,
      ...config,
    };

    this.startCleanup();
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss();
      return null;
    }

    // Check if expired
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    this.recordHit();
    return entry.value as T;
  }

  async set<T = any>(
    key: string,
    value: T,
    ttl?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const expiresAt = ttl 
      ? new Date(Date.now() + ttl)
      : this.config.defaultTTL 
      ? new Date(Date.now() + this.config.defaultTTL)
      : undefined;

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt,
      createdAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date(),
      metadata,
    };

    this.cache.set(key, entry);
    this.recordSet();
    
    // Check if we need to evict entries
    if (this.cache.size > (this.config.maxSize || 1000)) {
      this.evictLeastUsed();
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.recordDelete();
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    metadata?: Record<string, any>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl, metadata);
    return value;
  }

  async getMultiple<T = any>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      result.set(key, value);
    }
    
    return result;
  }

  async setMultiple<T = any>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async increment(key: string, amount: number = 1, ttl?: number): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + amount;
    await this.set(key, newValue, ttl);
    return newValue;
  }

  getKeys(pattern?: string): string[] {
    let keys = Array.from(this.cache.keys());
    
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      keys = keys.filter(key => regex.test(key));
    }
    
    return keys;
  }

  getSize(): number {
    return this.cache.size;
  }

  getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;
    this.metrics.size = this.cache.size;
    this.metrics.memoryUsage = this.estimateMemoryUsage();
    
    return { ...this.metrics };
  }

  async getEntry(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (entry.expiresAt && new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return { ...entry };
  }

  async setEntry(entry: CacheEntry): Promise<void> {
    this.cache.set(entry.key, entry);
    this.recordSet();
  }

  private evictLeastUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.recordEviction();
    }
  }

  private startCleanup(): void {
    if (this.config.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(entry.value).length * 2; // UTF-16
      totalSize += entry.key.length * 2;
      totalSize += 200; // Overhead for entry object
    }
    
    return totalSize;
  }

  private recordHit(): void {
    if (this.config.enableMetrics) {
      this.metrics.hits++;
    }
  }

  private recordMiss(): void {
    if (this.config.enableMetrics) {
      this.metrics.misses++;
    }
  }

  private recordSet(): void {
    if (this.config.enableMetrics) {
      this.metrics.sets++;
    }
  }

  private recordDelete(): void {
    if (this.config.enableMetrics) {
      this.metrics.deletes++;
    }
  }

  private recordEviction(): void {
    if (this.config.enableMetrics) {
      this.metrics.evictions++;
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
}

// Specialized cache instances for different use cases
export class DashboardCache {
  private static cache = CacheManager.getInstance({
    defaultTTL: 60000, // 1 minute
    maxSize: 100,
    enableMetrics: true,
  });

  static async get<T = any>(key: string): Promise<T | null> {
    return this.cache.get<T>(`dashboard:${key}`);
  }

  static async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cache.set(`dashboard:${key}`, value, ttl);
  }

  static async getOrSet<T = any>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    return this.cache.getOrSet(`dashboard:${key}`, factory, ttl);
  }

  static clear(): Promise<void> {
    return this.cache.clear('dashboard:*');
  }
}

export class SessionCache {
  private static cache = CacheManager.getInstance({
    defaultTTL: 1800000, // 30 minutes
    maxSize: 500,
    enableMetrics: true,
  });

  static async get<T = any>(key: string): Promise<T | null> {
    return this.cache.get<T>(`session:${key}`);
  }

  static async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cache.set(`session:${key}`, value, ttl);
  }

  static async delete(key: string): Promise<boolean> {
    return this.cache.delete(`session:${key}`);
  }

  static async clear(): Promise<void> {
    return this.cache.clear('session:*');
  }
}

export class ConfigCache {
  private static cache = CacheManager.getInstance({
    defaultTTL: 3600000, // 1 hour
    maxSize: 50,
    enableMetrics: false,
  });

  static async get<T = any>(key: string): Promise<T | null> {
    return this.cache.get<T>(`config:${key}`);
  }

  static async set<T = any>(key: string, value: T): Promise<void> {
    return this.cache.set(`config:${key}`, value);
  }

  static async clear(): Promise<void> {
    return this.cache.clear('config:*');
  }
}
