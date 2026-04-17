/**
 * Sub-Category System Manager
 * Deep hierarchy: Category → Sub Category → Micro Category
 * Auto connect products, SEO generation, validation
 */

import { supabase } from '@/integrations/supabase/client';
import { eventLogger, EventType } from './eventLogger';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  order: number;
  created_at?: string;
}

export interface SubCategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  order: number;
  created_at?: string;
}

export interface MicroCategory {
  id: string;
  sub_category_id: string;
  name: string;
  slug: string;
  order: number;
  created_at?: string;
}

export interface CategoryHierarchy {
  category: Category;
  subCategories: SubCategory[];
  microCategories: Map<string, MicroCategory[]>;
}

class CategoryManager {
  private static instance: CategoryManager;

  private constructor() {}

  static getInstance(): CategoryManager {
    if (!CategoryManager.instance) {
      CategoryManager.instance = new CategoryManager();
    }
    return CategoryManager.instance;
  }

  /**
   * Create a new category
   */
  async createCategory(data: Omit<Category, 'id' | 'created_at'>): Promise<Category> {
    const slug = this.generateSlug(data.name);
    
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name: data.name,
        slug,
        icon: data.icon,
        order: data.order,
      })
      .select()
      .single();

    if (error) throw error;

    eventLogger.logDbUpdate('categories', 'INSERT', category.id, undefined, {
      name: data.name,
      slug,
    });

    return category;
  }

  /**
   * Create a new sub-category
   */
  async createSubCategory(
    categoryId: string,
    data: Omit<SubCategory, 'id' | 'created_at'>
  ): Promise<SubCategory> {
    // Validate parent category exists
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .single();

    if (!category) {
      throw new Error(`Parent category ${categoryId} not found`);
    }

    const slug = this.generateSlug(data.name);
    
    const { data: subCategory, error } = await supabase
      .from('sub_categories')
      .insert({
        category_id: categoryId,
        name: data.name,
        slug,
        order: data.order,
      })
      .select()
      .single();

    if (error) throw error;

    eventLogger.logDbUpdate('sub_categories', 'INSERT', subCategory.id, undefined, {
      categoryId,
      name: data.name,
      slug,
    });

    return subCategory;
  }

  /**
   * Create a new micro-category
   */
  async createMicroCategory(
    subCategoryId: string,
    data: Omit<MicroCategory, 'id' | 'created_at'>
  ): Promise<MicroCategory> {
    // Validate parent sub-category exists
    const { data: subCategory } = await supabase
      .from('sub_categories')
      .select('id')
      .eq('id', subCategoryId)
      .single();

    if (!subCategory) {
      throw new Error(`Parent sub-category ${subCategoryId} not found`);
    }

    const slug = this.generateSlug(data.name);
    
    const { data: microCategory, error } = await supabase
      .from('micro_categories')
      .insert({
        sub_category_id: subCategoryId,
        name: data.name,
        slug,
        order: data.order,
      })
      .select()
      .single();

    if (error) throw error;

    eventLogger.logDbUpdate('micro_categories', 'INSERT', microCategory.id, undefined, {
      subCategoryId,
      name: data.name,
      slug,
    });

    return microCategory;
  }

  /**
   * Get full category hierarchy
   */
  async getHierarchy(): Promise<CategoryHierarchy[]> {
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .order('order');

    if (!categories) return [];

    const hierarchy: CategoryHierarchy[] = [];

    for (const category of categories) {
      const { data: subCategories } = await supabase
        .from('sub_categories')
        .select('*')
        .eq('category_id', category.id)
        .order('order');

      const microCategoriesMap = new Map<string, MicroCategory[]>();

      if (subCategories) {
        for (const sub of subCategories) {
          const { data: microCategories } = await supabase
            .from('micro_categories')
            .select('*')
            .eq('sub_category_id', sub.id)
            .order('order');

          if (microCategories) {
            microCategoriesMap.set(sub.id, microCategories);
          }
        }
      }

      hierarchy.push({
        category,
        subCategories: subCategories || [],
        microCategories: microCategoriesMap,
      });
    }

    return hierarchy;
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const { data: category } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();

    return category;
  }

  /**
   * Get sub-category by slug
   */
  async getSubCategoryBySlug(slug: string): Promise<SubCategory | null> {
    const { data: subCategory } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('slug', slug)
      .single();

    return subCategory;
  }

  /**
   * Get micro-category by slug
   */
  async getMicroCategoryBySlug(slug: string): Promise<MicroCategory | null> {
    const { data: microCategory } = await supabase
      .from('micro_categories')
      .select('*')
      .eq('slug', slug)
      .single();

    return microCategory;
  }

  /**
   * Assign category hierarchy to product
   */
  async assignCategoriesToProduct(
    productId: string,
    categoryId: string,
    subCategoryId: string,
    microCategoryId: string
  ): Promise<void> {
    // Validate full hierarchy path exists
    await this.validateHierarchyPath(categoryId, subCategoryId, microCategoryId);

    const { error } = await supabase
      .from('products')
      .update({
        category_id: categoryId,
        sub_category_id: subCategoryId,
        micro_category_id: microCategoryId,
      })
      .eq('id', productId);

    if (error) throw error;

    eventLogger.logDbUpdate('products', 'UPDATE', productId, undefined, {
      categoryId,
      subCategoryId,
      microCategoryId,
    });

    // Generate tags based on hierarchy
    await this.generateTagsForProduct(productId, categoryId, subCategoryId, microCategoryId);
  }

  /**
   * Validate hierarchy path exists
   */
  private async validateHierarchyPath(
    categoryId: string,
    subCategoryId: string,
    microCategoryId: string
  ): Promise<void> {
    // Validate category exists
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', categoryId)
      .single();

    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    // Validate sub-category belongs to category
    const { data: subCategory } = await supabase
      .from('sub_categories')
      .select('id, category_id')
      .eq('id', subCategoryId)
      .single();

    if (!subCategory || subCategory.category_id !== categoryId) {
      throw new Error(`Sub-category ${subCategoryId} not found or does not belong to category ${categoryId}`);
    }

    // Validate micro-category belongs to sub-category
    const { data: microCategory } = await supabase
      .from('micro_categories')
      .select('id, sub_category_id')
      .eq('id', microCategoryId)
      .single();

    if (!microCategory || microCategory.sub_category_id !== subCategoryId) {
      throw new Error(`Micro-category ${microCategoryId} not found or does not belong to sub-category ${subCategoryId}`);
    }
  }

  /**
   * Generate tags for product based on hierarchy
   */
  private async generateTagsForProduct(
    productId: string,
    categoryId: string,
    subCategoryId: string,
    microCategoryId: string
  ): Promise<void> {
    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    const { data: subCategory } = await supabase
      .from('sub_categories')
      .select('name')
      .eq('id', subCategoryId)
      .single();

    const { data: microCategory } = await supabase
      .from('micro_categories')
      .select('name')
      .eq('id', microCategoryId)
      .single();

    const tags = [
      category?.name?.toLowerCase(),
      subCategory?.name?.toLowerCase(),
      microCategory?.name?.toLowerCase(),
    ].filter(Boolean);

    const { error } = await supabase
      .from('products')
      .update({ tags })
      .eq('id', productId);

    if (error) throw error;

    eventLogger.logSystemEvent('Tags Generated', { productId, tags });
  }

  /**
   * Generate SEO metadata for category page
   */
  async generateSEOMetadata(
    type: 'category' | 'sub' | 'micro',
    id: string
  ): Promise<{ title: string; description: string; slug: string }> {
    let name: string;
    let parentName: string | null = null;

    if (type === 'category') {
      const { data: category } = await supabase
        .from('categories')
        .select('name')
        .eq('id', id)
        .single();
      name = category?.name || '';
    } else if (type === 'sub') {
      const { data: subCategory } = await supabase
        .from('sub_categories')
        .select('name, category_id')
        .eq('id', id)
        .single();
      name = subCategory?.name || '';
      
      if (subCategory?.category_id) {
        const { data: category } = await supabase
          .from('categories')
          .select('name')
          .eq('id', subCategory.category_id)
          .single();
        parentName = category?.name || null;
      }
    } else {
      const { data: microCategory } = await supabase
        .from('micro_categories')
        .select('name, sub_category_id')
        .eq('id', id)
        .single();
      name = microCategory?.name || '';
      
      if (microCategory?.sub_category_id) {
        const { data: subCategory } = await supabase
          .from('sub_categories')
          .select('name, category_id')
          .eq('id', microCategory.sub_category_id)
          .single();
        
        if (subCategory?.category_id) {
          const { data: category } = await supabase
            .from('categories')
            .select('name')
            .eq('id', subCategory.category_id)
            .single();
          parentName = category?.name || null;
        }
      }
    }

    const title = parentName 
      ? `Best ${name} ${parentName} | SaaS Vala`
      : `Best ${name} | SaaS Vala`;
    
    const description = `Discover the best ${name} solutions at SaaS Vala. Compare features, pricing, and reviews.`;
    const slug = this.generateSlug(name);

    return { title, description, slug };
  }

  /**
   * Validate no orphan records
   */
  async validateNoOrphans(): Promise<{ orphans: string[]; valid: boolean }> {
    const orphans: string[] = [];

    // Check for orphan sub-categories
    const { data: orphanSubs } = await supabase
      .from('sub_categories')
      .select('id, category_id')
      .not('category_id', 'in', '(SELECT id FROM categories)');

    if (orphanSubs && orphanSubs.length > 0) {
      orphans.push(...orphanSubs.map(s => `sub_category:${s.id}`));
    }

    // Check for orphan micro-categories
    const { data: orphanMicros } = await supabase
      .from('micro_categories')
      .select('id, sub_category_id')
      .not('sub_category_id', 'in', '(SELECT id FROM sub_categories)');

    if (orphanMicros && orphanMicros.length > 0) {
      orphans.push(...orphanMicros.map(m => `micro_category:${m.id}`));
    }

    // Check for products with invalid category path
    const { data: orphanProducts } = await supabase
      .from('products')
      .select('id, category_id, sub_category_id, micro_category_id')
      .not('category_id', 'is', null);

    if (orphanProducts) {
      for (const product of orphanProducts) {
        if (product.category_id) {
          const { data: category } = await supabase
            .from('categories')
            .select('id')
            .eq('id', product.category_id)
            .single();
          
          if (!category) {
            orphans.push(`product:${product.id}`);
          }
        }
      }
    }

    return { orphans, valid: orphans.length === 0 };
  }

  /**
   * Delete category (and cascade to sub/micro)
   */
  async deleteCategory(categoryId: string): Promise<void> {
    // Get all sub-categories
    const { data: subCategories } = await supabase
      .from('sub_categories')
      .select('id')
      .eq('category_id', categoryId);

    if (subCategories) {
      // Delete all micro-categories for each sub-category
      for (const sub of subCategories) {
        await supabase
          .from('micro_categories')
          .delete()
          .eq('sub_category_id', sub.id);
      }

      // Delete all sub-categories
      await supabase
        .from('sub_categories')
        .delete()
        .eq('category_id', categoryId);
    }

    // Delete category
    await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    eventLogger.logSystemEvent('Category Deleted', { categoryId });
  }

  /**
   * Generate URL-friendly slug
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /**
   * Get products by category hierarchy
   */
  async getProductsByHierarchy(
    categoryId?: string,
    subCategoryId?: string,
    microCategoryId?: string
  ): Promise<any[]> {
    let query = supabase.from('products').select('*');

    if (microCategoryId) {
      query = query.eq('micro_category_id', microCategoryId);
    } else if (subCategoryId) {
      query = query.eq('sub_category_id', subCategoryId);
    } else if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }
}

// Export singleton instance
export const categoryManager = CategoryManager.getInstance();

// Export helper functions
export const createCategory = (data: Omit<Category, 'id' | 'created_at'>) =>
  categoryManager.createCategory(data);
export const createSubCategory = (categoryId: string, data: Omit<SubCategory, 'id' | 'created_at'>) =>
  categoryManager.createSubCategory(categoryId, data);
export const createMicroCategory = (subCategoryId: string, data: Omit<MicroCategory, 'id' | 'created_at'>) =>
  categoryManager.createMicroCategory(subCategoryId, data);
export const getCategoryHierarchy = () => categoryManager.getHierarchy();
export const assignCategoriesToProduct = (
  productId: string,
  categoryId: string,
  subCategoryId: string,
  microCategoryId: string
) => categoryManager.assignCategoriesToProduct(productId, categoryId, subCategoryId, microCategoryId);
export const getProductsByHierarchy = (
  categoryId?: string,
  subCategoryId?: string,
  microCategoryId?: string
) => categoryManager.getProductsByHierarchy(categoryId, subCategoryId, microCategoryId);
export const validateNoOrphans = () => categoryManager.validateNoOrphans();
