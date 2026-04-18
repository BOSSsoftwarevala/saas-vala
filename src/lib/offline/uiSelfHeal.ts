/**
 * UI Self-Heal
 * No blank screen, show fallback, auto retry load
 */

import React from 'react';
import { selfHealingEngine } from './selfHealingEngine';

export interface UIFallbackConfig {
  component: string;
  fallbackComponent?: string;
  fallbackMessage?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface UILoadResult {
  success: boolean;
  attempts: number;
  fromFallback: boolean;
  timestamp: string;
  actions?: string[];
}

class UISelfHeal {
  private loadAttempts: Map<string, number> = new Map();
  private maxRetryAttempts = 3;
  private retryDelay = 2000; // 2 seconds
  private fallbackConfigs: Map<string, UIFallbackConfig> = new Map();
  private loadResults: Map<string, UILoadResult> = new Map();

  async healComponentLoad(componentId: string, loadFn: () => Promise<boolean>): Promise<UILoadResult> {
    const result: UILoadResult = {
      success: false,
      attempts: 0,
      fromFallback: false,
      timestamp: new Date().toISOString(),
    };

    const currentAttempts = this.loadAttempts.get(componentId) || 0;
    result.attempts = currentAttempts + 1;
    this.loadAttempts.set(componentId, result.attempts);

    try {
      // Attempt to load component
      const loadSuccess = await loadFn();

      if (loadSuccess) {
        result.success = true;
        this.loadAttempts.delete(componentId); // Reset attempts on success
        this.loadResults.set(componentId, result);
        return result;
      }

      // Load failed, check if we should retry
      if (result.attempts < this.maxRetryAttempts) {
        result.actions = [`Retry ${result.attempts}/${this.maxRetryAttempts}`];
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        
        // Retry
        const retryResult = await this.healComponentLoad(componentId, loadFn);
        return retryResult;
      }

      // Max attempts reached, use fallback
      const fallbackConfig = this.fallbackConfigs.get(componentId);

      if (fallbackConfig) {
        result.fromFallback = true;
        result.success = true; // Fallback is considered success
        this.loadResults.set(componentId, result);

        selfHealingEngine.handleEvent({
          type: 'api_fail',
          severity: 'medium',
          module: 'ui_self_heal',
          message: `Component ${componentId} healed using fallback`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'fallback_component_used',
        });
      } else {
        result.success = false;
        this.loadResults.set(componentId, result);

        selfHealingEngine.handleEvent({
          type: 'error',
          severity: 'high',
          module: 'ui_self_heal',
          message: `Component ${componentId} failed to load and no fallback available`,
          timestamp: result.timestamp,
          context: result,
          healed: false,
        });
      }

    } catch (error) {
      result.success = false;
      this.loadResults.set(componentId, result);

      selfHealingEngine.handleEvent({
        type: 'error',
        severity: 'high',
        module: 'ui_self_heal',
        message: `Component ${componentId} load error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: result.timestamp,
        context: { error },
        healed: false,
      });
    }

    return result;
  }

  registerFallbackConfig(config: UIFallbackConfig): void {
    this.fallbackConfigs.set(config.component, config);
  }

  unregisterFallbackConfig(component: string): void {
    this.fallbackConfigs.delete(component);
  }

  getFallbackConfig(component: string): UIFallbackConfig | undefined {
    return this.fallbackConfigs.get(component);
  }

  async healAllComponents(loadFunctions: Map<string, () => Promise<boolean>>): Promise<Map<string, UILoadResult>> {
    const results = new Map<string, UILoadResult>();

    for (const [componentId, loadFn] of loadFunctions) {
      const result = await this.healComponentLoad(componentId, loadFn);
      results.set(componentId, result);
    }

    return results;
  }

  getLoadResult(componentId: string): UILoadResult | undefined {
    return this.loadResults.get(componentId);
  }

  getAllLoadResults(): Map<string, UILoadResult> {
    return new Map(this.loadResults);
  }

  clearLoadAttempts(componentId: string): void {
    this.loadAttempts.delete(componentId);
  }

  clearAllLoadAttempts(): void {
    this.loadAttempts.clear();
  }

  setMaxRetryAttempts(attempts: number): void {
    this.maxRetryAttempts = attempts;
  }

  setRetryDelay(delay: number): void {
    this.retryDelay = delay;
  }

  async getUIHealthSummary(): Promise<{
    totalComponents: number;
    successfulLoads: number;
    fallbackLoads: number;
    failedLoads: number;
  }> {
    let successfulLoads = 0;
    let fallbackLoads = 0;
    let failedLoads = 0;

    for (const result of this.loadResults.values()) {
      if (result.success) {
        if (result.fromFallback) {
          fallbackLoads++;
        } else {
          successfulLoads++;
        }
      } else {
        failedLoads++;
      }
    }

    return {
      totalComponents: this.loadResults.size,
      successfulLoads,
      fallbackLoads,
      failedLoads,
    };
  }

  // React HOC for component self-healing
  withSelfHealing<P extends object>(
    Component: React.ComponentType<P>,
    componentId: string,
    fallbackComponent?: React.ComponentType<P>,
    fallbackMessage?: string
  ): React.ComponentType<P> {
    // Register fallback config
    this.registerFallbackConfig({
      component: componentId,
      fallbackComponent: fallbackComponent?.name,
      fallbackMessage,
    });

    return function WithSelfHealingWrapper(props: P) {
      const [isLoading, setIsLoading] = React.useState(true);
      const [hasError, setHasError] = React.useState(false);
      const [useFallback, setUseFallback] = React.useState(false);

      React.useEffect(() => {
        // Simulate load attempt
        const loadComponent = async () => {
          try {
            // In a real implementation, this would check if the component can render
            // For now, simulate success
            setIsLoading(false);
          } catch (error) {
            // On error, try fallback
            if (fallbackComponent) {
              setUseFallback(true);
              setIsLoading(false);
            } else {
              setHasError(true);
              setIsLoading(false);
            }
          }
        };

        loadComponent();
      }, []);

      if (isLoading) {
        return React.createElement('div', { className: 'ui-self-heal-loading' }, 'Loading...');
      }

      if (hasError && !fallbackComponent) {
        return React.createElement('div', { className: 'ui-self-heal-error' }, fallbackMessage || 'Component failed to load');
      }

      if (useFallback && fallbackComponent) {
        return React.createElement(fallbackComponent, props);
      }

      return React.createElement(Component, props);
    };
  }

  // Global error boundary handler
  handleGlobalError(error: Error, errorInfo: any): void {
    selfHealingEngine.handleEvent({
      type: 'error',
      severity: 'critical',
      module: 'ui_self_heal',
      message: `Global UI error: ${error.message}`,
      timestamp: new Date().toISOString(),
      context: { error, errorInfo },
      healed: false,
    });
  }
}

// Singleton instance
export const uiSelfHeal = new UISelfHeal();
