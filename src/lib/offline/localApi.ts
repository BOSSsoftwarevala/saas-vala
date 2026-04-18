/**
 * Local API Layer
 * Mirrors Supabase API but uses local IndexedDB
 */

import { indexedDB } from './indexedDB';

export interface LocalApiResponse<T> {
  data: T | null;
  error: string | null;
  fromCache: boolean;
}

export interface SelectQuery {
  table: string;
  columns?: string;
  filters?: Record<string, any>;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

export interface InsertQuery {
  table: string;
  data: any;
}

export interface UpdateQuery {
  table: string;
  data: any;
  filters: Record<string, any>;
}

export interface DeleteQuery {
  table: string;
  filters: Record<string, any>;
}

class LocalApi {
  private async executeQuery<T>(query: any): Promise<LocalApiResponse<T>> {
    try {
      await indexedDB.init();

      let result: T | null = null;

      switch (query.type) {
        case 'select':
          result = await this._select(query as SelectQuery);
          break;
        case 'insert':
          result = await this._insert(query as InsertQuery);
          break;
        case 'update':
          result = await this._update(query as UpdateQuery);
          break;
        case 'delete':
          result = await this._delete(query as DeleteQuery);
          break;
        default:
          throw new Error(`Unknown query type: ${query.type}`);
      }

      return { data: result, error: null, fromCache: true };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        fromCache: false,
      };
    }
  }

  private async _select<T>(query: SelectQuery): Promise<T> {
    const { table, filters, orderBy, ascending = true, limit: limitCount } = query;

    let data: any[] = [];

    if (filters && Object.keys(filters).length > 0) {
      // Use index-based query if possible
      const filterKeys = Object.keys(filters);
      if (filterKeys.length === 1) {
        data = await indexedDB.getByIndex(table, filterKeys[0], filters[filterKeys[0]]);
      } else {
        // Fallback to get all and filter
        data = await indexedDB.getAll(table);
        data = data.filter((item: any) => {
          return filterKeys.every(key => item[key] === filters[key]);
        });
      }
    } else {
      data = await indexedDB.getAll(table);
    }

    // Apply soft delete filter
    data = data.filter((item: any) => !item.deleted_at);

    // Apply ordering
    if (orderBy) {
      data.sort((a: any, b: any) => {
        if (a[orderBy] < b[orderBy]) return ascending ? -1 : 1;
        if (a[orderBy] > b[orderBy]) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (limitCount) {
      data = data.slice(0, limitCount);
    }

    return data as T;
  }

  private async _insert(query: InsertQuery): Promise<any> {
    const { table, data: insertData } = query;

    // Add timestamps if not present
    if (!insertData.created_at) {
      insertData.created_at = new Date().toISOString();
    }
    if (!insertData.updated_at) {
      insertData.updated_at = new Date().toISOString();
    }

    // Generate UUID if not present
    if (!insertData.id) {
      insertData.id = crypto.randomUUID();
    }

    await indexedDB.put(table, insertData);

    // Add to sync queue
    await this.addToSyncQueue(table, insertData.id, 'insert', insertData);

    return insertData;
  }

  private async _update(query: UpdateQuery): Promise<any> {
    const { table, data: updateData, filters } = query;

    // Get existing records
    const existingData = await indexedDB.getAll(table);
    const recordsToUpdate = existingData.filter((item: any) => {
      return Object.entries(filters).every(([key, value]) => item[key] === value);
    });

    // Update each record
    for (const record of recordsToUpdate) {
      const updatedRecord = { ...(record as any), ...updateData, updated_at: new Date().toISOString() };
      await indexedDB.put(table, updatedRecord);

      // Add to sync queue
      await this.addToSyncQueue(table, updatedRecord.id, 'update', updateData);
    }

    return recordsToUpdate;
  }

  private async _delete(query: DeleteQuery): Promise<any> {
    const { table, filters } = query;

    // Get existing records
    const existingData = await indexedDB.getAll(table);
    const recordsToDelete = existingData.filter((item: any) => {
      return Object.entries(filters).every(([key, value]) => item[key] === value);
    });

    // Soft delete each record
    for (const record of recordsToDelete) {
      const deletedRecord = { ...(record as any), deleted_at: new Date().toISOString() };
      await indexedDB.put(table, deletedRecord);

      // Add to sync queue
      await this.addToSyncQueue(table, (record as any).id, 'delete', { deleted_at: deletedRecord.deleted_at });
    }

    return recordsToDelete;
  }

  private async addToSyncQueue(table: string, recordId: string, action: string, data: any): Promise<void> {
    const syncItem = {
      id: crypto.randomUUID(),
      table_name: table,
      record_id: recordId,
      action,
      data,
      synced: false,
      created_at: new Date().toISOString(),
    };

    await indexedDB.put('sync_queue', syncItem);
  }

  // Convenience methods mirroring Supabase API
  select<T>(table: string): LocalSelectBuilder<T> {
    return new LocalSelectBuilder<T>(table, this);
  }

  insert(table: string, data: any): Promise<LocalApiResponse<any>> {
    return this.executeQuery({ type: 'insert', table, data });
  }

  update(table: string, data: any, filters: Record<string, any>): Promise<LocalApiResponse<any>> {
    return this.executeQuery({ type: 'update', table, data, filters });
  }

  delete(table: string, filters: Record<string, any>): Promise<LocalApiResponse<any>> {
    return this.executeQuery({ type: 'delete', table, filters });
  }

  // Sync queue methods
  async getPendingSyncItems(): Promise<any[]> {
    await indexedDB.init();
    const allItems = await indexedDB.getAll('sync_queue');
    return allItems.filter((item: any) => !item.synced);
  }

  async markSyncItemAsSynced(id: string): Promise<void> {
    await indexedDB.init();
    const item = await indexedDB.get('sync_queue', id);
    if (item) {
      (item as any).synced = true;
      (item as any).synced_at = new Date().toISOString();
      await indexedDB.put('sync_queue', item);
    }
  }
}

class LocalSelectBuilder<T> {
  private table: string;
  private api: LocalApi;
  private filters: Record<string, any> = {};
  private orderBy?: string;
  private ascending = true;
  private limitCount?: number;

  constructor(table: string, api: LocalApi) {
    this.table = table;
    this.api = api;
  }

  eq(column: string, value: any): this {
    this.filters[column] = value;
    return this;
  }

  not(column: string, value: any): this {
    // This is a simplified implementation
    // In a real implementation, you'd need to handle this differently
    return this;
  }

  is(column: string, value: any): this {
    this.filters[column] = value;
    return this;
  }

  order(column: string, ascending: boolean = true): this {
    this.orderBy = column;
    this.ascending = ascending;
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  async execute(): Promise<LocalApiResponse<T>> {
    return (this.api as any).executeQuery({
      type: 'select',
      table: this.table,
      filters: this.filters,
      orderBy: this.orderBy,
      ascending: this.ascending,
      limit: this.limitCount,
    });
  }
}

// Singleton instance
export const localApi = new LocalApi();
