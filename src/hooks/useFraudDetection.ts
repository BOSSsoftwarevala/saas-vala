import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  checkRateLimit,
  registerPaymentRef,
  verifyAmount,
  getDeviceId,
  recordActivity,
} from '@/lib/security';

// ─────────────────────────────────────────────────────────────────────────────
// Payment-fraud specific limits
// ─────────────────────────────────────────────────────────────────────────────
const PAYMENT_RATE_LIMIT = 5;           // max payment attempts per 60-second window
const PAYMENT_RATE_WINDOW_MS = 60_000;  // 60-second sliding window

interface FraudCheckResult {
  isBlocked: boolean;
  violationCount: number;
  totalFines: number;
  canProceed: boolean;
  message: string;
}

export interface PaymentFraudCheck {
  allowed: boolean;
  status: 'ok' | 'duplicate_ref' | 'amount_mismatch' | 'rate_limited' | 'review_required';
  message: string;
}

interface ViolationRecord {
  id: string;
  user_id: string;
  email: string;
  violation_type: string;
  violation_count: number;
  fine_amount: number;
  total_fines_paid: number;
  is_blocked: boolean;
  blocked_at: string | null;
  last_violation_at: string;
}

// Fine structure: 1st = $2, 2nd = $5, 3rd = permanent block
const FINE_STRUCTURE = {
  first: 2,
  second: 5,
  third: 'permanent_block' as const
};

