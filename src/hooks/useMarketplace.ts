import { useState, useCallback, useRef } from 'react';
import { publicMarketplaceApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import {
  generateIdempotencyKey,
  normalizeRequestId,
  checkClientRateLimit,
  resetClientRateLimit,
  formatCurrency,
  withRetry,
} from '@/lib/marketplaceUtils';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface SearchParams {
  category?: string;
  search?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

export function useMarketplaceProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (params?: SearchParams & PaginationParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await withRetry(() =>
        publicMarketplaceApi.listProducts({
          category: params?.category,
          search: params?.search,
          sort: params?.sort,
          limit: params?.limit ?? 20,
          offset: ((params?.page ?? 1) - 1) * (params?.limit ?? 20),
        })
      );
      setProducts(data?.products ?? []);
    } catch (err: any) {
      const errorMsg = err?.message ?? 'Failed to fetch products';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { products, loading, error, fetchProducts };
}

export function useMarketplaceCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getCategories();
      setCategories(data?.categories ?? []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  return { categories, loading, fetchCategories };
}

export function useProductRatings(productId: string) {
  const [ratings, setRatings] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchRatings = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getRatings(productId);
      setRatings(data?.ratings ?? []);
      setAverageRating(data?.average_rating ?? 0);
      setTotalRatings(data?.total_count ?? 0);
    } catch (err) {
      console.error('Failed to fetch ratings:', err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const submitRating = useCallback(async (rating: number, reviewTitle?: string, reviewText?: string) => {
    if (!productId) return false;
    setSubmitting(true);
    try {
      await publicMarketplaceApi.submitRating(productId, {
        rating,
        review_title: reviewTitle,
        review_text: reviewText,
      });
      toast.success('Your rating has been submitted');
      await fetchRatings();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit rating');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [productId, fetchRatings]);

  return {
    ratings,
    averageRating,
    totalRatings,
    loading,
    submitting,
    fetchRatings,
    submitRating,
  };
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getFavorites();
      setFavorites(data?.favorites?.map((f: any) => f.product_id) || []);
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (!user) {
        toast.error('Please login to add favorites');
        return;
      }

      const wasAlreadyFavorited = favorites.includes(productId);

      // Optimistic update — apply immediately for instant UI feedback
      setFavorites((prev) =>
        wasAlreadyFavorited ? prev.filter((id) => id !== productId) : [...prev, productId]
      );

      try {
        if (wasAlreadyFavorited) {
          await publicMarketplaceApi.removeFavorite(productId);
          toast.success('Removed from favorites');
        } else {
          await publicMarketplaceApi.addFavorite(productId);
          toast.success('Added to favorites');
        }
      } catch (err: any) {
        // Rollback optimistic update on failure
        setFavorites((prev) =>
          wasAlreadyFavorited ? [...prev, productId] : prev.filter((id) => id !== productId)
        );
        toast.error(err?.message ?? 'Failed to update favorites');
      }
    },
    [user, favorites]
  );

  const isFavorited = useCallback((productId: string) => favorites.includes(productId), [favorites]);

  return {
    favorites,
    loading,
    fetchFavorites,
    toggleFavorite,
    isFavorited,
  };
}

export function useMarketplaceOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async (params?: PaginationParams & { status?: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await withRetry(() => publicMarketplaceApi.getOrders(params));
      setOrders(data?.orders ?? []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      toast.error(err?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { orders, loading, fetchOrders };
}

export function useMarketplacePayment() {
  const [processing, setProcessing] = useState(false);
  const { user } = useAuth();

  /**
   * Ref-based lock: prevents concurrent payment calls (double-click,
   * fast Enter key repeat, etc.). Only ONE payment can be in flight.
   */
  const paymentLockRef = useRef(false);

  const initiatePayment = useCallback(
    async (
      productId: string,
      durationDays: number,
      paymentMethod: string,
      amount: number,
      idempotencyKey?: string
    ) => {
      if (!user) {
        toast.error('Please login to proceed');
        return { success: false, error: 'Not authenticated' };
      }

      // Hard lock — prevents double-submit even if component re-renders
      if (paymentLockRef.current) {
        toast.warning('A payment is already in progress, please wait…');
        return { success: false, error: 'Payment already in progress' };
      }

      // Client-side rate limit: max 3 payment attempts per 60s
      const rateLimitKey = `payment:${user.id}`;
      if (!checkClientRateLimit(rateLimitKey, 3, 60_000)) {
        toast.error('Too many payment attempts. Please wait before trying again.');
        return { success: false, error: 'Rate limit exceeded' };
      }

      paymentLockRef.current = true;
      setProcessing(true);

      // Per-call idempotency key — callers may supply their own
      const idemKey = normalizeRequestId(idempotencyKey ?? generateIdempotencyKey());

      try {
        const result = await withRetry(() =>
          publicMarketplaceApi.initiatePayment(
            {
              product_id: productId,
              duration_days: durationDays,
              payment_method: paymentMethod as any,
              amount,
              idempotency_key: idemKey,
            },
            { idempotencyKey: idemKey }
          ),
          3,
          800
        );

        if (result?.success) {
          resetClientRateLimit(rateLimitKey);
          toast.success('Order placed successfully!');
          return { success: true, order_id: result.order_id ?? null, data: result };
        }

        throw new Error(result?.error ?? 'Payment initiation failed');
      } catch (err: any) {
        const errorMsg = err?.message ?? 'Payment initiation failed';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        paymentLockRef.current = false;
        setProcessing(false);
      }
    },
    [user]
  );

  const verifyPayment = useCallback(
    async (orderId: string, transactionRef?: string, provider?: string) => {
      if (paymentLockRef.current) return { success: false, error: 'Payment already in progress' };
      paymentLockRef.current = true;
      setProcessing(true);
      try {
        const result = await publicMarketplaceApi.verifyPayment({
          order_id: orderId,
          transaction_ref: transactionRef,
          provider,
        });

        if (result?.success) {
          toast.success('Payment verified successfully');
          return { success: true, ...result };
        }

        throw new Error(result?.error ?? 'Payment verification failed');
      } catch (err: any) {
        toast.error(err?.message ?? 'Payment verification failed');
        return { success: false, error: err?.message ?? 'Unknown error' };
      } finally {
        paymentLockRef.current = false;
        setProcessing(false);
      }
    },
    []
  );

  return { processing, initiatePayment, verifyPayment };
}

export function useWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getWallet();
      setBalance(data?.balance || 0);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addBalance = useCallback(
    async (amount: number, paymentMethod?: string) => {
      if (!user) {
        toast.error('Please login first');
        return false;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Invalid amount');
        return false;
      }

      setLoading(true);
      try {
        const result = await publicMarketplaceApi.addWalletBalance(amount, paymentMethod);
        if (result?.success) {
          setBalance(result.balance ?? balance + amount);
          toast.success(`Added ${formatCurrency(amount)} to wallet`);
          return true;
        }
        toast.error(result?.error ?? 'Failed to add balance');
        return false;
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to add balance');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, balance]
  );

  return { balance, loading, fetchWallet, addBalance };
}

export function useLicenseKeys() {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLicenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await withRetry(() => publicMarketplaceApi.getLicenseKeys());
      setLicenses(data?.licenses ?? []);
    } catch (err) {
      console.error('Failed to fetch licenses:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const validateLicense = useCallback(async (licenseKey: string, deviceId?: string) => {
    if (!licenseKey?.trim()) {
      return { valid: false, error: 'License key is required' };
    }
    try {
      const result = await publicMarketplaceApi.validateLicense(licenseKey.trim().toUpperCase(), deviceId);
      if (result?.valid) {
        toast.success('License is valid');
        return { valid: true, ...result };
      }
      const reason = result?.error ?? 'License is invalid or expired';
      toast.error(reason);
      return { valid: false, error: reason };
    } catch (err: any) {
      const errorMsg = err?.message ?? 'License validation failed';
      toast.error(errorMsg);
      return { valid: false, error: errorMsg };
    }
  }, []);

  return { licenses, loading, fetchLicenses, validateLicense };
}

export function useResellerMarketplace() {
  const { user, isReseller } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!isReseller) return;
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getResellerStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch reseller stats:', err);
    } finally {
      setLoading(false);
    }
  }, [isReseller]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getResellerPlans();
      setPlans(data?.plans || []);
    } catch (err) {
      console.error('Failed to fetch reseller plans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEarnings = useCallback(async (period?: string) => {
    if (!isReseller) return;
    setLoading(true);
    try {
      const data = await publicMarketplaceApi.getResellerEarnings({ period });
      setEarnings(data?.earnings || []);
    } catch (err) {
      console.error('Failed to fetch earnings:', err);
    } finally {
      setLoading(false);
    }
  }, [isReseller]);

  const subscribeToPlan = useCallback(
    async (planId: string) => {
      if (!isReseller) {
        toast.error('Only resellers can subscribe to plans');
        return false;
      }

      setLoading(true);
      try {
        const result = await publicMarketplaceApi.subscribeToResellerPlan(planId);
        if (result.success) {
          toast.success('Plan subscribed successfully');
          await fetchStats();
          return true;
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to subscribe');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [isReseller, fetchStats]
  );

  const generateKeys = useCallback(
    async (productId: string, quantity: number, durationDays?: number) => {
      if (!isReseller) {
        toast.error('Only resellers can generate keys');
        return { success: false };
      }

      setLoading(true);
      try {
        const result = await publicMarketplaceApi.generateResellerKeys(productId, quantity, durationDays);
        if (result.success) {
          toast.success(`Generated ${quantity} license key(s)`);
          return { success: true, keys: result.keys };
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to generate keys');
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [isReseller]
  );

  return {
    stats,
    plans,
    earnings,
    loading,
    fetchStats,
    fetchPlans,
    fetchEarnings,
    subscribeToPlan,
    generateKeys,
  };
}

export function useMarketplaceNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(
    async (unreadOnly = false) => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await publicMarketplaceApi.getNotifications({
          page: 1,
          limit: 20,
          unread_only: unreadOnly,
        });
        const notifsArray = data?.notifications || [];
        setNotifications(notifsArray);
        setUnreadCount(notifsArray.filter((n: any) => !n.is_read).length);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await publicMarketplaceApi.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
  };
}
