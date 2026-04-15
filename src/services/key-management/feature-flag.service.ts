// Feature Flag System for Key Management
import { supabase } from '@/integrations/supabase/client';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  is_enabled: boolean;
  is_public: boolean;
  target_type: 'all' | 'user' | 'role' | 'subscription';
  target_ids: string[]; // user IDs, role IDs, or subscription IDs
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureFlags {
  user_id: string;
  flags: Record<string, boolean>;
  overrides: Record<string, boolean>;
}

export class FeatureFlagService {
  private cache: Map<string, FeatureFlag> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Check if feature is enabled for user
   */
  async isFeatureEnabled(
    featureKey: string,
    userId?: string,
    userRoleId?: string,
    userSubscriptionId?: string
  ): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlag(featureKey);

      if (!flag) {
        return false;
      }

      // If flag is disabled globally
      if (!flag.is_enabled) {
        return false;
      }

      // If flag is public and enabled
      if (flag.is_public) {
        return true;
      }

      // Check target-based access
      if (flag.target_type === 'all') {
        return true;
      }

      if (flag.target_type === 'user' && userId) {
        return flag.target_ids.includes(userId);
      }

      if (flag.target_type === 'role' && userRoleId) {
        return flag.target_ids.includes(userRoleId);
      }

      if (flag.target_type === 'subscription' && userSubscriptionId) {
        return flag.target_ids.includes(userSubscriptionId);
      }

