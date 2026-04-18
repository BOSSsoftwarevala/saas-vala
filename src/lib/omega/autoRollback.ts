/**
 * AUTO ROLLBACK SYSTEM
 * Failure detected → revert DB, revert UI, notify
 */

import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { eventStream } from './eventStream';

export interface RollbackCheckpoint {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  beforeState: any;
  afterState: any;
  timestamp: string;
  action: string;
  uiState?: any;
}

export class AutoRollbackSystem {
  private static instance: AutoRollbackSystem;
  private checkpoints: Map<string, RollbackCheckpoint> = new Map();
  private rollbackHistory: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): AutoRollbackSystem {
    if (!AutoRollbackSystem.instance) {
      AutoRollbackSystem.instance = new AutoRollbackSystem();
    }
    return AutoRollbackSystem.instance;
  }

  /**
   * Create a checkpoint before an action
   */
  async createCheckpoint(
    userId: string,
    entityType: string,
    entityId: string,
    beforeState: any,
    action: string,
    uiState?: any
  ): Promise<string> {
    const checkpoint: RollbackCheckpoint = {
      id: this.generateId(),
      userId,
      entityType,
      entityId,
      beforeState,
      afterState: null,
      timestamp: new Date().toISOString(),
      action,
      uiState,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);

    // Log to event stream
    await eventStream.logEvent(
      userId,
      `checkpoint_${action}`,
      entityType,
      entityId,
      beforeState,
      null,
      { checkpoint_id: checkpoint.id }
    );

    return checkpoint.id;
  }

  /**
   * Update checkpoint with after state (on success)
   */
  async updateCheckpointSuccess(checkpointId: string, afterState: any): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return;

    checkpoint.afterState = afterState;
    this.checkpoints.set(checkpointId, checkpoint);

    // Log to event stream
    await eventStream.logEvent(
      checkpoint.userId,
      'checkpoint_success',
      checkpoint.entityType,
      checkpoint.entityId,
      checkpoint.beforeState,
      afterState,
      { checkpoint_id: checkpointId }
    );

    // Remove old checkpoints for this entity (keep only last 5)
    this.cleanupOldCheckpoints(checkpoint.entityType, checkpoint.entityId);
  }

  /**
   * Perform rollback on failure
   */
  async rollback(checkpointId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { success: false, error: 'Checkpoint not found' };
    }

    try {
      // Revert DB state
      if (checkpoint.beforeState) {
        const { error } = await supabase
          .from(checkpoint.entityType)
          .update(checkpoint.beforeState)
          .eq('id', checkpoint.entityId);

        if (error) throw error;
      }

      // Log rollback to event stream
      await eventStream.logEvent(
        checkpoint.userId,
        'rollback',
        checkpoint.entityType,
        checkpoint.entityId,
        checkpoint.afterState,
        checkpoint.beforeState,
        { checkpoint_id: checkpointId, reason }
      );

      // Track rollback count
      const key = `${checkpoint.entityType}:${checkpoint.entityId}`;
      const count = this.rollbackHistory.get(key) || 0;
      this.rollbackHistory.set(key, count + 1);

      // Notify user
      toast.error(`Rollback performed: ${reason || 'Action failed'}`);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Rollback failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute action with automatic rollback on failure
   */
  async executeWithRollback<T>(
    userId: string,
    entityType: string,
    entityId: string,
    action: () => Promise<T>,
    uiState?: any
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    // Get current state
    const { data: currentState } = await supabase
      .from(entityType)
      .select('*')
      .eq('id', entityId)
      .single();

    // Create checkpoint
    const checkpointId = await this.createCheckpoint(
      userId,
      entityType,
      entityId,
      currentState,
      'execute_with_rollback',
      uiState
    );

    try {
      // Execute action
      const result = await action();

      // Update checkpoint with success
      await this.updateCheckpointSuccess(checkpointId, currentState);

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Perform rollback
      await this.rollback(checkpointId, errorMessage);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Batch execute with rollback
   */
  async batchExecuteWithRollback<T>(
    userId: string,
    operations: Array<{
      entityType: string;
      entityId: string;
      action: () => Promise<T>;
    }>,
    uiState?: any
  ): Promise<{ success: boolean; data?: T[]; errors?: string[] }> {
    const results: T[] = [];
    const errors: string[] = [];
    const checkpointIds: string[] = [];

    // Create checkpoints for all operations
    for (const op of operations) {
      const { data: currentState } = await supabase
        .from(op.entityType)
        .select('*')
        .eq('id', op.entityId)
        .single();

      const checkpointId = await this.createCheckpoint(
        userId,
        op.entityType,
        op.entityId,
        currentState,
        'batch_execute',
        uiState
      );

      checkpointIds.push(checkpointId);
    }

    // Execute operations
    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i].action();
        results.push(result);

        // Update checkpoint
        await this.updateCheckpointSuccess(checkpointIds[i], null);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(errorMessage);

        // Rollback all completed operations
        for (let j = 0; j <= i; j++) {
          await this.rollback(checkpointIds[j], `Batch operation failed: ${errorMessage}`);
        }

        return { success: false, errors };
      }
    }

    return { success: true, data: results };
  }

  /**
   * Get rollback history for an entity
   */
  getRollbackHistory(entityType: string, entityId: string): number {
    const key = `${entityType}:${entityId}`;
    return this.rollbackHistory.get(key) || 0;
  }

  /**
   * Check if entity has exceeded rollback threshold
   */
  hasExceededThreshold(entityType: string, entityId: string, threshold: number = 5): boolean {
    return this.getRollbackHistory(entityType, entityId) >= threshold;
  }

  /**
   * Cleanup old checkpoints
   */
  private cleanupOldCheckpoints(entityType: string, entityId: string): void {
    const entityCheckpoints = Array.from(this.checkpoints.entries())
      .filter(([_, cp]) => cp.entityType === entityType && cp.entityId === entityId)
      .sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime());

    // Keep only last 5
    if (entityCheckpoints.length > 5) {
      for (let i = 5; i < entityCheckpoints.length; i++) {
        this.checkpoints.delete(entityCheckpoints[i][0]);
      }
    }
  }

  /**
   * Get all checkpoints for an entity
   */
  getEntityCheckpoints(entityType: string, entityId: string): RollbackCheckpoint[] {
    return Array.from(this.checkpoints.values())
      .filter(cp => cp.entityType === entityType && cp.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private generateId(): string {
    return `ckpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old checkpoints (run periodically)
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 3600000;

    for (const [id, checkpoint] of this.checkpoints) {
      const checkpointTime = new Date(checkpoint.timestamp).getTime();
      if (checkpointTime < oneHourAgo) {
        this.checkpoints.delete(id);
      }
    }
  }
}

// Singleton instance
export const autoRollback = AutoRollbackSystem.getInstance();

/**
 * React hook for auto rollback
 */
export function useAutoRollback() {
  const executeWithRollback = async <T>(
    userId: string,
    entityType: string,
    entityId: string,
    action: () => Promise<T>,
    uiState?: any
  ) => {
    return autoRollback.executeWithRollback(userId, entityType, entityId, action, uiState);
  };

  const batchExecuteWithRollback = async <T>(
    userId: string,
    operations: Array<{
      entityType: string;
      entityId: string;
      action: () => Promise<T>;
    }>,
    uiState?: any
  ) => {
    return autoRollback.batchExecuteWithRollback(userId, operations, uiState);
  };

  const createCheckpoint = async (
    userId: string,
    entityType: string,
    entityId: string,
    beforeState: any,
    action: string,
    uiState?: any
  ) => {
    return autoRollback.createCheckpoint(userId, entityType, entityId, beforeState, action, uiState);
  };

  const rollback = async (checkpointId: string, reason?: string) => {
    return autoRollback.rollback(checkpointId, reason);
  };

  return { executeWithRollback, batchExecuteWithRollback, createCheckpoint, rollback };
}
