import { useState, useEffect } from 'react';
import { marketplaceApi, MarketplaceProduct, MarketplaceCategory, MarketplaceOrder, MarketplaceReview } from '@/lib/marketplaceApi';

export function useMarketplaceCategories() {
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await marketplaceApi.getCategories();
      setCategories(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, error, refresh: loadCategories };
}

export function useMarketplaceProducts(params?: {
  category?: string;
  search?: string;
  sort?: 'rating' | 'sales' | 'price_asc' | 'price_desc' | 'newest';
  featured?: boolean;
  limit?: number;
}) {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadProducts();
  }, [params?.category, params?.search, params?.sort, params?.featured]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await marketplaceApi.getProducts(params);
      setProducts(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { products, loading, error, refresh: loadProducts };
}

export function useMarketplaceProduct(slug: string) {
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadProduct();
  }, [slug]);

  const loadProduct = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const data = await marketplaceApi.getProductBySlug(slug);
      setProduct(data);
      await marketplaceApi.incrementViews(data.id);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { product, loading, error, refresh: loadProduct };
}

export function useMarketplaceOrders(userId?: string) {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadOrders();
  }, [userId]);

  const loadOrders = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await marketplaceApi.getUserOrders(userId);
      setOrders(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { orders, loading, error, refresh: loadOrders };
}

export function useMarketplaceReviews(productId: string) {
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const loadReviews = async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const data = await marketplaceApi.getProductReviews(productId);
      setReviews(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { reviews, loading, error, refresh: loadReviews };
}
