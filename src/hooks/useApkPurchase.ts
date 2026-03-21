import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useFraudDetection } from './useFraudDetection';
import { toast } from 'sonner';

interface ApkProduct {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller' | 'draft';
  price: number;
}

interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  licenseKey?: string;
  downloadUrl?: string;
  error?: string;
}

export function useApkPurchase() {
  const { user } = useAuth();
  const { checkUserStatus, reportViolation } = useFraudDetection();
  const [processing, setProcessing] = useState(false);

  // Generate transaction ID based license key with checksum
  const generateTransactionLicenseKey = (transactionId: string): string => {
    // Use transaction ID as the base for the license key
    // Format: TXN-{first8chars}-{last4chars}-{checksum}
    const cleanId = transactionId.replace(/-/g, '').toUpperCase();
    const checksum = Array.from(cleanId).reduce((acc, c) => (acc + c.charCodeAt(0)) % 1000, 0);
    return `TXN-${cleanId.substring(0, 8)}-${cleanId.substring(cleanId.length - 4)}-${checksum.toString().padStart(3, '0')}`;
  };

  // Helper: check if an ID looks like a valid UUID
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const purchaseApk = async (product: ApkProduct): Promise<PurchaseResult> => {
    if (!user) {
      return { success: false, error: 'Please sign in to download APK' };
    }

    const isGeneratedProduct = !isUuid(product.id);

    setProcessing(true);

    try {
      // Step 1: Check if user is blocked
      const fraudStatus = await checkUserStatus(user.id, user.email || '');
      
      if (fraudStatus.isBlocked) {
        setProcessing(false);
        toast.error(fraudStatus.message);
        return { success: false, error: fraudStatus.message };
      }

      // FIXED: Validate price before processing
      if (!Number.isFinite(product.price) || product.price <= 0) {
        throw new Error('Invalid product price');
      }

      // Step 2: Check wallet balance with version for optimistic locking
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance, version')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        throw new Error('Could not fetch wallet balance');
      }

      if ((wallet.balance || 0) < product.price) {
        throw new Error(`Insufficient balance. Need $${product.price}, have $${(wallet.balance || 0).toFixed(2)}`);
      }

      // Step 3: Create transaction (this becomes the license key source)
      const newBalance = (wallet.balance || 0) - product.price;
      
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'debit',
          amount: product.price,
          balance_after: newBalance,
          status: 'completed',
          description: `APK Purchase: ${product.title}`,
          reference_type: 'apk_purchase',
          meta: {
            product_id: product.id,
            product_title: product.title,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (txError || !transaction) {
        throw new Error('Failed to create transaction');
      }

      // Step 4: Generate license key from transaction ID
      const licenseKey = generateTransactionLicenseKey(transaction.id);

      // Step 5: Update wallet balance with optimistic locking to prevent race conditions
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString(),
          version: (wallet.version || 0) + 1
        })
        .eq('id', wallet.id)
        .eq('version', wallet.version);

      if (updateError) {
        throw new Error('Wallet update failed - balance conflict');
      }

      // Step 6: Create APK download record (only for real DB products)
      if (!isGeneratedProduct) {
        const { error: dlError } = await supabase.from('apk_downloads').insert({
          user_id: user.id,
          product_id: product.id,
          transaction_id: transaction.id,
          license_key: licenseKey,
          is_verified: true,
          verification_attempts: 0,
          is_blocked: false,
          created_at: new Date().toISOString()
        });
        
        if (dlError) throw new Error('Failed to create download record');
      }

      // Step 6.5: Save license key to license_keys table
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30-day license
      
      const { error: licenseError } = await supabase.from('license_keys').insert({
        product_id: isGeneratedProduct ? null : product.id,
        license_key: licenseKey,
        key_type: 'monthly' as const,
        status: 'active' as const,
        owner_email: user.email || null,
        owner_name: user.user_metadata?.full_name || null,
        max_devices: 1,
        activated_devices: 0,
        activated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        user_id: user.id,
        notes: `Purchased: ${product.title}`,
        meta: { product_title: product.title, transaction_id: transaction.id, product_id: product.id }
      });
      
      if (licenseError) throw new Error('Failed to save license key');

      // Step 7: Create marketplace order (only for real DB products)
      if (!isGeneratedProduct) {
        const { error: orderError } = await supabase
          .from('marketplace_orders')
          .insert({
            buyer_id: user.id,
            seller_id: user.id,
            amount: product.price,
            status: 'completed',
            payment_method: 'wallet',
            transaction_id: transaction.id,
            completed_at: new Date().toISOString()
          });
        
        if (orderError) throw new Error('Failed to create order');
      }

      // Step 8: Log activity
      await supabase.from('activity_logs').insert({
        entity_type: 'apk_download',
        entity_id: transaction.id,
        action: 'apk_purchased',
        performed_by: user.id,
        details: {
          product_id: product.id,
          product_title: product.title,
          license_key: licenseKey,
          amount: product.price,
          transaction_id: transaction.id,
          is_generated: isGeneratedProduct
        }
      }).catch(() => {}); // Non-critical

      // Step 9: Create notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '📱 APK Ready for Download',
        message: `${product.title} purchased. Your License Key: ${licenseKey}`,
        type: 'success',
        action_url: '/keys'
      }).catch(() => {}); // Non-critical

      setProcessing(false);
      
      // FIXED: Don't expose license key in URL - store in session instead
      return {
        success: true,
        transactionId: transaction.id,
        licenseKey,
        downloadUrl: `/download/apk/${product.id}`
      };
    } catch (error: any) {
      setProcessing(false);
      const errorMessage = error.message || 'Purchase failed';
      
      // Log error
      await supabase.from('error_logs').insert({
        user_id: user?.id,
        error_type: 'apk_purchase_error',
        error_message: errorMessage,
        context: { product_id: product.id, product_title: product.title }
      }).catch(() => {}); // Non-critical

      return { success: false, error: errorMessage };
    }
  };

  // Verify APK usage - call this when app starts
  const verifyApkUsage = async (
    licenseKey: string,
    deviceInfo?: Record<string, unknown>
  ): Promise<{ valid: boolean; message: string }> => {
    if (!user) {
      return { valid: false, message: 'User not authenticated' };
    }

    try {
      // FIXED: Always include user_id filter to prevent unauthorized access
      const { data: download, error } = await supabase
        .from('apk_downloads')
        .select('*')
        .eq('license_key', licenseKey)
        .eq('user_id', user.id)
        .single();

      if (error || !download) {
        // Potential fraud - key doesn't exist
        const fraudResult = await reportViolation(
          user.id,
          user.email || '',
          'Invalid license key used',
          licenseKey
        );
        
        return { 
          valid: false, 
          message: fraudResult.blocked 
            ? '⛔ Account blocked due to fraud' 
            : `⚠️ Invalid key. Fine: $${fraudResult.fine}`
        };
      }

      // Check if this user owns this license (double-check)
      if (download.user_id !== user.id) {
        // Fraud - using someone else's license
        const fraudResult = await reportViolation(
          user.id,
          user.email || '',
          'Attempted to use license belonging to another user',
          licenseKey
        );
        
        return { 
          valid: false, 
          message: fraudResult.blocked 
            ? '⛔ Account blocked due to fraud' 
            : `⚠️ Unauthorized license use. Fine: $${fraudResult.fine}`
        };
      }

      if (download.is_blocked) {
        return { 
          valid: false, 
          message: '⛔ License blocked: ' + (download.blocked_reason || 'Fraud detected')
        };
      }

      // FIXED: Add last_verified_at timestamp
      await supabase
        .from('apk_downloads')
        .update({
          verification_attempts: (download.verification_attempts || 0) + 1,
          device_info: deviceInfo ? JSON.parse(JSON.stringify(deviceInfo)) : download.device_info,
          last_verified_at: new Date().toISOString()
        })
        .eq('id', download.id);

      return { valid: true, message: 'License verified ✅' };
    } catch (_error) {
      return { valid: false, message: 'Verification failed' };
    }
  };

  return { 
    purchaseApk,
    verifyApkUsage, 
    processing,
    generateTransactionLicenseKey
  };
}
