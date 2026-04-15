// Transaction Lock Service - Prevent double-spending and race conditions

interface LockEntry {
  id: string;
  resource: string;
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
}

class TransactionLockService {
  private static instance: TransactionLockService;
  private locks: Map<string, LockEntry> = new Map();
  private lockTimeout = 30000; // 30 seconds default lock timeout

  private constructor() {
    // Clean up expired locks periodically
    setInterval(() => this.cleanupExpiredLocks(), 5000);
  }

  static getInstance(): TransactionLockService {
    if (!TransactionLockService.instance) {
      TransactionLockService.instance = new TransactionLockService();
    }
    return TransactionLockService.instance;
  }

  async acquireLock(
    resource: string,
    ownerId: string,
    timeout: number = this.lockTimeout
  ): Promise<{ success: boolean; lockId?: string }> {
    const lockId = `${resource}:${ownerId}:${Date.now()}`;
    const now = Date.now();
    const expiresAt = now + timeout;

    // Check if lock already exists
    const existingLock = this.locks.get(resource);
    if (existingLock && existingLock.expiresAt > now) {
      console.log(`[TransactionLock] Lock already held for ${resource} by ${existingLock.ownerId}`);
      return { success: false };
    }

    // Acquire lock
    const lock: LockEntry = {
      id: lockId,
      resource,
      ownerId,
      acquiredAt: now,
      expiresAt,
    };

    this.locks.set(resource, lock);
    console.log(`[TransactionLock] Lock acquired for ${resource} by ${ownerId}`);

    return { success: true, lockId };
  }

  async releaseLock(resource: string, lockId: string): Promise<void> {
    const lock = this.locks.get(resource);
    
    if (lock && lock.id === lockId) {
      this.locks.delete(resource);
      console.log(`[TransactionLock] Lock released for ${resource}`);
    }
  }

  async releaseLockByResource(resource: string): Promise<void> {
    const lock = this.locks.get(resource);
    
    if (lock) {
      this.locks.delete(resource);
      console.log(`[TransactionLock] Lock released for ${resource}`);
    }
  }

  private cleanupExpiredLocks(): void {
    const now = Date.now();
    
    for (const [resource, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(resource);
        console.log(`[TransactionLock] Expired lock cleaned up for ${resource}`);
      }
    }
  }

  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);
    const now = Date.now();
    return lock !== undefined && lock.expiresAt > now;
  }

  getLockInfo(resource: string): LockEntry | undefined {
    return this.locks.get(resource);
  }

  // Execute operation with automatic lock management
  async withLock<T>(
    resource: string,
    ownerId: string,
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    // Acquire lock
    const { success, lockId } = await this.acquireLock(resource, ownerId, timeout);
    
    if (!success) {
      throw new Error(`Resource ${resource} is locked by another transaction`);
    }

    try {
      // Execute operation
      const result = await operation();
      return result;
    } finally {
      // Release lock
      if (lockId) {
        await this.releaseLock(resource, lockId);
      }
    }
  }

  // Wallet transaction with lock
  async withWalletLock<T>(
    userId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.withLock(`wallet:${userId}`, userId, operation);
  }

  // Order transaction with lock
  async withOrderLock<T>(
    orderId: string,
    userId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.withLock(`order:${orderId}`, userId, operation);
  }

  // Key transaction with lock
  async withKeyLock<T>(
    keyId: string,
    userId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.withLock(`key:${keyId}`, userId, operation);
  }
}

export const transactionLock = TransactionLockService.getInstance();

// Convenience functions
export async function withWalletLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  return transactionLock.withWalletLock(userId, operation);
}

export async function withOrderLock<T>(orderId: string, userId: string, operation: () => Promise<T>): Promise<T> {
  return transactionLock.withOrderLock(orderId, userId, operation);
}

export async function withKeyLock<T>(keyId: string, userId: string, operation: () => Promise<T>): Promise<T> {
  return transactionLock.withKeyLock(keyId, userId, operation);
}
