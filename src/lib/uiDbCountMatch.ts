/**
 * UI ↔ DB Count Match
 * Assert UI product count == DB count
 */

import { supabase } from '@/lib/supabase';

export interface CountMatchResult {
  uiCount: number;
  dbCount: number;
  match: boolean;
  difference: number;
  timestamp: string;
}

export interface CountMismatchDetails {
  table: string;
  uiCount: number;
  dbCount: number;
  difference: number;
  percentage: number;
}

/**
 * Get actual DB count for products
 */
export async function getDbProductCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('deleted_at', null);

    if (error) {
      console.error('Error getting DB product count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting DB product count:', error);
    return 0;
  }
}

/**
 * Get actual DB count for a specific table
 */
export async function getDbCount(table: string, filters?: Record<string, any>): Promise<number> {
  try {
    let query = supabase.from(table).select('*', { count: 'exact', head: true });

    // Apply filters if provided
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      });
    }

    const { count, error } = await query;

    if (error) {
      console.error(`Error getting DB count for ${table}:`, error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error(`Error getting DB count for ${table}:`, error);
    return 0;
  }
}

/**
 * Compare UI count with DB count for products
 */
export async function compareProductCounts(uiCount: number): Promise<CountMatchResult> {
  const dbCount = await getDbProductCount();
  const match = uiCount === dbCount;
  const difference = Math.abs(uiCount - dbCount);

  return {
    uiCount,
    dbCount,
    match,
    difference,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Compare UI count with DB count for any table
 */
export async function compareCounts(table: string, uiCount: number, filters?: Record<string, any>): Promise<CountMatchResult> {
  const dbCount = await getDbCount(table, filters);
  const match = uiCount === dbCount;
  const difference = Math.abs(uiCount - dbCount);

  return {
    uiCount,
    dbCount,
    match,
    difference,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get detailed count mismatch information
 */
export async function getCountMismatchDetails(uiCounts: Record<string, number>): Promise<CountMismatchDetails[]> {
  const details: CountMismatchDetails[] = [];

  const tables = Object.keys(uiCounts);

  for (const table of tables) {
    const uiCount = uiCounts[table];
    const dbCount = await getDbCount(table);
    const difference = Math.abs(uiCount - dbCount);
    const percentage = dbCount > 0 ? (difference / dbCount) * 100 : 0;

    details.push({
      table,
      uiCount,
      dbCount,
      difference,
      percentage,
    });
  }

  return details;
}

/**
 * Assert count match and throw error if mismatch exceeds threshold
 */
export function assertCountMatch(
  result: CountMatchResult,
  thresholdPercentage: number = 5
): { passed: boolean; error?: string } {
  if (!result.match) {
    const percentage = result.dbCount > 0 ? (result.difference / result.dbCount) * 100 : 0;

    if (percentage > thresholdPercentage) {
      return {
        passed: false,
        error: `Count mismatch: UI=${result.uiCount}, DB=${result.dbCount}, difference=${result.difference} (${percentage.toFixed(2)}%)`,
      };
    }
  }

  return { passed: true };
}

/**
 * Log count mismatch to audit logs
 */
export async function logCountMismatch(
  table: string,
  uiCount: number,
  dbCount: number,
  context?: string
): Promise<void> {
  try {
    await (supabase as any).from('audit_logs').insert({
      action: 'COUNT_MISMATCH',
      table_name: table,
      details: {
        ui_count: uiCount,
        db_count: dbCount,
        difference: Math.abs(uiCount - dbCount),
        context,
      },
    });
  } catch (error) {
    console.error('Failed to log count mismatch:', error);
  }
}

/**
 * Validate all critical table counts
 */
export async function validateCriticalCounts(uiCounts: {
  products: number;
  categories: number;
  orders?: number;
}): Promise<{
  valid: boolean;
  mismatches: CountMismatchDetails[];
  summary: string;
}> {
  const mismatches: CountMismatchDetails[] = [];

  // Validate products count
  const productResult = await compareCounts('products', uiCounts.products, {
    is_active: true,
    deleted_at: null,
  });

  if (!productResult.match) {
    mismatches.push({
      table: 'products',
      uiCount: productResult.uiCount,
      dbCount: productResult.dbCount,
      difference: productResult.difference,
      percentage: productResult.dbCount > 0 ? (productResult.difference / productResult.dbCount) * 100 : 0,
    });
  }

  // Validate categories count
  const categoryResult = await compareCounts('categories', uiCounts.categories, {
    deleted_at: null,
  });

  if (!categoryResult.match) {
    mismatches.push({
      table: 'categories',
      uiCount: categoryResult.uiCount,
      dbCount: categoryResult.dbCount,
      difference: categoryResult.difference,
      percentage: categoryResult.dbCount > 0 ? (categoryResult.difference / categoryResult.dbCount) * 100 : 0,
    });
  }

  // Validate orders count if provided
  if (uiCounts.orders !== undefined) {
    const orderResult = await compareCounts('orders', uiCounts.orders, {
      deleted_at: null,
    });

    if (!orderResult.match) {
      mismatches.push({
        table: 'orders',
        uiCount: orderResult.uiCount,
        dbCount: orderResult.dbCount,
        difference: orderResult.difference,
        percentage: orderResult.dbCount > 0 ? (orderResult.difference / orderResult.dbCount) * 100 : 0,
      });
    }
  }

  const valid = mismatches.length === 0;
  const summary = valid
    ? 'All counts match'
    : `${mismatches.length} count mismatch(es) detected`;

  return {
    valid,
    mismatches,
    summary,
  };
}

/**
 * Schedule periodic count validation
 */
export function scheduleCountValidation(
  uiCounts: () => Promise<{ products: number; categories: number; orders?: number }>,
  intervalMs: number = 300000
): () => void {
  // 5 minutes default
  const interval = setInterval(async () => {
    try {
      const currentUiCounts = await uiCounts();
      const validation = await validateCriticalCounts(currentUiCounts);

      if (!validation.valid) {
        console.warn('Count validation failed:', validation.summary);
        // Log mismatches to audit logs
        for (const mismatch of validation.mismatches) {
          await logCountMismatch(
            mismatch.table,
            mismatch.uiCount,
            mismatch.dbCount,
            'Periodic validation'
          );
        }
      }
    } catch (error) {
      console.error('Error during count validation:', error);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}
