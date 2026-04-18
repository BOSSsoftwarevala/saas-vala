/**
 * Module Integration with Self-Healing
 * Integrates all 4 modules (Automation, Audit Logs, Marketplace Admin, System Health)
 * with the complete self-healing system and all 30 micro validations
 */

import React from 'react';
import { 
  validateField, 
  validateUUID, 
  ensureTimestamp, 
  safeMap, 
  safeNumber, 
  safeString, 
  nullShield,
  clickLock,
  withLoading,
  getUserFriendlyError,
  handleApiResponse,
  checkDuplicateRecord,
  checkOrphanRelation,
  withRetry,
  withTimeout,
  roleManager,
  validateRouteParams,
  handleImageError,
  getImageWithFallback,
  validateFile,
  validateBuildConfig,
  checkDeploymentStatus,
  actionLogger,
  safeConsoleLog,
  executeWithValidation,
  storageConsistency,
  addEventListenerSafe,
  debounce,
  handleEmptyFilter,
  getButtonState,
  validateForm,
  type ValidationResult,
  type FieldValidationConfig,
  type FileValidationConfig
} from './microValidations';

import { selfHealingEngine } from './selfHealingEngine';
import { systemWatchdog } from './systemWatchdog';
import { finalFlowOffline } from './finalFlowOffline';
import { moduleHardAssert } from './moduleHardAssert';
import { securityOfflineSafe } from './securityOfflineSafe';
import { dataSelfHeal } from './dataSelfHeal';
import { walletSelfHeal } from './walletSelfHeal';
import { orderSelfHeal } from './orderSelfHeal';
import { keySelfHeal } from './keySelfHeal';

export interface ModuleIntegrationConfig {
  moduleName: string;
  enableAllMicroValidations: boolean;
  enableSelfHealing: boolean;
  enableLogging: boolean;
}

export class ModuleIntegrator {
  private config: ModuleIntegrationConfig = {
    moduleName: '',
    enableAllMicroValidations: true,
    enableSelfHealing: true,
    enableLogging: true,
  };

  constructor(moduleName: string) {
    this.config.moduleName = moduleName;
  }

  // 1. FIELD LEVEL VALIDATION
  validateInput(value: any, config: FieldValidationConfig): ValidationResult {
    const result = validateField(value, config);
    if (!result.valid && this.config.enableLogging) {
      actionLogger.log('field_validation_failed', { module: this.config.moduleName, error: result.error });
    }
    return result;
  }

  // 2. ID CONSISTENCY
  validateId(id: any): ValidationResult {
    const result = validateUUID(id);
    if (!result.valid && this.config.enableLogging) {
      actionLogger.log('id_validation_failed', { module: this.config.moduleName, id, error: result.error });
    }
    return result;
  }

  // 3. TIME CONSISTENCY
  ensureTimestamps(record: any): any {
    const result = ensureTimestamp(record);
    if (this.config.enableLogging) {
      actionLogger.log('timestamp_ensured', { module: this.config.moduleName, recordId: record.id });
    }
    return result;
  }

  // 4. STATE SYNC
  syncState(uiState: any, dbState: any): boolean {
    const synced = JSON.stringify(uiState) === JSON.stringify(dbState);
    if (!synced && this.config.enableSelfHealing) {
      selfHealingEngine.handleEvent({
        type: 'state_mismatch',
        severity: 'medium',
        module: this.config.moduleName,
        message: 'State sync mismatch detected',
        timestamp: new Date().toISOString(),
        context: { uiState, dbState },
        healed: false,
      });
    }
    return synced;
  }

  // 5. CLICK LOCK
  acquireClickLock(actionKey: string): boolean {
    const acquired = clickLock.acquireLock(actionKey);
    if (!acquired && this.config.enableLogging) {
      actionLogger.log('click_locked', { module: this.config.moduleName, action: actionKey });
    }
    return acquired;
  }

  releaseClickLock(actionKey: string): void {
    clickLock.releaseLock(actionKey);
  }

  // 6. LOADING MICRO
  async withSafeLoading<T>(
    asyncFn: () => Promise<T>,
    setLoading: (loading: boolean) => void,
    setError: (error: Error | null) => void
  ): Promise<T> {
    try {
      return await withLoading(asyncFn, setLoading, setError);
    } catch (error) {
      if (this.config.enableLogging) {
        actionLogger.log('loading_error', { module: this.config.moduleName, error: String(error) });
      }
      throw error;
    }
  }

  // 7. ERROR MESSAGE MICRO
  getSafeError(error: any): string {
    return getUserFriendlyError(error);
  }

  // 8. NULL SHIELD
  nullShield<T>(data: T | null | undefined, fallback: T): T {
    const result = nullShield(data, fallback);
    if (data === null && this.config.enableLogging) {
      actionLogger.log('null_shield_triggered', { module: this.config.moduleName });
    }
    return result;
  }