      return false;
    } catch (error) {
      console.error('Error checking feature flag:', error);
      return false;
    }
  }

  /**
   * Get feature flag
   */
  async getFeatureFlag(featureKey: string): Promise<FeatureFlag | null> {
    try {
      // Check cache first
      if (this.cache.has(featureKey)) {
        const expiry = this.cacheExpiry.get(featureKey) || 0;
        if (Date.now() < expiry) {
          return this.cache.get(featureKey) || null;
        }
      }

      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('key', featureKey)
        .single();

      if (error) throw error;

      const flag = data as FeatureFlag;

      // Cache the flag
      this.cache.set(featureKey, flag);
      this.cacheExpiry.set(featureKey, Date.now() + this.cacheTTL);

      return flag;
    } catch (error) {
      console.error('Error getting feature flag:', error);
      return null;
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFeatureFlags(includeDisabled = false): Promise<FeatureFlag[]> {
    try {
      let query = supabase.from('feature_flags').select('*');

      if (!includeDisabled) {
        query = query.eq('is_enabled', true);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data as FeatureFlag[]) || [];
    } catch (error) {
      console.error('Error getting all feature flags:', error);
      return [];
    }
  }

  /**
   * Get user's feature flags
   */
  async getUserFeatureFlags(
    userId: string,
    userRoleId?: string,
    userSubscriptionId?: string
  ): Promise<UserFeatureFlags> {
    try {
      const flags = await this.getAllFeatureFlags();

      const userFlags: Record<string, boolean> = {};
      const overrides: Record<string, boolean> = {};

      for (const flag of flags) {
        const isEnabled = await this.isFeatureEnabled(
          flag.key,
          userId,
          userRoleId,
          userSubscriptionId
        );

        userFlags[flag.key] = isEnabled;

        // Check for user-specific override
        if (flag.target_type === 'user' && flag.target_ids.includes(userId)) {
          overrides[flag.key] = flag.is_enabled;
        }
      }

      return {
        user_id: userId,
        flags: userFlags,
        overrides,
      };
    } catch (error) {
      console.error('Error getting user feature flags:', error);
      return {
        user_id: userId,
        flags: {},
        overrides: {},
      };
    }
  }

  /**
   * Create feature flag
   */
  async createFeatureFlag(flag: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .insert({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          is_enabled: flag.is_enabled !== undefined ? flag.is_enabled : true,
          is_public: flag.is_public !== undefined ? flag.is_public : false,
          target_type: flag.target_type || 'all',
          target_ids: flag.target_ids || [],
          metadata: flag.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const newFlag = data as FeatureFlag;

      // Clear cache
      this.cache.delete(flag.key!);
      this.cacheExpiry.delete(flag.key!);

      return newFlag;
    } catch (error) {
      console.error('Error creating feature flag:', error);
      return null;
    }
  }

  /**
   * Update feature flag
   */
  async updateFeatureFlag(
    flagId: string,
    updates: Partial<FeatureFlag>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flagId);

      if (error) throw error;

      // Clear cache
      if (updates.key) {
        this.cache.delete(updates.key);
        this.cacheExpiry.delete(updates.key);
      }

      return true;
    } catch (error) {
      console.error('Error updating feature flag:', error);
      return false;
    }
  }

  /**
   * Toggle feature flag
   */
  async toggleFeatureFlag(flagKey: string): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlag(flagKey);

      if (!flag) {
        return false;
      }

      return await this.updateFeatureFlag(flag.id, {
        is_enabled: !flag.is_enabled,
      });
    } catch (error) {
      console.error('Error toggling feature flag:', error);
      return false;
    }
  }

  /**
   * Delete feature flag
   */
  async deleteFeatureFlag(flagId: string): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlagById(flagId);

      if (!flag) {
        return false;
      }

      const { error } = await supabase
        .from('feature_flags')
        .delete()
        .eq('id', flagId);

      if (error) throw error;

      // Clear cache
      this.cache.delete(flag.key);
      this.cacheExpiry.delete(flag.key);

      return true;
    } catch (error) {
      console.error('Error deleting feature flag:', error);
      return false;
    }
  }

  /**
   * Get feature flag by ID
   */
  private async getFeatureFlagById(flagId: string): Promise<FeatureFlag | null> {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('id', flagId)
        .single();

      if (error) throw error;
      return data as FeatureFlag;
    } catch (error) {
      console.error('Error getting feature flag by ID:', error);
      return null;
    }
  }

  /**
   * Add user to feature flag
   */
  async addUserToFeatureFlag(
    flagKey: string,
    userId: string
  ): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlag(flagKey);

      if (!flag) {
        return false;
      }

      const updatedTargetIds = [...new Set([...flag.target_ids, userId])];

      return await this.updateFeatureFlag(flag.id, {
        target_ids: updatedTargetIds,
        target_type: 'user',
      });
    } catch (error) {
      console.error('Error adding user to feature flag:', error);
      return false;
    }
  }

  /**
   * Remove user from feature flag
   */
  async removeUserFromFeatureFlag(
    flagKey: string,
    userId: string
  ): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlag(flagKey);

      if (!flag) {
        return false;
      }

      const updatedTargetIds = flag.target_ids.filter(id => id !== userId);

      return await this.updateFeatureFlag(flag.id, {
        target_ids: updatedTargetIds,
      });
    } catch (error) {
      console.error('Error removing user from feature flag:', error);
      return false;
    }
  }

  /**
   * Add role to feature flag
   */
  async addRoleToFeatureFlag(
    flagKey: string,
    roleId: string
  ): Promise<boolean> {
    try {
      const flag = await this.getFeatureFlag(flagKey);

      if (!flag) {
        return false;
      }

      const updatedTargetIds = [...new Set([...flag.target_ids, roleId])];

      return await this.updateFeatureFlag(flag.id, {
        target_ids: updatedTargetIds,
        target_type: 'role',
      });
    } catch (error) {
      console.error('Error adding role to feature flag:', error);
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Initialize default feature flags
   */
  async initializeDefaultFlags(): Promise<boolean> {
    try {
      const defaultFlags: Partial<FeatureFlag>[] = [
        {
          key: 'key_management_beta',
          name: 'Key Management Beta',
          description: 'Enable beta features for key management',
          is_enabled: false,
          is_public: false,
          target_type: 'all',
          target_ids: [],
          metadata: {},
        },
        {
          key: 'advanced_device_binding',
          name: 'Advanced Device Binding',
          description: 'Enable advanced device binding with fingerprinting',
          is_enabled: true,
          is_public: true,
          target_type: 'all',
          target_ids: [],
          metadata: {},
        },
        {
          key: 'subscription_based_limits',
          name: 'Subscription-based Limits',
          description: 'Enable subscription-based key and device limits',
          is_enabled: true,
          is_public: true,
          target_type: 'all',
          target_ids: [],
          metadata: {},
        },
        {
          key: 'real_time_validation',
          name: 'Real-time Validation',
          description: 'Enable real-time key validation with server ping',
          is_enabled: false,
          is_public: false,
          target_type: 'all',
          target_ids: [],
          metadata: {},
        },
        {
          key: 'offline_mode',
          name: 'Offline Mode',
          description: 'Enable offline mode with cached tokens',
          is_enabled: false,
          is_public: false,
          target_type: 'all',
          target_ids: [],
          metadata: {},
        },
      ];

      for (const flagData of defaultFlags) {
        const existing = await this.getFeatureFlag(flagData.key!);

        if (!existing) {
          await this.createFeatureFlag(flagData);
        }
      }

      return true;
    } catch (error) {
      console.error('Error initializing default flags:', error);
      return false;
    }
  }

  /**
   * Get feature flag statistics
   */
  async getFeatureFlagStats(): Promise<{
    total_flags: number;
    enabled_flags: number;
    disabled_flags: number;
    public_flags: number;
    private_flags: number;
    by_target_type: Record<string, number>;
  }> {
    try {
      const flags = await this.getAllFeatureFlags(true);

      const byTargetType: Record<string, number> = {};

      for (const flag of flags) {
        byTargetType[flag.target_type] = (byTargetType[flag.target_type] || 0) + 1;
      }

      return {
        total_flags: flags.length,
        enabled_flags: flags.filter(f => f.is_enabled).length,
        disabled_flags: flags.filter(f => !f.is_enabled).length,
        public_flags: flags.filter(f => f.is_public).length,
        private_flags: flags.filter(f => !f.is_public).length,
        by_target_type,
      };
    } catch (error) {
      console.error('Error getting feature flag stats:', error);
      return {
        total_flags: 0,
        enabled_flags: 0,
        disabled_flags: 0,
        public_flags: 0,
        private_flags: 0,
        by_target_type: {},
      };
    }
  }
}

export const featureFlagService = new FeatureFlagService();
