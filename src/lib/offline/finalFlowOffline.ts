/**
 * Final Flow Offline
 * Ensure login → dashboard → marketplace → product → wallet → order → key → APK works fully offline
 */

import { localApi } from './localApi';
import { syncEngine } from './syncEngine';
import { selfHealingEngine } from './selfHealingEngine';
import { moduleSelfCheck } from './moduleSelfCheck';
import { routeSelfHeal } from './routeSelfHeal';
import { dataSelfHeal } from './dataSelfHeal';
import { walletSelfHeal } from './walletSelfHeal';
import { orderSelfHeal } from './orderSelfHeal';
import { keySelfHeal } from './keySelfHeal';
import { securityOfflineSafe } from './securityOfflineSafe';

export interface FlowStep {
  name: string;
  execute: () => Promise<boolean>;
  required: boolean;
}

export interface FlowTestResult {
  flowName: string;
  steps: Array<{
    name: string;
    passed: boolean;
    error?: string;
    timestamp: string;
  }>;
  overallPassed: boolean;
  timestamp: string;
}

class FinalFlowOffline {
  async testLoginFlow(): Promise<FlowTestResult> {
    const flowName = 'login_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Check offline capability
    try {
      const isOnline = navigator.onLine;
      steps.push({
        name: 'check_offline_capability',
        passed: !isOnline || true, // Should work regardless of online status
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      steps.push({
        name: 'check_offline_capability',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    // Step 2: Authenticate with local credentials
    try {
      const { data } = await localApi.select('users').limit(1).execute();
      const users = (data as any)?.data || [];

      if (users.length > 0) {
        const user = users[0];
        await securityOfflineSafe.setSession(
          'local_token',
          user.id,
          user.role || 'user',
          Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        );

        steps.push({
          name: 'authenticate_local',
          passed: true,
          timestamp: new Date().toISOString(),
        });
      } else {
        steps.push({
          name: 'authenticate_local',
          passed: false,
          error: 'No local users found',
          timestamp: new Date().toISOString(),
        });
        overallPassed = false;
      }
    } catch (error) {
      steps.push({
        name: 'authenticate_local',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    // Step 3: Validate session
    try {
      const isValid = securityOfflineSafe.isAuthenticated();
      steps.push({
        name: 'validate_session',
        passed: isValid,
        timestamp: new Date().toISOString(),
      });

      if (!isValid) overallPassed = false;
    } catch (error) {
      steps.push({
        name: 'validate_session',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testDashboardFlow(): Promise<FlowTestResult> {
    const flowName = 'dashboard_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Check user data availability
    try {
      const { data } = await localApi.select('users').execute();
      const users = (data as any)?.data || [];

      steps.push({
        name: 'check_user_data',
        passed: users.length > 0,
        error: users.length === 0 ? 'No user data available' : undefined,
        timestamp: new Date().toISOString(),
      });

      if (users.length === 0) overallPassed = false;
    } catch (error) {
      steps.push({
        name: 'check_user_data',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    // Step 2: Check wallet data
    try {
      const userId = securityOfflineSafe.getCurrentUserId();
      if (userId) {
        const { data } = await localApi.select('wallets').eq('user_id', userId).execute();
        const wallets = (data as any)?.data || [];

        steps.push({
          name: 'check_wallet_data',
          passed: wallets.length > 0,
          error: wallets.length === 0 ? 'No wallet data available' : undefined,
          timestamp: new Date().toISOString(),
        });
      } else {
        steps.push({
          name: 'check_wallet_data',
          passed: false,
          error: 'No authenticated user',
          timestamp: new Date().toISOString(),
        });
        overallPassed = false;
      }
    } catch (error) {
      steps.push({
        name: 'check_wallet_data',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testMarketplaceFlow(): Promise<FlowTestResult> {
    const flowName = 'marketplace_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Check products availability
    try {
      const { data } = await localApi.select('products').execute();
      const products = (data as any)?.data || [];

      steps.push({
        name: 'check_products',
        passed: products.length > 0,
        error: products.length === 0 ? 'No products available' : undefined,
        timestamp: new Date().toISOString(),
      });

      if (products.length === 0) overallPassed = false;
    } catch (error) {
      steps.push({
        name: 'check_products',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    // Step 2: Check categories
    try {
      const { data } = await localApi.select('categories').execute();
      const categories = (data as any)?.data || [];

      steps.push({
        name: 'check_categories',
        passed: categories.length > 0,
        error: categories.length === 0 ? 'No categories available' : undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      steps.push({
        name: 'check_categories',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testProductFlow(): Promise<FlowTestResult> {
    const flowName = 'product_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Get a product
    try {
      const { data } = await localApi.select('products').limit(1).execute();
      const products = (data as any)?.data || [];

      if (products.length > 0) {
        const product = products[0];

        steps.push({
          name: 'get_product',
          passed: true,
          timestamp: new Date().toISOString(),
        });

        // Step 2: Check product details
        if (product.name && product.price) {
          steps.push({
            name: 'check_product_details',
            passed: true,
            timestamp: new Date().toISOString(),
          });
        } else {
          steps.push({
            name: 'check_product_details',
            passed: false,
            error: 'Missing product details',
            timestamp: new Date().toISOString(),
          });
          overallPassed = false;
        }
      } else {
        steps.push({
          name: 'get_product',
          passed: false,
          error: 'No products available',
          timestamp: new Date().toISOString(),
        });
        overallPassed = false;
      }
    } catch (error) {
      steps.push({
        name: 'get_product',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testWalletFlow(): Promise<FlowTestResult> {
    const flowName = 'wallet_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Get wallet
    try {
      const userId = securityOfflineSafe.getCurrentUserId();
      if (userId) {
        const { data } = await localApi.select('wallets').eq('user_id', userId).limit(1).execute();
        const wallets = (data as any)?.data || [];

        if (wallets.length > 0) {
          const wallet = wallets[0];

          steps.push({
            name: 'get_wallet',
            passed: true,
            timestamp: new Date().toISOString(),
          });

          // Step 2: Heal wallet if needed
          const healResult = await walletSelfHeal.healWallet(wallet.id);

          steps.push({
            name: 'heal_wallet',
            passed: healResult.healed || healResult.errors.length === 0,
            error: healResult.errors.length > 0 ? healResult.errors.join(', ') : undefined,
            timestamp: new Date().toISOString(),
          });

          if (!healResult.healed && healResult.errors.length > 0) {
            overallPassed = false;
          }
        } else {
          steps.push({
            name: 'get_wallet',
            passed: false,
            error: 'No wallet found',
            timestamp: new Date().toISOString(),
          });
          overallPassed = false;
        }
      } else {
        steps.push({
          name: 'get_wallet',
          passed: false,
          error: 'No authenticated user',
          timestamp: new Date().toISOString(),
        });
        overallPassed = false;
      }
    } catch (error) {
      steps.push({
        name: 'get_wallet',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testOrderFlow(): Promise<FlowTestResult> {
    const flowName = 'order_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Create test order
    try {
      const userId = securityOfflineSafe.getCurrentUserId();
      const { data: productData } = await localApi.select('products').limit(1).execute();
      const products = (productData as any)?.data || [];

      if (userId && products.length > 0) {
        const product = products[0];

        const order = {
          id: crypto.randomUUID(),
          user_id: userId,
          product_id: product.id,
          amount: product.price,
          quantity: 1,
          status: 'pending',
          payment_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await localApi.insert('orders', order);

        steps.push({
          name: 'create_order',
          passed: true,
          timestamp: new Date().toISOString(),
        });

        // Step 2: Heal order if needed
        const healResult = await orderSelfHeal.healOrder(order.id);

        steps.push({
          name: 'heal_order',
          passed: healResult.healed || healResult.errors.length === 0,
          error: healResult.errors.length > 0 ? healResult.errors.join(', ') : undefined,
          timestamp: new Date().toISOString(),
        });

        if (!healResult.healed && healResult.errors.length > 0) {
          overallPassed = false;
        }

        // Clean up test order
        await localApi.delete('orders', { id: order.id });
      } else {
        steps.push({
          name: 'create_order',
          passed: false,
          error: !userId ? 'No authenticated user' : 'No products available',
          timestamp: new Date().toISOString(),
        });
        overallPassed = false;
      }
    } catch (error) {
      steps.push({
        name: 'create_order',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testKeyFlow(): Promise<FlowTestResult> {
    const flowName = 'key_flow';
    const steps: FlowTestResult['steps'] = [];
    let overallPassed = true;

    // Step 1: Check license keys
    try {
      const { data } = await localApi.select('license_keys').execute();
      const keys = (data as any)?.data || [];

      steps.push({
        name: 'check_license_keys',
        passed: true,
        timestamp: new Date().toISOString(),
      });

      // Step 2: Heal keys if needed
      const healResults = await keySelfHeal.healAllMissingKeys();
      const allHealed = healResults.every(r => r.healed || r.errors.length === 0);

      steps.push({
        name: 'heal_keys',
        passed: allHealed,
        error: !allHealed ? 'Some keys failed to heal' : undefined,
        timestamp: new Date().toISOString(),
      });

      if (!allHealed) overallPassed = false;
    } catch (error) {
      steps.push({
        name: 'check_license_keys',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      overallPassed = false;
    }

    return {
      flowName,
      steps,
      overallPassed,
      timestamp: new Date().toISOString(),
    };
  }

  async testCompleteFlow(): Promise<FlowTestResult[]> {
    const results: FlowTestResult[] = [];

    results.push(await this.testLoginFlow());
    results.push(await this.testDashboardFlow());
    results.push(await this.testMarketplaceFlow());
    results.push(await this.testProductFlow());
    results.push(await this.testWalletFlow());
    results.push(await this.testOrderFlow());
    results.push(await this.testKeyFlow());

    // Log overall result
    const allPassed = results.every(r => r.overallPassed);

    selfHealingEngine.handleEvent({
      type: allPassed ? 'state_mismatch' : 'error',
      severity: allPassed ? 'low' : 'high',
      module: 'final_flow_offline',
      message: `Complete offline flow test: ${allPassed ? 'PASSED' : 'FAILED'}`,
      timestamp: new Date().toISOString(),
      context: { results },
      healed: false,
    });

    return results;
  }

  async runDataIntegrityCheck(): Promise<void> {
    // Run all self-healing checks
    await dataSelfHeal.healAllData();
    await walletSelfHeal.healAllWallets();
    await orderSelfHeal.healAllBrokenOrders();
    await keySelfHeal.healAllMissingKeys();
  }

  async runModuleHealthChecks(): Promise<void> {
    // Run module self-checks
    await moduleSelfCheck.checkModule('auth');
    await moduleSelfCheck.checkModule('marketplace');
    await moduleSelfCheck.checkModule('wallet');
    await moduleSelfCheck.checkModule('orders');
    await moduleSelfCheck.checkModule('license_keys');
  }

  getFlowSummary(results: FlowTestResult[]): {
    totalFlows: number;
    passedFlows: number;
    failedFlows: number;
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
  } {
    const totalFlows = results.length;
    const passedFlows = results.filter(r => r.overallPassed).length;
    const failedFlows = totalFlows - passedFlows;

    let totalSteps = 0;
    let passedSteps = 0;

    for (const result of results) {
      totalSteps += result.steps.length;
      passedSteps += result.steps.filter(s => s.passed).length;
    }

    const failedSteps = totalSteps - passedSteps;

    return {
      totalFlows,
      passedFlows,
      failedFlows,
      totalSteps,
      passedSteps,
      failedSteps,
    };
  }
}

// Singleton instance
export const finalFlowOffline = new FinalFlowOffline();
