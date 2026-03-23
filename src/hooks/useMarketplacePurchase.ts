 import { useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 import { generateSecureLicenseKey } from '@/lib/licenseUtils';
 import { toast } from 'sonner';
 
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
 
     setProcessing(true);
 
     try {
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
 
       // Step 2: Create marketplace order
       const { data: order, error: orderError } = await supabase
         .from('marketplace_orders')
         .insert({
           buyer_id: user.id,
           seller_id: user.id, // For demo products, seller is system
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
 
       // Step 3: Deduct from wallet (create transaction)
       const { error: transactionError } = await supabase
         .from('transactions')
         .insert({
           wallet_id: wallet.id,
           type: 'debit',
           amount: product.price,
           description: `Purchase: ${product.title}`,
           status: 'completed',
           reference_type: 'marketplace_order',
           reference_id: order.id,
         });
 
       if (transactionError) {
         console.error('Transaction error:', transactionError);
       }
 
       // Step 4: Update wallet balance
       const newBalance = (wallet.balance || 0) - product.price;
       const { error: updateError } = await supabase
         .from('wallets')
         .update({ balance: newBalance, updated_at: new Date().toISOString() })
         .eq('id', wallet.id);
 
       if (updateError) {
         console.error('Wallet update error:', updateError);
       }
 
       // Step 5: Generate secure crypto-random license key
        const licenseKey = generateSecureLicenseKey();

       // Step 5b: Save license key to license_keys table (guard against duplicate for same order)
        const { data: existingLicense } = await supabase
          .from('license_keys')
          .select('license_key')
          .filter('meta->>order_id', 'eq', order.id)
          .maybeSingle();

        const finalLicenseKey = existingLicense ? existingLicense.license_key : licenseKey;

        if (!existingLicense) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await supabase.from('license_keys').insert({
            product_id: /^[0-9a-f]{8}-/i.test(product.id) ? product.id : null,
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
            notes: `Purchased: ${product.title}`,
            meta: { product_title: product.title, order_id: order.id, product_id: product.id },
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
