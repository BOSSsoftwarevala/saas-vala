// Wallet Hard Lock Service - System-wide wallet balance control
import { supabase } from '@/lib/supabase';

export interface WalletBalance {
  balance: number;
  currency: string;
  user_id: string;
}

export class WalletLockService {
  private static instance: WalletLockService;
  private lockThreshold = 50; // $50 minimum balance
  private isLocked = false;
  private currentBalance = 0;
  private listeners: Set<(locked: boolean, balance: number) => void> = new Set();

  private constructor() {
    this.checkWalletBalance();
  }

  static getInstance(): WalletLockService {
    if (!WalletLockService.instance) {
      WalletLockService.instance = new WalletLockService();
    }
    return WalletLockService.instance;
  }

  /**
   * Check wallet balance and update lock status
   */
  async checkWalletBalance(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return false;
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('balance, currency, user_id')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        console.error('Error fetching wallet balance:', error);
        return false;
      }

      this.currentBalance = data.balance;
      const wasLocked = this.isLocked;
      this.isLocked = data.balance < this.lockThreshold;

      // Notify listeners if lock status changed
      if (wasLocked !== this.isLocked) {
        this.notifyListeners();
      }

      return this.isLocked;
    } catch (error) {
      console.error('Error checking wallet balance:', error);
      return false;
    }
  }

  /**
   * Get current lock status
   */
  getLockStatus(): { locked: boolean; balance: number; threshold: number } {
    return {
      locked: this.isLocked,
      balance: this.currentBalance,
      threshold: this.lockThreshold,
    };
  }

  /**
   * Get current balance
   */
  getCurrentBalance(): number {
    return this.currentBalance;
  }

  /**
   * Check if system is locked
   */
  isSystemLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Subscribe to lock status changes
   */
  subscribe(callback: (locked: boolean, balance: number) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of lock status change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      callback(this.isLocked, this.currentBalance);
    });
  }

  /**
   * Force refresh wallet balance
   */
  async refreshBalance(): Promise<void> {
    await this.checkWalletBalance();
  }

  /**
   * Set custom lock threshold (for testing or special cases)
   */
  setLockThreshold(threshold: number): void {
    this.lockThreshold = threshold;
    this.checkWalletBalance();
  }

  /**
   * Get lock threshold
   */
  getLockThreshold(): number {
    return this.lockThreshold;
  }

  /**
   * Check if action is allowed based on wallet balance
   */
  async isActionAllowed(): Promise<{ allowed: boolean; reason?: string }> {
    const isLocked = await this.checkWalletBalance();
    
    if (isLocked) {
      return {
        allowed: false,
        reason: `Wallet balance ($${this.currentBalance.toFixed(2)}) is below minimum threshold ($${this.lockThreshold}). Please add credits to continue.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Unlock system (for testing or admin override)
   */
  unlockSystem(): void {
    this.isLocked = false;
    this.notifyListeners();
  }

  /**
   * Lock system (for testing or admin action)
   */
  lockSystem(): void {
    this.isLocked = true;
    this.notifyListeners();
  }
}

export const walletLockService = WalletLockService.getInstance();
