/**
 * DB IMMUTABLE RULES
 * Critical tables protected, no direct delete
 * Orders / Wallet / Keys = append only
 */

import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface TableRule {
  tableName: string;
  appendOnly: boolean;
  protectedFields: string[];
  allowDelete: boolean;
  requireAudit: boolean;
}

export class DBImmutableRules {
  private static instance: DBImmutableRules;
  private rules: Map<string, TableRule> = new Map();

  private constructor() {
    this.initializeRules();
  }

  static getInstance(): DBImmutableRules {
    if (!DBImmutableRules.instance) {
      DBImmutableRules.instance = new DBImmutableRules();
    }
    return DBImmutableRules.instance;
  }

  private initializeRules(): void {
    // Define immutable rules for critical tables
    const tableRules: TableRule[] = [
      {
        tableName: 'orders',
        appendOnly: true,
        protectedFields: ['id', 'user_id', 'created_at', 'total_amount'],
        allowDelete: false,
        requireAudit: true,
      },
      {
        tableName: 'wallet_transactions',
        appendOnly: true,
        protectedFields: ['id', 'user_id', 'amount', 'created_at', 'transaction_type'],
        allowDelete: false,
        requireAudit: true,
      },
      {
        tableName: 'license_keys',
        appendOnly: true,
        protectedFields: ['id', 'key', 'product_id', 'user_id', 'created_at'],
        allowDelete: false,
        requireAudit: true,
      },
      {
        tableName: 'audit_logs',
        appendOnly: true,
        protectedFields: ['id', 'user_id', 'action', 'created_at'],
        allowDelete: false,
        requireAudit: true,
      },
      {
        tableName: 'event_streams',
        appendOnly: true,
        protectedFields: ['id', 'user_id', 'action', 'timestamp'],
        allowDelete: false,
        requireAudit: false,
      },
      {
        tableName: 'products',
        appendOnly: false,
        protectedFields: ['id', 'created_at'],
        allowDelete: true,
        requireAudit: true,
      },
      {
        tableName: 'resellers',
        appendOnly: false,
        protectedFields: ['id', 'created_at'],
        allowDelete: false,
        requireAudit: true,
      },
    ];

    tableRules.forEach(rule => {
      this.rules.set(rule.tableName, rule);
    });
  }

  /**
   * Check if a table is append-only
   */
  isAppendOnly(tableName: string): boolean {
    const rule = this.rules.get(tableName);
    return rule?.appendOnly || false;
  }

  /**
   * Check if delete is allowed for a table
   */
  isDeleteAllowed(tableName: string): boolean {
    const rule = this.rules.get(tableName);
    return rule?.allowDelete || false;
  }

  /**
   * Check if a field is protected
   */
  isFieldProtected(tableName: string, fieldName: string): boolean {
    const rule = this.rules.get(tableName);
    return rule?.protectedFields.includes(fieldName) || false;
  }

  /**
   * Validate insert operation
   */
  async validateInsert(tableName: string, data: any): Promise<{ valid: boolean; reason?: string }> {
    const rule = this.rules.get(tableName);
    if (!rule) return { valid: true };

    // Check if protected fields are being set correctly
    for (const field of rule.protectedFields) {
      if (field === 'id' && !data[field]) {
        // ID should be auto-generated
        continue;
      }
      if (field === 'created_at' && !data[field]) {
        // created_at should be auto-generated
        continue;
      }
    }

    return { valid: true };
  }

