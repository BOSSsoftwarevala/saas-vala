// Enterprise System - Main Entry Point
// This file exports all enterprise modules and provides initialization functions

export { PermissionManager, DEFAULT_PERMISSIONS, SUPER_ADMIN_PERMISSIONS, ADMIN_PERMISSIONS, DEFAULT_ROLES } from './permissions';
export type { Permission, Role, UserRole } from './permissions';

export { FeatureFlagManager, DEFAULT_FEATURE_FLAGS } from './featureFlags';
export type { FeatureFlag, FeatureFlagCondition } from './featureFlags';

export { VersionManager } from './versioning';
export type { ProductVersion, ApiVersion, Deployment } from './versioning';

export { JobQueue, defaultJobHandlers } from './jobQueue';
export type { Job, JobHandler } from './jobQueue';

export { RateLimiter, DEFAULT_RATE_LIMITS, initializeDefaultRateLimits } from './rateLimiting';
export type { RateLimitConfig, RateLimitResult } from './rateLimiting';

export { HealthMonitor } from './healthMonitoring';
export type { HealthCheck, SystemHealth, HealthAlert, HealthCheckConfig } from './healthMonitoring';

export { AnalyticsManager } from './analytics';
export type { AnalyticsEvent, DailyStats, ProductStats, SystemMetrics } from './analytics';

export { CacheManager, DashboardCache, SessionCache, ConfigCache } from './cache';
export type { CacheEntry, CacheConfig, CacheMetrics } from './cache';

export { EnvironmentManager, env, requireEnv, getEnv, getEnvNumber, getEnvBoolean, validateEnvironment } from './environment';
export type { Environment, EnvironmentConfig } from './environment';
export { isDev, isStaging, isProd } from './environment';

export { WebhookManager, WEBHOOK_EVENTS } from './webhooks';
export type { Webhook, WebhookEvent, WebhookDelivery, WebhookPayload } from './webhooks';
export type { WebhookEventType } from './webhooks';

export { ValidationManager, COMMON_SCHEMAS, initializeValidationSchemas } from './validation';
export type { ValidationRule, ValidationSchema, ValidationResult, ValidationError } from './validation';

export { SoftDeleteManager, withSoftDelete, filterActiveEntities, filterDeletedEntities, filterArchivedEntities } from './softDelete';
export type { SoftDeleteEntity, RecoveryOptions, DeleteAudit } from './softDelete';

export { TimezoneManager, tz, withTimezone, timezoneMiddleware, createDateResponse } from './timezone';
export type { TimezoneConfig, AuditLog } from './timezone';

export { MaintenanceManager, maintenanceMiddleware, requireAvailable } from './maintenance';
export type { MaintenanceMode, MaintenanceSchedule, MaintenanceAlert } from './maintenance';

// Initialization function to set up all enterprise systems
export async function initializeEnterpriseSystems(): Promise<void> {
  try {
    console.log('Initializing Enterprise Systems...');

    // 1. Initialize Environment System
    validateEnvironment();
    console.log('✓ Environment system validated');

    // 2. Initialize Validation Schemas
    initializeValidationSchemas();
    console.log('✓ Validation schemas initialized');

    // 3. Initialize Rate Limiting
    initializeDefaultRateLimits();
    console.log('✓ Rate limiting initialized');

    // 4. Initialize Job Queue with default handlers
    const jobQueue = JobQueue.getInstance();
    Object.entries(defaultJobHandlers).forEach(([type, handler]) => {
      jobQueue.registerHandler(type as any, handler);
    });
    console.log('✓ Job queue initialized');

    // 5. Initialize Health Monitoring
    const healthMonitor = HealthMonitor.getInstance();
    console.log('✓ Health monitoring started');

    // 6. Initialize Feature Flags
    const featureFlags = FeatureFlagManager.getInstance();
    console.log('✓ Feature flags initialized');

    // 7. Initialize Cache Manager
    const cacheManager = CacheManager.getInstance();
    console.log('✓ Cache manager initialized');

    // 8. Initialize Analytics
    const analytics = AnalyticsManager.getInstance();
    console.log('✓ Analytics system initialized');

    // 9. Initialize Webhook Manager
    const webhookManager = WebhookManager.getInstance();
    console.log('✓ Webhook manager initialized');

    // 10. Initialize Permission Manager
    const permissionManager = PermissionManager.getInstance();
    console.log('✓ Permission manager initialized');

    // 11. Initialize Version Manager
    const versionManager = VersionManager.getInstance();
    console.log('✓ Version manager initialized');

    // 12. Initialize Soft Delete Manager
    const softDeleteManager = SoftDeleteManager.getInstance();
    console.log('✓ Soft delete manager initialized');

    // 13. Initialize Timezone Manager
    const timezoneManager = TimezoneManager.getInstance();
    console.log('✓ Timezone manager initialized');

    // 14. Initialize Maintenance Manager
    const maintenanceManager = MaintenanceManager.getInstance();
    console.log('✓ Maintenance manager initialized');

    console.log('🚀 Enterprise Systems initialization complete!');
  } catch (error) {
    console.error('❌ Failed to initialize Enterprise Systems:', error);
    throw error;
  }
}

