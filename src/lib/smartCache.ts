/**
 * Smart Cache Layer
 * Intelligent caching for products, SEO, and AI responses
 * Automatic invalidation on updates
 */

import { eventLogger, EventType } from './eventLogger';
import { readWriteSeparation } from './readWriteSeparation';

export enum CacheNamespace {
  PRODUCTS = 'products',
  SEO = 'seo',
  AI = 'ai',
  MARKETPLACE = 'marketplace',
  USER = 'user',
}

export interface CacheConfig {
  namespace: CacheNamespace;
  key: string;
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Tags for group invalidation
}

class SmartCache {
  private static instance: SmartCache;
  private invalidationCallbacks: Map<string, Set<() => void>> = new Map();

  private constructor() {}

  static getInstance(): SmartCache {
    if (!SmartCache.instance) {
      SmartCache.instance = new SmartCache();
    }
    return SmartCache.instance;
  }

  /**
   * Cache a product list
   */
  async cacheProductList<T>(data: T, filters?: any): Promise<void> {
    const config: CacheConfig = {
      namespace: CacheNamespace.PRODUCTS,
      key: this.generateProductKey('list', filters),
      ttl: 300000, // 5 minutes
      tags: ['products', 'list'],
    };

    await this.set(config, data);
    eventLogger.logSystemEvent('Product List Cached', { key: config.key });
  }

  /**
   * Get cached product list
   */
  async getProductList<T>(filters?: any): Promise<T | null> {
    const config: CacheConfig = {
      namespace: CacheNamespace.PRODUCTS,
      key: this.generateProductKey('list', filters),
    };

    return this.get<T>(config);
  }

  /**
   * Cache a single product
   */
  async cacheProduct<T>(productId: string, data: T): Promise<void> {
    const config: CacheConfig = {
      namespace: CacheNamespace.PRODUCTS,
      key: this.generateProductKey('detail', { id: productId }),
      ttl: 600000, // 10 minutes
      tags: ['products', 'detail', `product:${productId}`],
    };

    await this.set(config, data);
    eventLogger.logSystemEvent('Product Cached', { productId });
  }

  /**
   * Get cached product
   */
  async getProduct<T>(productId: string): Promise<T | null> {
    const config: CacheConfig = {
      namespace: CacheNamespace.PRODUCTS,
      key: this.generateProductKey('detail', { id: productId }),
    };

    return this.get<T>(config);
  }

  /**
   * Invalidate product cache on update
   */
  invalidateProduct(productId: string): void {
    this.invalidateByTag(`product:${productId}`);
    this.invalidateByTag('products');
    eventLogger.logSystemEvent('Product Cache Invalidated', { productId });
  }

  /**
   * Invalidate all product cache
   */
  invalidateAllProducts(): void {
    this.invalidateByNamespace(CacheNamespace.PRODUCTS);
    eventLogger.logSystemEvent('All Product Cache Invalidated');
  }

  /**
   * Cache SEO data
   */
  async cacheSEO<T>(url: string, data: T): Promise<void> {
    const config: CacheConfig = {
      namespace: CacheNamespace.SEO,
      key: this.generateSEOKey(url),
      ttl: 3600000, // 1 hour
      tags: ['seo', `url:${url}`],
    };

    await this.set(config, data);
    eventLogger.logSystemEvent('SEO Data Cached', { url });
  }

  /**
   * Get cached SEO data
   */
  async getSEO<T>(url: string): Promise<T | null> {
    const config: CacheConfig = {
      namespace: CacheNamespace.SEO,
      key: this.generateSEOKey(url),
    };

    return this.get<T>(config);
  }

  /**
   * Invalidate SEO cache on content update
   */
  invalidateSEO(url: string): void {
    this.invalidateByTag(`url:${url}`);
    eventLogger.logSystemEvent('SEO Cache Invalidated', { url });
  }

  /**
   * Cache AI response
   */
  async cacheAIResponse<T>(prompt: string, response: T, model?: string): Promise<void> {
    const config: CacheConfig = {
      namespace: CacheNamespace.AI,
      key: this.generateAIKey(prompt, model),
      ttl: 86400000, // 24 hours
      tags: ['ai', model ? `model:${model}` : 'ai'],
    };

    await this.set(config, response);
    eventLogger.logSystemEvent('AI Response Cached', { model });
  }

  /**
   * Get cached AI response
   */
  async getAIResponse<T>(prompt: string, model?: string): Promise<T | null> {
    const config: CacheConfig = {
      namespace: CacheNamespace.AI,
      key: this.generateAIKey(prompt, model),
    };

    return this.get<T>(config);
  }

  /**
   * Invalidate AI cache for a model
   */
  invalidateAI(model?: string): void {
    if (model) {
      this.invalidateByTag(`model:${model}`);
    } else {
      this.invalidateByNamespace(CacheNamespace.AI);
    }
    eventLogger.logSystemEvent('AI Cache Invalidated', { model });
  }

  /**
   * Cache marketplace data
   */
  async cacheMarketplace<T>(key: string, data: T): Promise<void> {
    const config: CacheConfig = {
      namespace: CacheNamespace.MARKETPLACE,
      key: this.generateMarketplaceKey(key),
      ttl: 120000, // 2 minutes
      tags: ['marketplace'],
    };

    await this.set(config, data);
    eventLogger.logSystemEvent('Marketplace Data Cached', { key });
  }

