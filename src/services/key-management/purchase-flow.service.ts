// Purchase Flow with Key Auto-Assignment Service
import { supabase } from '@/integrations/supabase/client';
import type { Key } from '@/types/key-management';
import { keyGeneratorService } from './key-generator.service';
import crypto from 'crypto';

export interface PurchaseOrder {
  id: string;
  product_id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: string;
  payment_id?: string;
  key_type: 'api' | 'feature' | 'license';
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseFlowResult {
  success: boolean;
  order_id?: string;
  key_id?: string;
  key_value?: string;
  error?: string;
  message?: string;
}

export class PurchaseFlowService {
  /**
   * Process purchase and auto-assign key
   */
  async processPurchase(
    productId: string,
    userId: string,
    keyType: 'api' | 'feature' | 'license',
    quantity = 1,
    paymentId?: string
  ): Promise<PurchaseFlowResult> {
    try {
      // 1. Create purchase order
      const order = await this.createPurchaseOrder(
        productId,
        userId,
        keyType,
        quantity,
        paymentId
      );

      if (!order) {
        return {
          success: false,
          error: 'Failed to create purchase order',
        };
      }

      // 2. Get available keys
      const availableKeys = await keyGeneratorService.getUnassignedKeys(
        productId,
        keyType
      );

      if (availableKeys.length < quantity) {
        // Generate new keys if not enough available
        const generatedKeys = await this.generateMissingKeys(
          productId,
          keyType,
          quantity - availableKeys.length
        );

        if (generatedKeys.length < quantity - availableKeys.length) {
          return {
            success: false,
            error: 'Failed to generate required keys',
          };
        }
      }

      // 3. Get keys again (including newly generated)
      const keysToAssign = await keyGeneratorService.getUnassignedKeys(
        productId,
        keyType
      );

      if (keysToAssign.length < quantity) {
        return {
          success: false,
          error: 'Insufficient keys available',
        };
      }

      // 4. Assign keys to user
      const assignedKeys: Key[] = [];
      for (let i = 0; i < quantity; i++) {
        const key = keysToAssign[i];
        const assigned = await this.assignKeyToUser(key.id, userId);
        
        if (assigned) {
          assignedKeys.push(key);
        }
      }

      if (assignedKeys.length !== quantity) {
        return {
          success: false,
          error: 'Failed to assign all keys',
        };
      }

      // 5. Update order status
      await this.updateOrderStatus(order.id, 'paid');

      // 6. Send notification to user
      await this.sendKeyAssignmentNotification(userId, assignedKeys);

      return {
        success: true,
        order_id: order.id,
        key_id: assignedKeys[0].id,
        key_value: assignedKeys[0].key_value, // Encrypted
        message: `Successfully purchased and assigned ${quantity} key(s)`,
      };
    } catch (error) {
      console.error('Error processing purchase:', error);
      return {
        success: false,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Create purchase order
   */
  private async createPurchaseOrder(
    productId: string,
    userId: string,
    keyType: 'api' | 'feature' | 'license',
    quantity: number,
    paymentId?: string
  ): Promise<PurchaseOrder | null> {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          product_id: productId,
          user_id: userId,
          amount: 0, // Would be calculated from product price
          currency: 'USD',
          status: 'pending',
          payment_method: 'stripe',
          payment_id: paymentId,
          key_type: keyType,
          quantity,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      return null;
    }
  }

  /**
   * Generate missing keys
   */
  private async generateMissingKeys(
    productId: string,
    keyType: 'api' | 'feature' | 'license',
    count: number
  ): Promise<Key[]> {
    const keys: Key[] = [];

    for (let i = 0; i < count; i++) {
      const key = await keyGeneratorService.generateKey({
        product_id: productId,
        type: keyType,
        key_size: 'standard',
        usage_limit: 1,
      });

      if (key) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Assign key to user (atomic operation)
   */
  private async assignKeyToUser(
    keyId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('assign_key_to_user', {
        p_key_id: keyId,
        p_user_id: userId,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error assigning key to user:', error);
      return false;
    }
  }

  /**
   * Update order status
   */
  private async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'paid' | 'failed' | 'refunded'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating order status:', error);
      return false;
    }
  }

  /**
   * Send key assignment notification
   */
  private async sendKeyAssignmentNotification(
    userId: string,
    keys: Key[]
  ): Promise<void> {
    try {
      // Get user email
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (!user) return;

      // In production, send email via notification service
      console.log(`Sending key assignment notification to ${user.email}`);
      console.log(`Keys: ${keys.length}`);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Handle payment success webhook
   */
  async handlePaymentSuccess(
    paymentId: string,
    productId: string,
    userId: string,
    keyType: 'api' | 'feature' | 'license',
    quantity = 1
  ): Promise<PurchaseFlowResult> {
    try {
      // Check if order already exists for this payment
      const { data: existingOrder } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('payment_id', paymentId)
        .single();

      if (existingOrder && existingOrder.status === 'paid') {
        return {
          success: true,
          order_id: existingOrder.id,
          message: 'Order already processed',
        };
      }

      // Process purchase
      return await this.processPurchase(
        productId,
        userId,
        keyType,
        quantity,
        paymentId
      );
    } catch (error) {
      console.error('Error handling payment success:', error);
      return {
        success: false,
        error: 'Failed to process payment success',
      };
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(paymentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', paymentId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error handling payment failure:', error);
      return false;
    }
  }

  /**
   * Handle refund
   */
  async handleRefund(orderId: string): Promise<boolean> {
    try {
      // Get order details
      const { data: order } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!order) return false;

      // Update order status
      await this.updateOrderStatus(orderId, 'refunded');

      // Revoke assigned keys
      if (order.status === 'paid') {
        await this.revokeKeysForOrder(orderId);
      }

      return true;
    } catch (error) {
      console.error('Error handling refund:', error);
      return false;
    }
  }

  /**
   * Revoke keys for an order
   */
  private async revokeKeysForOrder(orderId: string): Promise<void> {
    try {
      // Get keys assigned for this order
      const { data: orderKeys } = await supabase
        .from('order_keys')
        .select('key_id')
        .eq('order_id', orderId);

      if (!orderKeys) return;

      // Revoke each key
      for (const orderKey of orderKeys) {
        await keyGeneratorService.revokeKey(
          orderKey.key_id,
          'Order refunded'
        );
      }
    } catch (error) {
      console.error('Error revoking keys for order:', error);
    }
  }

  /**
   * Get user's purchased keys
   */
  async getUserPurchasedKeys(userId: string): Promise<Key[]> {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('assigned_user_id', userId)
        .is('deleted_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data as Key[]) || [];
    } catch (error) {
      console.error('Error getting user purchased keys:', error);
      return [];
    }
  }

  /**
   * Get purchase history
   */
  async getPurchaseHistory(userId: string): Promise<PurchaseOrder[]> {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as PurchaseOrder[]) || [];
    } catch (error) {
      console.error('Error getting purchase history:', error);
      return [];
    }
  }

  /**
   * Get order details
   */
  async getOrderDetails(orderId: string): Promise<PurchaseOrder | null> {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    } catch (error) {
      console.error('Error getting order details:', error);
      return null;
    }
  }

  /**
   * Get pending orders (for retry)
   */
  async getPendingOrders(limit = 10): Promise<PurchaseOrder[]> {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data as PurchaseOrder[]) || [];
    } catch (error) {
      console.error('Error getting pending orders:', error);
      return [];
    }
  }

  /**
   * Retry pending orders
   */
  async retryPendingOrders(): Promise<number> {
    const pendingOrders = await this.getPendingOrders();
    let processed = 0;

    for (const order of pendingOrders) {
      try {
        // Check payment status with payment provider
        // If paid, process the order
        // If failed, mark as failed
        
        // For now, just skip
        console.log(`Would retry order ${order.id}`);
      } catch (error) {
        console.error(`Error retrying order ${order.id}:`, error);
      }
    }

    return processed;
  }
}

export const purchaseFlowService = new PurchaseFlowService();
