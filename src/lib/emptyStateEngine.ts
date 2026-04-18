/**
 * Empty State Engine
 * Show fallback UI for empty category/sub/micro/nano with suggestions
 */

import { supabase } from '@/lib/supabase';

export interface EmptyStateConfig {
  title: string;
  description: string;
  icon?: string;
  suggestions?: Array<{ label: string; action: string }>;
  showRelatedCategories?: boolean;
}

export interface EmptyStateContext {
  type: 'category' | 'sub' | 'micro' | 'nano' | 'products';
  entityName?: string;
  entityId?: string;
}

/**
 * Get empty state configuration for a given context
 */
export async function getEmptyStateConfig(context: EmptyStateContext): Promise<EmptyStateConfig> {
  switch (context.type) {
    case 'category':
      return getCategoryEmptyState(context.entityName);
    case 'sub':
      return getSubCategoryEmptyState(context.entityName);
    case 'micro':
      return getMicroCategoryEmptyState(context.entityName);
    case 'nano':
      return getNanoCategoryEmptyState(context.entityName);
    case 'products':
      return getProductsEmptyState();
    default:
      return getDefaultEmptyState();
  }
}

/**
 * Get empty state for category
 */
function getCategoryEmptyState(categoryName?: string): EmptyStateConfig {
  return {
    title: categoryName ? `No products in ${categoryName}` : 'No products found',
    description: categoryName
      ? `There are currently no products available in the ${categoryName} category.`
      : 'There are currently no products available.',
    icon: '📦',
    suggestions: [
      { label: 'Browse all products', action: '/marketplace' },
      { label: 'Check other categories', action: '/marketplace' },
    ],
    showRelatedCategories: true,
  };
}

/**
 * Get empty state for sub-category
 */
function getSubCategoryEmptyState(subCategoryName?: string): EmptyStateConfig {
  return {
    title: subCategoryName ? `No products in ${subCategoryName}` : 'No products found',
    description: subCategoryName
      ? `There are currently no products available in the ${subCategoryName} sub-category.`
      : 'There are currently no products available in this sub-category.',
    icon: '📦',
    suggestions: [
      { label: 'Browse parent category', action: '/marketplace' },
      { label: 'Check other sub-categories', action: '/marketplace' },
    ],
    showRelatedCategories: true,
  };
}

/**
 * Get empty state for micro-category
 */
function getMicroCategoryEmptyState(microCategoryName?: string): EmptyStateConfig {
  return {
    title: microCategoryName ? `No products in ${microCategoryName}` : 'No products found',
    description: microCategoryName
      ? `There are currently no products available in the ${microCategoryName} micro-category.`
      : 'There are currently no products available in this micro-category.',
    icon: '📦',
    suggestions: [
      { label: 'Browse parent sub-category', action: '/marketplace' },
      { label: 'Check other micro-categories', action: '/marketplace' },
    ],
    showRelatedCategories: true,
  };
}

/**
 * Get empty state for nano-category
 */
function getNanoCategoryEmptyState(nanoCategoryName?: string): EmptyStateConfig {
  return {
    title: nanoCategoryName ? `No products in ${nanoCategoryName}` : 'No products found',
    description: nanoCategoryName
      ? `There are currently no products available in the ${nanoCategoryName} nano-category.`
      : 'There are currently no products available in this nano-category.',
    icon: '📦',
    suggestions: [
      { label: 'Browse parent micro-category', action: '/marketplace' },
      { label: 'Check other nano-categories', action: '/marketplace' },
    ],
    showRelatedCategories: true,
  };
}

/**
 * Get empty state for products
 */
function getProductsEmptyState(): EmptyStateConfig {
  return {
    title: 'No products found',
    description: 'There are currently no products available. Please check back later.',
    icon: '📦',
    suggestions: [
      { label: 'Clear filters', action: '/marketplace' },
      { label: 'Browse all categories', action: '/marketplace' },
    ],
    showRelatedCategories: true,
  };
}

