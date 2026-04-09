import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useFraudDetection } from './useFraudDetection';
import { generateSecureOfflineLicenseKey } from '@/lib/licenseUtils';
import { toast } from 'sonner';
import { rateLimiter } from '@/lib/errorHandling';

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

  // Helper: check if an ID looks like a valid UUID
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const purchaseApk = async (product: ApkProduct): Promise<PurchaseResult> => {
    if (!user) {
      return { success: false, error: 'Please sign in to download APK' };
    }

    const buyAttemptKey = `apk-buy:${user.id}`;
    if (!rateLimiter.checkLimit(buyAttemptKey, 5, 60 * 1000)) {
      return { success: false, error: 'Too many purchase attempts. Please wait before trying again.' };
    }

    const isGeneratedProduct = !isUuid(product.id);

    setProcessing(true);

    // Track wallet state for rollback
    let walletDeducted = false;
    let walletId = '';
    let originalBalance = 0;

    try {
      // Step 1: Check if user is blocked
      const fraudStatus = await checkUserStatus(user.id, user.email || '');
      
      if (fraudStatus.isBlocked) {
        setProcessing(false);
        toast.error(fraudStatus.message);
        return { success: false, error: fraudStatus.message };
      }

      // Step 2: Check wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        throw new Error('Wallet not found. Please contact support.');
      }

      if ((wallet.balance || 0) < product.price) {
        throw new Error(`Insufficient balance. Need $${product.price}, have $${(wallet.balance || 0).toFixed(2)}`);
      }

      // Capture wallet info for potential rollback
      walletId = wallet.id;
      originalBalance = wallet.balance || 0;

      // Step 3: Deduct wallet balance FIRST (atomic check)
      const newBalance = originalBalance - product.price;
      const { error: walletUpdateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (walletUpdateError) {
        throw new Error('Failed to deduct balance. Please try again.');
      }
      walletDeducted = true;

      // Step 4: Create transaction record (after deduction)
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
            product_title: product.title
          }
        })
        .select()
        .single();

      if (txError || !transaction) {
        throw new Error('Failed to create transaction');
      }

      // Step 5: Generate secure signed offline license key
      const secureKeyBundle = await generateSecureOfflineLicenseKey({
        productId: isGeneratedProduct ? 'offline-generated-product' : product.id,
        assignedTo: user.id,
      });

      // Step 6: Create APK download record (only for real DB products)
      if (!isGeneratedProduct) {
        await supabase.from('apk_downloads').insert({
          user_id: user.id,
          product_id: product.id,
          transaction_id: transaction.id,
          license_key: secureKeyBundle.key,
          is_verified: true,
          verification_attempts: 0,
          is_blocked: false
        });
      }

      // Step 6.5: Save license key to license_keys table (so user can see it on /keys page)
      // Guard against duplicate license for the same transaction
      const { data: existingLicense } = await supabase
        .from('license_keys')
        .select('license_key')
        .filter('meta->>transaction_id', 'eq', transaction.id)
        .maybeSingle();

      const finalLicenseKey = existingLicense ? existingLicense.license_key : secureKeyBundle.key;

      if (!existingLicense) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30-day license
        await (supabase as any).from('license_keys').insert({
          product_id: isGeneratedProduct ? null : product.id,
          license_key: secureKeyBundle.key,
          key_signature: secureKeyBundle.signature,
          key_type: 'monthly' as const,
          key_status: 'unused' as const,
          status: 'active' as const,
          owner_email: user.email || null,
          owner_name: user.user_metadata?.full_name || null,
          max_devices: 1,
          activated_devices: 0,
          activated_at: null,
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
          purchase_transaction_id: transaction.id,
          notes: `Purchased: ${product.title}`,
          meta: {
            product_title: product.title,
            transaction_id: transaction.id,
            product_id: product.id,
            offline_payload: secureKeyBundle.payload,
          }
        });
      }

      // Step 7: Create marketplace order (only for real DB products)
      if (!isGeneratedProduct) {
        await supabase
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
          license_key: finalLicenseKey,
          amount: product.price,
          transaction_id: transaction.id,
          is_generated: isGeneratedProduct
        }
      });

      // Step 9: Create notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '📱 APK Ready for Download',
        message: `${product.title} purchased. Your License Key: ${finalLicenseKey}`,
        type: 'success',
        action_url: '/keys'
      });

      setProcessing(false);
      
      // Step 10: Generate real Supabase storage signed URL (15-minute TTL)
      let downloadUrl = '';
      if (!isGeneratedProduct) {
        const { data: apkRecord } = await supabase
          .from('apks')
          .select('file_url')
          .eq('product_id', product.id)
          .eq('status', 'published')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const storagePath = apkRecord?.file_url || null;
        if (storagePath) {
          const { data: signedData } = await supabase.storage
            .from('apks')
            .createSignedUrl(storagePath, 900); // 15-minute TTL
          downloadUrl = signedData?.signedUrl || '';

          await (supabase as any).from('activity_logs').insert({
            entity_type: 'apk_download',
            entity_id: transaction.id,
            action: 'download_link_issued',
            performed_by: user.id,
            details: {
              product_id: product.id,
              file_path: storagePath,
              ttl_seconds: 900,
              downloaded_at: new Date().toISOString(),
            },
          }).catch(() => { /* best-effort */ });
        }
      }

      return {
        success: true,
        transactionId: transaction.id,
        licenseKey: finalLicenseKey,
        downloadUrl,
      };
    } catch (error: any) {
      setProcessing(false);
      const errorMessage = error.message || 'Purchase failed';

      // Best-effort wallet refund: restore original balance if deduction already happened
      if (walletDeducted && walletId) {
        try {
          await supabase
            .from('wallets')
            .update({ balance: originalBalance, updated_at: new Date().toISOString() })
            .eq('id', walletId);
          // Insert compensating credit log
          await (supabase as any).from('transactions').insert({
            wallet_id: walletId,
            type: 'credit',
            amount: product.price,
            balance_after: originalBalance,
            status: 'completed',
            description: `Refund: Failed APK purchase for ${product.title}`,
            reference_type: 'refund',
            meta: { product_id: product.id, reason: errorMessage },
          }).catch(() => { /* best effort */ });
        } catch { /* best effort */ }
      }
      
      // Log error
      await supabase.from('error_logs').insert({
        user_id: user?.id,
        error_type: 'apk_purchase_error',
        error_message: errorMessage,
        context: { product_id: product.id, product_title: product.title }
      });

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
      const { data: download, error } = await supabase
        .from('apk_downloads')
        .select('*')
        .eq('license_key', licenseKey)
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

      // Check if this user owns this license
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

      // Update verification attempts
      await supabase
        .from('apk_downloads')
        .update({
          verification_attempts: (download.verification_attempts || 0) + 1,
          device_info: deviceInfo ? JSON.parse(JSON.stringify(deviceInfo)) : download.device_info
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
    processing
  };
}
