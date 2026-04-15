// Global Error Handler Service - Production-ready error handling
import { toast } from 'sonner';

export interface ErrorContext {
  action: string;
  component?: string;
  userId?: string;
  additionalData?: Record<string, unknown>;
}

export class ErrorHandlerService {
  private static instance: ErrorHandlerService;
  private errorQueue: Array<Error & ErrorContext> = [];
  private isProcessing = false;

  private constructor() {
    // Setup global error handlers
    this.setupGlobalHandlers();
  }

  static getInstance(): ErrorHandlerService {
    if (!ErrorHandlerService.instance) {
      ErrorHandlerService.instance = new ErrorHandlerService();
    }
    return ErrorHandlerService.instance;
  }

  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[ErrorHandler] Unhandled Promise Rejection:', event.reason);
      this.handleError(event.reason as Error, {
        action: 'unhandled_promise_rejection',
      });
      event.preventDefault();
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      console.error('[ErrorHandler] Global Error:', event.error);
      this.handleError(event.error, {
        action: 'global_error',
      });
    });
  }

  handleError(
    error: Error | unknown,
    context: ErrorContext = { action: 'unknown' }
  ): void {
    const errorObj = this.normalizeError(error, context);
    
    // Add to queue for processing
    this.errorQueue.push(errorObj);
    
    // Process queue
    this.processErrorQueue();

    // Show user-friendly toast
    this.showErrorToast(errorObj);

    // Log to console for debugging
    console.error('[ErrorHandler]', errorObj);
  }

  private normalizeError(error: Error | unknown, context: ErrorContext): Error & ErrorContext {
    if (error instanceof Error) {
      return { ...error, ...context };
    }
    
    // Convert non-Error objects to Error
    const stringError = String(error);
    const newError = new Error(stringError);
    return { ...newError, ...context };
  }

  private async processErrorQueue(): Promise<void> {
    if (this.isProcessing || this.errorQueue.length === 0) return;

    this.isProcessing = true;

    while (this.errorQueue.length > 0) {
      const error = this.errorQueue.shift();
      if (error) {
        await this.logError(error);
      }
    }

    this.isProcessing = false;
  }

  private async logError(error: Error & ErrorContext): Promise<void> {
    try {
      // In production, send to error tracking service (e.g., Sentry, LogRocket)
      // For now, log to console with structured format
      const logData = {
        message: error.message,
        stack: error.stack,
        action: error.action,
        component: error.component,
        userId: error.userId,
        additionalData: error.additionalData,
        timestamp: new Date().toISOString(),
      };

      console.error('[ErrorHandler] Logged Error:', JSON.stringify(logData, null, 2));
    } catch (logError) {
      console.error('[ErrorHandler] Failed to log error:', logError);
    }
  }

  private showErrorToast(error: Error & ErrorContext): void {
    const userMessage = this.getUserFriendlyMessage(error);
    
    toast.error(userMessage, {
      duration: 5000,
      action: {
        label: 'Dismiss',
        onClick: () => {},
      },
    });
  }

  private getUserFriendlyMessage(error: Error & ErrorContext): string {
    // Map common errors to user-friendly messages
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    if (message.includes('unauthorized') || message.includes('auth')) {
      return 'Authentication failed. Please log in again.';
    }
    
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'You do not have permission to perform this action.';
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Invalid input. Please check your data and try again.';
    }

    if (message.includes('wallet') || message.includes('balance')) {
      return 'Wallet operation failed. Please check your balance.';
    }

    // Default message
    return 'An error occurred. Please try again or contact support.';
  }

  async handleAsync<T>(
    promise: Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      this.handleError(error as Error, context);
      throw error;
    }
  }

  wrapFunction<T extends (...args: any[]) => any>(
    fn: T,
    context: ErrorContext
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.handleError(error, context);
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        this.handleError(error as Error, context);
        throw error;
      }
    }) as T;
  }
}

// Singleton instance
export const errorHandler = ErrorHandlerService.getInstance();

// Convenience function for error handling
export function handleError(error: Error | unknown, context?: Partial<ErrorContext>): void {
  errorHandler.handleError(error, { action: 'manual', ...context });
}

// Higher-order function for wrapping async operations
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext
): T {
  return errorHandler.wrapFunction(fn, context) as T;
}
