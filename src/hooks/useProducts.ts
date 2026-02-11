import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch products');
      console.error(error);
    } else {
      setProducts((data || []) as Product[]);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      console.error(error);
    } else {
      setCategories((data || []) as Category[]);
    }
  };

  const createProduct = async (product: Partial<Product>) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name || '',
        slug: product.slug || product.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || '',
        description: product.description || null,
        category_id: product.category_id && product.category_id.trim() !== '' ? product.category_id : null,
        status: product.status || 'draft',
        price: product.price || 0,
        currency: product.currency || 'INR',
        version: product.version || '1.0.0',
        features: product.features || [],
        created_by: userData.user?.id,
        git_repo_url: product.git_repo_url || null,
        git_repo_name: product.git_repo_name || null,
        git_default_branch: product.git_default_branch || 'main',
        deploy_status: product.deploy_status || 'idle',
        marketplace_visible: product.marketplace_visible || false,
        demo_url: product.demo_url || null,
        live_url: product.live_url || null,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create product');
      throw error;
    }
    toast.success('Product created');
    await fetchProducts();
    return data;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    // Sanitize category_id - convert empty string to null for UUID field
    const sanitizedUpdates = {
      ...updates,
      category_id: updates.category_id && String(updates.category_id).trim() !== '' 
        ? updates.category_id 
        : null
    };
    
    const { error } = await supabase
      .from('products')
      .update(sanitizedUpdates)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update product');
      throw error;
    }
    toast.success('Product updated');
    await fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete product');
      throw error;
    }
    toast.success('Product deleted');
    await fetchProducts();
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
