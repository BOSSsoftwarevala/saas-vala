/**
 * Final Data Integrity Loop
 * CRON to detect orphan/mismatch, auto fix or log
 */

import { supabase } from '@/lib/supabase';

export interface IntegrityIssue {
  type: 'orphan' | 'mismatch' | 'invalid' | 'missing';
  table: string;
  recordId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoFixable: boolean;
}

export interface IntegrityReport {
  timestamp: string;
  totalIssues: number;
  issues: IntegrityIssue[];
  fixedCount: number;
  loggedCount: number;
}

/**
 * Detect orphan records in products table
 */
async function detectOrphanProducts(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    // Products without valid category
    const { data: orphanProducts, error } = await supabase
      .from('products')
      .select('id, name, category_id')
      .is('category_id', null);

    if (!error && orphanProducts) {
      orphanProducts.forEach((product: any) => {
        issues.push({
          type: 'orphan',
          table: 'products',
          recordId: product.id,
          description: `Product "${product.name}" has no category`,
          severity: 'high',
          autoFixable: false,
        });
      });
    }

    // Products with invalid category reference
    const { data: invalidCategoryProducts } = await supabase
      .from('products')
      .select('id, name, category_id')
      .not('category_id', 'is', null);

    if (invalidCategoryProducts) {
      const { data: categories } = await supabase.from('categories').select('id');
      const categoryIds = new Set(categories?.map((c: any) => c.id) || []);

      invalidCategoryProducts.forEach((product: any) => {
        if (!categoryIds.has(product.category_id)) {
          issues.push({
            type: 'invalid',
            table: 'products',
            recordId: product.id,
            description: `Product "${product.name}" has invalid category reference`,
            severity: 'high',
            autoFixable: false,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error detecting orphan products:', error);
  }

  return issues;
}

/**
 * Detect orphan records in orders table
 */
async function detectOrphanOrders(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    // Orders without valid user
    const { data: orphanOrders, error } = await supabase
      .from('orders')
      .select('id, user_id')
      .is('user_id', null);

    if (!error && orphanOrders) {
      orphanOrders.forEach((order: any) => {
        issues.push({
          type: 'orphan',
          table: 'orders',
          recordId: order.id,
          description: `Order has no user`,
          severity: 'critical',
          autoFixable: false,
        });
      });
    }

    // Orders without valid product
    const { data: ordersWithoutProduct } = await supabase
      .from('orders')
      .select('id, product_id');

    if (ordersWithoutProduct) {
      const { data: products } = await supabase.from('products').select('id');
      const productIds = new Set(products?.map((p: any) => p.id) || []);

      ordersWithoutProduct.forEach((order: any) => {
        if (!productIds.has(order.product_id)) {
          issues.push({
            type: 'invalid',
            table: 'orders',
            recordId: order.id,
            description: `Order has invalid product reference`,
            severity: 'high',
            autoFixable: false,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error detecting orphan orders:', error);
  }

  return issues;
}

/**
 * Detect orphan records in wallet_ledger table
 */
async function detectOrphanWalletLedger(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    // Wallet ledger entries without valid user
    const { data: orphanLedger, error } = await (supabase as any)
      .from('wallet_transactions')
      .select('id, wallet_id')
      .is('wallet_id', null);

    if (!error && orphanLedger) {
      orphanLedger.forEach((ledger: any) => {
        issues.push({
          type: 'orphan',
          table: 'wallet_transactions',
          recordId: ledger.id,
          description: `Wallet transaction has no wallet reference`,
          severity: 'high',
          autoFixable: false,
        });
      });
    }
  } catch (error) {
    console.error('Error detecting orphan wallet ledger:', error);
  }

  return issues;
}

/**
 * Detect orphan records in license_keys table
 */
async function detectOrphanLicenseKeys(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    // License keys without valid order
    const { data: orphanKeys, error } = await (supabase as any)
      .from('license_keys')
      .select('id, order_id')
      .is('order_id', null);

    if (!error && orphanKeys) {
      orphanKeys.forEach((key: any) => {
        issues.push({
          type: 'orphan',
          table: 'license_keys',
          recordId: key.id,
          description: `License key has no order reference`,
          severity: 'medium',
          autoFixable: false,
        });
      });
    }
  } catch (error) {
    console.error('Error detecting orphan license keys:', error);
  }

  return issues;
}

/**
 * Detect category hierarchy mismatches
 */
async function detectCategoryHierarchyMismatches(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    // Products with sub_category_id but no category_id
    const { data: products } = await supabase
      .from('products')
      .select('id, name, category_id, sub_category_id')
      .not('sub_category_id', 'is', null);

    if (products) {
      products.forEach((product: any) => {
        if (!product.category_id) {
          issues.push({
            type: 'mismatch',
            table: 'products',
            recordId: product.id,
            description: `Product has sub_category but no category`,
            severity: 'high',
            autoFixable: false,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error detecting category hierarchy mismatches:', error);
  }

  return issues;
}

/**
 * Detect inactive products that should be hidden
 */
async function detectInactiveProducts(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    // Check if is_active column exists and filter inactive products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, is_active')
      .eq('is_active', false);

    if (!error && products) {
      products.forEach((product: any) => {
        issues.push({
          type: 'invalid',
          table: 'products',
          recordId: product.id,
          description: `Product "${product.name}" is inactive`,
          severity: 'low',
          autoFixable: false,
        });
      });
    }
  } catch (error) {
    // is_active column might not exist yet
    console.log('is_active column check skipped (column might not exist)');
  }

  return issues;
}

/**
 * Detect soft-deleted records
 */
async function detectSoftDeletedRecords(): Promise<IntegrityIssue[]> {
  const issues: IntegrityIssue[] = [];

  try {
    const tables = ['products', 'orders', 'license_keys', 'categories'];

    for (const table of tables) {
      const { data: deletedRecords, error } = await supabase
        .from(table)
        .select('id')
        .not('deleted_at', 'is', null);

      if (!error && deletedRecords && deletedRecords.length > 0) {
        deletedRecords.forEach((record: any) => {
          issues.push({
            type: 'invalid',
            table,
            recordId: record.id,
            description: `Record is soft-deleted`,
            severity: 'low',
            autoFixable: false,
          });
        });
      }
    }
  } catch (error) {
    console.error('Error detecting soft-deleted records:', error);
  }

  return issues;
}

/**
 * Run full integrity check
 */
export async function runIntegrityCheck(): Promise<IntegrityReport> {
  const timestamp = new Date().toISOString();
  const allIssues: IntegrityIssue[] = [];

  // Run all checks
  const [
    orphanProducts,
    orphanOrders,
    orphanWalletLedger,
    orphanLicenseKeys,
    categoryMismatches,
    inactiveProducts,
    softDeletedRecords,
  ] = await Promise.all([
    detectOrphanProducts(),
    detectOrphanOrders(),
    detectOrphanWalletLedger(),
    detectOrphanLicenseKeys(),
    detectCategoryHierarchyMismatches(),
    detectInactiveProducts(),
    detectSoftDeletedRecords(),
  ]);

  allIssues.push(
    ...orphanProducts,
    ...orphanOrders,
    ...orphanWalletLedger,
    ...orphanLicenseKeys,
    ...categoryMismatches,
    ...inactiveProducts,
    ...softDeletedRecords
  );

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Log issues to audit_logs table
  let loggedCount = 0;
  for (const issue of allIssues) {
    if (issue.severity === 'critical' || issue.severity === 'high') {
      try {
        await (supabase as any).from('audit_logs').insert({
          action: 'INTEGRITY_ISSUE',
          table_name: issue.table,
          record_id: issue.recordId,
          details: {
            type: issue.type,
            description: issue.description,
            severity: issue.severity,
          },
        });
        loggedCount++;
      } catch (error) {
        console.error('Failed to log integrity issue:', error);
      }
    }
  }

  return {
    timestamp,
    totalIssues: allIssues.length,
    issues: allIssues,
    fixedCount: 0, // Auto-fix not implemented yet
    loggedCount,
  };
}

/**
 * Schedule periodic integrity checks
 */
export function scheduleIntegrityCheck(intervalMs: number = 3600000): () => void {
  // 1 hour default
  const interval = setInterval(async () => {
    console.log('Running data integrity check...');
    const report = await runIntegrityCheck();
    console.log(`Integrity check complete: ${report.totalIssues} issues found`);
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Get integrity summary
 */
export async function getIntegritySummary(): Promise<{
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}> {
  const report = await runIntegrityCheck();

  const summary = {
    totalIssues: report.totalIssues,
    critical: report.issues.filter(i => i.severity === 'critical').length,
    high: report.issues.filter(i => i.severity === 'high').length,
    medium: report.issues.filter(i => i.severity === 'medium').length,
    low: report.issues.filter(i => i.severity === 'low').length,
  };

  return summary;
}
