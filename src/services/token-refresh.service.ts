// Auto Token Refresh Service - Automatic token refresh for Supabase
import { supabase } from '@/integrations/supabase/client';

class TokenRefreshService {
  private static instance: TokenRefreshService;
  private refreshInterval: NodeJS.Timeout | null = null;
  private refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry
  private isRefreshing = false;

  private constructor() {
    this.setupAutoRefresh();
  }

  static getInstance(): TokenRefreshService {
    if (!TokenRefreshService.instance) {
      TokenRefreshService.instance = new TokenRefreshService();
    }
    return TokenRefreshService.instance;
  }

  private setupAutoRefresh(): void {
    // Check token every minute
    this.refreshInterval = setInterval(() => {
      this.checkAndRefreshToken();
    }, 60000);

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('[TokenRefresh] Token refreshed successfully');
      } else if (event === 'SIGNED_OUT') {
        console.log('[TokenRefresh] User signed out, stopping refresh');
        this.stopAutoRefresh();
      }
    });
  }

  private async checkAndRefreshToken(): Promise<void> {
    if (this.isRefreshing) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const now = Date.now();
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const timeUntilExpiry = expiresAt - now;

      // Refresh if token is about to expire
      if (timeUntilExpiry < this.refreshThreshold) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error('[TokenRefresh] Error checking token:', error);
    }
  }

  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) return false;

    this.isRefreshing = true;

    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[TokenRefresh] Failed to refresh token:', error);
        return false;
      }

      console.log('[TokenRefresh] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[TokenRefresh] Error refreshing token:', error);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.setupAutoRefresh();
  }

  getTokenExpiry(): number | null {
    const expiresAt = localStorage.getItem('sb-astmdnelnuqwpdbyzecr-token-expires-at');
    return expiresAt ? parseInt(expiresAt, 10) : null;
  }

  isTokenExpiringSoon(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return false;
    
    const now = Date.now();
    const timeUntilExpiry = expiry - now;
    
    return timeUntilExpiry < this.refreshThreshold;
  }

  async forceRefresh(): Promise<boolean> {
    return this.refreshToken();
  }
}

export const tokenRefreshService = TokenRefreshService.getInstance();

// Convenience function
export async function refreshToken(): Promise<boolean> {
  return tokenRefreshService.refreshToken();
}
