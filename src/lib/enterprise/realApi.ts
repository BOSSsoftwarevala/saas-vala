import { RealPermissionManager } from './realPermissions';
import { RealJobQueue } from './realJobQueue';
import { RealAnalyticsManager } from './realAnalytics';
import { EnterpriseDatabase } from '../supabase';

// Real API endpoints with enterprise features
export class EnterpriseAPI {
  private static instance: EnterpriseAPI;

  static getInstance(): EnterpriseAPI {
    if (!EnterpriseAPI.instance) {
      EnterpriseAPI.instance = new EnterpriseAPI();
    }
    return EnterpriseAPI.instance;
  }

  // User Management APIs
  async updateUserPermissions(userId: string, permissions: any) {
    const permissionManager = RealPermissionManager.getInstance();
    return await permissionManager.updateUserPermissions(userId, permissions);
  }

  async assignRole(userId: string, roleName: string, assignedBy: string) {
    const permissionManager = RealPermissionManager.getInstance();
    return await permissionManager.assignRole(userId, roleName, assignedBy);
  }

  async getUsersWithPermission(permission: string) {
    const permissionManager = RealPermissionManager.getInstance();
    return await permissionManager.getUsersWithPermission(permission as any);
  }

  // Product Management APIs
  async createProduct(productData: any, createdBy: string) {
    // Validate permissions
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(createdBy, 'canCreateProduct');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create product');
    }

    // Create product
    const product = await EnterpriseDatabase.createProduct({
      ...productData,
      status: 'active',
      created_by: createdBy,
      current_version: '1.0.0'
    });

    // Track analytics
    const analytics = RealAnalyticsManager.getInstance();
    await analytics.trackEvent({
      type: 'product_created',
      category: 'product',
      action: 'create',
      userId: createdBy,
      productId: product.id,
      metadata: { productName: product.name }
    });

    // Create audit log
    await EnterpriseDatabase.createAuditLog({
      action: 'product_created',
      entity_type: 'product',
      entity_id: product.id,
      user_id: createdBy,
      timezone: 'UTC',
      metadata: { productData }
    });

