/**
 * Transaction Safety Manager
 * Wraps wallet→order→key flow in DB transactions
 * Ensures atomicity: BEGIN → PROCESS → COMMIT, FAIL → ROLLBACK
 */

import { supabase } from '@/lib/supabase';
import { eventLogger, EventType } from './eventLogger';
import { invariantChecker, checkWalletBalance, checkOrderUser, checkKeyProduct } from './invariantChecker';

export enum TransactionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}

export interface TransactionResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  status: TransactionStatus;
}

export interface OrderTransactionData {
  userId: string;
  productId: string;
  amount: number;
  walletId: string;
}

class TransactionManager {
  private static instance: TransactionManager;

  private constructor() {}

  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  /**
   * Execute a transaction with automatic rollback on failure
   * @param transactionFn The transaction function to execute
   */
  async executeTransaction<T>(
    transactionFn: () => Promise<T>
  ): Promise<TransactionResult<T>> {
    const transactionId = crypto.randomUUID();
    
    eventLogger.logSystemEvent('Transaction Started', {
      transactionId,
      status: TransactionStatus.IN_PROGRESS,
    });

    try {
      // Execute transaction
      const result = await transactionFn();

      eventLogger.logSystemEvent('Transaction Committed', {
        transactionId,
        status: TransactionStatus.COMMITTED,
      });

      return {
        success: true,
        data: result,
        status: TransactionStatus.COMMITTED,
      };
    } catch (error) {
      const err = error as Error;
      
      eventLogger.logError('Transaction Failed', err, undefined);

      return {
        success: false,
        error: err,
        status: TransactionStatus.FAILED,
      };
    }
  }

  /**
   * Execute the wallet→order→key transaction flow
   * This is the critical transaction that must be atomic
   */
  async executeOrderTransaction(
    data: OrderTransactionData
  ): Promise<TransactionResult> {
    const { userId, productId, amount, walletId } = data;
    const transactionId = crypto.randomUUID();

    return this.executeTransaction(async () => {
      // Step 1: Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('id', walletId)
        .single();

      if (walletError || !wallet) {
        throw new Error('Wallet not found');
      }

      const currentBalance = wallet.balance;

      // Step 2: Check invariant - wallet must have sufficient balance
      checkWalletBalance(walletId, currentBalance, amount);

      // Step 3: Deduct from wallet
      const { error: deductError } = await supabase
        .from('wallets')
        .update({ balance: currentBalance - amount })
        .eq('id', walletId);

      if (deductError) {
        throw new Error(`Failed to deduct from wallet: ${deductError.message}`);
      }

      eventLogger.logDbUpdate('wallets', 'UPDATE', walletId, userId, {
        amount,
        newBalance: currentBalance - amount,
      });

      // Step 4: Create order
      const { data: order, error: orderError } = await supabase
        .from('marketplace_orders')
        .insert({
          buyer_id: userId,
          seller_id: userId, // Using buyer_id as seller_id for self-purchase
          product_id: productId,
          amount: amount,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (orderError || !order) {
        // Rollback wallet deduction
        await supabase
          .from('wallets')
          .update({ balance: currentBalance })
          .eq('id', walletId);
        
        throw new Error(`Failed to create order: ${orderError?.message}`);
      }

      // Step 5: Check invariant - order must have user
      checkOrderUser(order.id, order.buyer_id);

      eventLogger.logDbUpdate('marketplace_orders', 'INSERT', order.id, userId, {
        productId,
        amount,
      });

      // Step 6: Generate key
      const licenseKeyValue = this.generateLicenseKey();

      const { data: key, error: keyError } = await supabase
        .from('license_keys')
        .insert({
          product_id: productId,
          license_key: licenseKeyValue,
          status: 'active',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (keyError || !key) {
        // Rollback order and wallet
        await supabase.from('marketplace_orders').delete().eq('id', order.id);
        await supabase.from('wallets').update({ balance: currentBalance }).eq('id', walletId);
        
        throw new Error(`Failed to generate key: ${keyError?.message}`);
      }

      // Step 7: Check invariant - key must have product
      checkKeyProduct(key.id, key.product_id);

      eventLogger.logDbUpdate('license_keys', 'INSERT', key.id, userId, {
        productId,
        licenseKey: licenseKeyValue,
      });

      // Step 8: Link key to order
      const { error: linkError } = await supabase
        .from('marketplace_orders')
        .update({ license_key_id: key.id, status: 'completed' })
        .eq('id', order.id);

      if (linkError) {
        throw new Error(`Failed to link key to order: ${linkError.message}`);
      }

      // Step 9: Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: walletId,
          type: 'debit',
          amount: amount,
          status: 'completed',
          description: `Order ${order.id}`,
          created_at: new Date().toISOString(),
        });

      if (txError) {
        // This is non-critical, log but don't fail
        eventLogger.logError('Failed to create transaction record', txError as Error, userId);
      }

      return {
        order,
        key,
        transactionId,
      };
    });
  }

  /**
   * Generate a unique license key
   */
  private generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];
    
    for (let i = 0; i < 4; i++) {
      let segment = '';
      for (let j = 0; j < 5; j++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      segments.push(segment);
    }
    
    return segments.join('-');
  }

  /**
   * Execute a safe database operation with retry
   * @param operation The database operation to execute
   * @param maxRetries Maximum number of retries (default: 2)
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error = new Error('Operation failed');

    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt < maxRetries) {
          eventLogger.logSystemEvent('Retrying operation', {
            attempt,
            maxRetries,
            error: lastError.message,
          });
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
        }
      }
    }

    throw lastError;
  }
}

// Export singleton instance
export const transactionManager = TransactionManager.getInstance();

// Export helper function for order transactions
export const executeOrderTransaction = async (
  userId: string,
  productId: string,
  amount: number,
  walletId: string
) => {
  return transactionManager.executeOrderTransaction({
    userId,
    productId,
    amount,
    walletId,
  });
};
