// API Client Service - Production-ready API calls with retry, loading, and error handling
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { errorHandler } from './error-handler.service';

export interface ApiOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  showToast?: boolean;
  loadingCallback?: (loading: boolean) => void;
}

class ApiClientService {
  private static instance: ApiClientService;
  private loadingStates: Map<string, boolean> = new Map();

  private constructor() {}

  static getInstance(): ApiClientService {
    if (!ApiClientService.instance) {
      ApiClientService.instance = new ApiClientService();
    }
    return ApiClientService.instance;
  }

  setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading);
  }

  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    options: ApiOptions = {}
  ): Promise<T> {
    const {
      retries = 3,
      retryDelay = 1000,
      timeout = 30000,
      showToast = true,
      loadingCallback,
    } = options;

    const operationKey = `operation-${Date.now()}`;
    
    if (loadingCallback) {
      loadingCallback(true);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add timeout
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), timeout)
          ),
        ]);

        if (loadingCallback) {
          loadingCallback(false);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        console.error(`[ApiClient] Attempt ${attempt + 1} failed:`, error);

        // Don't retry on certain errors
        if (this.shouldNotRetry(error as Error)) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve =>
            setTimeout(resolve, retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }

    if (loadingCallback) {
      loadingCallback(false);
    }

    // All retries failed
    if (showToast && lastError) {
      errorHandler.handleError(lastError, {
        action: 'api_call_failed',
        additionalData: { attempts: retries + 1 },
      });
    }

    throw lastError;
  }

  private shouldNotRetry(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Don't retry on authentication errors
    if (message.includes('unauthorized') || message.includes('auth')) {
      return true;
    }
    
    // Don't retry on permission errors
    if (message.includes('permission') || message.includes('forbidden')) {
      return true;
    }
    
    // Don't retry on validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return true;
    }

    return false;
  }

  // Supabase query wrapper with retry
  async query<T>(
    table: string,
    options: ApiOptions = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      const { data, error } = await supabase.from(table).select('*');
      
      if (error) {
        throw error;
      }
      
      return data as T;
    }, options);
  }

  // Supabase insert wrapper with retry
  async insert<T>(
    table: string,
    data: Record<string, unknown>,
    options: ApiOptions = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      const { data, error } = await supabase.from(table).insert(data).select().single();
      
      if (error) {
        throw error;
      }
      
      return data as T;
    }, options);
  }

  // Supabase update wrapper with retry
  async update<T>(
    table: string,
    data: Record<string, unknown>,
    filter: Record<string, unknown>,
    options: ApiOptions = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      const { data, error } = await supabase
        .from(table)
        .update(data)
        .match(filter)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as T;
    }, options);
  }

  // Supabase delete wrapper with retry
  async delete(
    table: string,
    filter: Record<string, unknown>,
    options: ApiOptions = {}
  ): Promise<void> {
    return this.withRetry(async () => {
      const { error } = await supabase.from(table).delete().match(filter);
      
      if (error) {
        throw error;
      }
    }, options);
  }

  // Generic Supabase RPC call with retry
  async rpc<T>(
    functionName: string,
    params: Record<string, unknown> = {},
    options: ApiOptions = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        throw error;
      }
      
      return data as T;
    }, options);
  }
}

export const apiClient = ApiClientService.getInstance();

// Convenience hook for API calls with loading state
export function useApiCall() {
  const [loading, setLoading] = useState(false);

  const execute = async <T>(
    operation: () => Promise<T>,
    options: ApiOptions = {}
  ): Promise<T> => {
    setLoading(true);
    try {
      return await apiClient.withRetry(operation, {
        ...options,
        loadingCallback: (isLoading) => setLoading(isLoading),
      });
    } finally {
      setLoading(false);
    }
  };

  return { loading, execute };
}