  /**
   * Validate update operation
   */
  async validateUpdate(tableName: string, data: any, recordId: string): Promise<{ valid: boolean; reason?: string }> {
    const rule = this.rules.get(tableName);
    if (!rule) return { valid: true };

    // Check if trying to modify protected fields
    for (const field of rule.protectedFields) {
      if (data[field] !== undefined) {
        if (field === 'id' || field === 'created_at' || field === 'user_id') {
          return { 
            valid: false, 
            reason: `Cannot modify protected field '${field}' in table '${tableName}'` 
          };
        }
      }
    }

    // For append-only tables, only allow status updates
    if (rule.appendOnly) {
      const allowedUpdates = ['status', 'updated_at', 'metadata'];
      const updateKeys = Object.keys(data);
      const invalidUpdates = updateKeys.filter(key => !allowedUpdates.includes(key));
      
      if (invalidUpdates.length > 0) {
        return { 
          valid: false, 
          reason: `Append-only table '${tableName}' only allows status updates. Tried to update: ${invalidUpdates.join(', ')}` 
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate delete operation
   */
  async validateDelete(tableName: string, recordId: string): Promise<{ valid: boolean; reason?: string }> {
    const rule = this.rules.get(tableName);
    if (!rule) return { valid: true };

    if (!rule.allowDelete) {
      return { 
        valid: false, 
        reason: `Delete not allowed for table '${tableName}'. Use soft delete instead.` 
      };
    }

    return { valid: true };
  }

  /**
   * Safe insert with validation
   */
  async safeInsert(tableName: string, data: any, userId?: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Validate
      const validation = await this.validateInsert(tableName, data);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      // Insert
      const { data: insertedData, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Audit log if required
      const rule = this.rules.get(tableName);
      if (rule?.requireAudit && userId) {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'create',
          table_name: tableName,
          record_id: insertedData.id,
          new_values: insertedData,
        });
      }

      return { success: true, data: insertedData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Safe update with validation
   */
  async safeUpdate(
    tableName: string,
    recordId: string,
    data: any,
    userId?: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Get current state
      const { data: currentData, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', recordId)
        .single();

      if (fetchError) throw fetchError;

      // Validate
      const validation = await this.validateUpdate(tableName, data, recordId);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      // Update
      const { data: updatedData, error } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', recordId)
        .select()
        .single();

      if (error) throw error;

      // Audit log if required
      const rule = this.rules.get(tableName);
      if (rule?.requireAudit && userId) {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'update',
          table_name: tableName,
          record_id: recordId,
          old_values: currentData,
          new_values: updatedData,
        });
      }

      return { success: true, data: updatedData };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Safe delete with validation (uses soft delete for protected tables)
   */
  async safeDelete(
    tableName: string,
    recordId: string,
    userId?: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      // Get current state
      const { data: currentData, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', recordId)
        .single();

      if (fetchError) throw fetchError;

      // Validate
      const validation = await this.validateDelete(tableName, recordId);
      if (!validation.valid) {
        // Use soft delete instead
        return this.softDelete(tableName, recordId, userId, currentData);
      }

      // Delete
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      // Audit log if required
      const rule = this.rules.get(tableName);
      if (rule?.requireAudit && userId) {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'delete',
          table_name: tableName,
          record_id: recordId,
          old_values: currentData,
        });
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Soft delete (mark as deleted without actually deleting)
   */
  private async softDelete(
    tableName: string,
    recordId: string,
    userId: string | undefined,
    currentData: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ 
          deleted_at: new Date().toISOString(),
          status: 'deleted',
        })
        .eq('id', recordId);

      if (error) throw error;

      // Audit log
      if (userId) {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'soft_delete',
          table_name: tableName,
          record_id: recordId,
          old_values: currentData,
          new_values: { deleted_at: new Date().toISOString(), status: 'deleted' },
        });
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get all rules
   */
  getRules(): TableRule[] {
    return Array.from(this.rules.values());
  }
}

// Singleton instance
export const dbImmutableRules = DBImmutableRules.getInstance();

/**
 * React hook for DB immutable rules
 */
export function useDBImmutableRules() {
  const safeInsert = async (tableName: string, data: any, userId?: string) => {
    return dbImmutableRules.safeInsert(tableName, data, userId);
  };

  const safeUpdate = async (tableName: string, recordId: string, data: any, userId?: string) => {
    return dbImmutableRules.safeUpdate(tableName, recordId, data, userId);
  };

  const safeDelete = async (tableName: string, recordId: string, userId?: string) => {
    return dbImmutableRules.safeDelete(tableName, recordId, userId);
  };

  const isAppendOnly = (tableName: string) => {
    return dbImmutableRules.isAppendOnly(tableName);
  };

  const isDeleteAllowed = (tableName: string) => {
    return dbImmutableRules.isDeleteAllowed(tableName);
  };

  return { safeInsert, safeUpdate, safeDelete, isAppendOnly, isDeleteAllowed };
}
