/**
 * Auto Fallback Navigation
 * Redirect to nearest valid parent on invalid route
 */

import { supabase } from '@/lib/supabase';

export interface NavigationFallbackResult {
  shouldRedirect: boolean;
  redirectPath?: string;
  reason?: string;
}

/**
 * Check if a category slug is valid
 */
async function isCategorySlugValid(slug: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Check if a sub-category slug is valid
 */
async function isSubCategorySlugValid(slug: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Check if a micro-category slug is valid
 */
async function isMicroCategorySlugValid(slug: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('micro_categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Check if a nano-category slug is valid
 */
async function isNanoCategorySlugValid(slug: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('nano_categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Get nearest valid parent for category route
 */
export async function getNearestValidParent(
  categorySlug?: string,
  subSlug?: string,
  microSlug?: string,
  nanoSlug?: string
): Promise<NavigationFallbackResult> {
  // If no category provided, redirect to marketplace
  if (!categorySlug) {
    return {
      shouldRedirect: true,
      redirectPath: '/marketplace',
      reason: 'No category provided',
    };
  }

  // Check if category is valid
  const categoryValid = await isCategorySlugValid(categorySlug);
  if (!categoryValid) {
    return {
      shouldRedirect: true,
      redirectPath: '/marketplace',
      reason: 'Invalid category slug',
    };
  }

  // If no sub-category, category is valid
  if (!subSlug) {
    return {
      shouldRedirect: false,
    };
  }

  // Check if sub-category is valid
  const subValid = await isSubCategorySlugValid(subSlug);
  if (!subValid) {
    return {
      shouldRedirect: true,
      redirectPath: `/marketplace/${categorySlug}`,
      reason: 'Invalid sub-category slug',
    };
  }

  // If no micro-category, sub-category is valid
  if (!microSlug) {
    return {
      shouldRedirect: false,
    };
  }

  // Check if micro-category is valid
  const microValid = await isMicroCategorySlugValid(microSlug);
  if (!microValid) {
    return {
      shouldRedirect: true,
      redirectPath: `/marketplace/${categorySlug}/${subSlug}`,
      reason: 'Invalid micro-category slug',
    };
  }

  // If no nano-category, micro-category is valid
  if (!nanoSlug) {
    return {
      shouldRedirect: false,
    };
  }

  // Check if nano-category is valid
  const nanoValid = await isNanoCategorySlugValid(nanoSlug);
  if (!nanoValid) {
    return {
      shouldRedirect: true,
      redirectPath: `/marketplace/${categorySlug}/${subSlug}/${microSlug}`,
      reason: 'Invalid nano-category slug',
    };
  }

  // All valid
  return {
    shouldRedirect: false,
  };
}

/**
 * Validate route and get fallback if needed
 */
export async function validateRouteWithFallback(
  path: string
): Promise<NavigationFallbackResult> {
  // Parse the path
  const parts = path.split('/').filter(Boolean);

  if (parts[0] !== 'marketplace') {
    return {
      shouldRedirect: false,
    };
  }

  const categorySlug = parts[1];
  const subSlug = parts[2];
  const microSlug = parts[3];
  const nanoSlug = parts[4];

  return getNearestValidParent(categorySlug, subSlug, microSlug, nanoSlug);
}

/**
 * Get suggested categories for invalid route
 */
export async function getSuggestedCategories(limit: number = 5): Promise<Array<{ slug: string; name: string }>> {
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
 * Get suggested sub-categories for a category
 */
export async function getSuggestedSubCategories(
  categorySlug: string,
  limit: number = 5
): Promise<Array<{ slug: string; name: string }>> {
  try {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .maybeSingle();

    if (!category) {
      return [];
    }

    const { data, error } = await supabase
      .from('sub_categories')
      .select('slug, name')
      .eq('parent_id', category.id)
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
 * Perform auto fallback navigation
 */
export async function performAutoFallback(
  categorySlug?: string,
  subSlug?: string,
  microSlug?: string,
  nanoSlug?: string
): Promise<string | null> {
  const result = await getNearestValidParent(categorySlug, subSlug, microSlug, nanoSlug);

  if (result.shouldRedirect && result.redirectPath) {
    return result.redirectPath;
  }

  return null;
}

/**
 * Hook for auto fallback navigation in React components
 */
export function useAutoFallbackNavigation(
  categorySlug?: string,
  subSlug?: string,
  microSlug?: string,
  nanoSlug?: string
) {
  const [fallbackResult, setFallbackResult] = React.useState<NavigationFallbackResult>({
    shouldRedirect: false,
  });

  React.useEffect(() => {
    getNearestValidParent(categorySlug, subSlug, microSlug, nanoSlug).then(setFallbackResult);
  }, [categorySlug, subSlug, microSlug, nanoSlug]);

  return fallbackResult;
}

import React from 'react';
