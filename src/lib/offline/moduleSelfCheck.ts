/**
 * Module Self-Check
 * Auto validation on load for each module
 */

import { indexedDB } from './indexedDB';
import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface ModuleCheckResult {
  moduleName: string;
  status: 'pass' | 'fail' | 'warning';
  checks: CheckResult[];
  timestamp: string;
}

export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  healed: boolean;
}

class ModuleSelfCheck {
  private moduleChecks: Map<string, ModuleCheckResult> = new Map();

  async checkModule(moduleName: string): Promise<ModuleCheckResult> {
    const checks: CheckResult[] = [];
    const timestamp = new Date().toISOString();

    // Module-specific checks
    switch (moduleName) {
      case 'auth':
        checks.push(await this.checkAuthModule());
        break;
      case 'marketplace':
        checks.push(await this.checkMarketplaceModule());
        break;
      case 'wallet':
        checks.push(await this.checkWalletModule());
        break;
      case 'orders':
        checks.push(await this.checkOrdersModule());
        break;
      case 'license_keys':
        checks.push(await this.checkLicenseKeysModule());
        break;
      default:
        checks.push(await this.checkGenericModule(moduleName));
    }

    // Common checks for all modules
    checks.push(await this.checkDatabaseConnection());
    checks.push(await this.checkDataIntegrity(moduleName));

    const status = this.determineOverallStatus(checks);
    const result: ModuleCheckResult = {
      moduleName,
      status,
      checks,
      timestamp,
    };

    this.moduleChecks.set(moduleName, result);

    // Log to self-healing engine if failed
    if (status === 'fail') {
      selfHealingEngine.handleEvent({
        type: 'error',
        severity: 'high',
        module: moduleName,
        message: `Module self-check failed`,
        timestamp,
        context: result,
        healed: false,
      });
    }

    return result;
  }

  private async checkAuthModule(): Promise<CheckResult> {
    try {
      // Check if user data exists in local DB
      const { data } = await localApi.select('users').execute();

      if ((data as any).data && (data as any).data.length > 0) {
        return {
          name: 'auth_data',
          status: 'pass',
          message: 'Auth data exists in local DB',
          healed: false,
        };
      }

      return {
        name: 'auth_data',
        status: 'warning',
        message: 'No auth data in local DB (user not logged in)',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'auth_data',
        status: 'fail',
        message: `Failed to check auth data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkMarketplaceModule(): Promise<CheckResult> {
    try {
      // Check if products data exists
      const { data } = await localApi.select('products').execute();

      if (!(data as any).data || (data as any).data.length === 0) {
        return {
          name: 'products_data',
          status: 'warning',
          message: 'No products data in local DB',
          healed: false,
        };
      }

      // Check if categories data exists
      const { data: categoriesData } = await localApi.select('categories').execute();

      if (!(categoriesData as any).data || (categoriesData as any).data.length === 0) {
        return {
          name: 'categories_data',
          status: 'warning',
          message: 'No categories data in local DB',
          healed: false,
        };
      }

      return {
        name: 'marketplace_data',
        status: 'pass',
        message: 'Marketplace data exists in local DB',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'marketplace_data',
        status: 'fail',
        message: `Failed to check marketplace data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkWalletModule(): Promise<CheckResult> {
    try {
      // Check if wallet_ledger data exists
      const { data } = await localApi.select('wallet_ledger').execute();

      if (!(data as any).data || (data as any).data.length === 0) {
        return {
          name: 'wallet_ledger',
          status: 'warning',
          message: 'No wallet ledger data in local DB',
          healed: false,
        };
      }

      return {
        name: 'wallet_ledger',
        status: 'pass',
        message: 'Wallet ledger data exists in local DB',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'wallet_ledger',
        status: 'fail',
        message: `Failed to check wallet ledger: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkOrdersModule(): Promise<CheckResult> {
    try {
      // Check if orders data exists
      const { data } = await localApi.select('orders').execute();

      if (!(data as any).data || (data as any).data.length === 0) {
        return {
          name: 'orders_data',
          status: 'warning',
          message: 'No orders data in local DB',
          healed: false,
        };
      }

      return {
        name: 'orders_data',
        status: 'pass',
        message: 'Orders data exists in local DB',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'orders_data',
        status: 'fail',
        message: `Failed to check orders data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkLicenseKeysModule(): Promise<CheckResult> {
    try {
      // Check if license_keys data exists
      const { data } = await localApi.select('license_keys').execute();

      if (!(data as any).data || (data as any).data.length === 0) {
        return {
          name: 'license_keys',
          status: 'warning',
          message: 'No license keys data in local DB',
          healed: false,
        };
      }

      return {
        name: 'license_keys',
        status: 'pass',
        message: 'License keys data exists in local DB',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'license_keys',
        status: 'fail',
        message: `Failed to check license keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkGenericModule(moduleName: string): Promise<CheckResult> {
    try {
      // Generic check for any module
      const { data } = await localApi.select('settings').eq('key', `module_${moduleName}_status`).execute();

      return {
        name: 'generic_module',
        status: 'pass',
        message: `Module ${moduleName} check passed`,
        healed: false,
      };
    } catch (error) {
      return {
        name: 'generic_module',
        status: 'fail',
        message: `Failed to check module ${moduleName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkDatabaseConnection(): Promise<CheckResult> {
    try {
      await indexedDB.init();

      if (!indexedDB.isReady()) {
        return {
          name: 'db_connection',
          status: 'fail',
          message: 'IndexedDB not ready',
          healed: false,
        };
      }

      return {
        name: 'db_connection',
        status: 'pass',
        message: 'IndexedDB connection successful',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'db_connection',
        status: 'fail',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private async checkDataIntegrity(moduleName: string): Promise<CheckResult> {
    try {
      // Check for soft-deleted records
      const tables = ['products', 'categories', 'orders', 'license_keys'];
      let hasSoftDeleted = false;

      for (const table of tables) {
        const { data } = await localApi.select(table).execute();
        if ((data as any).data) {
          const softDeleted = (data as any).data.filter((item: any) => item.deleted_at);
          if (softDeleted.length > 0) {
            hasSoftDeleted = true;
          }
        }
      }

      if (hasSoftDeleted) {
        return {
          name: 'data_integrity',
          status: 'warning',
          message: 'Soft-deleted records found in database',
          healed: false,
        };
      }

      return {
        name: 'data_integrity',
        status: 'pass',
        message: 'Data integrity check passed',
        healed: false,
      };
    } catch (error) {
      return {
        name: 'data_integrity',
        status: 'fail',
        message: `Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healed: false,
      };
    }
  }

  private determineOverallStatus(checks: CheckResult[]): 'pass' | 'fail' | 'warning' {
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warning');

    if (hasFail) return 'fail';
    if (hasWarning) return 'warning';
    return 'pass';
  }

  getModuleCheckResult(moduleName: string): ModuleCheckResult | undefined {
    return this.moduleChecks.get(moduleName);
  }

  getAllModuleChecks(): ModuleCheckResult[] {
    return Array.from(this.moduleChecks.values());
  }

  async checkAllModules(): Promise<ModuleCheckResult[]> {
    const modules = ['auth', 'marketplace', 'wallet', 'orders', 'license_keys'];
    const results: ModuleCheckResult[] = [];

    for (const module of modules) {
      const result = await this.checkModule(module);
      results.push(result);
    }

    return results;
  }

  clearModuleChecks(): void {
    this.moduleChecks.clear();
  }
}

// Singleton instance
export const moduleSelfCheck = new ModuleSelfCheck();