/**
 * Get default empty state
 */
function getDefaultEmptyState(): EmptyStateConfig {
  return {
    title: 'Nothing found',
    description: 'No results were found for your request.',
    icon: '🔍',
    suggestions: [
      { label: 'Go to homepage', action: '/' },
      { label: 'Browse marketplace', action: '/marketplace' },
    ],
    showRelatedCategories: false,
  };
}

/**
 * Get related categories for suggestions
 */
export async function getRelatedCategories(limit: number = 5): Promise<Array<{ slug: string; name: string; productCount?: number }>> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name')
      .limit(limit);

    if (error || !data) {
      return [];
    }

    // Get product count for each category
    const categoriesWithCounts = await Promise.all(
      (data as any[]).map(async (category) => {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('is_active', true)
          .is('deleted_at', null);

        return {
          slug: category.slug,
          name: category.name,
          productCount: count || 0,
        };
      })
    );

    // Sort by product count
    categoriesWithCounts.sort((a, b) => (b.productCount || 0) - (a.productCount || 0));

    return categoriesWithCounts.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get popular categories for empty state
 */
export async function getPopularCategories(limit: number = 3): Promise<Array<{ slug: string; name: string }>> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name')
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data as Array<{ slug: string; name: string }>;
  } catch {
    return [];
  }
}

/**
 * Get suggested products for empty state
 */
export async function getSuggestedProducts(limit: number = 5): Promise<Array<{ id: string; name: string; slug: string; price: number }>> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, price')
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data as Array<{ id: string; name: string; slug: string; price: number }>;
  } catch {
    return [];
  }
}

/**
 * Check if a context is empty (no products)
 */
export async function isContextEmpty(context: EmptyStateContext): Promise<boolean> {
  try {
    let query;

    switch (context.type) {
      case 'category':
        if (context.entityId) {
          query = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', context.entityId)
            .eq('is_active', true)
            .is('deleted_at', null);
        } else {
          query = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true)
            .is('deleted_at', null);
        }
        break;
      case 'sub':
        if (context.entityId) {
          query = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('sub_category_id', context.entityId)
            .eq('is_active', true)
            .is('deleted_at', null);
        }
        break;
      case 'micro':
        if (context.entityId) {
          query = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('micro_category_id', context.entityId)
            .eq('is_active', true)
            .is('deleted_at', null);
        }
        break;
      case 'nano':
        if (context.entityId) {
          query = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('nano_category_id', context.entityId)
            .eq('is_active', true)
            .is('deleted_at', null);
        }
        break;
      case 'products':
        query = supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .is('deleted_at', null);
        break;
      default:
        return false;
    }

    if (!query) return false;

    const { count } = await query;
    return (count || 0) === 0;
  } catch {
    return false;
  }
}

/**
 * React hook for empty state
 */
export function useEmptyState(context: EmptyStateContext) {
  const [isEmpty, setIsEmpty] = React.useState(false);
  const [config, setConfig] = React.useState<EmptyStateConfig>(getDefaultEmptyState());
  const [relatedCategories, setRelatedCategories] = React.useState<Array<{ slug: string; name: string }>>([]);
  const [suggestedProducts, setSuggestedProducts] = React.useState<Array<{ id: string; name: string; slug: string; price: number }>>([]);

  React.useEffect(() => {
    isContextEmpty(context).then(async (empty) => {
      setIsEmpty(empty);
      if (empty) {
        const config = await getEmptyStateConfig(context);
        setConfig(config);

        if (config.showRelatedCategories) {
          const [categories, products] = await Promise.all([
            getRelatedCategories(5),
            getSuggestedProducts(5),
          ]);
          setRelatedCategories(categories);
          setSuggestedProducts(products);
        }
      }
    });
  }, [context]);

  return {
    isEmpty,
    config,
    relatedCategories,
    suggestedProducts,
  };
}

import React from 'react';
