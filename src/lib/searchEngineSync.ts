/**
 * Search Engine Hard Sync
 * Ensure search results match DB truth for category hierarchy
 */

import { supabase } from '@/lib/supabase';

export interface SearchSyncResult {
  synced: boolean;
  mismatches: number;
  fixed: number;
  errors: string[];
  timestamp: string;
}

export interface ProductSearchData {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  sub_category_id?: string;
  micro_category_id?: string;
  nano_category_id?: string;
  category_name?: string;
  sub_category_name?: string;
  micro_category_name?: string;
  nano_category_name?: string;
}

/**
 * Sync product search data with category hierarchy
 */
export async function syncProductSearchData(): Promise<SearchSyncResult> {
  const errors: string[] = [];
  let mismatches = 0;
  let fixed = 0;

  try {
    // Get all products with category information
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        category_id,
        sub_category_id,
        micro_category_id,
        nano_category_id,
        categories!inner (
          id,
          name,
          slug
        ),
        sub_categories!left (
          id,
          name,
          slug
        ),
        micro_categories!left (
          id,
          name,
          slug
        ),
        nano_categories!left (
          id,
          name,
          slug
        )
      `)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (productsError) {
      errors.push(`Failed to fetch products: ${productsError.message}`);
      return {
        synced: false,
        mismatches,
        fixed,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

    if (!products || products.length === 0) {
      return {
        synced: true,
        mismatches,
        fixed,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

    // Validate each product's category hierarchy
    for (const product of products as any[]) {
      const productData: ProductSearchData = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        category_id: product.category_id,
        sub_category_id: product.sub_category_id,
        micro_category_id: product.micro_category_id,
        nano_category_id: product.nano_category_id,
        category_name: product.categories?.name,
        sub_category_name: product.sub_categories?.name,
        micro_category_name: product.micro_categories?.name,
        nano_category_name: product.nano_categories?.name,
      };

      // Validate category hierarchy
      const validation = await validateProductCategoryHierarchy(productData);

      if (!validation.valid) {
        mismatches++;
        
        // Attempt to fix mismatches
        if (validation.fixable) {
          const fixResult = await fixProductCategoryHierarchy(productData, validation.corrections);
          if (fixResult.fixed) {
            fixed++;
          } else {
            errors.push(`Failed to fix product ${product.id}: ${fixResult.error}`);
          }
        } else {
          errors.push(`Product ${product.id}: ${validation.error}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    synced: errors.length === 0,
    mismatches,
    fixed,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate product category hierarchy
 */
async function validateProductCategoryHierarchy(
  product: ProductSearchData
): Promise<{ valid: boolean; error?: string; fixable: boolean; corrections?: any }> {
  // Validate category exists
  if (!product.category_id) {
    return {
      valid: false,
      error: 'Product has no category',
      fixable: false,
    };
  }

  // Validate sub-category hierarchy
  if (product.sub_category_id) {
    const { data: subCategory } = await supabase
      .from('sub_categories')
      .select('parent_id')
      .eq('id', product.sub_category_id)
      .maybeSingle();

    if (!subCategory) {
      return {
        valid: false,
        error: 'Sub-category does not exist',
        fixable: true,
        corrections: { sub_category_id: null },
      };
    }

    if (subCategory.parent_id !== product.category_id) {
      return {
        valid: false,
        error: 'Sub-category does not belong to product category',
        fixable: true,
        corrections: { sub_category_id: null },
      };
    }
  }

  // Validate micro-category hierarchy
  if (product.micro_category_id) {
    if (!product.sub_category_id) {
      return {
        valid: false,
        error: 'Micro-category requires sub-category',
        fixable: true,
        corrections: { micro_category_id: null },
      };
    }

    const { data: microCategory } = await supabase
      .from('micro_categories')
      .select('parent_id')
      .eq('id', product.micro_category_id)
      .maybeSingle();

    if (!microCategory) {
      return {
        valid: false,
        error: 'Micro-category does not exist',
        fixable: true,
        corrections: { micro_category_id: null },
      };
    }

    if (microCategory.parent_id !== product.sub_category_id) {
      return {
        valid: false,
        error: 'Micro-category does not belong to sub-category',
        fixable: true,
        corrections: { micro_category_id: null },
      };
    }
  }

  // Validate nano-category hierarchy
  if (product.nano_category_id) {
    if (!product.micro_category_id) {
      return {
        valid: false,
        error: 'Nano-category requires micro-category',
        fixable: true,
        corrections: { nano_category_id: null },
      };
    }

    const { data: nanoCategory } = await supabase
      .from('nano_categories')
      .select('parent_id')
      .eq('id', product.nano_category_id)
      .maybeSingle();

    if (!nanoCategory) {
      return {
        valid: false,
        error: 'Nano-category does not exist',
        fixable: true,
        corrections: { nano_category_id: null },
      };
    }

    if (nanoCategory.parent_id !== product.micro_category_id) {
      return {
        valid: false,
        error: 'Nano-category does not belong to micro-category',
        fixable: true,
        corrections: { nano_category_id: null },
      };
    }
  }

  return { valid: true, fixable: false };
}

/**
 * Fix product category hierarchy
 */
async function fixProductCategoryHierarchy(
  product: ProductSearchData,
  corrections: any
): Promise<{ fixed: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('products')
      .update(corrections)
      .eq('id', product.id);

    if (error) {
      return {
        fixed: false,
        error: error.message,
      };
    }

    return { fixed: true };
  } catch (error) {
    return {
      fixed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Rebuild category hierarchy index
 */
export async function rebuildCategoryHierarchyIndex(): Promise<SearchSyncResult> {
  const errors: string[] = [];
  let fixed = 0;

  try {
    // Clear existing index
    const { error: deleteError } = await supabase
      .from('category_hierarchy_index')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except dummy

    if (deleteError) {
      errors.push(`Failed to clear index: ${deleteError.message}`);
    }

    // Get all products with category information
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, category_id, sub_category_id, micro_category_id, nano_category_id')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (productsError) {
      errors.push(`Failed to fetch products: ${productsError.message}`);
      return {
        synced: false,
        mismatches: 0,
        fixed,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

    if (!products || products.length === 0) {
      return {
        synced: true,
        mismatches: 0,
        fixed,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

    // Build index entries
    const indexEntries = products.map((product: any) => ({
      category_id: product.category_id,
      sub_category_id: product.sub_category_id,
      micro_category_id: product.micro_category_id,
      nano_category_id: product.nano_category_id,
      product_id: product.id,
    }));

    // Insert index entries in batches
    const batchSize = 100;
    for (let i = 0; i < indexEntries.length; i += batchSize) {
      const batch = indexEntries.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('category_hierarchy_index')
        .insert(batch);

      if (insertError) {
        errors.push(`Failed to insert index batch ${i / batchSize}: ${insertError.message}`);
      } else {
        fixed += batch.length;
      }
    }
  } catch (error) {
    errors.push(`Index rebuild error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    synced: errors.length === 0,
    mismatches: 0,
    fixed,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate search index integrity
 */
export async function validateSearchIndexIntegrity(): Promise<{
  valid: boolean;
  totalProducts: number;
  indexedProducts: number;
  missingProducts: number;
  orphanedIndexEntries: number;
}> {
  try {
    // Get total active products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('deleted_at', null);

    // Get total indexed products
    const { count: indexedProducts } = await supabase
      .from('category_hierarchy_index')
      .select('*', { count: 'exact', head: true });

    const missingProducts = (totalProducts || 0) - (indexedProducts || 0);
    const orphanedIndexEntries = Math.max(0, (indexedProducts || 0) - (totalProducts || 0));

    return {
      valid: missingProducts === 0 && orphanedIndexEntries === 0,
      totalProducts: totalProducts || 0,
      indexedProducts: indexedProducts || 0,
      missingProducts,
      orphanedIndexEntries,
    };
  } catch (error) {
    console.error('Error validating search index integrity:', error);
    return {
      valid: false,
      totalProducts: 0,
      indexedProducts: 0,
      missingProducts: 0,
      orphanedIndexEntries: 0,
    };
  }
}

/**
 * Schedule periodic search sync
 */
export function scheduleSearchSync(intervalMs: number = 3600000): () => void {
  // 1 hour default
  const interval = setInterval(async () => {
    console.log('Running search engine sync...');
    const result = await syncProductSearchData();
    console.log(`Search sync complete: ${result.synced ? 'synced' : 'errors'}`);
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}
