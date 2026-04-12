// STEP 88: EVENT DE-DUP ENGINE - Ignore duplicate socket events
export interface EventSignature {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  source: string;
  hash: string;
}

export interface DedupConfig {
  windowSize: number; // Time window for deduplication (ms)
  maxCacheSize: number; // Maximum events to cache
  hashAlgorithm: 'simple' | 'sha256' | 'md5';
  enablePayloadHashing: boolean;
}

export interface DedupStats {
  totalEvents: number;
  duplicateEvents: number;
  uniqueEvents: number;
  cacheSize: number;
  duplicateRate: number;
}

export class EventDeduplicationEngine {
  private static instance: EventDeduplicationEngine;
  private config: DedupConfig;
  private eventCache = new Map<string, EventSignature>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private stats: DedupStats = {
    totalEvents: 0,
    duplicateEvents: 0,
    uniqueEvents: 0,
    cacheSize: 0,
    duplicateRate: 0
  };

  static getInstance(config?: Partial<DedupConfig>): EventDeduplicationEngine {
    if (!EventDeduplicationEngine.instance) {
      EventDeduplicationEngine.instance = new EventDeduplicationEngine(config);
    }
    return EventDeduplicationEngine.instance;
  }

  constructor(config: Partial<DedupConfig> = {}) {
    this.config = {
      windowSize: 5000, // 5 seconds
      maxCacheSize: 1000,
      hashAlgorithm: 'simple',
      enablePayloadHashing: true,
      ...config
    };

    this.startCleanupTimer();
  }

  // Check if event is duplicate
  isDuplicate(event: Partial<EventSignature>): boolean {
    this.stats.totalEvents++;

    const signature = this.createEventSignature(event);
    const cacheKey = `${signature.type}_${signature.hash}`;

    // Check cache for existing event
    const existing = this.eventCache.get(cacheKey);
    if (existing) {
      // Check if within deduplication window
      const timeDiff = signature.timestamp - existing.timestamp;
      if (timeDiff < this.config.windowSize) {
        this.stats.duplicateEvents++;
        this.updateStats();
        console.log(`Duplicate event detected: ${cacheKey} (${timeDiff}ms apart)`);
        return true;
      } else {
        // Event is outside window, remove old and allow new
        this.eventCache.delete(cacheKey);
      }
    }

    // Add to cache
    this.eventCache.set(cacheKey, signature);
    this.stats.uniqueEvents++;
    this.updateStats();

    return false;
  }

  // Create event signature
  private createEventSignature(event: Partial<EventSignature>): EventSignature {
    const signature: EventSignature = {
      id: event.id || this.generateId(),
      type: event.type || 'unknown',
      payload: event.payload,
      timestamp: event.timestamp || Date.now(),
      source: event.source || 'unknown',
      hash: this.generateHash(event)
    };

    return signature;
  }

  // Generate hash for event
  private generateHash(event: Partial<EventSignature>): string {
    const hashData = {
      type: event.type,
      payload: this.config.enablePayloadHashing ? event.payload : null,
      source: event.source
    };

    switch (this.config.hashAlgorithm) {
      case 'simple':
        return this.simpleHash(JSON.stringify(hashData));
      case 'sha256':
        return this.sha256Hash(JSON.stringify(hashData));
      case 'md5':
        return this.md5Hash(JSON.stringify(hashData));
      default:
        return this.simpleHash(JSON.stringify(hashData));
    }
  }

  // Simple hash function
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // SHA-256 hash (simplified implementation)
  private sha256Hash(str: string): string {
    // In a real implementation, you'd use crypto.subtle.digest
    // For now, using simple hash as fallback
    return this.simpleHash(str) + '_sha256';
  }

  // MD5 hash (simplified implementation)
  private md5Hash(str: string): string {
    // In a real implementation, you'd use MD5 algorithm
    // For now, using simple hash as fallback
    return this.simpleHash(str) + '_md5';
  }

  // Generate unique ID
  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Process event with deduplication
  processEvent<T>(
    event: Partial<EventSignature>,
    handler: (event: EventSignature) => T
  ): T | null {
    if (this.isDuplicate(event)) {
      return null; // Skip duplicate event
    }

    const signature = this.createEventSignature(event);
    return handler(signature);
  }

