/**
 * Wallet Self-Heal
 * Recalculate from ledger on mismatch
 */

import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface WalletHealResult {
  walletId: string;
  healed: boolean;
  oldBalance: number;
  newBalance: number;
  transactions: number;
  errors: string[];
  timestamp: string;
}

class WalletSelfHeal {
  async healWallet(walletId: string): Promise<WalletHealResult> {
    const result: WalletHealResult = {
      walletId,
      healed: false,
      oldBalance: 0,
      newBalance: 0,
      transactions: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get current wallet balance
      const { data: walletData } = await localApi.select('wallets').eq('id', walletId).execute();
      const wallets = (walletData as any)?.data || [];
      const wallet = wallets[0];

      if (!wallet) {
        result.errors.push('Wallet not found');
        return result;
      }

      result.oldBalance = wallet.balance || 0;

      // Get all ledger entries for this wallet
      const { data: ledgerData } = await localApi.select('wallet_ledger').eq('wallet_id', walletId).execute();
      const ledgerEntries = (ledgerData as any)?.data || [];
      result.transactions = ledgerEntries.length;

      // Calculate balance from ledger
      let calculatedBalance = 0;

      for (const entry of ledgerEntries) {
        if (entry.type === 'credit') {
          calculatedBalance += entry.amount || 0;
        } else if (entry.type === 'debit') {
          calculatedBalance -= entry.amount || 0;
        }
      }

      result.newBalance = calculatedBalance;

      // Check if there's a mismatch
      const tolerance = 0.01; // Small tolerance for floating point errors
      const hasMismatch = Math.abs(result.oldBalance - result.newBalance) > tolerance;

      if (hasMismatch) {
        // Update wallet balance
        await localApi.update('wallets', { balance: calculatedBalance }, { id: walletId });
        result.healed = true;

        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'medium',
          module: 'wallet_self_heal',
          message: `Wallet ${walletId} balance healed: ${result.oldBalance} → ${result.newBalance}`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'balance_recalculated',
        });
      } else {
        result.healed = true; // No healing needed, but marked as success
      }

    } catch (error) {
      result.errors.push(`Wallet heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async healAllWallets(): Promise<WalletHealResult[]> {
    const results: WalletHealResult[] = [];

    try {
      // Get all wallets
      const { data: walletsData } = await localApi.select('wallets').execute();
      const wallets = (walletsData as any)?.data || [];

      for (const wallet of wallets) {
        const result = await this.healWallet(wallet.id);
        results.push(result);
      }
    } catch (error) {
      console.error('Failed to heal all wallets:', error);
    }

    return results;
  }

  async validateWalletBalance(walletId: string, expectedBalance: number): Promise<boolean> {
    try {
      const { data: walletData } = await localApi.select('wallets').eq('id', walletId).execute();
      const wallets = (walletData as any)?.data || [];
      const wallet = wallets[0];

      if (!wallet) return false;

      const tolerance = 0.01;
      return Math.abs((wallet.balance || 0) - expectedBalance) <= tolerance;
    } catch {
      return false;
    }
  }

  async getWalletSummary(walletId: string): Promise<{
    balance: number;
    transactions: number;
    lastTransaction?: string;
    valid: boolean;
  }> {
    try {
      const { data: walletData } = await localApi.select('wallets').eq('id', walletId).execute();
      const wallets = (walletData as any)?.data || [];
      const wallet = wallets[0];

      if (!wallet) {
        return { balance: 0, transactions: 0, valid: false };
      }

      const { data: ledgerData } = await localApi.select('wallet_ledger')
        .eq('wallet_id', walletId)
        .order('created_at', false)
        .limit(1)
        .execute();

      const ledgerEntries = (ledgerData as any)?.data || [];
      const lastTransaction = ledgerEntries[0]?.created_at;

      // Validate balance
      const healResult = await this.healWallet(walletId);
      const valid = !healResult.errors.length;

      return {
        balance: wallet.balance || 0,
        transactions: healResult.transactions,
        lastTransaction,
        valid,
      };
    } catch {
      return { balance: 0, transactions: 0, valid: false };
    }
  }
}

// Singleton instance
export const walletSelfHeal = new WalletSelfHeal();