  // 9. ARRAY SAFETY
  safeMap<T, U>(array: T[] | null | undefined, mapFn: (item: T, index: number) => U): U[] {
    return safeMap(array, mapFn);
  }

  // 10. NUMBER SAFETY
  safeNumber(value: any, fallback: number = 0): number {
    return safeNumber(value, fallback);
  }

  // 11. STRING SAFETY
  safeString(value: any, fallback: string = ''): string {
    return safeString(value, fallback);
  }

  // 12. STORAGE CONSISTENCY
  syncStorage(key: string, data: any): void {
    storageConsistency.syncWithLocalStorage(key, data);
  }

  getFromStorage<T>(key: string, fallback: T): T {
    return storageConsistency.getFromLocalStorage(key, fallback);
  }

  clearStaleStorage(maxAge: number = 24 * 60 * 60 * 1000): void {
    storageConsistency.clearStaleCache(maxAge);
  }

  // 13. MEMORY CLEANUP
  cleanupEffect(cleanupFn: () => void): () => void {
    return cleanupFn;
  }

  // 14. EVENT CLEANUP
  addSafeEventListener(
    target: EventTarget,
    event: string,
    handler: EventListener
  ): () => void {
    return addEventListenerSafe(target, event, handler);
  }

  // 15. API EDGE CASE
  handleApiSafe<T>(response: any, fallback: T) {
    const result = handleApiResponse<T>(response, fallback);
    if (!result.data && this.config.enableLogging) {
      actionLogger.log('api_edge_case', { module: this.config.moduleName, error: result.error });
    }
    return result;
  }

  // 16. DB EDGE CASE
  async checkDuplicate(tableName: string, field: string, value: any): Promise<boolean> {
    const isDuplicate = await checkDuplicateRecord(tableName, field, value);
    if (isDuplicate && this.config.enableLogging) {
      actionLogger.log('duplicate_detected', { module: this.config.moduleName, table: tableName, field, value });
    }
    return isDuplicate;
  }

  async checkOrphan(tableName: string, relationField: string, relationTable: string): Promise<boolean> {
    const hasOrphan = await checkOrphanRelation(tableName, relationField, relationTable);
    if (hasOrphan && this.config.enableSelfHealing) {
      dataSelfHeal.healAllData();
    }
    return hasOrphan;
  }