  // Process event with async handler
  async processEventAsync<T>(
    event: Partial<EventSignature>,
    handler: (event: EventSignature) => Promise<T>
  ): Promise<T | null> {
    if (this.isDuplicate(event)) {
      return null; // Skip duplicate event
    }

    const signature = this.createEventSignature(event);
    return await handler(signature);
  }

  // Batch process events
  processEvents<T>(
    events: Partial<EventSignature>[],
    handler: (event: EventSignature) => T
  ): T[] {
    const results: T[] = [];

    for (const event of events) {
      const result = this.processEvent(event, handler);
      if (result !== null) {
        results.push(result);
      }
    }

    return results;
  }

  // Clear old events from cache
  private cleanupCache(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.windowSize;
    let removedCount = 0;

    for (const [key, event] of this.eventCache.entries()) {
      if (event.timestamp < cutoffTime) {
        this.eventCache.delete(key);
        removedCount++;
      }
    }

    // If cache is still too large, remove oldest events
    if (this.eventCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.eventCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = entries.slice(0, this.eventCache.size - this.config.maxCacheSize);
      toRemove.forEach(([key]) => {
        this.eventCache.delete(key);
        removedCount++;
      });
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old events from deduplication cache`);
    }

    this.updateStats();
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, this.config.windowSize / 2); // Clean up twice per window
  }

  // Update statistics
  private updateStats(): void {
    this.stats.cacheSize = this.eventCache.size;
    this.stats.duplicateRate = this.stats.totalEvents > 0 
      ? this.stats.duplicateEvents / this.stats.totalEvents 
      : 0;
  }

  // Get deduplication statistics
  getStats(): DedupStats {
    this.updateStats();
    return { ...this.stats };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      totalEvents: 0,
      duplicateEvents: 0,
      uniqueEvents: 0,
      cacheSize: this.eventCache.size,
      duplicateRate: 0
    };
  }

  // Clear cache
  clearCache(): void {
    this.eventCache.clear();
    this.updateStats();
  }

  // Check if specific event type is in cache
  hasEventType(type: string): boolean {
    for (const event of this.eventCache.values()) {
      if (event.type === type) {
        return true;
      }
    }
    return false;
  }

  // Get events by type
  getEventsByType(type: string): EventSignature[] {
    const events: EventSignature[] = [];
    for (const event of this.eventCache.values()) {
      if (event.type === type) {
        events.push(event);
      }
    }
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Get recent events
  getRecentEvents(count: number = 10): EventSignature[] {
    const events = Array.from(this.eventCache.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
    
    return events;
  }

  // Update configuration
  updateConfig(newConfig: Partial<DedupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer with new window size
    this.startCleanupTimer();
  }

  // Get current configuration
  getConfig(): DedupConfig {
    return { ...this.config };
  }

  // Export cache for debugging
  exportCache(): Array<{ key: string; event: EventSignature }> {
    const entries: Array<{ key: string; event: EventSignature }> = [];
    
    for (const [key, event] of this.eventCache.entries()) {
      entries.push({ key, event: { ...event } });
    }
    
    return entries;
  }

  // Import cache (for testing/debugging)
  importCache(entries: Array<{ key: string; event: EventSignature }>): void {
    this.eventCache.clear();
    
    for (const { key, event } of entries) {
      this.eventCache.set(key, event);
    }
    
    this.updateStats();
  }

  // Destroy deduplication engine
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.clearCache();
  }
}

// Utility function for socket event deduplication
export const createSocketEventDeduper = () => {
  const deduper = EventDeduplicationEngine.getInstance();

  return {
    // Process socket message
    processMessage: (message: any, handler: (event: EventSignature) => void) => {
      return deduper.processEvent({
        type: 'socket_message',
        payload: message,
        source: 'socket'
      }, handler);
    },

    // Process presence event
    processPresence: (event: any, handler: (event: EventSignature) => void) => {
      return deduper.processEvent({
        type: 'presence',
        payload: event,
        source: 'socket'
      }, handler);
    },

    // Process typing indicator
    processTyping: (event: any, handler: (event: EventSignature) => void) => {
      return deduper.processEvent({
        type: 'typing',
        payload: event,
        source: 'socket'
      }, handler);
    },

    // Get deduplication stats
    getStats: () => deduper.getStats(),

    // Reset stats
    resetStats: () => deduper.resetStats()
  };
};

export const eventDeduplicationEngine = EventDeduplicationEngine.getInstance();
