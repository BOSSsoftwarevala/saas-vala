// Cleanup Service - Proper logout and state cleanup
import { supabase } from '@/integrations/supabase/client';

class CleanupService {
  private static instance: CleanupService;

  private constructor() {}

  static getInstance(): CleanupService {
    if (!CleanupService.instance) {
      CleanupService.instance = new CleanupService();
    }
    return CleanupService.instance;
  }

  async performFullCleanup(): Promise<void> {
    try {
      // 1. Sign out from Supabase
      await supabase.auth.signOut();

      // 2. Clear all Supabase auth state
      localStorage.removeItem('sb-astmdnelnuqwpdbyzecr-auth-token');
      localStorage.removeItem('sb-astmdnelnuqwpdbyzecr-user-role');
      localStorage.removeItem('sb-astmdnelnuqwpdbyzecr-session');

      // 3. Clear application state
      localStorage.removeItem('user_preferences');
      localStorage.removeItem('search_history');
      localStorage.removeItem('cache_data');
      localStorage.removeItem('wallet_balance');

      // 4. Clear session storage
      sessionStorage.clear();

      // 5. Clear any custom app state
      this.clearAppState();

      // 6. Clear IndexedDB (if used)
      await this.clearIndexedDB();

      // 7. Clear service worker cache (if used)
      await this.clearServiceWorkerCache();

      console.log('[CleanupService] Full cleanup completed successfully');
    } catch (error) {
      console.error('[CleanupService] Error during cleanup:', error);
      // Even if cleanup fails, try to force clear basic auth data
      this.forceCleanup();
    }
  }

  private clearAppState(): void {
    // Clear any app-specific state
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('app_') || key.startsWith('saas_'))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  private async clearIndexedDB(): Promise<void> {
    try {
      const databases = await indexedDB.databases();
      
      for (const db of databases) {
        if (db.name) {
          try {
            indexedDB.deleteDatabase(db.name);
          } catch (error) {
            console.error(`[CleanupService] Failed to delete IndexedDB ${db.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[CleanupService] Error clearing IndexedDB:', error);
    }
  }

  private async clearServiceWorkerCache(): Promise<void> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    } catch (error) {
      console.error('[CleanupService] Error clearing service worker cache:', error);
    }
  }

  private forceCleanup(): void {
    // Force clear everything if normal cleanup fails
    localStorage.clear();
    sessionStorage.clear();
    
    // Force reload to ensure clean state
    window.location.href = '/';
  }

  async clearCache(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`[CleanupService] Error clearing cache for ${key}:`, error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      // Clear only app-specific cache, not auth tokens
      const keysToKeep = [
        'sb-astmdnelnuqwpdbyzecr-auth-token',
        'sb-astmdnelnuqwpdbyzecr-user-role',
        'sb-astmdnelnuqwpdbyzecr-session',
      ];

      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();
    } catch (error) {
      console.error('[CleanupService] Error clearing cache:', error);
    }
  }

  getCleanupStatus(): {
    localStorageSize: number;
    sessionStorageSize: number;
    indexedDBDatabases: number;
  } {
    let localStorageSize = 0;
    let sessionStorageSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        localStorageSize += localStorage.getItem(key)?.length || 0;
      }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        sessionStorageSize += sessionStorage.getItem(key)?.length || 0;
      }
    }

    return {
      localStorageSize,
      sessionStorageSize,
      indexedDBDatabases: 0, // Will be calculated dynamically if needed
    };
  }
}

export const cleanupService = CleanupService.getInstance();

// Convenience functions
export async function performLogoutCleanup(): Promise<void> {
  await cleanupService.performFullCleanup();
}

export async function clearAppCache(): Promise<void> {
  await cleanupService.clearAllCache();
}

export function getCleanupStatus() {
  return cleanupService.getCleanupStatus();
}
