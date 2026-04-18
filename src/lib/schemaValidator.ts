/**
 * Schema Strict Mode Validator
 * Enforces database schema strict mode requirements:
 * - All columns NOT NULL where required
 * - ENUM for status (order/key/user)
 * - Foreign keys enforced
 * - No orphan rows possible
 */

import { supabase } from '@/lib/supabase';
import { eventLogger, EventType } from './eventLogger';

export enum SchemaViolationType {
  NULLABLE_REQUIRED_COLUMN = 'nullable_required_column',
  MISSING_ENUM = 'missing_enum',
  ORPHAN_ROW = 'orphan_row',
  MISSING_FOREIGN_KEY = 'missing_foreign_key',
  INVALID_DATA_TYPE = 'invalid_data_type',
}

export interface SchemaViolation {
  type: SchemaViolationType;
  table: string;
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

class SchemaValidator {
  private static instance: SchemaValidator;

  private constructor() {}

  static getInstance(): SchemaValidator {
    if (!SchemaValidator.instance) {
      SchemaValidator.instance = new SchemaValidator();
    }
    return SchemaValidator.instance;
  }

  /**
   * Validate the entire database schema against strict mode requirements
   */
  async validateSchema(): Promise<SchemaViolation[]> {
    const violations: SchemaViolation[] = [];

    eventLogger.logSystemEvent('Schema Validation Started');

    // Check for orphan rows in critical tables
    violations.push(...await this.checkOrphanRows());

    // Check for NULL values in required columns
    violations.push(...await this.checkRequiredColumns());

    // Check ENUM status fields
    violations.push(...await this.checkEnumStatusFields());

    // Check foreign key relationships
    violations.push(...await this.checkForeignKeys());

    // Log violations
    if (violations.length > 0) {
      eventLogger.logError('Schema Validation Failed', new Error(`${violations.length} violations found`));
    } else {
      eventLogger.logSystemEvent('Schema Validation Passed');
    }

    return violations;
  }

  /**
   * Check for orphan rows (rows with invalid foreign key references)
   */
  private async checkOrphanRows(): Promise<SchemaViolation[]> {
    const violations: SchemaViolation[] = [];

    // Check orders with invalid user references
    const { data: orphanOrders } = await supabase
      .from('marketplace_orders')
      .select('id, buyer_id')
      .not('buyer_id', 'is', null);

    if (orphanOrders && orphanOrders.length > 0) {
      // Verify each order has a valid user
      for (const order of orphanOrders) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('id', order.buyer_id)
          .single();

        if (!user) {
          violations.push({
            type: SchemaViolationType.ORPHAN_ROW,
            table: 'marketplace_orders',
            column: 'buyer_id',
            message: `Order ${order.id} has invalid buyer_id reference`,
            severity: 'error',
          });
        }
      }
    }

    // Check keys with invalid product references
    const { data: orphanKeys } = await supabase
      .from('license_keys')
      .select('id, product_id')
      .not('product_id', 'is', null);

    if (orphanKeys && orphanKeys.length > 0) {
      for (const key of orphanKeys) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('id', key.product_id)
          .single();

        if (!product) {
          violations.push({
            type: SchemaViolationType.ORPHAN_ROW,
            table: 'license_keys',
            column: 'product_id',
            message: `Key ${key.id} has invalid product_id reference`,
            severity: 'error',
          });
        }
      }
    }

    // Check wallets with invalid user references
    const { data: orphanWallets } = await supabase
      .from('wallets')
      .select('id, user_id')
      .not('user_id', 'is', null);

