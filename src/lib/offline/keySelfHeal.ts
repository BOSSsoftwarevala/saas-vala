/**
 * Key Self-Heal
 * Regenerate missing keys (logged)
 */

import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface KeyHealResult {
  orderId: string;
  healed: boolean;
  keysGenerated: number;
  errors: string[];
  timestamp: string;
}

class KeySelfHeal {
  async healMissingKeys(orderId: string): Promise<KeyHealResult> {
    const result: KeyHealResult = {
      orderId,
      healed: false,
      keysGenerated: 0,
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

      // Check if order is completed
      if (order.status !== 'completed' && order.payment_status !== 'completed') {
        result.errors.push('Order not completed, cannot generate keys');
        return result;
      }

      // Get existing keys for this order
      const { data: existingKeysData } = await localApi.select('license_keys').eq('order_id', orderId).execute();
      const existingKeys = (existingKeysData as any)?.data || [];

      // Get the product to determine key quantity
      const { data: productsData } = await localApi.select('products').eq('id', order.product_id).execute();
      const products = (productsData as any)?.data || [];
      const product = products[0];

      if (!product) {
        result.errors.push('Product not found');
        return result;
      }

      const expectedKeys = order.quantity || 1;
      const missingKeys = expectedKeys - existingKeys.length;

      if (missingKeys <= 0) {
        result.healed = true; // No healing needed
        return result;
      }

      // Generate missing keys
      for (let i = 0; i < missingKeys; i++) {
        try {
          const newKey = await this.generateLicenseKey(order.id, product.id);
          await localApi.insert('license_keys', newKey);
          result.keysGenerated++;
        } catch (error) {
          result.errors.push(`Failed to generate key ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (result.keysGenerated > 0) {
        result.healed = true;

        // Log the key generation
        await this.logKeyGeneration(orderId, result.keysGenerated);

        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'medium',
          module: 'key_self_heal',
          message: `Generated ${result.keysGenerated} missing keys for order ${orderId}`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'keys_regenerated',
        });
      }

    } catch (error) {
      result.errors.push(`Key heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async generateLicenseKey(orderId: string, productId: string): Promise<any> {
    // Generate a random license key
    const key = this.generateRandomKey();

    return {
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: productId,
      key,
      status: 'active',
      assigned_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private generateRandomKey(): string {
    // Generate a random license key format: XXXX-XXXX-XXXX-XXXX
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    let key = '';

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < segmentLength; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < segments - 1) {
        key += '-';
      }
    }

    return key;
  }

  private async logKeyGeneration(orderId: string, count: number): Promise<void> {
    const logEntry = {
      id: crypto.randomUUID(),
      order_id: orderId,
      action: 'key_regeneration',
      details: `Generated ${count} missing license keys`,
      created_at: new Date().toISOString(),
    };

    try {
      await localApi.insert('audit_logs', logEntry);
    } catch (error) {
      console.error('Failed to log key generation:', error);
    }
  }

  async healAllMissingKeys(): Promise<KeyHealResult[]> {
    const results: KeyHealResult[] = [];

    try {
      // Get all completed orders
      const { data: ordersData } = await localApi.select('orders').execute();
      const orders = (ordersData as any)?.data || [];

      const completedOrders = orders.filter((o: any) => 
        o.status === 'completed' || o.payment_status === 'completed'
      );

      for (const order of completedOrders) {
        const result = await this.healMissingKeys(order.id);
        if (result.healed || result.errors.length > 0) {
          results.push(result);
        }
      }
    } catch (error) {
      console.error('Failed to heal all keys:', error);
    }

    return results;
  }

  async validateOrderKeys(orderId: string): Promise<{
    valid: boolean;
    expected: number;
    actual: number;
    missing: number;
  }> {
    try {
      const { data: ordersData } = await localApi.select('orders').eq('id', orderId).execute();
      const orders = (ordersData as any)?.data || [];
      const order = orders[0];

      if (!order) {
        return { valid: false, expected: 0, actual: 0, missing: 0 };
      }

      const { data: keysData } = await localApi.select('license_keys').eq('order_id', orderId).execute();
      const keys = (keysData as any)?.data || [];

      const expected = order.quantity || 1;
      const actual = keys.length;
      const missing = Math.max(0, expected - actual);

      return {
        valid: missing === 0,
        expected,
        actual,
        missing,
      };
    } catch {
      return { valid: false, expected: 0, actual: 0, missing: 0 };
    }
  }

  async getKeyHealthSummary(): Promise<{
    totalOrders: number;
    completedOrders: number;
    ordersWithMissingKeys: number;
    totalKeys: number;
    missingKeys: number;
  }> {
    try {
      const { data: ordersData } = await localApi.select('orders').execute();
      const orders = (ordersData as any)?.data || [];

      const completedOrders = orders.filter((o: any) => 
        o.status === 'completed' || o.payment_status === 'completed'
      );

      const { data: keysData } = await localApi.select('license_keys').execute();
      const keys = (keysData as any)?.data || [];

      let ordersWithMissingKeys = 0;
      let missingKeys = 0;

      for (const order of completedOrders) {
        const validation = await this.validateOrderKeys(order.id);
        if (validation.missing > 0) {
          ordersWithMissingKeys++;
          missingKeys += validation.missing;
        }
      }

      return {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        ordersWithMissingKeys,
        totalKeys: keys.length,
        missingKeys,
      };
    } catch {
      return {
        totalOrders: 0,
        completedOrders: 0,
        ordersWithMissingKeys: 0,
        totalKeys: 0,
        missingKeys: 0,
      };
    }
  }
}

// Singleton instance
export const keySelfHeal = new KeySelfHeal();