    return product;
  }

  async softDeleteProduct(productId: string, deletedBy: string, reason?: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(deletedBy, 'canCreateProduct');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to delete product');
    }

    const product = await EnterpriseDatabase.softDeleteEntity('products', productId, deletedBy, reason);

    // Track analytics
    const analytics = RealAnalyticsManager.getInstance();
    await analytics.trackEvent({
      type: 'product_deleted',
      category: 'product',
      action: 'delete',
      userId: deletedBy,
      productId: productId,
      metadata: { reason }
    });

    return product;
  }

  // API Key Management APIs
  async generateApiKey(keyData: any, createdBy: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(createdBy, 'canGenerateKey');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to generate API key');
    }

    // Add job to queue
    const jobQueue = RealJobQueue.getInstance();
    const jobId = await jobQueue.addJob('key_generation', keyData, {
      priority: 'medium',
      createdBy
    });

    // Track analytics
    const analytics = RealAnalyticsManager.getInstance();
    await analytics.trackEvent({
      type: 'key_generation_requested',
      category: 'api',
      action: 'create',
      userId: createdBy,
      productId: keyData.productId,
      metadata: { jobId }
    });

    return { jobId, status: 'pending' };
  }

  async getJobStatus(jobId: string) {
    const jobQueue = RealJobQueue.getInstance();
    return await jobQueue.getJob(jobId);
  }

  async retryJob(jobId: string) {
    const jobQueue = RealJobQueue.getInstance();
    return await jobQueue.retryJob(jobId);
  }

  // Analytics APIs
  async getDashboardStats(userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canViewAnalytics');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to view analytics');
    }

    const analytics = RealAnalyticsManager.getInstance();
    const [
      dailyStats,
      topProducts,
      realtimeMetrics
    ] = await Promise.all([
      analytics.getDailyStats(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      ),
      analytics.getTopProducts('views', 5),
      analytics.getRealtimeMetrics()
    ]);

    return {
      dailyStats,
      topProducts,
      realtimeMetrics
    };
  }

  async getProductStats(productId: string, userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canViewAnalytics');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to view analytics');
    }

    const analytics = RealAnalyticsManager.getInstance();
    return await analytics.getProductStats(productId);
  }

  async getUserActivity(userId: string, requestedBy: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(requestedBy, 'canViewLogs');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to view user activity');
    }

    const analytics = RealAnalyticsManager.getInstance();
    return await analytics.getUserActivity(userId);
  }

  // Health Check API
  async getSystemHealth(userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canManageSystem');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to view system health');
    }

    const analytics = RealAnalyticsManager.getInstance();
    const jobQueue = RealJobQueue.getInstance();
    
    const [realtimeMetrics, queueStats] = await Promise.all([
      analytics.getRealtimeMetrics(),
      Promise.resolve(jobQueue.getQueueStats())
    ]);

    // Check database connectivity
    let dbStatus = 'healthy';
    try {
      await supabase.from('users').select('id').limit(1);
    } catch (error) {
      dbStatus = 'unhealthy';
    }

    return {
      status: dbStatus === 'healthy' && realtimeMetrics.errorRate < 5 ? 'healthy' : 'degraded',
      database: dbStatus,
      queue: queueStats,
      metrics: realtimeMetrics,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  // Feature Flag API
  async getFeatureFlags(userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canManageSystem');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to manage feature flags');
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateFeatureFlag(flagId: string, updates: any, userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canManageSystem');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to manage feature flags');
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', flagId)
      .select()
      .single();

    if (error) throw error;

    // Create audit log
    await EnterpriseDatabase.createAuditLog({
      action: 'feature_flag_updated',
      entity_type: 'feature_flag',
      entity_id: flagId,
      user_id: userId,
      timezone: 'UTC',
      metadata: { updates }
    });

    return data;
  }

  // Maintenance API
  async getMaintenanceSchedules(userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canManageSystem');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to view maintenance schedules');
    }

    return await EnterpriseDatabase.getActiveMaintenanceSchedules();
  }

  async scheduleMaintenance(scheduleData: any, userId: string) {
    const permissionManager = RealPermissionManager.getInstance();
    const hasPermission = await permissionManager.hasPermission(userId, 'canManageSystem');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to schedule maintenance');
    }

    const { data, error } = await supabase
      .from('maintenance_schedules')
      .insert({
        ...scheduleData,
        created_by: userId,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    // Create audit log
    await EnterpriseDatabase.createAuditLog({
      action: 'maintenance_scheduled',
      entity_type: 'maintenance_schedule',
      entity_id: data.id,
      user_id: userId,
      timezone: 'UTC',
      metadata: { scheduleData }
    });

    return data;
  }
}

// React hooks for API calls
export function useEnterpriseAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = EnterpriseAPI.getInstance();

  const callAPI = useCallback(async <T>(apiCall: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'API call failed';
      setError(errorMessage);
      console.error('API call failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return { api, loading, error, callAPI };
}

// Specific hooks for common operations
export function useDashboardStats(userId?: string) {
  const { api, loading, error, callAPI } = useEnterpriseAPI();
  const [stats, setStats] = useState<any>(null);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    const result = await callAPI(() => api.getDashboardStats(userId));
    setStats(result);
  }, [userId, api, callAPI]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, error, reload: loadStats };
}

export function useUserPermissions(userId?: string) {
  const { api, loading, error, callAPI } = useEnterpriseAPI();
  const [permissions, setPermissions] = useState<any>(null);

  const loadPermissions = useCallback(async () => {
    if (!userId) return;
    const permissionManager = RealPermissionManager.getInstance();
    const result = await callAPI(() => permissionManager.getUserPermissions(userId));
    setPermissions(result);
  }, [userId, api, callAPI]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return { permissions, loading, error, reload: loadPermissions };
}

// React imports
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export default EnterpriseAPI;
