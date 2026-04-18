/**
 * System Watchdog
 * Run DB integrity, route validity, module health checks every X seconds
 */

import { dataSelfHeal } from './dataSelfHeal';
import { walletSelfHeal } from './walletSelfHeal';
import { orderSelfHeal } from './orderSelfHeal';
import { keySelfHeal } from './keySelfHeal';
import { moduleSelfCheck } from './moduleSelfCheck';
import { routeSelfHeal } from './routeSelfHeal';
import { selfHealingEngine } from './selfHealingEngine';
import { finalFlowOffline } from './finalFlowOffline';

export interface WatchdogConfig {
  enabled: boolean;
  intervalMs: number;
  enableDBIntegrityCheck: boolean;
  enableRouteValidityCheck: boolean;
  enableModuleHealthCheck: boolean;
  enableDataHeal: boolean;
  enableWalletHeal: boolean;
  enableOrderHeal: boolean;
  enableKeyHeal: boolean;
}

export interface WatchdogReport {
  timestamp: string;
  dbIntegrity: { checked: boolean; passed: boolean; errors: string[] };
  routeValidity: { checked: boolean; passed: boolean; errors: string[] };
  moduleHealth: { checked: boolean; passed: boolean; errors: string[] };
  dataHeal: { checked: boolean; healed: number; errors: string[] };
  walletHeal: { checked: boolean; healed: number; errors: string[] };
  orderHeal: { checked: boolean; healed: number; errors: string[] };
  keyHeal: { checked: boolean; healed: number; errors: string[] };
}

class SystemWatchdog {
  private config: WatchdogConfig = {
    enabled: true,
    intervalMs: 60 * 1000, // 1 minute
    enableDBIntegrityCheck: true,
    enableRouteValidityCheck: true,
    enableModuleHealthCheck: true,
    enableDataHeal: true,
    enableWalletHeal: true,
    enableOrderHeal: true,
    enableKeyHeal: true,
  };

  private intervalId: number | null = null;
  private reports: WatchdogReport[] = [];
  private isRunning = false;

  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.runWatchdog();

    this.intervalId = window.setInterval(() => {
      this.runWatchdog();
    }, this.config.intervalMs);

    selfHealingEngine.handleEvent({
      type: 'state_mismatch',
      severity: 'low',
      module: 'system_watchdog',
      message: 'System watchdog started',
      timestamp: new Date().toISOString(),
      context: { config: this.config },
      healed: false,
    });
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;

