/**
 * Data Self-Heal
 * Auto rebuild relations for missing category chain, keys, orders
 */

import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface DataHealResult {
  table: string;
  healed: number;
  failed: number;
  errors: string[];
  timestamp: string;
}

class DataSelfHeal {
  async healCategoryHierarchy(): Promise<DataHealResult> {
    const result: DataHealResult = {
      table: 'category_hierarchy',
      healed: 0,
      failed: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get all products
      const { data: productsData } = await localApi.select('products').execute();
      const products = (productsData as any)?.data || [];

      // Get all categories
      const { data: categoriesData } = await localApi.select('categories').execute();
      const categories = (categoriesData as any)?.data || [];

      // Get all sub-categories
      const { data: subCategoriesData } = await localApi.select('sub_categories').execute();
      const subCategories = (subCategoriesData as any)?.data || [];

      // Get all micro-categories
      const { data: microCategoriesData } = await localApi.select('micro_categories').execute();
      const microCategories = (microCategoriesData as any)?.data || [];

      // Get all nano-categories
      const { data: nanoCategoriesData } = await localApi.select('nano_categories').execute();
      const nanoCategories = (nanoCategoriesData as any)?.data || [];

      // Create maps for quick lookup
      const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
      const subCategoryMap = new Map(subCategories.map((c: any) => [c.id, c]));
      const microCategoryMap = new Map(microCategories.map((c: any) => [c.id, c]));
      const nanoCategoryMap = new Map(nanoCategories.map((c: any) => [c.id, c]));

      // Check each product's category hierarchy
      for (const product of products) {
        let needsHeal = false;
        const updates: any = {};

        // Check category
        if (product.category_id && !categoryMap.has(product.category_id)) {
          needsHeal = true;
          updates.category_id = null;
        }

        // Check sub-category
        if (product.sub_category_id && !subCategoryMap.has(product.sub_category_id)) {
          needsHeal = true;
          updates.sub_category_id = null;
        }

        // Check micro-category
        if (product.micro_category_id && !microCategoryMap.has(product.micro_category_id)) {
          needsHeal = true;
          updates.micro_category_id = null;
        }

        // Check nano-category
        if (product.nano_category_id && !nanoCategoryMap.has(product.nano_category_id)) {
          needsHeal = true;
          updates.nano_category_id = null;
        }

        if (needsHeal) {
          try {
            await localApi.update('products', updates, { id: product.id });
            result.healed++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to heal product ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Check sub-category parent references
      for (const subCat of subCategories) {
        if (subCat.parent_id && !categoryMap.has(subCat.parent_id)) {
          try {
            await localApi.update('sub_categories', { parent_id: null }, { id: subCat.id });
            result.healed++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to heal sub-category ${subCat.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Check micro-category parent references
      for (const microCat of microCategories) {
        if (microCat.parent_id && !subCategoryMap.has(microCat.parent_id)) {
          try {
            await localApi.update('micro_categories', { parent_id: null }, { id: microCat.id });
            result.healed++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to heal micro-category ${microCat.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Check nano-category parent references
      for (const nanoCat of nanoCategories) {
        if (nanoCat.parent_id && !microCategoryMap.has(nanoCat.parent_id)) {
          try {
            await localApi.update('nano_categories', { parent_id: null }, { id: nanoCat.id });
            result.healed++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to heal nano-category ${nanoCat.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (result.healed > 0) {
        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'low',
          module: 'data_self_heal',
          message: `Healed ${result.healed} category hierarchy issues`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'category_hierarchy_rebuilt',
        });
      }

    } catch (error) {
      result.errors.push(`Category hierarchy heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async healOrphanOrders(): Promise<DataHealResult> {
    const result: DataHealResult = {
      table: 'orders',
      healed: 0,
      failed: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get all orders
      const { data: ordersData } = await localApi.select('orders').execute();
      const orders = (ordersData as any)?.data || [];

      // Get all users
      const { data: usersData } = await localApi.select('users').execute();
      const users = (usersData as any)?.data || [];
      const userMap = new Map(users.map((u: any) => [u.id, u]));

      // Get all products
      const { data: productsData } = await localApi.select('products').execute();
      const products = (productsData as any)?.data || [];
      const productMap = new Map(products.map((p: any) => [p.id, p]));

      // Check each order for orphan references
      for (const order of orders) {
        let needsHeal = false;
        const updates: any = {};

        // Check user reference
        if (order.user_id && !userMap.has(order.user_id)) {
          needsHeal = true;
          // Don't null user_id as it's critical, just log
          result.errors.push(`Order ${order.id} has orphan user reference`);
        }

        // Check product reference
        if (order.product_id && !productMap.has(order.product_id)) {
          needsHeal = true;
          updates.product_id = null;
        }

        if (needsHeal) {
          try {
            await localApi.update('orders', updates, { id: order.id });
            result.healed++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to heal order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (result.healed > 0) {
        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'low',
          module: 'data_self_heal',
          message: `Healed ${result.healed} orphan order issues`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'orphan_orders_fixed',
        });
      }

    } catch (error) {
      result.errors.push(`Orphan order heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async healOrphanLicenseKeys(): Promise<DataHealResult> {
    const result: DataHealResult = {
      table: 'license_keys',
      healed: 0,
      failed: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get all license keys
      const { data: keysData } = await localApi.select('license_keys').execute();
      const keys = (keysData as any)?.data || [];

      // Get all orders
      const { data: ordersData } = await localApi.select('orders').execute();
      const orders = (ordersData as any)?.data || [];
      const orderMap = new Map(orders.map((o: any) => [o.id, o]));

      // Get all users
      const { data: usersData } = await localApi.select('users').execute();
      const users = (usersData as any)?.data || [];
      const userMap = new Map(users.map((u: any) => [u.id, u]));

      // Check each license key for orphan references
      for (const key of keys) {
        let needsHeal = false;
        const updates: any = {};

        // Check order reference
        if (key.order_id && !orderMap.has(key.order_id)) {
          needsHeal = true;
          updates.order_id = null;
        }

        // Check assigned_to reference
        if (key.assigned_to && !userMap.has(key.assigned_to)) {
          needsHeal = true;
          updates.assigned_to = null;
        }

        if (needsHeal) {
          try {
            await localApi.update('license_keys', updates, { id: key.id });
            result.healed++;
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to heal license key ${key.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      if (result.healed > 0) {
        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'low',
          module: 'data_self_heal',
          message: `Healed ${result.healed} orphan license key issues`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'orphan_license_keys_fixed',
        });
      }

    } catch (error) {
      result.errors.push(`Orphan license key heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  async healAllData(): Promise<DataHealResult[]> {
    const results: DataHealResult[] = [];

    results.push(await this.healCategoryHierarchy());
    results.push(await this.healOrphanOrders());
    results.push(await this.healOrphanLicenseKeys());

    return results;
  }

  async getDataIntegritySummary(): Promise<{
    totalHealed: number;
    totalFailed: number;
    totalErrors: number;
    tables: string[];
  }> {
    const results = await this.healAllData();

    const totalHealed = results.reduce((sum, r) => sum + r.healed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const tables = results.map(r => r.table);

    return {
      totalHealed,
      totalFailed,
      totalErrors,
      tables,
    };
  }
}

// Singleton instance
export const dataSelfHeal = new DataSelfHeal();
