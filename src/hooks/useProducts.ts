import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { productsApi } from '@/lib/api';
import { productManagerApi, ProductFilters } from '@/lib/productManagerApi';
import type { Json } from '@/integrations/supabase/types';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  status: 'active' | 'suspended' | 'archived' | 'draft';
  price: number;
  currency: string;
  version: string;
  features: Json;
  created_at: string;
  updated_at: string;
  git_repo_url: string | null;
  git_repo_name: string | null;
  git_default_branch: string | null;
  deploy_status: string | null;
  marketplace_visible: boolean | null;
  demo_url: string | null;
  demo_source_url: string | null;
  live_url: string | null;
  thumbnail_url: string | null;
  // New fields from Product Manager System
  short_description?: string;
  full_description?: string;
  tags?: string[];
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  og_image?: string;
  canonical_url?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  level: 'master' | 'sub' | 'micro' | 'nano';
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
}

export function useProducts(page: number = 1, pageSize: number = 20, filters: ProductFilters = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Try new Product Manager API first
      const response = await productManagerApi.product.getProducts(page, pageSize, filters);
      setProducts(response.data as Product[]);
      setTotalCount(response.count);
      setTotalPages(response.totalPages);
    } catch (e: any) {
      // Fallback to old API if new one fails
      console.warn('Product Manager API failed, falling back to old API:', e);
      try {
        const res = await productsApi.list();
        setProducts((res.data || []) as Product[]);
        setTotalCount((res.data || []).length);
      } catch (fallbackError: any) {
        toast.error('Failed to fetch products');
        console.error(fallbackError);
      }
    }
    setLoading(false);
  }, [page, pageSize, JSON.stringify(filters)]);

  const fetchCategories = async () => {
    try {
      // Try new Product Manager API first
      const newCategories = await productManagerApi.category.getCategories();
      setCategories(newCategories as Category[]);
    } catch (e) {
      // Fallback to old API
      try {
        const res = await productsApi.categories();
        setCategories((res.data || []) as Category[]);
      } catch (fallbackError) {
        console.error(fallbackError);
      }
    }
  };

  const createProduct = async (product: Partial<Product>) => {
    try {
      // Try new Product Manager API first
      // Convert status to match new API (archived -> suspended)
      const convertedProduct = {
        ...product,
        status: product.status === 'archived' ? 'suspended' : product.status,
      } as any;
      const result = await productManagerApi.product.createProduct(convertedProduct);
      if (result) {
        toast.success('Product created');
        await fetchProducts();
        return result;
      }
      // Fallback to old API
      const res = await productsApi.create(product);
      toast.success('Product created');
      await fetchProducts();
      return res.data;
    } catch (e: any) {
      toast.error('Failed to create product');
      throw e;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      // Try new Product Manager API first
      // Convert status to match new API (archived -> suspended)
      const convertedUpdates = {
        ...updates,
        status: updates.status === 'archived' ? 'suspended' : updates.status,
      } as any;
      const result = await productManagerApi.product.updateProduct(id, convertedUpdates);
      if (result) {
        toast.success('Product updated');
        await fetchProducts();
        return result;
      }
      // Fallback to old API
      await productsApi.update(id, updates);
      toast.success('Product updated');
      await fetchProducts();
    } catch (e: any) {
      toast.error('Failed to update product');
      throw e;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      // Try new Product Manager API first
      const result = await productManagerApi.product.deleteProduct(id);
      if (result) {
        toast.success('Product deleted');
        await fetchProducts();
        return;
      }
      // Fallback to old API
      await productsApi.delete(id);
      toast.success('Product deleted');
      await fetchProducts();
    } catch (e: any) {
      toast.error('Failed to delete product');
      throw e;
    }
  };

  const suspendProduct = async (id: string) => {
    await updateProduct(id, { status: 'suspended' });
  };

  const activateProduct = async (id: string) => {
    await updateProduct(id, { status: 'active' });
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts]);

  return {
    products,
    categories,
    loading,
    totalCount,
    totalPages,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    suspendProduct,
    activateProduct
  };
}
