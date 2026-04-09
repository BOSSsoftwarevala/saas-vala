 import { useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 import { generateSecureOfflineLicenseKey } from '@/lib/licenseUtils';
 import { toast } from 'sonner';
 import { rateLimiter } from '@/lib/errorHandling';
 
interface Product {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  status: 'upcoming' | 'live' | 'bestseller';
  price: number;
  category?: string;
}
 
 interface PurchaseResult {
   success: boolean;
   orderId?: string;
   licenseKey?: string;
   error?: string;
 }
 
 export function useMarketplacePurchase() {
   const { user } = useAuth();
   const [processing, setProcessing] = useState(false);
 
   const purchaseProduct = async (product: Product): Promise<PurchaseResult> => {
     if (!user) {
       return { success: false, error: 'Please sign in to make a purchase' };
     }

     const buyAttemptKey = `marketplace-buy:${user.id}`;
     if (!rateLimiter.checkLimit(buyAttemptKey, 5, 60 * 1000)) {
       return { success: false, error: 'Too many purchase attempts. Please wait before trying again.' };
     }
 
     setProcessing(true);
 
  let walletDeducted = false;
  let walletId = '';
  let originalBalance = 0;

     try {
  // (rollback state managed outside try via let declarations above)
       // Step 1: Check wallet balance
       const { data: wallet, error: walletError } = await supabase
         .from('wallets')
         .select('id, balance')
         .eq('user_id', user.id)
         .single();
 
       if (walletError || !wallet) {
         throw new Error('Could not fetch wallet balance');
       }
 
       if ((wallet.balance || 0) < product.price) {
         throw new Error(`Insufficient balance. You need ₹${product.price.toLocaleString()} but have ₹${(wallet.balance || 0).toLocaleString()}`);
       }
 
       // Step 2: Deduct wallet balance FIRST
      const newBalance = (wallet.balance || 0) - product.price;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (updateError) {
        throw new Error('Failed to deduct wallet balance. Please try again.');
      }
      // Step 3: Create marketplace order
      walletDeducted = true;
      walletId = wallet.id;
      originalBalance = wallet.balance || 0;

      // Step 3: Create marketplace order
       const { data: order, error: orderError } = await supabase
         .from('marketplace_orders')
         .insert({
           buyer_id: user.id,
           seller_id: user.id,
           amount: product.price,
           status: 'completed',
           payment_method: 'wallet',
           completed_at: new Date().toISOString(),
         })
         .select()
         .single();
 
       if (orderError) {
         throw new Error('Failed to create order');
       }
 
       // Step 4: Create debit transaction record (type must be 'debit')
       const { data: transaction, error: transactionError } = await (supabase as any)
         .from('transactions')
         .insert({
           wallet_id: wallet.id,
           type: 'debit',
           amount: product.price,
           balance_after: newBalance,
           description: `Purchase: ${product.title}`,
           status: 'completed',
           reference_type: 'marketplace_order',
           reference_id: order.id,
           product_id: /^[0-9a-f]{8}-/i.test(product.id) ? product.id : null,
           created_at: new Date().toISOString(),
         })
         .select('*')
         .single();
 
       if (transactionError || !transaction) {
         throw new Error('Failed to create transaction');
       }
 
       // Step 5: Generate secure signed offline key
        const secureKeyBundle = await generateSecureOfflineLicenseKey({
          productId: /^[0-9a-f]{8}-/i.test(product.id) ? product.id : 'offline-marketplace-product',
          assignedTo: user.id,
        });

       // Step 5b: Save license key to license_keys table (guard against duplicate for same order)
        const { data: existingLicense } = await (supabase as any)
          .from('license_keys')
          .select('license_key')
          .filter('meta->>order_id', 'eq', order.id)
          .maybeSingle();

        const finalLicenseKey = existingLicense ? existingLicense.license_key : secureKeyBundle.key;

        if (!existingLicense) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await (supabase as any).from('license_keys').insert({
            product_id: /^[0-9a-f]{8}-/i.test(product.id) ? product.id : null,
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
              order_id: order.id,
              product_id: product.id,
              transaction_id: transaction.id,
              offline_payload: secureKeyBundle.payload,
            },
          });
        }

       // Step 6: Log activity
       await supabase.from('activity_logs').insert({
         entity_type: 'marketplace_order',
         entity_id: order.id,
         action: 'purchase_completed',
         performed_by: user.id,
         details: {
           product_title: product.title,
           amount: product.price,
           payment_method: 'wallet',
           license_key: finalLicenseKey,
         },
       });
 
       // Step 7: Create notification
       await supabase.from('notifications').insert({
         user_id: user.id,
         title: 'Purchase Successful',
         message: `You purchased ${product.title} for ₹${product.price.toLocaleString()}. Your License Key: ${finalLicenseKey}`,
         type: 'success',
         action_url: '/keys',
       });
 
       setProcessing(false);
       return {
         success: true,
         orderId: order.id,
         licenseKey: finalLicenseKey,
       };
     } catch (error: any) {
       setProcessing(false);
       const errorMessage = error.message || 'Purchase failed';
       
      // Best-effort wallet refund if deduction happened before failure
      if (walletDeducted && walletId) {
        try {
          await supabase
            .from('wallets')
            .update({ balance: originalBalance, updated_at: new Date().toISOString() })
            .eq('id', walletId);
          await (supabase as any).from('transactions').insert({
            wallet_id: walletId,
            type: 'credit',
            amount: product.price,
            balance_after: originalBalance,
            status: 'completed',
            description: `Refund: Failed purchase for ${product.title}`,
            reference_type: 'refund',
            meta: { product_id: product.id, reason: errorMessage },
          }).catch(() => { /* best effort */ });
        } catch { /* best effort */ }
      }

       // Log error
       await supabase.from('error_logs').insert({
         user_id: user.id,
         error_type: 'purchase_error',
         error_message: errorMessage,
         context: { product_id: product.id, product_title: product.title },
       });
 
       return { success: false, error: errorMessage };
     }
   };
 
   return { purchaseProduct, processing };
 }
