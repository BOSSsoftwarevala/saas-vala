/**
 * Module Hard Assert
 * Validate load, action, response, DB update for each module
 */

import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface AssertResult {
  module: string;
  assertion: string;
  passed: boolean;
  error?: string;
  timestamp: string;
}

export interface ModuleAssertConfig {
  enableLoadValidation: boolean;
  enableActionValidation: boolean;
  enableResponseValidation: boolean;
  enableDBUpdateValidation: boolean;
}

class ModuleHardAssert {
  private config: ModuleAssertConfig = {
    enableLoadValidation: true,
    enableActionValidation: true,
    enableResponseValidation: true,
    enableDBUpdateValidation: true,
  };

  private assertResults: AssertResult[] = [];

  async assertModuleLoad(moduleName: string, loadFn: () => Promise<any>): Promise<AssertResult> {
    const result: AssertResult = {
      module: moduleName,
      assertion: 'load',
      passed: false,
      timestamp: new Date().toISOString(),
    };

    if (!this.config.enableLoadValidation) {
      result.passed = true;
      this.assertResults.push(result);
      return result;
    }

    try {
      const startTime = performance.now();
      const loadResult = await loadFn();
      const endTime = performance.now();

      // Assert that load completed
      if (loadResult === null || loadResult === undefined) {
        result.error = 'Load returned null or undefined';
        this.assertResults.push(result);
        return result;
      }

      // Assert that load completed in reasonable time (< 5 seconds)
      const loadTime = endTime - startTime;
      if (loadTime > 5000) {
        result.error = `Load took too long: ${loadTime}ms`;
        this.assertResults.push(result);
        return result;
      }

      result.passed = true;
      this.assertResults.push(result);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.assertResults.push(result);
    }

    return result;
  }

  async assertModuleAction(
    moduleName: string,
    actionName: string,
    actionFn: () => Promise<any>,
    expectedOutcome?: any
  ): Promise<AssertResult> {
    const result: AssertResult = {
      module: moduleName,
      assertion: `action:${actionName}`,
      passed: false,
      timestamp: new Date().toISOString(),
    };

    if (!this.config.enableActionValidation) {
      result.passed = true;
      this.assertResults.push(result);
      return result;
    }

    try {
      const actionResult = await actionFn();

      // Assert that action completed
      if (actionResult === null || actionResult === undefined) {
        result.error = 'Action returned null or undefined';
        this.assertResults.push(result);
        return result;
      }

      // Assert expected outcome if provided
      if (expectedOutcome !== undefined) {
        if (typeof expectedOutcome === 'function') {
          if (!expectedOutcome(actionResult)) {
            result.error = 'Action result does not match expected outcome';
            this.assertResults.push(result);
            return result;
          }
        } else if (JSON.stringify(actionResult) !== JSON.stringify(expectedOutcome)) {
          result.error = 'Action result does not match expected outcome';
          this.assertResults.push(result);
          return result;
        }
      }

      result.passed = true;
      this.assertResults.push(result);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.assertResults.push(result);
    }

    return result;
  }

  async assertModuleResponse(
    moduleName: string,
    response: any,
    validationRules?: {
      requiredFields?: string[];
      typeChecks?: Record<string, string>;
      customValidation?: (response: any) => boolean;
    }
  ): Promise<AssertResult> {
    const result: AssertResult = {
      module: moduleName,
      assertion: 'response',
      passed: false,
      timestamp: new Date().toISOString(),
    };

    if (!this.config.enableResponseValidation) {
      result.passed = true;
      this.assertResults.push(result);
      return result;
    }

    try {
      if (response === null || response === undefined) {
        result.error = 'Response is null or undefined';
        this.assertResults.push(result);
        return result;
      }

      // Check required fields
      if (validationRules?.requiredFields) {
        for (const field of validationRules.requiredFields) {
          if (!(field in response) || response[field] === null || response[field] === undefined) {
            result.error = `Missing required field: ${field}`;
            this.assertResults.push(result);
            return result;
          }
        }
      }

      // Check type constraints
      if (validationRules?.typeChecks) {
        for (const [field, expectedType] of Object.entries(validationRules.typeChecks)) {
          if (field in response) {
            const actualType = typeof response[field];
            if (actualType !== expectedType) {
              result.error = `Field ${field} has wrong type: expected ${expectedType}, got ${actualType}`;
              this.assertResults.push(result);
              return result;
            }
          }
        }
      }

      // Custom validation
      if (validationRules?.customValidation) {
        if (!validationRules.customValidation(response)) {
          result.error = 'Custom validation failed';
          this.assertResults.push(result);
          return result;
        }
      }

      result.passed = true;
      this.assertResults.push(result);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.assertResults.push(result);
    }

    return result;
  }

