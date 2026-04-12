// STEP 83: SOFT FAIL UI STATE - Show sending... retrying... until confirmed
import { useState, useCallback, useRef } from 'react';

export interface MessageUIState {
  id: string;
  status: 'sending' | 'sent' | 'failed' | 'retrying' | 'delivered' | 'read';
  error?: string;
  retryCount: number;
  lastAttempt: number;
  showRetryButton: boolean;
}

export interface SoftFailUIOptions {
  maxRetries?: number;
  retryDelay?: number;
  showRetryAfter?: number;
  autoRetry?: boolean;
}

export const useSoftFailUI = (options: SoftFailUIOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 2000,
    showRetryAfter = 5000,
    autoRetry = true
  } = options;

  const [messageStates, setMessageStates] = useState<Map<string, MessageUIState>>(new Map());
  const retryTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize message state
  const initializeMessage = useCallback((messageId: string) => {
    const state: MessageUIState = {
      id: messageId,
      status: 'sending',
      retryCount: 0,
      lastAttempt: Date.now(),
      showRetryButton: false
    };

    setMessageStates(prev => new Map(prev.set(messageId, state)));

    // Show retry button after delay
    const retryTimer = setTimeout(() => {
      updateMessageState(messageId, { showRetryButton: true });
    }, showRetryAfter);

    retryTimers.current.set(messageId, retryTimer);
  }, [showRetryAfter]);

  // Update message state
  const updateMessageState = useCallback((messageId: string, updates: Partial<MessageUIState>) => {
    setMessageStates(prev => {
      const current = prev.get(messageId);
      if (!current) return prev;

      const updated = { ...current, ...updates, lastAttempt: Date.now() };
      return new Map(prev.set(messageId, updated));
    });
  }, []);

  // Mark message as sent successfully
  const markAsSent = useCallback((messageId: string) => {
    // Clear retry timer
    const timer = retryTimers.current.get(messageId);
    if (timer) {
      clearTimeout(timer);
      retryTimers.current.delete(messageId);
    }

    updateMessageState(messageId, { 
      status: 'sent',
      showRetryButton: false,
      error: undefined
    });
  }, [updateMessageState]);

  // Mark message as failed
  const markAsFailed = useCallback((messageId: string, error?: string) => {
    updateMessageState(messageId, { 
      status: 'failed',
      error,
      showRetryButton: true
    });

    // Auto-retry if enabled and within retry limit
    if (autoRetry) {
      const currentState = messageStates.get(messageId);
      if (currentState && currentState.retryCount < maxRetries) {
        setTimeout(() => {
          retryMessage(messageId);
        }, retryDelay * Math.pow(2, currentState.retryCount)); // Exponential backoff
      }
    }
  }, [autoRetry, maxRetries, retryDelay, updateMessageState, messageStates]);

  // Mark message as delivered
  const markAsDelivered = useCallback((messageId: string) => {
    updateMessageState(messageId, { status: 'delivered' });
  }, [updateMessageState]);

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    updateMessageState(messageId, { status: 'read' });
  }, [updateMessageState]);

  // Retry message
  const retryMessage = useCallback(async (messageId: string, retryFunction?: () => Promise<boolean>) => {
    const currentState = messageStates.get(messageId);
    if (!currentState) return;

    if (currentState.retryCount >= maxRetries) {
      updateMessageState(messageId, { 
        status: 'failed',
        showRetryButton: true,
        error: 'Max retries exceeded'
      });
      return;
    }

    // Update state to retrying
    updateMessageState(messageId, { 
      status: 'retrying',
      showRetryButton: false,
      retryCount: currentState.retryCount + 1
    });

    // Execute retry function if provided
    if (retryFunction) {
      try {
        const success = await retryFunction();
        if (success) {
          markAsSent(messageId);
        } else {
          markAsFailed(messageId, 'Retry failed');
        }
      } catch (error) {
        markAsFailed(messageId, error instanceof Error ? error.message : 'Retry failed');
      }
    }
  }, [maxRetries, updateMessageState, markAsSent, markAsFailed, messageStates]);

  // Get message state
  const getMessageState = useCallback((messageId: string): MessageUIState | undefined => {
    return messageStates.get(messageId);
  }, [messageStates]);

  // Get status text for display
  const getStatusText = useCallback((messageId: string): string => {
    const state = messageStates.get(messageId);
    if (!state) return '';

    switch (state.status) {
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'retrying':
        return `Retrying... (${state.retryCount}/${maxRetries})`;
      case 'failed':
        return state.error || 'Failed to send';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      default:
        return '';
    }
  }, [messageStates, maxRetries]);

  // Get status color for UI
  const getStatusColor = useCallback((messageId: string): string => {
    const state = messageStates.get(messageId);
    if (!state) return 'text-gray-500';

    switch (state.status) {
      case 'sending':
      case 'retrying':
        return 'text-blue-500';
      case 'sent':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'delivered':
        return 'text-green-600';
      case 'read':
        return 'text-green-700';
      default:
        return 'text-gray-500';
    }
  }, [messageStates]);

  // Check if message should show retry button
  const shouldShowRetryButton = useCallback((messageId: string): boolean => {
    const state = messageStates.get(messageId);
    return state?.showRetryButton || false;
  }, [messageStates]);

  // Check if message can be retried
  const canRetry = useCallback((messageId: string): boolean => {
    const state = messageStates.get(messageId);
    return state ? state.retryCount < maxRetries : false;
  }, [messageStates, maxRetries]);

  // Clean up message state
  const cleanupMessage = useCallback((messageId: string) => {
    // Clear retry timer
    const timer = retryTimers.current.get(messageId);
    if (timer) {
      clearTimeout(timer);
      retryTimers.current.delete(messageId);
    }

    // Remove from state
    setMessageStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(messageId);
      return newMap;
    });
  }, []);

  // Clean up all message states
  const cleanupAll = useCallback(() => {
    // Clear all timers
    retryTimers.current.forEach(timer => clearTimeout(timer));
    retryTimers.current.clear();

    // Clear all states
    setMessageStates(new Map());
  }, []);

  // Get failed messages count
  const getFailedMessagesCount = useCallback((): number => {
    let count = 0;
    messageStates.forEach(state => {
      if (state.status === 'failed') count++;
    });
    return count;
  }, [messageStates]);

  // Get sending messages count
  const getSendingMessagesCount = useCallback((): number => {
    let count = 0;
    messageStates.forEach(state => {
      if (state.status === 'sending' || state.status === 'retrying') count++;
    });
    return count;
  }, [messageStates]);

  // Retry all failed messages
  const retryAllFailed = useCallback(async (retryFunction?: (messageId: string) => Promise<boolean>) => {
    const promises: Promise<void>[] = [];

    messageStates.forEach((state, messageId) => {
      if (state.status === 'failed' && state.retryCount < maxRetries) {
        const retryFn = retryFunction ? () => retryFunction(messageId) : undefined;
        promises.push(retryMessage(messageId, retryFn));
      }
    });

    await Promise.all(promises);
  }, [messageStates, maxRetries, retryMessage]);

  // Get overall connection status
  const getConnectionStatus = useCallback((): {
    isHealthy: boolean;
    sendingCount: number;
    failedCount: number;
  } => {
    const sendingCount = getSendingMessagesCount();
    const failedCount = getFailedMessagesCount();
    
    return {
      isHealthy: failedCount === 0 && sendingCount === 0,
      sendingCount,
      failedCount
    };
  }, [getSendingMessagesCount, getFailedMessagesCount]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    cleanupAll();
  }, [cleanupAll]);

  return {
    // State management
    initializeMessage,
    updateMessageState,
    getMessageState,
    cleanupMessage,
    cleanupAll,
    cleanup,

    // Status updates
    markAsSent,
    markAsFailed,
    markAsDelivered,
    markAsRead,

    // Retry functionality
    retryMessage,
    retryAllFailed,
    canRetry,
    shouldShowRetryButton,

    // UI helpers
    getStatusText,
    getStatusColor,

    // Statistics
    getFailedMessagesCount,
    getSendingMessagesCount,
    getConnectionStatus,

    // Raw state access
    messageStates
  };
};
