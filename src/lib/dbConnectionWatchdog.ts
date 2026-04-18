/**
 * DB Connection Watchdog
 * Pings Supabase every X seconds, blocks actions on fail
 */

import { supabase } from '@/lib/supabase';

export interface ConnectionStatus {
  connected: boolean;
  lastChecked: Date;
  latency?: number;
  error?: string;
}

class DBConnectionWatchdog {
  private static instance: DBConnectionWatchdog;
  private status: ConnectionStatus = {
    connected: true,
    lastChecked: new Date(),
  };
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30000; // 30 seconds
  private readonly timeoutMs = 5000; // 5 second timeout
  private listeners: Set<(status: ConnectionStatus) => void> = new Set();

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): DBConnectionWatchdog {
    if (!DBConnectionWatchdog.instance) {
      DBConnectionWatchdog.instance = new DBConnectionWatchdog();
    }
    return DBConnectionWatchdog.instance;
  }

  private async checkConnection(): Promise<void> {
    const startTime = Date.now();
    try {
      // Simple health check query with timeout using Promise.race
      const queryPromise = supabase
        .from('categories')
        .select('id')
        .limit(1);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), this.timeoutMs)
      );

      const { error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      const latency = Date.now() - startTime;

      if (error) {
        this.status = {
          connected: false,
          lastChecked: new Date(),
          latency,
          error: error.message,
        };
      } else {
        this.status = {
          connected: true,
          lastChecked: new Date(),
          latency,
        };
      }
    } catch (error) {
      this.status = {
        connected: false,
        lastChecked: new Date(),
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    this.notifyListeners();
  }

  private startMonitoring(): void {
    // Check immediately
    this.checkConnection();

    // Set up interval
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, this.checkIntervalMs);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.status));
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Check if DB is connected
   */
  isConnected(): boolean {
    return this.status.connected;
  }

  /**
   * Subscribe to connection status changes
   */
  subscribe(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Manually trigger a connection check
   */
  async forceCheck(): Promise<ConnectionStatus> {
    await this.checkConnection();
    return this.getStatus();
  }

  /**
   * Stop monitoring (useful for cleanup)
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Resume monitoring
   */
  resumeMonitoring(): void {
    if (!this.checkInterval) {
      this.startMonitoring();
    }
  }

  /**
   * Execute action only if connected, otherwise return error
   */
  async executeIfConnected<T>(action: () => Promise<T>): Promise<{ success: boolean; data?: T; error?: string }> {
    if (!this.isConnected()) {
      return {
        success: false,
        error: 'Database connection is currently unavailable. Please try again later.',
      };
    }

    try {
      const data = await action();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      };
    }
  }
}

// Export singleton instance
export const dbWatchdog = DBConnectionWatchdog.getInstance();

// Export convenience functions
export function useDBConnection() {
  const [status, setStatus] = React.useState<ConnectionStatus>(dbWatchdog.getStatus());

  React.useEffect(() => {
    const unsubscribe = dbWatchdog.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}

import React from 'react';