    selfHealingEngine.handleEvent({
      type: 'state_mismatch',
      severity: 'low',
      module: 'system_watchdog',
      message: 'System watchdog stopped',
      timestamp: new Date().toISOString(),
      context: {},
      healed: false,
    });
  }

  private async runWatchdog(): Promise<void> {
    const report: WatchdogReport = {
      timestamp: new Date().toISOString(),
      dbIntegrity: { checked: false, passed: false, errors: [] },
      routeValidity: { checked: false, passed: false, errors: [] },
      moduleHealth: { checked: false, passed: false, errors: [] },
      dataHeal: { checked: false, healed: 0, errors: [] },
      walletHeal: { checked: false, healed: 0, errors: [] },
      orderHeal: { checked: false, healed: 0, errors: [] },
      keyHeal: { checked: false, healed: 0, errors: [] },
    };

    // DB Integrity Check
    if (this.config.enableDBIntegrityCheck) {
      try {
        report.dbIntegrity.checked = true;
        const summary = await dataSelfHeal.getDataIntegritySummary();
        report.dbIntegrity.passed = summary.totalErrors === 0;

        if (!report.dbIntegrity.passed) {
          report.dbIntegrity.errors.push(`${summary.totalErrors} data integrity issues found`);
        }
      } catch (error) {
        report.dbIntegrity.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Route Validity Check
    if (this.config.enableRouteValidityCheck) {
      try {
        report.routeValidity.checked = true;
        const currentPath = window.location.pathname;
        const validationResult = await routeSelfHeal.validateRoute(currentPath);
        report.routeValidity.passed = validationResult.valid;

        if (!validationResult.valid) {
          report.routeValidity.errors.push(`Invalid route: ${currentPath}`);
          // Auto heal route
          await routeSelfHeal.healRoute(currentPath);
        }
      } catch (error) {
        report.routeValidity.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Module Health Check
    if (this.config.enableModuleHealthCheck) {
      try {
        report.moduleHealth.checked = true;
        const modules = ['auth', 'marketplace', 'wallet', 'orders', 'license_keys'];
        let allPassed = true;
        const errors: string[] = [];

        for (const module of modules) {
          const result = await moduleSelfCheck.checkModule(module);
          if (result.status !== 'pass') {
            allPassed = false;
            const failedChecks = result.checks.filter(c => c.status === 'fail');
            errors.push(`${module}: ${failedChecks.map(c => c.message).join(', ')}`);
          }
        }

        report.moduleHealth.passed = allPassed;
        report.moduleHealth.errors = errors;
      } catch (error) {
        report.moduleHealth.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Data Heal
    if (this.config.enableDataHeal) {
      try {
        report.dataHeal.checked = true;
        const results = await dataSelfHeal.healAllData();
        report.dataHeal.healed = results.reduce((sum, r) => sum + r.healed, 0);
        report.dataHeal.errors = results.flatMap(r => r.errors);
      } catch (error) {
        report.dataHeal.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Wallet Heal
    if (this.config.enableWalletHeal) {
      try {
        report.walletHeal.checked = true;
        const results = await walletSelfHeal.healAllWallets();
        report.walletHeal.healed = results.filter(r => r.healed).length;
        report.walletHeal.errors = results.flatMap(r => r.errors);
      } catch (error) {
        report.walletHeal.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Order Heal
    if (this.config.enableOrderHeal) {
      try {
        report.orderHeal.checked = true;
        const results = await orderSelfHeal.healAllBrokenOrders();
        report.orderHeal.healed = results.filter(r => r.healed).length;
        report.orderHeal.errors = results.flatMap(r => r.errors);
      } catch (error) {
        report.orderHeal.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Key Heal
    if (this.config.enableKeyHeal) {
      try {
        report.keyHeal.checked = true;
        const results = await keySelfHeal.healAllMissingKeys();
        report.keyHeal.healed = results.reduce((sum, r) => sum + r.keysGenerated, 0);
        report.keyHeal.errors = results.flatMap(r => r.errors);
      } catch (error) {
        report.keyHeal.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Store report
    this.reports.push(report);

    // Keep only last 100 reports
    if (this.reports.length > 100) {
      this.reports.shift();
    }

    // Log if there are issues
    const hasIssues = !report.dbIntegrity.passed ||
                      !report.routeValidity.passed ||
                      !report.moduleHealth.passed ||
                      report.dataHeal.errors.length > 0 ||
                      report.walletHeal.errors.length > 0 ||
                      report.orderHeal.errors.length > 0 ||
                      report.keyHeal.errors.length > 0;

    if (hasIssues) {
      selfHealingEngine.handleEvent({
        type: 'state_mismatch',
        severity: 'medium',
        module: 'system_watchdog',
        message: 'Watchdog detected issues',
        timestamp: report.timestamp,
        context: report,
        healed: true,
        healingAction: 'watchdog_auto_heal',
      });
    }
  }

  getReports(): WatchdogReport[] {
    return [...this.reports];
  }

  getLatestReport(): WatchdogReport | null {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  clearReports(): void {
    this.reports = [];
  }

  isWatchdogRunning(): boolean {
    return this.isRunning;
  }

  setConfig(config: Partial<WatchdogConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart if running and interval changed
    if (this.isRunning && config.intervalMs !== undefined) {
      this.stop();
      this.start();
    }
  }

  getConfig(): WatchdogConfig {
    return { ...this.config };
  }

  async runOnce(): Promise<WatchdogReport> {
    await this.runWatchdog();
    return this.getLatestReport()!;
  }

  getHealthSummary(): {
    totalReports: number;
    totalIssues: number;
    averageHealedPerRun: number;
    lastRunTimestamp: string | null;
  } {
    const totalReports = this.reports.length;
    let totalIssues = 0;
    let totalHealed = 0;

    for (const report of this.reports) {
      if (!report.dbIntegrity.passed) totalIssues++;
      if (!report.routeValidity.passed) totalIssues++;
      if (!report.moduleHealth.passed) totalIssues++;
      totalHealed += report.dataHeal.healed;
      totalHealed += report.walletHeal.healed;
      totalHealed += report.orderHeal.healed;
      totalHealed += report.keyHeal.healed;
    }

    return {
      totalReports,
      totalIssues,
      averageHealedPerRun: totalReports > 0 ? totalHealed / totalReports : 0,
      lastRunTimestamp: this.getLatestReport()?.timestamp || null,
    };
  }
}

// Singleton instance
export const systemWatchdog = new SystemWatchdog();
