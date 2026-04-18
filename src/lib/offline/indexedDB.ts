/**
 * Local Database Layer - IndexedDB
 * Mirrors Supabase schema for offline-first operation
 */

const DB_NAME = 'saasvala_offline_db';
const DB_VERSION = 1;

export interface TableSchema {
  name: string;
  keyPath: string;
  indexes: Array<{ name: string; keyPath: string; unique?: boolean }>;
}

const TABLES: TableSchema[] = [
  { name: 'users', keyPath: 'id', indexes: [
    { name: 'email', keyPath: 'email', unique: true },
    { name: 'created_at', keyPath: 'created_at' }
  ]},
  { name: 'products', keyPath: 'id', indexes: [
    { name: 'slug', keyPath: 'slug', unique: true },
    { name: 'category_id', keyPath: 'category_id' },
    { name: 'is_active', keyPath: 'is_active' },
    { name: 'deleted_at', keyPath: 'deleted_at' }
  ]},
  { name: 'categories', keyPath: 'id', indexes: [
    { name: 'slug', keyPath: 'slug', unique: true },
    { name: 'deleted_at', keyPath: 'deleted_at' }
  ]},
  { name: 'sub_categories', keyPath: 'id', indexes: [
    { name: 'slug', keyPath: 'slug', unique: true },
    { name: 'parent_id', keyPath: 'parent_id' }
  ]},
  { name: 'micro_categories', keyPath: 'id', indexes: [
    { name: 'slug', keyPath: 'slug', unique: true },
    { name: 'parent_id', keyPath: 'parent_id' }
  ]},
  { name: 'nano_categories', keyPath: 'id', indexes: [
    { name: 'slug', keyPath: 'slug', unique: true },
    { name: 'parent_id', keyPath: 'parent_id' }
  ]},
  { name: 'orders', keyPath: 'id', indexes: [
    { name: 'user_id', keyPath: 'user_id' },
    { name: 'product_id', keyPath: 'product_id' },
    { name: 'created_at', keyPath: 'created_at' },
    { name: 'deleted_at', keyPath: 'deleted_at' }
  ]},
  { name: 'wallet_ledger', keyPath: 'id', indexes: [
    { name: 'wallet_id', keyPath: 'wallet_id' },
    { name: 'created_at', keyPath: 'created_at' }
  ]},
  { name: 'license_keys', keyPath: 'id', indexes: [
    { name: 'order_id', keyPath: 'order_id' },
    { name: 'assigned_to', keyPath: 'assigned_to' }
  ]},
  { name: 'resellers', keyPath: 'id', indexes: [
    { name: 'user_id', keyPath: 'user_id', unique: true }
  ]},
  { name: 'ai_logs', keyPath: 'id', indexes: [
    { name: 'user_id', keyPath: 'user_id' },
    { name: 'created_at', keyPath: 'created_at' }
  ]},
  { name: 'chat_messages', keyPath: 'id', indexes: [
    { name: 'user_id', keyPath: 'user_id' },
    { name: 'created_at', keyPath: 'created_at' }
  ]},
  { name: 'seo_data', keyPath: 'id', indexes: [
    { name: 'entity_type', keyPath: 'entity_type' },
    { name: 'entity_id', keyPath: 'entity_id' }
  ]},
  { name: 'support_tickets', keyPath: 'id', indexes: [
    { name: 'user_id', keyPath: 'user_id' },
    { name: 'status', keyPath: 'status' }
  ]},
  { name: 'audit_logs', keyPath: 'id', indexes: [
    { name: 'user_id', keyPath: 'user_id' },
    { name: 'action', keyPath: 'action' },
    { name: 'created_at', keyPath: 'created_at' }
  ]},
  { name: 'system_health_logs', keyPath: 'id', indexes: [
    { name: 'created_at', keyPath: 'created_at' }
  ]},
  { name: 'settings', keyPath: 'key', indexes: [
    { name: 'key', keyPath: 'key', unique: true }
  ]},
  { name: 'sync_queue', keyPath: 'id', indexes: [
    { name: 'table_name', keyPath: 'table_name' },
    { name: 'action', keyPath: 'action' },
    { name: 'synced', keyPath: 'synced' }
  ]},
];

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create all tables with indexes
        TABLES.forEach((table) => {
          if (!db.objectStoreNames.contains(table.name)) {
            const store = db.createObjectStore(table.name, { keyPath: table.keyPath });
            table.indexes.forEach((index) => {
              store.createIndex(index.name, index.keyPath, { unique: index.unique });
            });
          }
        });
      };
    });

    return this.initPromise;
  }

  async get<T>(tableName: string, key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get from ${tableName}`));
    });
  }

  async getAll<T>(tableName: string): Promise<T[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get all from ${tableName}`));
    });
  }

  async put<T>(tableName: string, data: T): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to put to ${tableName}`));
    });
  }

  async delete(tableName: string, key: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete from ${tableName}`));
    });
  }

  async getByIndex<T>(tableName: string, indexName: string, value: any): Promise<T[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to query index ${indexName}`));
    });
  }

  async clear(tableName: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readwrite');
      const store = transaction.objectStore(tableName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${tableName}`));
    });
  }

  async count(tableName: string): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count ${tableName}`));
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  isReady(): boolean {
    return this.db !== null;
  }
}

// Singleton instance
export const indexedDB = new IndexedDBManager();
