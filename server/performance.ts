import * as fs from 'fs';
import * as zlib from 'zlib';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';

export interface CacheEntry {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  compressionRatio: number;
  requestCount: number;
  errorRate: number;
}

export interface CompressionConfig {
  enabled: boolean;
  level: number;
  threshold: number; // Minimum size to compress
  types: string[];
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  cleanupInterval: number;
}

export class UltraPerformance {
  private static instance: UltraPerformance;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: PerformanceMetrics;
  private compressionConfig: CompressionConfig;
  private cacheConfig: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  static getInstance(): UltraPerformance {
    if (!UltraPerformance.instance) {
      UltraPerformance.instance = new UltraPerformance();
    }
    return UltraPerformance.instance;
  }

  constructor() {
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    
    this.metrics = {
      responseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      requestCount: 0,
      errorRate: 0
    };

    this.compressionConfig = {
      enabled: process.env.ENABLE_COMPRESSION !== 'false',
      level: parseInt(process.env.COMPRESSION_LEVEL || '6'),
      threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'),
      types: (process.env.COMPRESSION_TYPES || 'text/html,text/css,text/javascript,application/json,application/javascript').split(',')
    };

    this.cacheConfig = {
      enabled: process.env.ENABLE_CACHE !== 'false',
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100') * 1024 * 1024, // 100MB
      ttl: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
      cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '60000') // 1 minute
    };

