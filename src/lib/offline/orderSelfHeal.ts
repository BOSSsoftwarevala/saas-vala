/**
 * Order Self-Heal
 * Rollback and reprocess on broken state
 */

import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface OrderHealResult {
  orderId: string;
  healed: boolean;
  oldStatus: string;
  newStatus: string;
  actions: string[];
  errors: string[];
  timestamp: string;
}

class OrderSelfHeal {
  async healOrder(orderId: string): Promise<OrderHealResult> {
    const result: OrderHealResult = {
      orderId,
      healed: false,
      oldStatus: '',
      newStatus: '',
      actions: [],
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get the order
      const { data: ordersData } = await localApi.select('orders').eq('id', orderId).execute();
      const orders = (ordersData as any)?.data || [];
      const order = orders[0];

      if (!order) {
        result.errors.push('Order not found');
        return result;
      }

      result.oldStatus = order.status || 'unknown';

      // Check for broken states
      const brokenStates = ['payment_failed', 'processing_error', 'timeout', 'stuck'];
      const isBroken = brokenStates.includes(order.status);

      if (!isBroken) {
        result.healed = true; // No healing needed
        result.newStatus = order.status;
        return result;
      }

      // Attempt to heal based on status
      switch (order.status) {
        case 'payment_failed':
          await this.healPaymentFailed(order, result);
          break;
        case 'processing_error':
          await this.healProcessingError(order, result);
          break;
        case 'timeout':
          await this.healTimeout(order, result);
          break;
        case 'stuck':
          await this.healStuck(order, result);
          break;
        default:
          result.errors.push(`Unknown broken state: ${order.status}`);
      }

      if (result.actions.length > 0) {
        result.healed = true;

        // Get updated order status
        const { data: updatedOrdersData } = await localApi.select('orders').eq('id', orderId).execute();
        const updatedOrders = (updatedOrdersData as any)?.data || [];
        result.newStatus = updatedOrders[0]?.status || order.status;

        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'medium',
          module: 'order_self_heal',
          message: `Order ${orderId} healed: ${result.oldStatus} → ${result.newStatus}`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'order_reprocessed',
        });
      }

    } catch (error) {
      result.errors.push(`Order heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async healPaymentFailed(order: any, result: OrderHealResult): Promise<void> {
    // Reset to pending for retry
    await localApi.update('orders', { status: 'pending' }, { id: order.id });
    result.actions.push('Reset status to pending for payment retry');
  }

  private async healProcessingError(order: any, result: OrderHealResult): Promise<void> {
    // Check if payment was successful
    if (order.payment_status === 'completed') {
      // Retry processing
      await localApi.update('orders', { status: 'processing' }, { id: order.id });
      result.actions.push('Retried processing after payment completion');
    } else {
      // Rollback to pending
      await localApi.update('orders', { status: 'pending' }, { id: order.id });
      result.actions.push('Rolled back to pending due to processing error');
    }
  }

  private async healTimeout(order: any, result: OrderHealResult): Promise<void> {
    // Check order age
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    const timeoutThreshold = 30 * 60 * 1000; // 30 minutes

    if (orderAge > timeoutThreshold) {
      // Mark as failed if too old
      await localApi.update('orders', { status: 'failed' }, { id: order.id });
      result.actions.push('Marked as failed due to timeout');
    } else {
      // Retry processing
      await localApi.update('orders', { status: 'processing' }, { id: order.id });
      result.actions.push('Retried processing after timeout');
    }
  }

  private async healStuck(order: any, result: OrderHealResult): Promise<void> {
    // Check if license keys were generated
    const { data: keysData } = await localApi.select('license_keys').eq('order_id', order.id).execute();
    const keys = (keysData as any)?.data || [];

    if (keys.length > 0) {
      // Order completed but status not updated
      await localApi.update('orders', { status: 'completed' }, { id: order.id });
      result.actions.push('Updated status to completed (keys exist)');
    } else if (order.payment_status === 'completed') {
      // Payment done but no keys, retry key generation
      await localApi.update('orders', { status: 'processing' }, { id: order.id });
      result.actions.push('Retried key generation (payment completed)');
    } else {
      // No payment, reset to pending
      await localApi.update('orders', { status: 'pending' }, { id: order.id });
      result.actions.push('Reset to pending (no payment)');
    }
  }

  async healAllBrokenOrders(): Promise<OrderHealResult[]> {
    const results: OrderHealResult[] = [];

    try {
      // Get all orders with broken states
      const { data: ordersData } = await localApi.select('orders').execute();
      const orders = (ordersData as any)?.data || [];

      const brokenStates = ['payment_failed', 'processing_error', 'timeout', 'stuck'];
      const brokenOrders = orders.filter((o: any) => brokenStates.includes(o.status));

      for (const order of brokenOrders) {
        const result = await this.healOrder(order.id);
        results.push(result);
      }
    } catch (error) {
      console.error('Failed to heal all orders:', error);
    }

    return results;
  }

  async validateOrderState(orderId: string): Promise<{
    valid: boolean;
    status: string;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const { data: ordersData } = await localApi.select('orders').eq('id', orderId).execute();
      const orders = (ordersData as any)?.data || [];
      const order = orders[0];

      if (!order) {
        return { valid: false, status: 'not_found', issues: ['Order not found'] };
      }

      // Check if order has required fields
      if (!order.user_id) issues.push('Missing user_id');
      if (!order.product_id) issues.push('Missing product_id');
      if (!order.amount) issues.push('Missing amount');

      // Check status consistency
      if (order.status === 'completed' && order.payment_status !== 'completed') {
        issues.push('Status completed but payment not completed');
      }

      if (order.status === 'pending' && order.payment_status === 'completed') {
        issues.push('Status pending but payment completed');
      }

      // Check for orphan references
      const { data: usersData } = await localApi.select('users').eq('id', order.user_id).execute();
      const users = (usersData as any)?.data || [];
      if (order.user_id && users.length === 0) {
        issues.push('Orphan user reference');
      }

      const { data: productsData } = await localApi.select('products').eq('id', order.product_id).execute();
      const products = (productsData as any)?.data || [];
      if (order.product_id && products.length === 0) {
        issues.push('Orphan product reference');
      }

      return {
        valid: issues.length === 0,
        status: order.status,
        issues,
      };
    } catch (error) {
      return {
        valid: false,
        status: 'error',
        issues: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async getOrderHealthSummary(): Promise<{
    totalOrders: number;
    brokenOrders: number;
    healedOrders: number;
    statusBreakdown: Record<string, number>;
  }> {
    try {
      const { data: ordersData } = await localApi.select('orders').execute();
      const orders = (ordersData as any)?.data || [];

      const statusBreakdown: Record<string, number> = {};
      const brokenStates = ['payment_failed', 'processing_error', 'timeout', 'stuck'];
      let brokenOrders = 0;

      for (const order of orders) {
        const status = order.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

        if (brokenStates.includes(status)) {
          brokenOrders++;
        }
      }

      // Get healed orders from recent heal results
      const healedOrders = 0; // Would need to track this separately

      return {
        totalOrders: orders.length,
        brokenOrders,
        healedOrders,
        statusBreakdown,
      };
    } catch {
      return {
        totalOrders: 0,
        brokenOrders: 0,
        healedOrders: 0,
        statusBreakdown: {},
      };
    }
  }
}

// Singleton instance
export const orderSelfHeal = new OrderSelfHeal();
