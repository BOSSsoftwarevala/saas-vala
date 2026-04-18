/**
 * Duplicate Request Blocker
 * Stores last request hash and ignores duplicates
 */

export interface RequestHash {
  hash: string;
  timestamp: number;
  endpoint: string;
  payload?: any;
}

class DuplicateRequestBlocker {
  private static instance: DuplicateRequestBlocker;
  private recentRequests: Map<string, RequestHash> = new Map();
  private readonly ttlMs = 5000; // 5 seconds TTL
  private readonly maxRequests = 100;

  private constructor() {
    // Clean up expired requests periodically
    setInterval(() => this.cleanup(), this.ttlMs);
  }

  static getInstance(): DuplicateRequestBlocker {
    if (!DuplicateRequestBlocker.instance) {
      DuplicateRequestBlocker.instance = new DuplicateRequestBlocker();
    }
    return DuplicateRequestBlocker.instance;
  }

  /**
   * Generate hash from request details
   */
  private generateHash(endpoint: string, payload?: any): string {
    const payloadString = payload ? JSON.stringify(payload) : '';
    const combined = `${endpoint}:${payloadString}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if request is a duplicate
   */
  isDuplicate(endpoint: string, payload?: any): boolean {
    const hash = this.generateHash(endpoint, payload);
    const now = Date.now();
    const recent = this.recentRequests.get(hash);

    if (!recent) {
      return false;
    }

    // Check if within TTL
    const isDuplicate = now - recent.timestamp < this.ttlMs;
    return isDuplicate;
  }

  /**
   * Register a request
   */
  registerRequest(endpoint: string, payload?: any): void {
    const hash = this.generateHash(endpoint, payload);
    const now = Date.now();

    this.recentRequests.set(hash, {
      hash,
      timestamp: now,
      endpoint,
      payload,
    });

    // Prevent memory leak by limiting size
    if (this.recentRequests.size > this.maxRequests) {
      const oldestKey = this.recentRequests.keys().next().value;
      this.recentRequests.delete(oldestKey);
    }
  }

  /**
   * Clean up expired requests
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, request] of this.recentRequests.entries()) {
      if (now - request.timestamp > this.ttlMs) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.recentRequests.delete(key));
  }

  /**
   * Clear all stored requests
   */
  clear(): void {
    this.recentRequests.clear();
  }

  /**
   * Get count of recent requests
   */
  getCount(): number {
    return this.recentRequests.size;
  }
}

// Export singleton instance
export const duplicateBlocker = DuplicateRequestBlocker.getInstance();

/**
 * Higher-order function to wrap async functions with duplicate blocking
 */
export function withDuplicateBlock<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  endpoint?: string
): (...args: T) => Promise<R | null> {
  return async (...args: T): Promise<R | null> => {
    const payload = args.length > 0 ? args : undefined;
    const requestEndpoint = endpoint || fn.name || 'anonymous';

    if (duplicateBlocker.isDuplicate(requestEndpoint, payload)) {
      console.warn(`Duplicate request blocked: ${requestEndpoint}`);
      return null;
    }

    duplicateBlocker.registerRequest(requestEndpoint, payload);

    try {
      return await fn(...args);
    } catch (error) {
      // Remove from registry on error to allow retry
      // (optional: depends on use case)
      throw error;
    }
  };
}

/**
 * Check if a specific action should be blocked
 */
export function shouldBlockAction(action: string, payload?: any): boolean {
  return duplicateBlocker.isDuplicate(action, payload);
}

/**
 * Register an action
 */
export function registerAction(action: string, payload?: any): void {
  duplicateBlocker.registerRequest(action, payload);
}
