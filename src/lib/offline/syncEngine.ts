/**
 * Sync Engine
 * Background sync engine for local ↔ server synchronization
 */

import { localApi } from './localApi';
import { supabase } from '@/lib/supabase';

export interface SyncConfig {
  autoSync: boolean;
  syncInterval: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
  timestamp: string;
}

class SyncEngine {
  private config: SyncConfig = {
    autoSync: true,
    syncInterval: 60000, // 1 minute
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
  };

  private syncIntervalId: number | null = null;
  private isSyncing = false;
  private online = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline(): void {
    this.online = true;
    if (this.config.autoSync) {
      this.sync();
    }
  }

  private handleOffline(): void {
    this.online = false;
  }

  isOnline(): boolean {
    return this.online;
  }

  async sync(): Promise<SyncResult> {
    if (!this.online || this.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: this.online ? ['Sync already in progress'] : ['Offline'],
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncing = true;

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get pending sync items
      const pendingItems = await localApi.getPendingSyncItems();

      for (const item of pendingItems) {
        const syncResult = await this.syncItem(item);
        if (syncResult.success) {
          result.synced++;
          await localApi.markSyncItemAsSynced(item.id);
        } else {
          result.failed++;
          result.errors.push(syncResult.error || 'Unknown error');
        }
      }

      // Also sync from server to local (pull changes)
      await this.pullChanges();

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async syncItem(item: any): Promise<{ success: boolean; error?: string }> {
    let attempts = 0;

    while (attempts < this.config.retryAttempts) {
      try {
        switch (item.action) {
          case 'insert':
            await this.syncInsert(item);
            break;
          case 'update':
            await this.syncUpdate(item);
            break;
          case 'delete':
            await this.syncDelete(item);
            break;
          default:
            throw new Error(`Unknown action: ${item.action}`);
        }

        return { success: true };
      } catch (error) {
        attempts++;
        if (attempts >= this.config.retryAttempts) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    return { success: false, error: 'Max retry attempts reached' };
  }

  private async syncInsert(item: any): Promise<void> {
    const { table_name, data } = item;

    // Check if record already exists on server
    const { data: existing } = await supabase
      .from(table_name)
      .select('id')
      .eq('id', data.id)
      .maybeSingle();

    if (existing) {
      // Record exists, skip insert
      return;
    }

    // Insert to server
    const { error } = await supabase
      .from(table_name)
      .insert(data);

    if (error) {
      throw error;
    }
  }

  private async syncUpdate(item: any): Promise<void> {
    const { table_name, record_id, data } = item;

    // Update on server
    const { error } = await supabase
      .from(table_name)
      .update(data)
      .eq('id', record_id);

    if (error) {
      throw error;
    }
  }

  private async syncDelete(item: any): Promise<void> {
    const { table_name, record_id, data } = item;

    // Soft delete on server
    const { error } = await supabase
      .from(table_name)
      .update(data)
      .eq('id', record_id);

    if (error) {
      throw error;
    }
  }

  private async pullChanges(): Promise<void> {
    // Pull changes from server for critical tables
    const tables = ['users', 'products', 'categories', 'orders', 'license_keys'];

    for (const table of tables) {
      try {
        // Get last sync timestamp from settings
        const lastSync = await this.getLastSyncTimestamp(table);

        // Fetch changes from server
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('updated_at', lastSync)
          .is('deleted_at', null);

        if (error || !data) {
          continue;
        }

        // Update local DB
        for (const record of data) {
          await localApi.insert(table, record);
        }

        // Update last sync timestamp
        await this.setLastSyncTimestamp(table);
      } catch (error) {
        console.error(`Failed to pull changes for ${table}:`, error);
      }
    }
  }

  private async getLastSyncTimestamp(table: string): Promise<string> {
    const { data } = await localApi.select('settings').eq('key', `last_sync_${table}`).execute();

    if (data.data && data.data.length > 0) {
      return data.data[0].value || '1970-01-01T00:00:00.000Z';
    }

    return '1970-01-01T00:00:00.000Z';
  }

  private async setLastSyncTimestamp(table: string): Promise<void> {
    const timestamp = new Date().toISOString();

    // Check if setting exists
    const { data } = await localApi.select('settings').eq('key', `last_sync_${table}`).execute();

    if (data.data && data.data.length > 0) {
      // Update existing
      await localApi.update('settings', { value: timestamp }, { key: `last_sync_${table}` });
    } else {
      // Insert new
      await localApi.insert('settings', {
        key: `last_sync_${table}`,
        value: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  }

  startAutoSync(): void {
    if (this.syncIntervalId !== null) {
      return; // Already started
    }

    if (this.config.autoSync && this.online) {
      this.sync();
    }

    this.syncIntervalId = window.setInterval(() => {
      if (this.config.autoSync && this.online) {
        this.sync();
      }
    }, this.config.syncInterval);
  }

  stopAutoSync(): void {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  setConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart auto sync if interval changed
    if (config.syncInterval !== undefined && this.syncIntervalId !== null) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  getConfig(): SyncConfig {
    return { ...this.config };
  }

  async forceFullSync(): Promise<SyncResult> {
    // Reset sync timestamps
    const tables = ['users', 'products', 'categories', 'orders', 'license_keys'];

    for (const table of tables) {
      await this.setLastSyncTimestamp('1970-01-01T00:00:00.000Z');
    }

    return this.sync();
  }

  getSyncStatus(): {
    online: boolean;
    syncing: boolean;
    pendingItems: number;
  } {
    return {
      online: this.online,
      syncing: this.isSyncing,
      pendingItems: 0, // Would need to query sync queue
    };
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();
