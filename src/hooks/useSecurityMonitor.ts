/**
 * useSecurityMonitor
 *
 * Unified hook for:
 * - Suspicious activity / AI fraud detection (Phase 7)
 * - Alert generation (Phase 8)
 * - Auto-block decisions (Phase 9)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getRiskScore, recordActivity, getDeviceId } from '@/lib/security';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAlert {
  id: string;
  userId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  createdAt: string;
  resolved: boolean;
}

export interface SecurityStatus {
  riskScore: number;            // 0-100
  isHighRisk: boolean;
  isFlagged: boolean;
  activeAlerts: SecurityAlert[];
}

const RISK_THRESHOLD_MEDIUM = 40;
const RISK_THRESHOLD_HIGH = 70;
const RISK_THRESHOLD_CRITICAL = 90;

export function useSecurityMonitor() {
  const [status, setStatus] = useState<SecurityStatus>({
    riskScore: 0,
    isHighRisk: false,
    isFlagged: false,
    activeAlerts: [],
  });
  const [processing, setProcessing] = useState(false);

  // ─── Log a security alert to the DB and optionally show a toast ───────────
  const raiseAlert = useCallback(
    async (
      userId: string,
      type: string,
      severity: AlertSeverity,
      message: string,
      details: Record<string, unknown> = {}
    ): Promise<void> => {
      try {
        await supabase.from('activity_logs').insert({
          entity_type: 'security_alert',
          entity_id: userId,
          action: type,
          performed_by: userId,
          details: { severity, message, ...details },
        });

        const newAlert: SecurityAlert = {
          id: crypto.randomUUID(),
          userId,
          type,
          severity,
          message,
          details,
          createdAt: new Date().toISOString(),
          resolved: false,
        };

        setStatus((prev) => ({
          ...prev,
          isFlagged: prev.isFlagged || severity === 'critical' || severity === 'high',
          activeAlerts: [newAlert, ...prev.activeAlerts].slice(0, 50),
        }));

        if (severity === 'critical') {
          toast.error(`🚨 SECURITY ALERT: ${message}`);
        } else if (severity === 'high') {
          toast.warning(`⚠️ Security Warning: ${message}`);
        }
      } catch (e) {
        console.error('raiseAlert error:', e);
      }
    },
    []
  );

  // ─── Evaluate current risk level and raise alert if needed ──────────────
  const evaluateRisk = useCallback(
    async (userId: string, actionType: string): Promise<number> => {
      const score = recordActivity(actionType);

      let severity: AlertSeverity | null = null;
      let message = '';

      if (score >= RISK_THRESHOLD_CRITICAL) {
        severity = 'critical';
        message = `Extreme activity burst detected (score: ${score}). Account may be compromised.`;
      } else if (score >= RISK_THRESHOLD_HIGH) {
        severity = 'high';
        message = `High-frequency activity detected (score: ${score}). Possible automated abuse.`;
      } else if (score >= RISK_THRESHOLD_MEDIUM) {
        severity = 'medium';
        message = `Elevated activity level (score: ${score}). Monitoring for further actions.`;
      }

      if (severity) {
        await raiseAlert(userId, 'activity_burst', severity, message, {
          actionType,
          riskScore: score,
        });
      }

      setStatus((prev) => ({
        ...prev,
        riskScore: score,
        isHighRisk: score >= RISK_THRESHOLD_HIGH,
      }));

      return score;
    },
    [raiseAlert]
  );

  // ─── Monitor a payment attempt ─────────────────────────────────────────
  const monitorPayment = useCallback(
    async (
      userId: string,
      amount: number,
      referenceId: string
    ): Promise<{ allowed: boolean; reason?: string }> => {
      setProcessing(true);
      try {
        const score = await evaluateRisk(userId, 'payment_attempt');

        if (score >= RISK_THRESHOLD_CRITICAL) {
          await raiseAlert(
            userId,
            'payment_blocked_risk',
            'critical',
            `Payment of ${amount} blocked — critical risk score ${score}`,
            { amount, referenceId }
          );
          return { allowed: false, reason: 'Account temporarily restricted due to suspicious activity.' };
        }

        // Check for duplicate reference in DB
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('reference_id', referenceId)
          .limit(1);

        if (existingTx && existingTx.length > 0) {
          await raiseAlert(
            userId,
            'duplicate_payment_ref',
            'high',
            `Duplicate payment reference detected: ${referenceId}`,
            { amount, referenceId }
          );
          return { allowed: false, reason: 'Duplicate payment reference detected.' };
        }

        return { allowed: true };
      } finally {
        setProcessing(false);
      }
    },
    [evaluateRisk, raiseAlert]
  );

  // ─── Monitor a wallet operation ────────────────────────────────────────
  const monitorWalletOp = useCallback(
    async (
      userId: string,
      operation: 'debit' | 'credit' | 'withdraw',
      amount: number,
      currentBalance: number
    ): Promise<{ allowed: boolean; reason?: string }> => {
      // Negative balance guard
      if (operation === 'debit' || operation === 'withdraw') {
        if (amount > currentBalance) {
          await raiseAlert(
            userId,
            'insufficient_balance',
            'medium',
            `Wallet operation blocked: requested ${amount}, balance ${currentBalance}`,
            { operation, amount, currentBalance }
          );
          return { allowed: false, reason: 'Insufficient wallet balance.' };
        }
        if (amount <= 0) {
          await raiseAlert(
            userId,
            'invalid_amount',
            'high',
            `Invalid amount ${amount} for wallet operation`,
            { operation, amount }
          );
          return { allowed: false, reason: 'Invalid transaction amount.' };
        }
      }

      // Check if wallet is locked in DB
      const { data: wallet } = await supabase
        .from('wallets')
        .select('is_locked')
        .eq('user_id', userId)
        .single();

      if (wallet?.is_locked) {
        await raiseAlert(
          userId,
          'locked_wallet_access',
          'critical',
          'Attempt to use a frozen wallet',
          { operation, amount }
        );
        return { allowed: false, reason: 'Wallet is frozen. Contact support.' };
      }

      return { allowed: true };
    },
    [raiseAlert]
  );

  // ─── Monitor a license activation ─────────────────────────────────────
  const monitorLicenseActivation = useCallback(
    async (
      userId: string,
      licenseId: string,
      deviceId: string
    ): Promise<{ allowed: boolean; reason?: string }> => {
      setProcessing(true);
      try {
        const { data: license } = await supabase
          .from('license_keys')
          .select('max_devices, activated_devices, status, device_id')
          .eq('id', licenseId)
          .single();

        if (!license) {
          return { allowed: false, reason: 'License not found.' };
        }

        if (license.status !== 'active') {
          await raiseAlert(
            userId,
            'inactive_license_activation',
            'high',
            `Attempt to activate a ${license.status} license`,
            { licenseId, deviceId }
          );
          return { allowed: false, reason: `License is ${license.status}.` };
        }

        if (license.activated_devices >= license.max_devices) {
          await raiseAlert(
            userId,
            'license_device_limit_exceeded',
            'high',
            `License ${licenseId} already at max devices (${license.max_devices})`,
            { licenseId, deviceId, maxDevices: license.max_devices }
          );

          // Auto-deactivate when limit exceeded with a different device
          if (license.device_id && license.device_id !== deviceId) {
            await supabase
              .from('license_keys')
              .update({ status: 'suspended' })
              .eq('id', licenseId);

            await raiseAlert(
              userId,
              'license_auto_deactivated',
              'critical',
              `License ${licenseId} auto-deactivated: multi-device abuse detected`,
              { licenseId, deviceId }
            );
            return {
              allowed: false,
              reason: 'License deactivated due to multi-device abuse. Contact support.',
            };
          }

          return { allowed: false, reason: 'Device limit reached for this license.' };
        }

        return { allowed: true };
      } finally {
        setProcessing(false);
      }
    },
    [raiseAlert]
  );

  // ─── Freeze a user wallet (auto-block) ────────────────────────────────
  const freezeWallet = useCallback(async (userId: string, reason: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('wallets')
        .update({ is_locked: true })
        .eq('user_id', userId);

      if (error) throw error;

      await raiseAlert(userId, 'wallet_frozen', 'critical', `Wallet frozen: ${reason}`, {
        reason,
      });
      toast.error('🔒 Wallet frozen due to suspicious activity.');
      return true;
    } catch (e) {
      console.error('freezeWallet error:', e);
      return false;
    }
  }, [raiseAlert]);

  // ─── Get current device fingerprint ───────────────────────────────────
  const getDeviceFingerprint = useCallback(async (): Promise<string> => {
    return getDeviceId();
  }, []);

  // ─── Refresh current risk score ────────────────────────────────────────
  const refreshRiskScore = useCallback((): number => {
    const score = getRiskScore();
    setStatus((prev) => ({
      ...prev,
      riskScore: score,
      isHighRisk: score >= RISK_THRESHOLD_HIGH,
    }));
    return score;
  }, []);

  return {
    status,
    processing,
    raiseAlert,
    evaluateRisk,
    monitorPayment,
    monitorWalletOp,
    monitorLicenseActivation,
    freezeWallet,
    getDeviceFingerprint,
    refreshRiskScore,
  };
}