    if (orphanWallets && orphanWallets.length > 0) {
      for (const wallet of orphanWallets) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('id', wallet.user_id)
          .single();

        if (!user) {
          violations.push({
            type: SchemaViolationType.ORPHAN_ROW,
            table: 'wallets',
            column: 'user_id',
            message: `Wallet ${wallet.id} has invalid user_id reference`,
            severity: 'error',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check for NULL values in required columns
   */
  private async checkRequiredColumns(): Promise<SchemaViolation[]> {
    const violations: SchemaViolation[] = [];

    // Define required columns for critical tables
    const requiredColumns: Record<string, string[]> = {
      users: ['email', 'created_at'],
      marketplace_orders: ['buyer_id', 'product_id', 'amount', 'created_at'],
      license_keys: ['license_key', 'created_at'],
      products: ['name', 'price', 'created_at'],
      wallets: ['user_id', 'balance', 'created_at'],
    };

    for (const [table, columns] of Object.entries(requiredColumns)) {
      for (const column of columns) {
        const { data: nullRows } = await supabase
          .from(table as any)
          .select('id')
          .is(column, null)
          .limit(10);

        if (nullRows && nullRows.length > 0) {
          violations.push({
            type: SchemaViolationType.NULLABLE_REQUIRED_COLUMN,
            table,
            column,
            message: `${table}.${column} has NULL values but is required`,
            severity: 'error',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check ENUM status fields for valid values
   */
  private async checkEnumStatusFields(): Promise<SchemaViolation[]> {
    const violations: SchemaViolation[] = [];

    // Check order status
    const { data: invalidOrderStatus } = await supabase
      .from('marketplace_orders')
      .select('id, status')
      .not('status', 'in', '("pending","completed","cancelled","failed")');

    if (invalidOrderStatus && invalidOrderStatus.length > 0) {
      violations.push({
        type: SchemaViolationType.MISSING_ENUM,
        table: 'marketplace_orders',
        column: 'status',
        message: `Found ${invalidOrderStatus.length} orders with invalid status`,
        severity: 'warning',
      });
    }

    // Check key status
    const { data: invalidKeyStatus } = await supabase
      .from('license_keys')
      .select('id, status')
      .not('status', 'in', '("active","inactive","expired","revoked")');

    if (invalidKeyStatus && invalidKeyStatus.length > 0) {
      violations.push({
        type: SchemaViolationType.MISSING_ENUM,
        table: 'license_keys',
        column: 'status',
        message: `Found ${invalidKeyStatus.length} keys with invalid status`,
        severity: 'warning',
      });
    }

    return violations;
  }

  /**
   * Check foreign key relationships
   */
  private async checkForeignKeys(): Promise<SchemaViolation[]> {
    const violations: SchemaViolation[] = [];

    // This is a simplified check - in production, you'd query information_schema
    // to verify actual foreign key constraints exist

    // Check if orders have license_key_id that references valid keys
    const { data: ordersWithKeys } = await supabase
      .from('marketplace_orders')
      .select('id, license_key_id')
      .not('license_key_id', 'is', null);

    if (ordersWithKeys && ordersWithKeys.length > 0) {
      for (const order of ordersWithKeys) {
        const { data: key } = await supabase
          .from('license_keys')
          .select('id')
          .eq('id', order.license_key_id)
          .single();

        if (!key) {
          violations.push({
            type: SchemaViolationType.MISSING_FOREIGN_KEY,
            table: 'marketplace_orders',
            column: 'license_key_id',
            message: `Order ${order.id} references non-existent key ${order.license_key_id}`,
            severity: 'error',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Fix orphan rows by deleting them
   */
  async fixOrphanRows(): Promise<number> {
    let fixedCount = 0;

    // Delete orders with invalid buyer_id
    const { data: orphanOrders } = await supabase
      .from('marketplace_orders')
      .select('id, buyer_id');

    if (orphanOrders) {
      for (const order of orphanOrders) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('id', order.buyer_id)
          .single();

        if (!user) {
          await supabase.from('marketplace_orders').delete().eq('id', order.id);
          fixedCount++;
          eventLogger.logSystemEvent('Fixed Orphan Row', {
            table: 'marketplace_orders',
            id: order.id,
          });
        }
      }
    }

    // Delete keys with invalid product_id
    const { data: orphanKeys } = await supabase
      .from('license_keys')
      .select('id, product_id');

    if (orphanKeys) {
      for (const key of orphanKeys) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('id', key.product_id)
          .single();

        if (!product) {
          await supabase.from('license_keys').delete().eq('id', key.id);
          fixedCount++;
          eventLogger.logSystemEvent('Fixed Orphan Row', {
            table: 'license_keys',
            id: key.id,
          });
        }
      }
    }

    return fixedCount;
  }

  /**
   * Generate a schema validation report
   */
  async generateReport(): Promise<string> {
    const violations = await this.validateSchema();
    
    const report = {
      timestamp: new Date().toISOString(),
      totalViolations: violations.length,
      errors: violations.filter(v => v.severity === 'error'),
      warnings: violations.filter(v => v.severity === 'warning'),
      violations: violations,
    };

    return JSON.stringify(report, null, 2);
  }
}

// Export singleton instance
export const schemaValidator = SchemaValidator.getInstance();

// Export helper functions
export const validateSchema = () => schemaValidator.validateSchema();
export const fixOrphanRows = () => schemaValidator.fixOrphanRows();
export const generateSchemaReport = () => schemaValidator.generateReport();
