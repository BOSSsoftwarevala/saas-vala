import { supabase } from '@/integrations/supabase/client';

export class DashboardError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'DashboardError';
  }
}

export class ValidationError extends DashboardError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DashboardError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends DashboardError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'PERMISSION_DENIED', 403);
    this.name = 'PermissionError';
  }
}

export class RateLimitError extends DashboardError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

// Rate limiting utility
class RateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();

  checkLimit(key: string, maxAttempts: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  reset(key: string) {
    this.attempts.delete(key);
  }
}

export const rateLimiter = new RateLimiter();

// Input validation utilities
export const validators = {
  required: (value: any, fieldName: string) => {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
  },

  string: (value: any, fieldName: string, minLength?: number, maxLength?: number) => {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }
    if (minLength && value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`);
    }
    if (maxLength && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`);
    }
  },

  email: (value: string, fieldName: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid email address`);
    }
  },

  oneOf: (value: any, allowedValues: any[], fieldName: string) => {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
  },

  positiveNumber: (value: any, fieldName: string) => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new ValidationError(`${fieldName} must be a positive number`);
    }
  },

  uuid: (value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid UUID`);
    }
  }
};

// Security utilities
export const security = {
  sanitizeInput: (input: string): string => {
    return input.replace(/[<>]/g, '').trim();
  },

  checkPermission: (userRole?: string, requiredRole: string = 'admin') => {
    if (!userRole || userRole !== requiredRole) {
      throw new PermissionError();
    }
  },

  validateSession: async (userId?: string) => {
    if (!userId) {
      throw new PermissionError('User not authenticated');
    }

    // Check if user still exists and is active
    const { data: user } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new PermissionError('User account not found');
    }

    return user;
  }
};

// Error handling wrapper
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`${operationName} failed:`, error);

    // Re-throw DashboardErrors as-is
    if (error instanceof DashboardError) {
      throw error;
    }

    // Handle Supabase errors
    if (error && typeof error === 'object' && 'code' in error) {
      const supabaseError = error as any;

      switch (supabaseError.code) {
        case 'PGRST116':
          throw new NotFoundError('Resource', 'unknown');
        case '23505':
          throw new ValidationError('Resource already exists');
        case '42501':
          throw new PermissionError();
        default:
          throw new DashboardError(
            supabaseError.message || 'Database operation failed',
            'DATABASE_ERROR',
            500,
            { originalError: supabaseError }
          );
      }
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new DashboardError('Network connection failed', 'NETWORK_ERROR', 503);
    }

    // Generic error
    throw new DashboardError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      'UNKNOWN_ERROR',
      500,
      { originalError: error }
    );
  }
};

// Retry utility for transient failures
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry validation or permission errors
      if (error instanceof ValidationError || error instanceof PermissionError) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError!;
};