// Graceful shutdown function
export async function shutdownEnterpriseSystems(): Promise<void> {
  try {
    console.log('Shutting down Enterprise Systems...');

    // Stop health monitoring
    const healthMonitor = HealthMonitor.getInstance();
    healthMonitor.stopMonitoring();
    console.log('✓ Health monitoring stopped');

    // Stop job queue processing
    const jobQueue = JobQueue.getInstance();
    jobQueue.stopProcessing();
    console.log('✓ Job queue stopped');

    // Stop maintenance scheduler
    const maintenanceManager = MaintenanceManager.getInstance();
    maintenanceManager.destroy();
    console.log('✓ Maintenance scheduler stopped');

    // Clear caches
    const cacheManager = CacheManager.getInstance();
    cacheManager.destroy();
    console.log('✓ Cache cleared');

    console.log('✅ Enterprise Systems shutdown complete!');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    throw error;
  }
}

// Health check function for monitoring
export async function getEnterpriseSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  systems: Record<string, boolean>;
  uptime: number;
}> {
  const healthMonitor = HealthMonitor.getInstance();
  const systemHealth = await healthMonitor.getSystemHealth();
  
  const systems: Record<string, boolean> = {
    environment: true, // Always true if app is running
    validation: true, // Always true if initialized
    rateLimiting: true, // Always true if initialized
    jobQueue: true, // Could check queue health
    healthMonitoring: systemHealth.status !== 'unhealthy',
    featureFlags: true, // Always true if initialized
    cache: true, // Could check cache health
    analytics: true, // Always true if initialized
    webhooks: true, // Could check webhook delivery health
    permissions: true, // Always true if initialized
    versioning: true, // Always true if initialized
    softDelete: true, // Always true if initialized
    timezone: true, // Always true if initialized
    maintenance: !MaintenanceManager.getInstance().isMaintenanceActive(),
  };

  const healthyCount = Object.values(systems).filter(Boolean).length;
  const totalCount = Object.keys(systems).length;
  const healthRatio = healthyCount / totalCount;

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (healthRatio >= 0.9) status = 'healthy';
  else if (healthRatio >= 0.7) status = 'degraded';
  else status = 'unhealthy';

  return {
    status,
    systems,
    uptime: systemHealth.uptime,
  };
}

// Export a singleton instance manager for easy access
export class EnterpriseSystemManager {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (!this.initialized) {
      await initializeEnterpriseSystems();
      this.initialized = true;
    }
  }

  static async shutdown(): Promise<void> {
    if (this.initialized) {
      await shutdownEnterpriseSystems();
      this.initialized = false;
    }
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    systems: Record<string, boolean>;
    uptime: number;
  }> {
    return getEnterpriseSystemHealth();
  }
}

// Default export for convenience
export default EnterpriseSystemManager;
