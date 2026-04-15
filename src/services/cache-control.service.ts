// Cache Control Service - Manage cache invalidation after actions
class CacheControlService {
  private static instance: CacheControlService;
  private cache: Map<string, any> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Clean up expired cache periodically
    setInterval(() => this.cleanupExpiredCache(), 60000);
  }

  static getInstance(): CacheControlService {
    if (!CacheControlService.instance) {
      CacheControlService.instance = new CacheControlService();
    }
    return CacheControlService.instance;
  }

  set(key: string, value: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, expiry);
  }

  get(key: string): any | null {
    const expiry = this.cacheTimestamps.get(key);
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
      }
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheTimestamps.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }

  // Cache invalidation strategies
  invalidateByEntity(entity: string, entityId: string): void {
    this.clearPattern(`${entity}:*`);
    this.clearPattern(`${entityId}:*`);
  }

  invalidateByAction(action: string): void {
    this.clearPattern(`action:${action}:*`);
  }

  invalidateByUser(userId: string): void {
    this.clearPattern(`user:${userId}:*`);
  }

  // Common cache keys
  static KEYS = {
    PRODUCTS: 'products:list',
    PRODUCT: (id: string) => `product:${id}`,
    ORDERS: 'orders:list',
    ORDER: (id: string) => `order:${id}`,
    KEYS: 'keys:list',
    KEY: (id: string) => `key:${id}`,
    SERVERS: 'servers:list',
    SERVER: (id: string) => `server:${id}`,
    WALLET: (userId: string) => `wallet:${userId}`,
    USER: (userId: string) => `user:${userId}`,
    TICKETS: 'tickets:list',
    TICKET: (id: string) => `ticket:${id}`,
    METRICS: 'metrics:dashboard',
  };

  // Invalidate cache after CRUD operations
  afterProductCreate(): void {
    this.delete(CacheControlService.KEYS.PRODUCTS);
    this.delete(CacheControlService.KEYS.METRICS);
  }

  afterProductUpdate(productId: string): void {
    this.delete(CacheControlService.KEYS.PRODUCT(productId));
    this.delete(CacheControlService.KEYS.PRODUCTS);
    this.delete(CacheControlService.KEYS.METRICS);
  }

  afterProductDelete(productId: string): void {
    this.delete(CacheControlService.KEYS.PRODUCT(productId));
    this.delete(CacheControlService.KEYS.PRODUCTS);
    this.delete(CacheControlService.KEYS.METRICS);
  }

  afterOrderCreate(userId: string): void {
    this.delete(CacheControlService.KEYS.ORDERS);
    this.delete(CacheControlService.KEYS.WALLET(userId));
    this.delete(CacheControlService.KEYS.METRICS);
  }

  afterOrderUpdate(orderId: string, userId: string): void {
    this.delete(CacheControlService.KEYS.ORDER(orderId));
    this.delete(CacheControlService.KEYS.ORDERS);
    this.delete(CacheControlService.KEYS.WALLET(userId));
  }

  afterKeyCreate(): void {
    this.delete(CacheControlService.KEYS.KEYS);
    this.delete(CacheControlService.KEYS.METRICS);
  }

  afterKeyUpdate(keyId: string): void {
    this.delete(CacheControlService.KEYS.KEY(keyId));
    this.delete(CacheControlService.KEYS.KEYS);
  }

  afterWalletUpdate(userId: string): void {
    this.delete(CacheControlService.KEYS.WALLET(userId));
    this.delete(CacheControlService.KEYS.METRICS);
  }

  afterServerUpdate(serverId: string): void {
    this.delete(CacheControlService.KEYS.SERVER(serverId));
    this.delete(CacheControlService.KEYS.SERVERS);
  }

  afterTicketCreate(): void {
    this.delete(CacheControlService.KEYS.TICKETS);
  }

  afterTicketUpdate(ticketId: string): void {
    this.delete(CacheControlService.KEYS.TICKET(ticketId));
    this.delete(CacheControlService.KEYS.TICKETS);
  }

  getStats(): {
    size: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cacheControl = CacheControlService.getInstance();

// Convenience functions
export function setCache(key: string, value: any, ttl?: number): void {
  cacheControl.set(key, value, ttl);
}

export function getCache(key: string): any | null {
  return cacheControl.get(key);
}

export function deleteCache(key: string): void {
  cacheControl.delete(key);
}

export function clearCache(): void {
  cacheControl.clear();
}
