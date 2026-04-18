/**
 * APK Pipeline Self-Heal
 * Retry and fallback template on build fail
 */

import { selfHealingEngine } from './selfHealingEngine';

export interface BuildConfig {
  productId: string;
  templateId?: string;
  customConfig?: any;
}

export interface BuildResult {
  success: boolean;
  apkUrl?: string;
  error?: string;
  attempts: number;
  timestamp: string;
}

export interface BuildHealResult {
  buildId: string;
  healed: boolean;
  oldStatus: string;
  newStatus: string;
  actions: string[];
  errors: string[];
  timestamp: string;
}

class ApkPipelineSelfHeal {
  private maxRetryAttempts = 3;
  private retryDelay = 5000; // 5 seconds
  private buildQueue: Map<string, BuildConfig> = new Map();
  private buildResults: Map<string, BuildResult> = new Map();

  async healBuild(buildId: string): Promise<BuildHealResult> {
    const result: BuildHealResult = {
      buildId,
      healed: false,
      oldStatus: '',
      newStatus: '',
      actions: [],
      errors: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Get current build status
      const buildResult = this.buildResults.get(buildId);

      if (!buildResult) {
        result.errors.push('Build not found');
        return result;
      }

      result.oldStatus = buildResult.success ? 'success' : 'failed';

      if (buildResult.success) {
        result.healed = true; // No healing needed
        result.newStatus = 'success';
        return result;
      }

      // Attempt to heal failed build
      const buildConfig = this.buildQueue.get(buildId);

      if (!buildConfig) {
        result.errors.push('Build configuration not found');
        return result;
      }

      // Retry build
      result.actions.push(`Retrying build (attempt ${buildResult.attempts + 1})`);

      const retryResult = await this.retryBuild(buildId, buildConfig, buildResult.attempts + 1);

      if (retryResult.success) {
        result.healed = true;
        result.newStatus = 'success';
        result.actions.push('Build succeeded on retry');

        selfHealingEngine.handleEvent({
          type: 'state_mismatch',
          severity: 'low',
          module: 'apk_pipeline_self_heal',
          message: `Build ${buildId} healed on retry`,
          timestamp: result.timestamp,
          context: result,
          healed: true,
          healingAction: 'build_retried',
        });
      } else {
        // Try fallback template
        result.actions.push('Trying fallback template');
        const fallbackResult = await this.tryFallbackTemplate(buildId, buildConfig);

        if (fallbackResult.success) {
          result.healed = true;
          result.newStatus = 'success';
          result.actions.push('Build succeeded with fallback template');

          selfHealingEngine.handleEvent({
            type: 'state_mismatch',
            severity: 'medium',
            module: 'apk_pipeline_self_heal',
            message: `Build ${buildId} healed with fallback template`,
            timestamp: result.timestamp,
            context: result,
            healed: true,
            healingAction: 'fallback_template_used',
          });
        } else {
          result.errors.push('Build failed even with fallback template');
          result.newStatus = 'failed';
        }
      }

    } catch (error) {
      result.errors.push(`Build heal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async retryBuild(buildId: string, config: BuildConfig, attempt: number): Promise<BuildResult> {
    if (attempt > this.maxRetryAttempts) {
      return {
        success: false,
        error: 'Max retry attempts reached',
        attempts: attempt,
        timestamp: new Date().toISOString(),
      };
    }

    // Simulate build retry with delay
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));

    // In a real implementation, this would call the actual build API
    // For now, simulate a successful retry
    const success = Math.random() > 0.3; // 70% success rate

    const result: BuildResult = {
      success,
      apkUrl: success ? `https://example.com/apk/${buildId}.apk` : undefined,
      error: success ? undefined : 'Build failed',
      attempts: attempt,
      timestamp: new Date().toISOString(),
    };

    this.buildResults.set(buildId, result);

    return result;
  }

  private async tryFallbackTemplate(buildId: string, config: BuildConfig): Promise<BuildResult> {
    // Use a default/fallback template
    const fallbackConfig: BuildConfig = {
      productId: config.productId,
      templateId: 'default_template',
      customConfig: {
        ...config.customConfig,
        useFallback: true,
      },
    };

    // Simulate build with fallback template
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));

    // In a real implementation, this would call the actual build API with fallback template
    // For now, simulate success
    const result: BuildResult = {
      success: true,
      apkUrl: `https://example.com/apk/${buildId}-fallback.apk`,
      attempts: 0,
      timestamp: new Date().toISOString(),
    };

    this.buildResults.set(buildId, result);

    return result;
  }

  async queueBuild(buildId: string, config: BuildConfig): Promise<void> {
    this.buildQueue.set(buildId, config);

    // Initialize build result as pending
    this.buildResults.set(buildId, {
      success: false,
      error: 'Build pending',
      attempts: 0,
      timestamp: new Date().toISOString(),
    });
  }

  async startBuild(buildId: string): Promise<BuildResult> {
    const config = this.buildQueue.get(buildId);

    if (!config) {
      return {
        success: false,
        error: 'Build configuration not found',
        attempts: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Simulate initial build
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate build failure (30% chance)
    const success = Math.random() > 0.3;

    const result: BuildResult = {
      success,
      apkUrl: success ? `https://example.com/apk/${buildId}.apk` : undefined,
      error: success ? undefined : 'Build failed',
      attempts: 1,
      timestamp: new Date().toISOString(),
    };

    this.buildResults.set(buildId, result);

    if (!success) {
      // Auto-heal on failure
      await this.healBuild(buildId);
    }

    return this.buildResults.get(buildId)!;
  }

  getBuildStatus(buildId: string): BuildResult | undefined {
    return this.buildResults.get(buildId);
  }

  getAllBuilds(): Map<string, BuildResult> {
    return new Map(this.buildResults);
  }

  clearBuild(buildId: string): void {
    this.buildQueue.delete(buildId);
    this.buildResults.delete(buildId);
  }

  clearAllBuilds(): void {
    this.buildQueue.clear();
    this.buildResults.clear();
  }

  async getBuildHealthSummary(): Promise<{
    totalBuilds: number;
    successfulBuilds: number;
    failedBuilds: number;
    healedBuilds: number;
    pendingBuilds: number;
  }> {
    let successfulBuilds = 0;
    let failedBuilds = 0;
    let healedBuilds = 0;
    let pendingBuilds = 0;

    for (const result of this.buildResults.values()) {
      if (result.success) {
        successfulBuilds++;
        if (result.attempts > 1) {
          healedBuilds++;
        }
      } else {
        failedBuilds++;
      }

      if (result.error === 'Build pending') {
        pendingBuilds++;
      }
    }

    return {
      totalBuilds: this.buildResults.size,
      successfulBuilds,
      failedBuilds,
      healedBuilds,
      pendingBuilds,
    };
  }

  setMaxRetryAttempts(attempts: number): void {
    this.maxRetryAttempts = attempts;
  }

  setRetryDelay(delay: number): void {
    this.retryDelay = delay;
  }
}

// Singleton instance
export const apkPipelineSelfHeal = new ApkPipelineSelfHeal();
