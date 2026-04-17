import { supabase } from '@/lib/supabase';

// Types
export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  download_url: string | null;
  demo_url: string | null;
  documentation_url: string | null;
  category_id: string | null;
  price: number;
  currency: string;
  original_price: number | null;
  discount_percentage: number;
  sales_count: number;
  views_count: number;
  rating_average: number;
  rating_count: number;
  tags: string[] | null;
  features: Record<string, unknown> | null;
  requirements: Record<string, unknown> | null;
  version: string | null;
  last_updated: string;
  is_featured: boolean;
  is_active: boolean;
  is_approved: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: MarketplaceCategory;
}

export interface MarketplaceOrder {
  id: string;
  order_number: string;
  user_id: string;
  product_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_id: string | null;
  download_count: number;
  max_downloads: number;
  download_expiry: string | null;
  created_at: string;
  updated_at: string;
  product?: MarketplaceProduct;
}

export interface MarketplaceReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
  };
  replies?: MarketplaceReviewReply[];
}

export interface MarketplaceReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
  };
}

// Marketplace API Service
export const marketplaceApi = {
  // Categories
  async getCategories() {
    const { data, error } = await supabase
      .from('marketplace_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data as MarketplaceCategory[];
  },

  async getCategoryBySlug(slug: string) {
    const { data, error } = await supabase
      .from('marketplace_categories')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    return data as MarketplaceCategory;
  },

  async createCategory(category: Partial<MarketplaceCategory>) {
    const { data, error } = await supabase
      .from('marketplace_categories')
      .insert(category)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceCategory;
  },

  async updateCategory(id: string, category: Partial<MarketplaceCategory>) {
    const { data, error } = await supabase
      .from('marketplace_categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceCategory;
  },

  async deleteCategory(id: string) {
    const { error } = await supabase
      .from('marketplace_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Products
  async getProducts(params?: {
    category?: string;
    search?: string;
    sort?: 'rating' | 'sales' | 'price_asc' | 'price_desc' | 'newest';
    featured?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('marketplace_products')
      .select(`
        *,
        category:marketplace_categories(*)
      `)
      .eq('is_active', true)
      .eq('is_approved', true);

    if (params?.category) {
      query = query.eq('category_id', params.category);
    }

    if (params?.search) {
      query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%,tags.cs.{${params.search}}`);
    }

    if (params?.featured) {
      query = query.eq('is_featured', true);
    }

    if (params?.sort) {
      switch (params.sort) {
        case 'rating':
          query = query.order('rating_average', { ascending: false });
          break;
        case 'sales':
          query = query.order('sales_count', { ascending: false });
          break;
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('price', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
      }
    } else {
      query = query.order('sales_count', { ascending: false });
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as MarketplaceProduct[];
  },

  async getProductBySlug(slug: string) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .select(`
        *,
        category:marketplace_categories(*)
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .eq('is_approved', true)
      .single();
    
    if (error) throw error;
    return data as MarketplaceProduct;
  },

  async getProductById(id: string) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .select(`
        *,
        category:marketplace_categories(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as MarketplaceProduct;
  },

  async incrementViews(productId: string) {
    const { error } = await supabase
      .rpc('increment_product_views', { product_id: productId });
    
    if (error) throw error;
  },

  async createProduct(product: Partial<MarketplaceProduct>) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .insert(product)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceProduct;
  },

  async updateProduct(id: string, product: Partial<MarketplaceProduct>) {
    const { data, error } = await supabase
      .from('marketplace_products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceProduct;
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('marketplace_products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Orders
  async getUserOrders(userId: string) {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:marketplace_products(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as MarketplaceOrder[];
  },

  async getAllOrders(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:marketplace_products(*)
      `)
      .order('created_at', { ascending: false });

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as MarketplaceOrder[];
  },

  async getOrderById(id: string) {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select(`
        *,
        product:marketplace_products(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as MarketplaceOrder;
  },

  async createOrder(order: Partial<MarketplaceOrder>) {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const { data, error } = await supabase
      .from('marketplace_orders')
      .insert({ ...order, order_number: orderNumber })
      .select(`
        *,
        product:marketplace_products(*)
      `)
      .single();
    
    if (error) throw error;
    
    // Increment product sales count
    if (order.product_id) {
      await supabase
        .from('marketplace_products')
        .update({ sales_count: (await this.getProductById(order.product_id)).sales_count + 1 })
        .eq('id', order.product_id);
    }
    
    return data as MarketplaceOrder;
  },

  async updateOrder(id: string, order: Partial<MarketplaceOrder>) {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .update(order)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceOrder;
  },

  async deleteOrder(id: string) {
    const { error } = await supabase
      .from('marketplace_orders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Reviews
  async getProductReviews(productId: string) {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as MarketplaceReview[];
  },

  async getUserReviews(userId: string) {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .select(`
        *,
        product:marketplace_products(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as MarketplaceReview[];
  },

  async getAllReviews(params?: {
    approved?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('marketplace_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.approved !== undefined) {
      query = query.eq('is_approved', params.approved);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 20) - 1);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data as MarketplaceReview[];
  },

  async createReview(review: Partial<MarketplaceReview>) {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .insert(review)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceReview;
  },

  async updateReview(id: string, review: Partial<MarketplaceReview>) {
    const { data, error } = await supabase
      .from('marketplace_reviews')
      .update(review)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceReview;
  },

  async deleteReview(id: string) {
    const { error } = await supabase
      .from('marketplace_reviews')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async approveReview(id: string) {
    return this.updateReview(id, { is_approved: true });
  },

  // Review Replies
  async createReply(reply: Partial<MarketplaceReviewReply>) {
    const { data, error } = await supabase
      .from('marketplace_review_replies')
      .insert(reply)
      .select()
      .single();
    
    if (error) throw error;
    return data as MarketplaceReviewReply;
  },

  async deleteReply(id: string) {
    const { error } = await supabase
      .from('marketplace_review_replies')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Real-time subscriptions
  subscribeToProducts(callback: (payload: any) => void) {
    return supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_products' }, callback)
      .subscribe();
  },

  subscribeToOrders(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_orders', filter: `user_id=eq.${userId}` }, callback)
      .subscribe();
  },

  subscribeToReviews(productId: string, callback: (payload: any) => void) {
    return supabase
      .channel('reviews-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_reviews', filter: `product_id=eq.${productId}` }, callback)
      .subscribe();
  },
};
