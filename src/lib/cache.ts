/**
 * Simple in-memory TTL cache for the marketplace.
 *
 * Designed to hold product lists and categories between page navigations
 * without a full React Query or SWR dependency.
 *
 * Usage:
 *   import { cache } from '@/lib/cache';
 *
 *   // Read (returns undefined on miss / expired)
 *   const hit = cache.get<Product[]>('products:list');
 *
 *   // Write with optional TTL (ms). Default: 60 seconds.
 *   cache.set('products:list', data, 60_000);
 *
 *   // Invalidate one key
 *   cache.invalidate('products:list');
 *
 *   // Invalidate all keys matching a prefix
 *   cache.invalidatePrefix('products');
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 60 seconds

class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate all keys that start with the given prefix. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Remove all expired entries (housekeeping). */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  /** Keys currently alive in the cache. */
  keys(): string[] {
    this.prune();
    return [...this.store.keys()];
  }
}

/** Singleton cache instance shared across the app. */
export const cache = new TtlCache();

// ─────────────────────────────────────────────
// Cached async fetch helper
// ─────────────────────────────────────────────

/**
 * Execute `fn` and cache its result under `key` for `ttlMs` milliseconds.
 * On a cache hit the function is not called.
 *
 * @example
 *   const products = await cachedFetch(
 *     'products:list',
 *     () => publicMarketplaceApi.listProducts({}),
 *     60_000  // 1 minute
 *   );
 */
export async function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;

  const result = await fn();
  cache.set(key, result, ttlMs);
  return result;
}
