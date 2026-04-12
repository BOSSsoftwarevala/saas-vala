// STEP 123: REQUEST STATE LOCK - Lock row during approve/reject action
import { createClient } from '@supabase/supabase-js';

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  reason?: string;
  retryAfter?: number; // milliseconds
}

export interface LockInfo {
  lockId: string;
  requestId: string;
  userId: string;
  action: 'approve' | 'reject';
  acquiredAt: string;
  expiresAt: string;
}

export class RequestStateLock {
  private static instance: RequestStateLock;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private activeLocks = new Map<string, LockInfo>(); // requestId -> lock info
  private lockTimeout = 30000; // 30 seconds
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  static getInstance(): RequestStateLock {
    if (!RequestStateLock.instance) {
      RequestStateLock.instance = new RequestStateLock();
    }
    return RequestStateLock.instance;
  }

  // Acquire lock for request action
  async acquireLock(
    requestId: string,
    userId: string,
    action: 'approve' | 'reject'
  ): Promise<LockResult> {
    const lockId = this.generateLockId(requestId, userId, action);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.lockTimeout);

    // Check if lock already exists
    const existingLock = this.activeLocks.get(requestId);
    if (existingLock) {
      // Check if lock is expired
      if (new Date() > new Date(existingLock.expiresAt)) {
        // Lock expired, remove it
        this.releaseLock(requestId, existingLock.lockId);
      } else {
        // Lock is still active
        const retryAfter = Math.min(
          this.retryDelay,
          new Date(existingLock.expiresAt).getTime() - now.getTime()
        );
        
        return {
          acquired: false,
          reason: `Request already locked by ${existingLock.userId} for ${existingLock.action}`,
          retryAfter
        };
      }
    }

    // Try to acquire database-level lock
    const dbLockResult = await this.acquireDatabaseLock(requestId, lockId, userId, action);
    if (!dbLockResult.acquired) {
      return dbLockResult;
    }

    // Create in-memory lock
    const lockInfo: LockInfo = {
      lockId,
      requestId,
      userId,
      action,
      acquiredAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    this.activeLocks.set(requestId, lockInfo);

    // Set auto-release timer
    setTimeout(() => {
      this.releaseLock(requestId, lockId);
    }, this.lockTimeout);

    console.log(`Lock acquired: ${lockId} for ${action} by ${userId}`);
    
    return {
      acquired: true,
      lockId
    };
  }