export function useFraudDetection() {
  const [checking, setChecking] = useState(false);

  // Check if user is blocked or has violations
  const checkUserStatus = async (userId: string, _email: string): Promise<FraudCheckResult> => {
    setChecking(true);
    
    try {
      const { data: violations, error } = await supabase
        .from('user_violations')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Fraud check error:', error);
      }

      const record = violations as ViolationRecord | null;

      if (!record) {
        setChecking(false);
        return {
          isBlocked: false,
          violationCount: 0,
          totalFines: 0,
          canProceed: true,
          message: 'User is in good standing'
        };
      }

      if (record.is_blocked) {
        setChecking(false);
        return {
          isBlocked: true,
          violationCount: record.violation_count,
          totalFines: record.total_fines_paid,
          canProceed: false,
          message: '⛔ PERMANENTLY BLOCKED: This account has been blocked due to repeated fraud violations.'
        };
      }

      setChecking(false);
      return {
        isBlocked: false,
        violationCount: record.violation_count,
        totalFines: record.total_fines_paid,
        canProceed: true,
        message: `Warning: ${record.violation_count} previous violation(s). Total fines: $${record.total_fines_paid}`
      };
    } catch (_error) {
      setChecking(false);
      return {
        isBlocked: false,
        violationCount: 0,
        totalFines: 0,
        canProceed: true,
        message: 'Unable to verify status'
      };
    }
  };

  // Report a fraud violation
  const reportViolation = async (
    userId: string, 
    email: string, 
    reason: string,
    productId?: string
  ): Promise<{ success: boolean; fine: number; blocked: boolean; message: string }> => {
    setChecking(true);

    try {
      // Check existing violations
      const { data: existing } = await supabase
        .from('user_violations')
        .select('*')
        .eq('user_id', userId)
        .single();

      const record = existing as ViolationRecord | null;
      let newCount = 1;
      let fine = FINE_STRUCTURE.first;
      let shouldBlock = false;

      if (record) {
        newCount = record.violation_count + 1;
        
        if (newCount === 2) {
          fine = FINE_STRUCTURE.second;
        } else if (newCount >= 3) {
          shouldBlock = true;
          fine = 0; // No fine, just block
        }
      }

      if (record) {
        // Update existing record
        await supabase
          .from('user_violations')
          .update({
            violation_count: newCount,
            fine_amount: fine,
            total_fines_paid: (record.total_fines_paid || 0) + fine,
            is_blocked: shouldBlock,
            blocked_at: shouldBlock ? new Date().toISOString() : null,
            last_violation_at: new Date().toISOString(),
            details: {
              ...(typeof (record as any).details === 'object' ? (record as any).details : {}),
              [`violation_${newCount}`]: {
                reason,
                product_id: productId,
                timestamp: new Date().toISOString()
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', record.id);
      } else {
        // Create new violation record
        await supabase
          .from('user_violations')
          .insert({
            user_id: userId,
            email,
            violation_type: 'fraud',
            violation_count: 1,
            fine_amount: fine,
            total_fines_paid: fine,
            is_blocked: false,
            details: {
              violation_1: {
                reason,
                product_id: productId,
                timestamp: new Date().toISOString()
              }
            }
          });
      }

      // Deduct fine from wallet if applicable
      if (fine > 0) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', userId)
          .single();

        if (wallet) {
          const newBalance = Math.max(0, (wallet.balance || 0) - fine);
          
          await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', wallet.id);

          await supabase.from('transactions').insert({
            wallet_id: wallet.id,
            type: 'debit',
            amount: fine,
            balance_after: newBalance,
            status: 'completed',
            description: `⚠️ FRAUD FINE: Violation #${newCount} - ${reason}`,
            reference_type: 'fraud_fine'
          });
        }
      }

      // Log the violation
      await supabase.from('activity_logs').insert({
        entity_type: 'fraud_violation',
        entity_id: userId,
        action: shouldBlock ? 'permanent_block' : `violation_${newCount}`,
        performed_by: userId,
        details: {
          email,
          reason,
          fine,
          violation_number: newCount,
          is_blocked: shouldBlock
        }
      });

      setChecking(false);

      if (shouldBlock) {
        toast.error('⛔ ACCOUNT PERMANENTLY BLOCKED due to repeated fraud violations!');
        return {
          success: true,
          fine: 0,
          blocked: true,
          message: '⛔ PERMANENTLY BLOCKED: 3rd violation detected. Account has been permanently blocked.'
        };
      }

      toast.error(`⚠️ Fraud detected! Fine of $${fine} applied. Violation #${newCount}`);
      return {
        success: true,
        fine,
        blocked: false,
        message: `Violation #${newCount} recorded. Fine of $${fine} applied to wallet.`
      };
    } catch (error) {
      setChecking(false);
      console.error('Report violation error:', error);
      return {
        success: false,
        fine: 0,
        blocked: false,
        message: 'Failed to record violation'
      };
    }
  };

  // Verify license key matches transaction
  const verifyLicenseKey = async (
    licenseKey: string, 
    userId: string
  ): Promise<{ valid: boolean; message: string }> => {
    try {
      // Check if this license exists and belongs to user
      const { data: download, error } = await supabase
        .from('apk_downloads')
        .select('*')
        .eq('license_key', licenseKey)
        .eq('user_id', userId)
        .single();

      if (error || !download) {
        return {
          valid: false,
          message: 'Invalid license key or not found for this user'
        };
      }

      if (download.is_blocked) {
        return {
          valid: false,
          message: '⛔ This license has been blocked: ' + (download.blocked_reason || 'Fraud detected')
        };
      }

      return {
        valid: true,
        message: 'License verified successfully'
      };
    } catch (_error) {
      return {
        valid: false,
        message: 'Verification failed'
      };
    }
  };

  // Block a specific APK license
  const blockLicense = async (licenseKey: string, reason: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('apk_downloads')
        .update({
          is_blocked: true,
          blocked_reason: reason
        })
        .eq('license_key', licenseKey);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Block license error:', error);
      return false;
    }
  };

  // ─── Phase 2: Payment fraud detection ──────────────────────────────────
  /**
   * Validate a payment attempt before submitting it.
   *
   * Checks:
   *  1. Client-side rate limit (5 attempts / 60 s)
   *  2. Duplicate payment reference
   *  3. Amount sanity (declared amount must equal server amount)
   *  4. Flags any payment reference already stored in DB as REVIEW REQUIRED
   */
  const checkPaymentFraud = async (
    userId: string,
    amount: number,
    serverAmount: number,
    referenceId: string
  ): Promise<PaymentFraudCheck> => {
    setChecking(true);
    try {
      // 1. Rate limit
      const rateLimitKey = `payment:${userId}`;
      if (!checkRateLimit(rateLimitKey, PAYMENT_RATE_LIMIT, PAYMENT_RATE_WINDOW_MS)) {
        toast.error('⚠️ Too many payment attempts. Please wait before trying again.');
        await supabase.from('activity_logs').insert({
          entity_type: 'payment_fraud',
          entity_id: userId,
          action: 'rate_limited',
          performed_by: userId,
          details: { referenceId, amount },
        });
        return {
          allowed: false,
          status: 'rate_limited',
          message: 'Too many payment attempts in a short time. Please wait.',
        };
      }

      // 2. Amount verification (server-side value must match declared value)
      if (!verifyAmount(amount, serverAmount)) {
        toast.error('⚠️ Payment amount mismatch detected.');
        await supabase.from('activity_logs').insert({
          entity_type: 'payment_fraud',
          entity_id: userId,
          action: 'amount_mismatch',
          performed_by: userId,
          details: { referenceId, declaredAmount: amount, serverAmount },
        });
        return {
          allowed: false,
          status: 'amount_mismatch',
          message: 'Payment amount mismatch. Transaction blocked.',
        };
      }

      // 3. Duplicate reference — check client-side registry
      if (!registerPaymentRef(referenceId)) {
        toast.error('⚠️ Duplicate payment reference detected.');
        await supabase.from('activity_logs').insert({
          entity_type: 'payment_fraud',
          entity_id: userId,
          action: 'duplicate_ref_client',
          performed_by: userId,
          details: { referenceId, amount },
        });
        return {
          allowed: false,
          status: 'duplicate_ref',
          message: 'This payment reference has already been used.',
        };
      }

      // 4. Duplicate reference — cross-check DB
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('reference_id', referenceId)
        .limit(1);

      if (existingTx && existingTx.length > 0) {
        // Flag as REVIEW REQUIRED
        const deviceId = await getDeviceId();
        await supabase.from('activity_logs').insert({
          entity_type: 'payment_fraud',
          entity_id: userId,
          action: 'duplicate_ref_db',
          performed_by: userId,
          details: {
            referenceId,
            amount,
            deviceId,
            review_required: true,
          },
        });
        toast.warning('⚠️ Payment flagged for review.');
        recordActivity('duplicate_payment');
        return {
          allowed: false,
          status: 'review_required',
          message: 'Payment flagged as REVIEW REQUIRED — duplicate reference found.',
        };
      }

      return { allowed: true, status: 'ok', message: 'Payment checks passed.' };
    } finally {
      setChecking(false);
    }
  };

  return {
    checking,
    checkUserStatus,
    reportViolation,
    verifyLicenseKey,
    blockLicense,
    checkPaymentFraud,
  };
}
