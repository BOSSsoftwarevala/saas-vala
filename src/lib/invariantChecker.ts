/**
 * Invariant Check Engine
 * Enforces business rules and data integrity constraints
 * Blocks operations that would violate invariants
 */

import { eventLogger, EventType } from './eventLogger';

export enum InvariantType {
  WALLET_NON_NEGATIVE = 'wallet_non_negative',
  ORDER_HAS_USER = 'order_has_user',
  KEY_HAS_PRODUCT = 'key_has_product',
  USER_HAS_EMAIL = 'user_has_email',
  PRODUCT_HAS_PRICE = 'product_has_price',
  TRANSACTION_BALANCED = 'transaction_balanced',
}

export interface InvariantViolation {
  type: InvariantType;
  message: string;
  context?: Record<string, any>;
}

class InvariantChecker {
  private static instance: InvariantChecker;

  private constructor() {}

  static getInstance(): InvariantChecker {
    if (!InvariantChecker.instance) {
      InvariantChecker.instance = new InvariantChecker();
    }
    return InvariantChecker.instance;
  }

  /**
   * Check if wallet balance is non-negative
   * @param walletId The wallet ID
   * @param currentBalance The current wallet balance
   * @param amount The amount being deducted
   */
  checkWalletNonNegative(
    walletId: string,
    currentBalance: number,
    amount: number
  ): InvariantViolation | null {
    const newBalance = currentBalance - amount;
    
    if (newBalance < 0) {
      const violation: InvariantViolation = {
        type: InvariantType.WALLET_NON_NEGATIVE,
        message: `Wallet balance cannot be negative. Current: ${currentBalance}, Deducting: ${amount}, Result: ${newBalance}`,
        context: {
          walletId,
          currentBalance,
          amount,
          newBalance,
        },
      };
      
      eventLogger.logError('Invariant Violation: Wallet Non-Negative', new Error(violation.message));
      return violation;
    }
    
    return null;
  }

  /**
   * Check if order has a valid user
   * @param orderId The order ID
   * @param userId The user ID (can be null/undefined)
   */
  checkOrderHasUser(orderId: string, userId?: string | null): InvariantViolation | null {
    if (!userId) {
      const violation: InvariantViolation = {
        type: InvariantType.ORDER_HAS_USER,
        message: `Order must have a valid user. Order ID: ${orderId}`,
        context: {
          orderId,
          userId,
        },
      };
      
      eventLogger.logError('Invariant Violation: Order Has User', new Error(violation.message));
      return violation;
    }
    
    return null;
  }

  /**
   * Check if key has a valid product
   * @param keyId The key ID
   * @param productId The product ID (can be null/undefined)
   */
  checkKeyHasProduct(keyId: string, productId?: string | null): InvariantViolation | null {
    if (!productId) {
      const violation: InvariantViolation = {
        type: InvariantType.KEY_HAS_PRODUCT,
        message: `Key must have a valid product. Key ID: ${keyId}`,
        context: {
          keyId,
          productId,
        },
      };
      
      eventLogger.logError('Invariant Violation: Key Has Product', new Error(violation.message));
      return violation;
    }
    
    return null;
  }

  /**
   * Check if user has a valid email
   * @param userId The user ID
   * @param email The user email (can be null/undefined)
   */
  checkUserHasEmail(userId: string, email?: string | null): InvariantViolation | null {
    if (!email || !email.includes('@')) {
      const violation: InvariantViolation = {
        type: InvariantType.USER_HAS_EMAIL,
        message: `User must have a valid email. User ID: ${userId}`,
        context: {
          userId,
          email,
        },
      };
      
      eventLogger.logError('Invariant Violation: User Has Email', new Error(violation.message));
      return violation;
    }
    
    return null;
  }

  /**
   * Check if product has a valid price
   * @param productId The product ID
   * @param price The product price
   */
  checkProductHasPrice(productId: string, price?: number | null): InvariantViolation | null {
    if (price === null || price === undefined || price < 0) {
      const violation: InvariantViolation = {
        type: InvariantType.PRODUCT_HAS_PRICE,
        message: `Product must have a valid non-negative price. Product ID: ${productId}`,
        context: {
          productId,
          price,
        },
      };
      
      eventLogger.logError('Invariant Violation: Product Has Price', new Error(violation.message));
      return violation;
    }
    
    return null;
  }

  /**
   * Check if transaction is balanced (debit + credit = 0)
   * @param transactionId The transaction ID
   * @param debitAmount The debit amount
   * @param creditAmount The credit amount
   */
  checkTransactionBalanced(
    transactionId: string,
    debitAmount: number,
    creditAmount: number
  ): InvariantViolation | null {
    const balance = debitAmount + creditAmount;
    
    if (Math.abs(balance) > 0.01) { // Allow for floating point errors
      const violation: InvariantViolation = {
        type: InvariantType.TRANSACTION_BALANCED,
        message: `Transaction must be balanced. Debit: ${debitAmount}, Credit: ${creditAmount}, Balance: ${balance}`,
        context: {
          transactionId,
          debitAmount,
          creditAmount,
          balance,
        },
      };
      
      eventLogger.logError('Invariant Violation: Transaction Balanced', new Error(violation.message));
      return violation;
    }
    
    return null;
  }

  /**
   * Run multiple invariant checks and return the first violation
   * @param checks Array of invariant check results
   */
  checkMultiple(...checks: (InvariantViolation | null)[]): InvariantViolation | null {
    for (const check of checks) {
      if (check) {
        return check;
      }
    }
    return null;
  }

  /**
   * Throw an error if any invariant is violated
   * @param violation The invariant violation
   */
  throwIfViolated(violation: InvariantViolation | null): void {
    if (violation) {
      throw new Error(`Invariant Violation: ${violation.message}`);
    }
  }

  /**
   * Check if operation should be blocked based on invariant violations
   * @param violations Array of invariant violations
   */
  shouldBlockOperation(...violations: (InvariantViolation | null)[]): boolean {
    return violations.some(v => v !== null);
  }
}

// Export singleton instance
export const invariantChecker = InvariantChecker.getInstance();

// Export helper functions for common checks
export const checkWalletBalance = (
  walletId: string,
  currentBalance: number,
  amount: number
): void => {
  const violation = invariantChecker.checkWalletNonNegative(walletId, currentBalance, amount);
  invariantChecker.throwIfViolated(violation);
};

export const checkOrderUser = (orderId: string, userId?: string | null): void => {
  const violation = invariantChecker.checkOrderHasUser(orderId, userId);
  invariantChecker.throwIfViolated(violation);
};

export const checkKeyProduct = (keyId: string, productId?: string | null): void => {
  const violation = invariantChecker.checkKeyHasProduct(keyId, productId);
  invariantChecker.throwIfViolated(violation);
};
