// Duplicate Prevention Service - Prevent duplicate entries
import { supabase } from '@/integrations/supabase/client';

class DuplicatePreventionService {
  private static instance: DuplicatePreventionService;
  private cache: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): DuplicatePreventionService {
    if (!DuplicatePreventionService.instance) {
      DuplicatePreventionService.instance = new DuplicatePreventionService();
    }
    return DuplicatePreventionService.instance;
  }

  async checkDuplicateProduct(name: string, slug: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .or(`name.eq.${name},slug.eq.${slug}`)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.error('[DuplicatePrevention] Error checking duplicate product:', error);
      return false;
    }
  }

  async checkDuplicateKey(keyValue: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('id')
        .eq('key_value', keyValue)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.error('[DuplicatePrevention] Error checking duplicate key:', error);
      return false;
    }
  }

  async checkDuplicateUser(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.error('[DuplicatePrevention] Error checking duplicate user:', error);
      return false;
    }
  }

  async checkDuplicateOrder(orderId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    } catch (error) {
      console.error('[DuplicatePrevention] Error checking duplicate order:', error);
      return false;
    }
  }

  addToCache(type: string, value: string): void {
    if (!this.cache.has(type)) {
      this.cache.set(type, new Set());
    }
    this.cache.get(type)?.add(value);
  }

  isInCache(type: string, value: string): boolean {
    return this.cache.get(type)?.has(value) ?? false;
  }

  removeFromCache(type: string, value: string): void {
    this.cache.get(type)?.delete(value);
  }

  clearCache(type?: string): void {
    if (type) {
      this.cache.delete(type);
    } else {
      this.cache.clear();
    }
  }

  async ensureUniqueProduct(name: string, slug: string): Promise<{ unique: boolean; error?: string }> {
    // Check cache first
    if (this.isInCache('product_name', name) || this.isInCache('product_slug', slug)) {
      return { unique: false, error: 'Product with this name or slug already exists' };
    }

    // Check database
    const isDuplicate = await this.checkDuplicateProduct(name, slug);
    
    if (isDuplicate) {
      this.addToCache('product_name', name);
      this.addToCache('product_slug', slug);
      return { unique: false, error: 'Product with this name or slug already exists' };
    }

    return { unique: true };
  }

  async ensureUniqueKey(keyValue: string): Promise<{ unique: boolean; error?: string }> {
    // Check cache first
    if (this.isInCache('key', keyValue)) {
      return { unique: false, error: 'Key already exists' };
    }

    // Check database
    const isDuplicate = await this.checkDuplicateKey(keyValue);
    
    if (isDuplicate) {
      this.addToCache('key', keyValue);
      return { unique: false, error: 'Key already exists' };
    }

    return { unique: true };
  }

  async ensureUniqueUser(email: string): Promise<{ unique: boolean; error?: string }> {
    // Check cache first
    if (this.isInCache('user_email', email)) {
      return { unique: false, error: 'User with this email already exists' };
    }

    // Check database
    const isDuplicate = await this.checkDuplicateUser(email);
    
    if (isDuplicate) {
      this.addToCache('user_email', email);
      return { unique: false, error: 'User with this email already exists' };
    }

    return { unique: true };
  }
}

export const duplicatePrevention = DuplicatePreventionService.getInstance();

// Convenience functions
export async function ensureUniqueProduct(name: string, slug: string) {
  return duplicatePrevention.ensureUniqueProduct(name, slug);
}

export async function ensureUniqueKey(keyValue: string) {
  return duplicatePrevention.ensureUniqueKey(keyValue);
}

export async function ensureUniqueUser(email: string) {
  return duplicatePrevention.ensureUniqueUser(email);
}
