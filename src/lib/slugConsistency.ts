/**
 * Slug Consistency Utility
 * Ensures route params match database slugs with auto-redirect on mismatch
 */

import { supabase } from '@/lib/supabase';

export interface CategorySlug {
  id: string;
  slug: string;
  name: string;
  level: 'category' | 'sub' | 'micro' | 'nano';
}

/**
 * Validate and correct category slug from route parameter
 * @param slug The slug from route parameter
 * @param level The category level ('category' | 'sub' | 'micro' | 'nano')
 * @returns The correct slug (either original or corrected)
 */
export async function validateCategorySlug(
  slug: string,
  level: 'category' | 'sub' | 'micro' | 'nano'
): Promise<{ valid: boolean; correctSlug?: string; categoryId?: string }> {
  if (!slug || slug.trim() === '') {
    return { valid: false };
  }

  try {
    let query;
    switch (level) {
      case 'category':
        query = supabase.from('categories').select('id, slug, name').eq('slug', slug).maybeSingle();
        break;
      case 'sub':
        query = supabase.from('sub_categories').select('id, slug, name').eq('slug', slug).maybeSingle();
        break;
      case 'micro':
        query = supabase.from('micro_categories').select('id, slug, name').eq('slug', slug).maybeSingle();
        break;
      case 'nano':
        query = supabase.from('nano_categories').select('id, slug, name').eq('slug', slug).maybeSingle();
        break;
      default:
        return { valid: false };
    }

    const { data, error } = await query;

    if (error || !data) {
      // Slug not found in database
      return { valid: false };
    }

    // Slug exists and matches
    return { valid: true, correctSlug: data.slug, categoryId: data.id };
  } catch (error) {
    console.error('Error validating category slug:', error);
    return { valid: false };
  }
}

/**
 * Get correct slug by category ID
 * @param categoryId The category ID
 * @param level The category level
 * @returns The correct slug
 */
export async function getSlugByCategoryId(
  categoryId: string,
  level: 'category' | 'sub' | 'micro' | 'nano'
): Promise<string | null> {
  if (!categoryId) return null;

  try {
    let query;
    switch (level) {
      case 'category':
        query = supabase.from('categories').select('slug').eq('id', categoryId).maybeSingle();
        break;
      case 'sub':
        query = supabase.from('sub_categories').select('slug').eq('id', categoryId).maybeSingle();
        break;
      case 'micro':
        query = supabase.from('micro_categories').select('slug').eq('id', categoryId).maybeSingle();
        break;
      case 'nano':
        query = supabase.from('nano_categories').select('slug').eq('id', categoryId).maybeSingle();
        break;
      default:
        return null;
    }

    const { data, error } = await query;

    if (error || !data) {
      return null;
    }

    return data.slug;
  } catch (error) {
    console.error('Error getting slug by category ID:', error);
    return null;
  }
}

/**
 * Validate full category hierarchy slugs
 * @param categorySlug The category slug
 * @param subSlug The sub-category slug (optional)
 * @param microSlug The micro-category slug (optional)
 * @param nanoSlug The nano-category slug (optional)
 * @returns Object with validation results and correct slugs
 */
export async function validateCategoryHierarchy(
  categorySlug: string,
  subSlug?: string,
  microSlug?: string,
  nanoSlug?: string
): Promise<{
  valid: boolean;
  correctSlugs: {
    category?: string;
    sub?: string;
    micro?: string;
    nano?: string;
  };
}> {
  const correctSlugs: {
    category?: string;
    sub?: string;
    micro?: string;
    nano?: string;
  } = {};

  try {
    // Validate category
    const categoryResult = await validateCategorySlug(categorySlug, 'category');
    if (!categoryResult.valid) {
      return { valid: false, correctSlugs };
    }
    correctSlugs.category = categoryResult.correctSlug;

    // Validate sub-category if provided
    if (subSlug) {
      const subResult = await validateCategorySlug(subSlug, 'sub');
      if (!subResult.valid) {
        return { valid: false, correctSlugs };
      }
      correctSlugs.sub = subResult.correctSlug;
    }

    // Validate micro-category if provided
    if (microSlug) {
      const microResult = await validateCategorySlug(microSlug, 'micro');
      if (!microResult.valid) {
        return { valid: false, correctSlugs };
      }
      correctSlugs.micro = microResult.correctSlug;
    }

    // Validate nano-category if provided
    if (nanoSlug) {
      const nanoResult = await validateCategorySlug(nanoSlug, 'nano');
      if (!nanoResult.valid) {
        return { valid: false, correctSlugs };
      }
      correctSlugs.nano = nanoResult.correctSlug;
    }

    return { valid: true, correctSlugs };
  } catch (error) {
    console.error('Error validating category hierarchy:', error);
    return { valid: false, correctSlugs };
  }
}

/**
 * Generate slug from name
 * @param name The name to convert to slug
 * @returns The generated slug
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if slug matches expected format
 * @param slug The slug to validate
 * @returns True if slug is valid
 */
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length > 0;
}