  async assertDBUpdate(
    moduleName: string,
    tableName: string,
    recordId: string,
    expectedChanges: Partial<any>
  ): Promise<AssertResult> {
    const result: AssertResult = {
      module: moduleName,
      assertion: 'db_update',
      passed: false,
      timestamp: new Date().toISOString(),
    };

    if (!this.config.enableDBUpdateValidation) {
      result.passed = true;
      this.assertResults.push(result);
      return result;
    }

    try {
      // Fetch the record from DB
      const { data } = await localApi.select(tableName).eq('id', recordId).execute();
      const records = (data as any)?.data || [];

      if (records.length === 0) {
        result.error = 'Record not found in database';
        this.assertResults.push(result);
        return result;
      }

      const record = records[0];

      // Assert expected changes
      for (const [field, expectedValue] of Object.entries(expectedChanges)) {
        if (!(field in record)) {
          result.error = `Field ${field} not found in record`;
          this.assertResults.push(result);
          return result;
        }

        if (record[field] !== expectedValue) {
          result.error = `Field ${field} has wrong value: expected ${expectedValue}, got ${record[field]}`;
          this.assertResults.push(result);
          return result;
        }
      }

      result.passed = true;
      this.assertResults.push(result);
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.assertResults.push(result);
    }

    return result;
  }

  async assertModuleComplete(
    moduleName: string,
    operations: {
      load?: () => Promise<any>;
      actions?: Array<{ name: string; fn: () => Promise<any>; expected?: any }>;
      response?: any;
      responseValidation?: {
        requiredFields?: string[];
        typeChecks?: Record<string, string>;
        customValidation?: (response: any) => boolean;
      };
      dbUpdate?: { tableName: string; recordId: string; expectedChanges: Partial<any> };
    }
  ): Promise<AssertResult[]> {
    const results: AssertResult[] = [];

    // Assert load
    if (operations.load) {
      const loadResult = await this.assertModuleLoad(moduleName, operations.load);
      results.push(loadResult);

      if (!loadResult.passed) {
        selfHealingEngine.handleEvent({
          type: 'error',
          severity: 'high',
          module: 'module_hard_assert',
          message: `Module ${moduleName} load assertion failed`,
          timestamp: loadResult.timestamp,
          context: loadResult,
          healed: false,
        });
        return results;
      }
    }

    // Assert actions
    if (operations.actions) {
      for (const action of operations.actions) {
        const actionResult = await this.assertModuleAction(
          moduleName,
          action.name,
          action.fn,
          action.expected
        );
        results.push(actionResult);

        if (!actionResult.passed) {
          selfHealingEngine.handleEvent({
            type: 'error',
            severity: 'high',
            module: 'module_hard_assert',
            message: `Module ${moduleName} action ${action.name} assertion failed`,
            timestamp: actionResult.timestamp,
            context: actionResult,
            healed: false,
          });
        }
      }
    }

    // Assert response
    if (operations.response) {
      const responseResult = await this.assertModuleResponse(
        moduleName,
        operations.response,
        operations.responseValidation
      );
      results.push(responseResult);

      if (!responseResult.passed) {
        selfHealingEngine.handleEvent({
          type: 'error',
          severity: 'high',
          module: 'module_hard_assert',
          message: `Module ${moduleName} response assertion failed`,
          timestamp: responseResult.timestamp,
          context: responseResult,
          healed: false,
        });
      }
    }

    // Assert DB update
    if (operations.dbUpdate) {
      const dbResult = await this.assertDBUpdate(
        moduleName,
        operations.dbUpdate.tableName,
        operations.dbUpdate.recordId,
        operations.dbUpdate.expectedChanges
      );
      results.push(dbResult);

      if (!dbResult.passed) {
        selfHealingEngine.handleEvent({
          type: 'error',
          severity: 'high',
          module: 'module_hard_assert',
          message: `Module ${moduleName} DB update assertion failed`,
          timestamp: dbResult.timestamp,
          context: dbResult,
          healed: false,
        });
      }
    }

    return results;
  }

  getAssertResults(): AssertResult[] {
    return [...this.assertResults];
  }

  getModuleResults(moduleName: string): AssertResult[] {
    return this.assertResults.filter(r => r.module === moduleName);
  }

  clearResults(): void {
    this.assertResults = [];
  }

  getAssertionSummary(): {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    byModule: Record<string, { passed: number; failed: number }>;
  } {
    const total = this.assertResults.length;
    const passed = this.assertResults.filter(r => r.passed).length;
    const failed = total - passed;
    const passRate = total > 0 ? passed / total : 0;

    const byModule: Record<string, { passed: number; failed: number }> = {};

    for (const result of this.assertResults) {
      if (!byModule[result.module]) {
        byModule[result.module] = { passed: 0, failed: 0 };
      }

      if (result.passed) {
        byModule[result.module].passed++;
      } else {
        byModule[result.module].failed++;
      }
    }

    return { total, passed, failed, passRate, byModule };
  }

  setConfig(config: Partial<ModuleAssertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ModuleAssertConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const moduleHardAssert = new ModuleHardAssert();
