import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { productsApi } from '@/lib/api';
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

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await productsApi.list();
      setProducts((res.data || []) as Product[]);
    } catch (e: any) {
      toast.error('Failed to fetch products');
      console.error(e);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const res = await productsApi.categories();
      setCategories((res.data || []) as Category[]);
    } catch (e) {
      console.error(e);
    }
  };

  const createProduct = async (product: Partial<Product>) => {
    try {
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
  }, []);

  return {
    products,
    categories,
    loading,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    suspendProduct,
    activateProduct
  };
}