  // Acquire database-level lock using advisory locks or row versioning
  private async acquireDatabaseLock(
    requestId: string,
    lockId: string,
    userId: string,
    action: 'approve' | 'reject'
  ): Promise<LockResult> {
    try {
      // Use optimistic locking with version check
      const { data: request, error: fetchError } = await this.supabase
        .from('chat_requests')
        .select('id, status, version, locked_by, locked_until')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return {
          acquired: false,
          reason: 'Request not found'
        };
      }

      // Check if request is already locked
      if (request.locked_by && request.locked_until) {
        const lockUntil = new Date(request.locked_until);
        if (lockUntil > new Date()) {
          return {
            acquired: false,
            reason: `Request locked by ${request.locked_by}`,
            retryAfter: lockUntil.getTime() - Date.now()
          };
        }
      }

      // Check if request is in a state that allows this action
      if (request.status !== 'pending') {
        return {
          acquired: false,
          reason: `Request is ${request.status}, cannot ${action}`
        };
      }

      // Acquire lock by updating the request
      const lockUntil = new Date(Date.now() + this.lockTimeout);
      const { error: updateError } = await this.supabase
        .from('chat_requests')
        .update({
          locked_by: `${userId}:${action}`,
          locked_until: lockUntil.toISOString(),
          version: request.version + 1
        })
        .eq('id', requestId)
        .eq('version', request.version); // Optimistic locking

      if (updateError) {
        // Check if it's a version conflict (race condition)
        if (updateError.message.includes('version') || updateError.code === 'PGRST116') {
          return {
            acquired: false,
            reason: 'Request was modified by another process',
            retryAfter: this.retryDelay
          };
        }
        throw new Error(`Failed to acquire database lock: ${updateError.message}`);
      }

      return { acquired: true, lockId };

    } catch (error) {
      console.error('Error acquiring database lock:', error);
      return {
        acquired: false,
        reason: 'Database error occurred'
      };
    }
  }

  // Release lock
  async releaseLock(requestId: string, lockId: string): Promise<boolean> {
    try {
      // Remove from memory
      const lockInfo = this.activeLocks.get(requestId);
      if (lockInfo && lockInfo.lockId === lockId) {
        this.activeLocks.delete(requestId);
      }

      // Release database lock
      const { error } = await this.supabase
        .from('chat_requests')
        .update({
          locked_by: null,
          locked_until: null
        })
        .eq('id', requestId)
        .eq('locked_by', lockInfo?.userId + ':' + lockInfo?.action || lockId);

      if (error) {
        console.error('Error releasing database lock:', error);
        return false;
      }

      console.log(`Lock released: ${lockId}`);
      return true;

    } catch (error) {
      console.error('Error releasing lock:', error);
      return false;
    }
  }

  // Execute action with lock (wrapper function)
  async executeWithLock<T>(
    requestId: string,
    userId: string,
    action: 'approve' | 'reject',
    callback: (lockId: string) => Promise<T>
  ): Promise<{ success: boolean; result?: T; reason?: string }> {
    let lockId: string | undefined;
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      // Try to acquire lock
      const lockResult = await this.acquireLock(requestId, userId, action);
      
      if (!lockResult.acquired) {
        if (lockResult.retryAfter && lockResult.retryAfter > 0) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, lockResult.retryAfter));
          retryCount++;
          continue;
        } else {
          return {
            success: false,
            reason: lockResult.reason || 'Failed to acquire lock'
          };
        }
      }

      lockId = lockResult.lockId;
      break;
    }

    if (!lockId) {
      return {
        success: false,
        reason: 'Failed to acquire lock after maximum retries'
      };
    }

    try {
      // Execute the callback with lock
      const result = await callback(lockId);
      
      return {
        success: true,
        result
      };

    } catch (error) {
      console.error('Error executing locked action:', error);
      return {
        success: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };

    } finally {
      // Always release the lock
      if (lockId) {
        await this.releaseLock(requestId, lockId);
      }
    }
  }

  // Check if request is locked
  isRequestLocked(requestId: string): boolean {
    const lockInfo = this.activeLocks.get(requestId);
    if (!lockInfo) {
      return false;
    }

    // Check if lock is expired
    if (new Date() > new Date(lockInfo.expiresAt)) {
      this.activeLocks.delete(requestId);
      return false;
    }

    return true;
  }

  // Get lock information
  getLockInfo(requestId: string): LockInfo | null {
    const lockInfo = this.activeLocks.get(requestId);
    if (!lockInfo) {
      return null;
    }

    // Check if lock is expired
    if (new Date() > new Date(lockInfo.expiresAt)) {
      this.activeLocks.delete(requestId);
      return null;
    }

    return { ...lockInfo };
  }

  // Force release all locks for a user
  async releaseUserLocks(userId: string): Promise<number> {
    let releasedCount = 0;
    const locksToRelease: string[] = [];

    for (const [requestId, lockInfo] of this.activeLocks.entries()) {
      if (lockInfo.userId === userId) {
        locksToRelease.push(requestId);
      }
    }

    for (const requestId of locksToRelease) {
      const lockInfo = this.activeLocks.get(requestId);
      if (lockInfo) {
        const released = await this.releaseLock(requestId, lockInfo.lockId);
        if (released) {
          releasedCount++;
        }
      }
    }

    console.log(`Released ${releasedCount} locks for user ${userId}`);
    return releasedCount;
  }

  // Clean up expired locks
  cleanupExpiredLocks(): number {
    const now = new Date();
    const expiredLocks: string[] = [];

    for (const [requestId, lockInfo] of this.activeLocks.entries()) {
      if (now > new Date(lockInfo.expiresAt)) {
        expiredLocks.push(requestId);
      }
    }

    for (const requestId of expiredLocks) {
      const lockInfo = this.activeLocks.get(requestId);
      if (lockInfo) {
        this.releaseLock(requestId, lockInfo.lockId);
      }
    }

    if (expiredLocks.length > 0) {
      console.log(`Cleaned up ${expiredLocks.length} expired locks`);
    }

    return expiredLocks.length;
  }

  // Generate unique lock ID
  private generateLockId(requestId: string, userId: string, action: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${requestId}_${userId}_${action}_${timestamp}_${random}`;
  }

  // Get lock statistics
  getLockStats(): {
    activeLocks: number;
    locksByUser: Record<string, number>;
    locksByAction: Record<string, number>;
    averageLockAge: number;
  } {
    const locksByUser: Record<string, number> = {};
    const locksByAction: Record<string, number> = {};
    let totalAge = 0;
    const now = new Date();

    for (const lockInfo of this.activeLocks.values()) {
      // Count by user
      locksByUser[lockInfo.userId] = (locksByUser[lockInfo.userId] || 0) + 1;
      
      // Count by action
      locksByAction[lockInfo.action] = (locksByAction[lockInfo.action] || 0) + 1;
      
      // Calculate age
      const acquiredAt = new Date(lockInfo.acquiredAt);
      totalAge += now.getTime() - acquiredAt.getTime();
    }

    const averageLockAge = this.activeLocks.size > 0 ? totalAge / this.activeLocks.size : 0;

    return {
      activeLocks: this.activeLocks.size,
      locksByUser,
      locksByAction,
      averageLockAge
    };
  }

  // Release all locks (emergency function)
  async releaseAllLocks(): Promise<number> {
    const lockIds = Array.from(this.activeLocks.keys());
    let releasedCount = 0;

    for (const requestId of lockIds) {
      const lockInfo = this.activeLocks.get(requestId);
      if (lockInfo) {
        const released = await this.releaseLock(requestId, lockInfo.lockId);
        if (released) {
          releasedCount++;
        }
      }
    }

    console.log(`Emergency release: ${releasedCount} locks released`);
    return releasedCount;
  }

  // Set lock timeout
  setLockTimeout(timeout: number): void {
    this.lockTimeout = timeout;
  }

  // Get lock timeout
  getLockTimeout(): number {
    return this.lockTimeout;
  }
}

export const requestStateLock = RequestStateLock.getInstance();