  /**
   * Get cached marketplace data
   */
  async getMarketplace<T>(key: string): Promise<T | null> {
    const config: CacheConfig = {
      namespace: CacheNamespace.MARKETPLACE,
      key: this.generateMarketplaceKey(key),
    };

    return this.get<T>(config);
  }

  /**
   * Invalidate marketplace cache
   */
  invalidateMarketplace(): void {
    this.invalidateByNamespace(CacheNamespace.MARKETPLACE);
    eventLogger.logSystemEvent('Marketplace Cache Invalidated');
  }

  /**
   * Generic cache set operation
   */
  private async set<T>(config: CacheConfig, data: T): Promise<void> {
    const key = this.generateKey(config);
    const ttl = config.ttl || 300000; // Default 5 minutes

    await readWriteSeparation.write(
      'INSERT',
      'cache',
      async () => {
        // Store in read/write separation cache
        return data;
      },
      [key]
    );

    // Register invalidation callbacks for tags
    if (config.tags) {
      for (const tag of config.tags) {
        if (!this.invalidationCallbacks.has(tag)) {
          this.invalidationCallbacks.set(tag, new Set());
        }
      }
    }
  }

  /**
   * Generic cache get operation
   */
  private async get<T>(config: CacheConfig): Promise<T | null> {
    const key = this.generateKey(config);

    try {
      return await readWriteSeparation.read(
        key,
        async () => null, // Return null if not in cache
        0 // No TTL for cache hit check
      );
    } catch (error) {
      eventLogger.logError('Cache Get Failed', error as Error);
      return null;
    }
  }

  /**
   * Invalidate by tag
   */
  private invalidateByTag(tag: string): void {
    const callbacks = this.invalidationCallbacks.get(tag);
    if (callbacks) {
      callbacks.forEach(callback => callback());
      this.invalidationCallbacks.delete(tag);
    }
  }

  /**
   * Invalidate by namespace
   */
  private invalidateByNamespace(namespace: CacheNamespace): void {
    const pattern = `${namespace}:*`;
    readWriteSeparation.invalidatePattern(pattern);
  }

  /**
   * Generate cache key from config
   */
  private generateKey(config: CacheConfig): string {
    return `${config.namespace}:${config.key}`;
  }

  /**
   * Generate product cache key
   */
  private generateProductKey(type: string, filters?: any): string {
    const filterString = filters ? JSON.stringify(filters) : '';
    return `${type}:${filterString}`;
  }

  /**
   * Generate SEO cache key
   */
  private generateSEOKey(url: string): string {
    return `page:${url}`;
  }

  /**
   * Generate AI cache key
   */
  private generateAIKey(prompt: string, model?: string): string {
    const modelSuffix = model ? `:${model}` : '';
    return `prompt:${this.hashString(prompt)}${modelSuffix}`;
  }

  /**
   * Generate marketplace cache key
   */
  private generateMarketplaceKey(key: string): string {
    return `data:${key}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(): Promise<void> {
    eventLogger.logSystemEvent('Cache Warm-up Started');

    // Warm up product list
    // This would be called with actual data fetching functions
    // await this.cacheProductList(await fetchProductList());

    // Warm up SEO data for homepage
    // await this.cacheSEO('/', await fetchSEOData('/'));

    eventLogger.logSystemEvent('Cache Warm-up Completed');
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const cacheStats = readWriteSeparation.getCacheStats();
    return {
      ...cacheStats,
      invalidationCallbacks: this.invalidationCallbacks.size,
    };
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    readWriteSeparation.clearCache();
    this.invalidationCallbacks.clear();
    eventLogger.logSystemEvent('All Cache Cleared');
  }
}

// Export singleton instance
export const smartCache = SmartCache.getInstance();

// Export helper functions
export const cacheProductList = <T>(data: T, filters?: any) => 
  smartCache.cacheProductList(data, filters);
export const getProductList = <T>(filters?: any) => 
  smartCache.getProductList<T>(filters);
export const cacheProduct = <T>(productId: string, data: T) => 
  smartCache.cacheProduct(productId, data);
export const getProduct = <T>(productId: string) => 
  smartCache.getProduct<T>(productId);
export const invalidateProduct = (productId: string) => 
  smartCache.invalidateProduct(productId);
export const cacheSEO = <T>(url: string, data: T) => 
  smartCache.cacheSEO(url, data);
export const getSEO = <T>(url: string) => 
  smartCache.getSEO<T>(url);
export const cacheAIResponse = <T>(prompt: string, response: T, model?: string) => 
  smartCache.cacheAIResponse(prompt, response, model);
export const getAIResponse = <T>(prompt: string, model?: string) => 
  smartCache.getAIResponse<T>(prompt, model);
export const invalidateAI = (model?: string) => 
  smartCache.invalidateAI(model);
export const warmUpCache = () => smartCache.warmUpCache();
export const getCacheStats = () => smartCache.getStats();
export const clearAllCache = () => smartCache.clearAll();