  // 17. NETWORK EDGE
  async withNetworkRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    try {
      return await withRetry(fn, maxRetries);
    } catch (error) {
      if (this.config.enableLogging) {
        actionLogger.log('network_retry_failed', { module: this.config.moduleName, error: String(error) });
      }
      throw error;
    }
  }

  async withNetworkTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    try {
      return await withTimeout(fn, timeoutMs);
    } catch (error) {
      if (this.config.enableLogging) {
        actionLogger.log('network_timeout', { module: this.config.moduleName, timeout: timeoutMs });
      }
      throw error;
    }
  }

  // 18. ROLE EDGE
  setRole(role: string): void {
    roleManager.setRole(role);
    if (this.config.enableLogging) {
      actionLogger.log('role_changed', { module: this.config.moduleName, role });
    }
  }

  hasPermission(requiredRole: string): boolean {
    return roleManager.hasPermission(requiredRole);
  }

  subscribeToRole(callback: (role: string | null) => void): () => void {
    return roleManager.subscribe(callback);
  }

  // 19. ROUTE EDGE
  validateRoute(params: Record<string, any>, requiredParams: string[]): {
    valid: boolean;
    missing: string[];
    invalid: string[];
  } {
    return validateRouteParams(params, requiredParams);
  }

  // 20. BUTTON EDGE
  getButtonState(isLoading: boolean, isDisabled: boolean, isValid: boolean): {
    disabled: boolean;
    loading: boolean;
  } {
    return getButtonState(isLoading, isDisabled, isValid);
  }

  // 21. FORM EDGE
  validateForm<T extends Record<string, any>>(
    data: T,
    validations: Record<keyof T, FieldValidationConfig>
  ): {
    valid: boolean;
    errors: Record<string, string>;
  } {
    return validateForm(data, validations);
  }

  // 22. SEARCH EDGE
  debounceSearch<T extends (...args: any[]) => any>(fn: T, delay: number): T {
    return debounce(fn, delay) as T;
  }

  // 23. FILTER EDGE
  handleFilterEmpty<T>(items: T[], fallbackMessage: string = 'No results found'): {
    items: T[];
    showFallback: boolean;
    message: string;
  } {
    return handleEmptyFilter(items, fallbackMessage);
  }

  // 24. IMAGE EDGE
  handleImageError(event: React.SyntheticEvent<HTMLImageElement>, fallbackSrc: string): void {
    handleImageError(event, fallbackSrc);
  }

  getImageWithFallback(src: string, fallback: string = '/placeholder.png'): string {
    return getImageWithFallback(src, fallback);
  }

  // 25. FILE EDGE
  validateFile(file: File, config: FileValidationConfig): ValidationResult {
    const result = validateFile(file, config);
    if (!result.valid && this.config.enableLogging) {
      actionLogger.log('file_validation_failed', { module: this.config.moduleName, error: result.error });
    }
    return result;
  }

  // 26. BUILD EDGE
  validateBuild(config: any): ValidationResult {
    return validateBuildConfig(config);
  }

  // 27. DEPLOY EDGE
  checkDeployStatus(): {
    isLatest: boolean;
    cacheCleared: boolean;
    version: string;
  } {
    return checkDeploymentStatus();
  }

  // 28. LOG EDGE
  logAction(action: string, context?: any): void {
    if (this.config.enableLogging) {
      actionLogger.log(action, { module: this.config.moduleName, ...context });
    }
  }

  getLogs() {
    return actionLogger.getLogs();
  }

  clearLogs() {
    actionLogger.clearLogs();
  }

  // 29. SECURITY EDGE
  safeLog(message: string, data?: any): void {
    safeConsoleLog(message, data);
  }

  // 30. FINAL ASSERT MICRO LOOP
  async executeWithFullValidation<T>(
    action: string,
    validate: () => ValidationResult,
    execute: () => Promise<T>,
    updateDB?: (result: T) => Promise<void>,
    updateUI?: (result: T) => void
  ): Promise<T> {
    try {
      return await executeWithValidation(action, validate, execute, updateDB, updateUI);
    } catch (error) {
      if (this.config.enableSelfHealing) {
        selfHealingEngine.handleEvent({
          type: 'error',
          severity: 'high',
          module: this.config.moduleName,
          message: `Validation failed for action: ${action}`,
          timestamp: new Date().toISOString(),
          context: { error: String(error) },
          healed: false,
        });
      }
      throw error;
    }
  }

  // Self-Healing Integration
  async runSelfHealing(): Promise<void> {
    if (!this.config.enableSelfHealing) return;

    // Run data self-heal
    await dataSelfHeal.healAllData();

    // Run wallet self-heal
    await walletSelfHeal.healAllWallets();

    // Run order self-heal
    await orderSelfHeal.healAllBrokenOrders();

    // Run key self-heal
    await keySelfHeal.healAllMissingKeys();
  }

  // Module Hard Assert Integration
  async assertModuleLoad(loadFn: () => Promise<any>): Promise<any> {
    const result = await moduleHardAssert.assertModuleLoad(this.config.moduleName, loadFn);
    if (!result.passed && this.config.enableSelfHealing) {
      selfHealingEngine.handleEvent({
        type: 'error',
        severity: 'high',
        module: this.config.moduleName,
        message: 'Module load assertion failed',
        timestamp: result.timestamp,
        context: result,
        healed: false,
      });
    }
    return result;
  }

  // System Watchdog Integration
  startWatchdog(intervalMs: number = 60 * 1000): void {
    systemWatchdog.setConfig({ intervalMs, enabled: true });
    systemWatchdog.start();
  }

  stopWatchdog(): void {
    systemWatchdog.stop();
  }

  // Final Flow Integration
  async testModuleFlow(): Promise<any> {
    return await finalFlowOffline.runDataIntegrityCheck();
  }

  // Security Integration
  async validateToken(token: string): Promise<any> {
    return await securityOfflineSafe.validateToken(token);
  }

  async validateRole(requiredRole: string): Promise<any> {
    return await securityOfflineSafe.validateRole(requiredRole);
  }

  sanitizeData<T>(data: T): T {
    return securityOfflineSafe.sanitizeData(data);
  }

  // Initialize all integrations
  async initialize(): Promise<void> {
    if (this.config.enableSelfHealing) {
      await this.runSelfHealing();
    }

    storageConsistency.startAutoSync(60 * 1000); // Sync every minute
    this.startWatchdog(60 * 1000); // Watchdog every minute

    if (this.config.enableLogging) {
      actionLogger.log('module_initialized', { module: this.config.moduleName });
    }
  }

  // Cleanup on unmount
  cleanup(): void {
    this.stopWatchdog();
    storageConsistency.stopAutoSync();
    this.clearLogs();

    if (this.config.enableLogging) {
      actionLogger.log('module_cleanup', { module: this.config.moduleName });
    }
  }
}

// Module-specific integrators
export const automationIntegrator = new ModuleIntegrator('automation');
export const auditLogsIntegrator = new ModuleIntegrator('audit_logs');
export const marketplaceAdminIntegrator = new ModuleIntegrator('marketplace_admin');
export const systemHealthIntegrator = new ModuleIntegrator('system_health');

// React hook for module integration
export function useModuleIntegration(moduleName: string) {
  const integrator = new ModuleIntegrator(moduleName);

  React.useEffect(() => {
    integrator.initialize();
    return () => integrator.cleanup();
  }, [moduleName]);

  return integrator;
}