    this.startCleanupInterval();
    this.startMetricsCollection();
  }

  // Compression utilities
  compress(data: string | Buffer, contentType: string): Buffer | string {
    if (!this.compressionConfig.enabled) {
      return data;
    }

    const shouldCompress = this.compressionConfig.types.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!shouldCompress) {
      return data;
    }

    const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    if (inputBuffer.length < this.compressionConfig.threshold) {
      return data;
    }

    try {
      const compressed = zlib.gzipSync(inputBuffer, { level: this.compressionConfig.level });
      
      // Update compression ratio metric
      const ratio = compressed.length / inputBuffer.length;
      this.metrics.compressionRatio = (this.metrics.compressionRatio + ratio) / 2;
      
      this.logger.debug('performance', 'Data compressed', {
        originalSize: inputBuffer.length,
        compressedSize: compressed.length,
        ratio: (1 - ratio) * 100
      });

      return compressed;
    } catch (error) {
      this.logger.error('performance', 'Compression failed', error as Error);
      return data;
    }
  }

  decompress(data: Buffer): Buffer | string {
    try {
      return zlib.gunzipSync(data);
    } catch (error) {
      // Data might not be compressed
      return data;
    }
  }

  // Cache management
  set(key: string, value: any, ttl?: number): void {
    if (!this.cacheConfig.enabled) {
      return;
    }

    const serializedValue = JSON.stringify(value);
    const size = Buffer.byteLength(serializedValue, 'utf8');

    // Check if we need to make space
    this.ensureCacheSize(size);

    const entry: CacheEntry = {
      key,
      value,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (ttl || this.cacheConfig.ttl)),
      accessCount: 0,
      lastAccessed: new Date(),
      size
    };

    this.cache.set(key, entry);
    this.logger.debug('performance', 'Cache entry added', { key, size, ttl });
  }

  get<T = any>(key: string): T | null {
    if (!this.cacheConfig.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry.value as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.logger.info('performance', 'Cache cleared');
  }

  private ensureCacheSize(newEntrySize: number): void {
    let currentSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
    
    while (currentSize + newEntrySize > this.cacheConfig.maxSize && this.cache.size > 0) {
      // Remove least recently used entry
      let lruKey: string | null = null;
      let oldestAccess = new Date();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          lruKey = key;
        }
      }

      if (lruKey) {
        const removed = this.cache.get(lruKey);
        if (removed) {
          currentSize -= removed.size;
          this.cache.delete(lruKey);
        }
      } else {
        break;
      }
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.cacheConfig.cleanupInterval);
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('performance', `Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  // Performance monitoring
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect metrics every 5 seconds
  }

  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed;

    // Cache hit rate
    const totalAccess = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0);
    const cacheHits = totalAccess > 0 ? this.cache.size : 0;
    this.metrics.cacheHitRate = totalAccess > 0 ? (cacheHits / totalAccess) * 100 : 0;
  }

  // Request timing middleware
  createTimingMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = process.hrtime.bigint();
      
      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        this.metrics.responseTime = (this.metrics.responseTime + responseTime) / 2;
        this.metrics.requestCount++;
        
        if (res.statusCode >= 400) {
          this.metrics.errorRate = (this.metrics.errorRate + 1) / this.metrics.requestCount * 100;
        }

        this.logger.logPerformance(`${req.method} ${req.url}`, responseTime, {
          statusCode: res.statusCode,
          contentLength: res.get('content-length')
        });
      });

      next();
    };
  }

  // Caching middleware
  createCacheMiddleware(ttl?: number) {
    return (req: any, res: any, next: any) => {
      if (!this.cacheConfig.enabled || req.method !== 'GET') {
        return next();
      }

      const cacheKey = `response:${req.method}:${req.url}:${JSON.stringify(req.query)}`;
      const cached = this.get(cacheKey);

      if (cached) {
        this.logger.debug('performance', 'Cache hit', { key: cacheKey });
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = (data: any) => {
        this.set(cacheKey, data, ttl);
        res.set('X-Cache', 'MISS');
        return originalJson.call(res, data);
      };

      next();
    };
  }

  // Compression middleware
  createCompressionMiddleware() {
    return (req: any, res: any, next: any) => {
      if (!this.compressionConfig.enabled) {
        return next();
      }

      const acceptEncoding = req.get('accept-encoding') || '';
      
      if (!acceptEncoding.includes('gzip')) {
        return next();
      }

      // Override res.write to compress data
      const originalWrite = res.write;
      const originalEnd = res.end;
      let compressed = false;

      res.write = function (chunk: any, encoding?: any) {
        if (!compressed && (typeof chunk === 'string' || Buffer.isBuffer(chunk))) {
          const contentType = res.get('content-type') || 'text/html';
          const compressedChunk = (this as any).compress(chunk, contentType);
          
          if (compressedChunk !== chunk) {
            res.set('Content-Encoding', 'gzip');
            res.set('Vary', 'Accept-Encoding');
            compressed = true;
            chunk = compressedChunk;
          }
        }
        return originalWrite.call(this, chunk, encoding);
      }.bind(this);

      res.end = function (chunk?: any, encoding?: any) {
        if (chunk) {
          res.write(chunk, encoding);
        }
        return originalEnd.call(this);
      };

      next();
    };
  }

  // Database query optimization
  async optimizeQuery(query: string, params?: any[]): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      // Check if query is cached
      const cacheKey = `query:${Buffer.from(query).toString('base64')}:${JSON.stringify(params || [])}`;
      const cached = this.get(cacheKey);
      
      if (cached) {
        this.logger.debug('performance', 'Query cache hit', { query: query.substring(0, 100) });
        return cached;
      }

      // Execute query
      const result = await this.database.query(query, params);
      const duration = Date.now() - startTime;

      // Cache result if it's a SELECT query and not too large
      if (query.trim().toUpperCase().startsWith('SELECT') && result.length < 1000) {
        this.set(cacheKey, result, 60000); // Cache for 1 minute
      }

      this.logger.logPerformance('Database query', duration, { 
        query: query.substring(0, 100), 
        resultCount: result.length 
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformance('Database query (failed)', duration, { 
        query: query.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Static asset optimization
  optimizeStaticAsset(content: string, type: string): string {
    let optimized = content;

    // Minify CSS
    if (type.includes('css')) {
      optimized = optimized
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .trim();
    }

    // Minify JavaScript
    if (type.includes('javascript')) {
      optimized = optimized
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .trim();
    }

    // Minify HTML
    if (type.includes('html')) {
      optimized = optimized
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .trim();
    }

    return optimized;
  }

  // Get performance statistics
  getPerformanceStats(): {
    metrics: PerformanceMetrics;
    cache: {
      entries: number;
      hitRate: number;
      size: number;
      maxSize: number;
    };
    compression: {
      enabled: boolean;
      ratio: number;
      level: number;
    };
  } {
    const cacheSize = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);

    return {
      metrics: { ...this.metrics },
      cache: {
        entries: this.cache.size,
        hitRate: this.metrics.cacheHitRate,
        size: cacheSize,
        maxSize: this.cacheConfig.maxSize
      },
      compression: {
        enabled: this.compressionConfig.enabled,
        ratio: this.metrics.compressionRatio,
        level: this.compressionConfig.level
      }
    };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      responseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHitRate: 0,
      compressionRatio: 0,
      requestCount: 0,
      errorRate: 0
    };
    this.logger.info('performance', 'Performance metrics reset');
  }

  // Warm up cache with common data
  async warmupCache(): Promise<void> {
    if (!this.cacheConfig.enabled) {
      return;
    }

    this.logger.info('performance', 'Starting cache warmup...');

    try {
      // Cache common database queries
      const commonQueries = [
        'SELECT COUNT(*) as count FROM users WHERE status = $1',
        'SELECT COUNT(*) as count FROM products WHERE status = $1',
        'SELECT * FROM feature_flags WHERE enabled = true'
      ];

      for (const query of commonQueries) {
        await this.database.query(query, ['active']);
      }

      this.logger.info('performance', 'Cache warmup completed');
    } catch (error) {
      this.logger.error('performance', 'Cache warmup failed', error as Error);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.cache.clear();
    this.logger.info('performance', 'Performance module destroyed');
  }
}

export default UltraPerformance;
