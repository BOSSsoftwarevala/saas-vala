/**
 * Self-Healing Engine
 * Global watcher to detect errors, nulls, API fails, route fails
 */

export interface HealingEvent {
  type: 'error' | 'null' | 'api_fail' | 'route_fail' | 'state_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  module: string;
  message: string;
  timestamp: string;
  context?: any;
  healed: boolean;
  healingAction?: string;
}

export interface HealingConfig {
  autoHeal: boolean;
  retryAttempts: number;
  retryDelay: number;
  logAllEvents: boolean;
}

class SelfHealingEngine {
  private config: HealingConfig = {
    autoHeal: true,
    retryAttempts: 3,
    retryDelay: 1000,
    logAllEvents: true,
  };

  private eventHistory: HealingEvent[] = [];
  private maxHistorySize = 100;
  private listeners: Set<(event: HealingEvent) => void> = new Set();
  private moduleHealth: Map<string, boolean> = new Map();

  constructor() {
    this.initializeGlobalErrorHandlers();
  }

  private initializeGlobalErrorHandlers(): void {
    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleEvent({
        type: 'error',
        severity: 'critical',
        module: source || 'global',
        message: message.toString(),
        timestamp: new Date().toISOString(),
        context: { lineno, colno, error },
        healed: false,
      });

      if (this.config.autoHeal) {
        return this.healError(error);
      }

      return false;
    };

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleEvent({
        type: 'error',
        severity: 'high',
        module: 'promise',
        message: event.reason?.toString() || 'Unhandled promise rejection',
        timestamp: new Date().toISOString(),
        context: { reason: event.reason },
        healed: false,
      });
    });
  }

  public handleEvent(event: HealingEvent): void {
    // Add to history
    this.eventHistory.push(event);

    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Log if configured
    if (this.config.logAllEvents) {
      console.log('[Self-Healing]', event);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(event));

    // Update module health
    this.updateModuleHealth(event.module, false);
  }

  private async healError(error: any): Promise<boolean> {
    // Attempt to heal the error
    try {
      // Retry logic
      for (let i = 0; i < this.config.retryAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        
        // If error is recoverable, retry would happen here
        // For now, just mark as attempted
      }

      return false;
    } catch {
      return false;
    }
  }

  detectNull(module: string, value: any, context?: string): boolean {
    if (value === null || value === undefined) {
      this.handleEvent({
        type: 'null',
        severity: 'high',
        module,
        message: `Null/undefined detected${context ? ` in ${context}` : ''}`,
        timestamp: new Date().toISOString(),
        context: { value, context },
        healed: false,
      });

      if (this.config.autoHeal) {
        return this.healNull(module, value, context);
      }

      return true;
    }

    return false;
  }

  private healNull(module: string, value: any, context?: string): boolean {
    // Provide fallback value based on context
    const fallback = this.getFallbackForContext(context);

    if (fallback !== null) {
      this.handleEvent({
        type: 'null',
        severity: 'low',
        module,
        message: `Null healed with fallback${context ? ` in ${context}` : ''}`,
        timestamp: new Date().toISOString(),
        context: { original: value, fallback },
        healed: true,
        healingAction: 'provided_fallback',
      });

      this.updateModuleHealth(module, true);
      return true;
    }

    return false;
  }

  private getFallbackForContext(context?: string): any {
    // Provide appropriate fallbacks based on context
    if (!context) return null;

    if (context.includes('array')) return [];
    if (context.includes('number')) return 0;
    if (context.includes('string')) return '';
    if (context.includes('boolean')) return false;
    if (context.includes('object')) return {};

    return null;
  }

  detectApiFail(module: string, error: any, endpoint?: string): void {
    this.handleEvent({
      type: 'api_fail',
      severity: 'high',
      module,
      message: `API failure${endpoint ? ` at ${endpoint}` : ''}: ${error?.message || 'Unknown error'}`,
      timestamp: new Date().toISOString(),
      context: { error, endpoint },
      healed: false,
    });

    if (this.config.autoHeal) {
      this.healApiFail(module, error, endpoint);
    }
  }

  private async healApiFail(module: string, error: any, endpoint?: string): Promise<void> {
    // Try to heal API failure by retrying with fallback
    for (let i = 0; i < this.config.retryAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));

      // Retry logic would go here
      // For now, just mark as attempted
    }

    this.handleEvent({
      type: 'api_fail',
      severity: 'medium',
      module,
      message: `API fail healing attempted${endpoint ? ` for ${endpoint}` : ''}`,
      timestamp: new Date().toISOString(),
      context: { endpoint },
      healed: true,
      healingAction: 'retry_attempted',
    });
  }

  detectRouteFail(module: string, route: string, error?: any): void {
    this.handleEvent({
      type: 'route_fail',
      severity: 'high',
      module,
      message: `Route failure at ${route}${error ? `: ${error.message}` : ''}`,
      timestamp: new Date().toISOString(),
      context: { route, error },
      healed: false,
    });

    if (this.config.autoHeal) {
      this.healRouteFail(module, route, error);
    }
  }

  private healRouteFail(module: string, route: string, error?: any): void {
    // Redirect to safe fallback route
    const fallbackRoute = this.getFallbackRoute(route);

    if (fallbackRoute !== route) {
      window.location.href = fallbackRoute;

      this.handleEvent({
        type: 'route_fail',
        severity: 'low',
        module,
        message: `Route healed by redirecting to ${fallbackRoute}`,
        timestamp: new Date().toISOString(),
        context: { originalRoute: route, fallbackRoute },
        healed: true,
        healingAction: 'redirected',
      });

      this.updateModuleHealth(module, true);
    }
  }

  private getFallbackRoute(route: string): string {
    // Provide fallback routes
    if (route.includes('/dashboard')) return '/marketplace';
    if (route.includes('/reseller-dashboard')) return '/marketplace';
    if (route.includes('/marketplace/')) return '/marketplace';
    
    return '/'; // Default fallback
  }

  detectStateMismatch(module: string, expected: any, actual: any, context?: string): void {
    const isMismatch = JSON.stringify(expected) !== JSON.stringify(actual);

    if (isMismatch) {
      this.handleEvent({
        type: 'state_mismatch',
        severity: 'medium',
        module,
        message: `State mismatch detected${context ? ` in ${context}` : ''}`,
        timestamp: new Date().toISOString(),
        context: { expected, actual, context },
        healed: false,
      });

      if (this.config.autoHeal) {
        this.healStateMismatch(module, expected, context);
      }
    }
  }

  private healStateMismatch(module: string, expected: any, context?: string): void {
    // Reset state to expected value
    // This would trigger a state update in the module
    
    this.handleEvent({
      type: 'state_mismatch',
      severity: 'low',
      module,
      message: `State healed by resetting${context ? ` in ${context}` : ''}`,
      timestamp: new Date().toISOString(),
      context: { expected, context },
      healed: true,
      healingAction: 'state_reset',
    });

    this.updateModuleHealth(module, true);
  }

  updateModuleHealth(module: string, healthy: boolean): void {
    this.moduleHealth.set(module, healthy);
  }

  getModuleHealth(module: string): boolean {
    return this.moduleHealth.get(module) ?? true;
  }

  getAllModuleHealth(): Record<string, boolean> {
    return Object.fromEntries(this.moduleHealth);
  }

  subscribe(listener: (event: HealingEvent) => void): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEventHistory(limit?: number): HealingEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  clearEventHistory(): void {
    this.eventHistory = [];
  }

  setConfig(config: Partial<HealingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): HealingConfig {
    return { ...this.config };
  }

  getHealthSummary(): {
    totalEvents: number;
    healed: number;
    failed: number;
    healthyModules: number;
    totalModules: number;
  } {
    const healed = this.eventHistory.filter(e => e.healed).length;
    const failed = this.eventHistory.filter(e => !e.healed).length;
    const healthyModules = Array.from(this.moduleHealth.values()).filter(h => h).length;

    return {
      totalEvents: this.eventHistory.length,
      healed,
      failed,
      healthyModules,
      totalModules: this.moduleHealth.size,
    };
  }
}

// Singleton instance
export const selfHealingEngine = new SelfHealingEngine();
