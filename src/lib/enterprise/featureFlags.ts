export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
  conditions?: FeatureFlagCondition[];
}

export interface FeatureFlagCondition {
  type: 'user_id' | 'role' | 'environment' | 'custom';
  value: string | string[];
  operator: 'equals' | 'in' | 'not_in' | 'contains';
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'enable_ai',
    name: 'Enable AI Features',
    description: 'Toggle AI-powered features on/off',
    enabled: true,
  },
  {
    id: 'enable_marketplace',
    name: 'Enable Marketplace',
    description: 'Toggle marketplace functionality',
    enabled: true,
  },
  {
    id: 'enable_beta_features',
    name: 'Enable Beta Features',
    description: 'Toggle beta/experimental features',
    enabled: false,
    rolloutPercentage: 10,
  },
  {
    id: 'enable_advanced_analytics',
    name: 'Enable Advanced Analytics',
    description: 'Toggle advanced analytics features',
    enabled: true,
  },
  {
    id: 'enable_webhooks',
    name: 'Enable Webhooks',
    description: 'Toggle webhook integration',
    enabled: false,
  },
];

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: Map<string, FeatureFlag> = new Map();
  private userFlags: Map<string, Map<string, boolean>> = new Map();

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags(): void {
    DEFAULT_FEATURE_FLAGS.forEach(flag => {
      this.flags.set(flag.id, flag);
    });
  }

  async isEnabled(flagId: string, userId?: string): Promise<boolean> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    // Check user-specific cache
    if (userId && this.userFlags.has(userId)) {
      const userFlagCache = this.userFlags.get(userId)!;
      if (userFlagCache.has(flagId)) {
        return userFlagCache.get(flagId)!;
      }
    }

    let enabled = flag.enabled;

    // Apply rollout percentage
    if (flag.rolloutPercentage && userId) {
      const hash = this.hashUserId(userId);
      enabled = enabled && (hash % 100) < flag.rolloutPercentage;
    }

    // Apply conditions
    if (flag.conditions && userId) {
      enabled = enabled && await this.evaluateConditions(flag.conditions, userId);
    }

    // Cache result
    if (userId) {
      if (!this.userFlags.has(userId)) {
        this.userFlags.set(userId, new Map());
      }
      this.userFlags.get(userId)!.set(flagId, enabled);
    }

    return enabled;
  }

  async getEnabledFlags(userId?: string): Promise<FeatureFlag[]> {
    const enabledFlags: FeatureFlag[] = [];
    
    for (const [flagId, flag] of this.flags) {
      if (await this.isEnabled(flagId, userId)) {
        enabledFlags.push(flag);
      }
    }
    
    return enabledFlags;
  }

  async updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<void> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      throw new Error(`Feature flag ${flagId} not found`);
    }

    Object.assign(flag, updates);
    await this.saveFlagToDB(flagId, flag);
    
    // Clear user cache
    this.userFlags.clear();
  }

  async createFlag(flag: Omit<FeatureFlag, 'id'>): Promise<FeatureFlag> {
    const id = this.generateFlagId(flag.name);
    const newFlag: FeatureFlag = { ...flag, id };
    
    this.flags.set(id, newFlag);
    await this.saveFlagToDB(id, newFlag);
    
    return newFlag;
  }

  async deleteFlag(flagId: string): Promise<void> {
    if (!this.flags.has(flagId)) {
      throw new Error(`Feature flag ${flagId} not found`);
    }

    this.flags.delete(flagId);
    await this.deleteFlagFromDB(flagId);
    
    // Clear user cache
    this.userFlags.clear();
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async evaluateConditions(conditions: FeatureFlagCondition[], userId: string): Promise<boolean> {
    // Implement condition evaluation logic
    // For now, return true (no conditions)
    return true;
  }

  private generateFlagId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private async saveFlagToDB(flagId: string, flag: FeatureFlag): Promise<void> {
    // Implement database save logic
  }

  private async deleteFlagFromDB(flagId: string): Promise<void> {
    // Implement database delete logic
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.userFlags.delete(userId);
    } else {
      this.userFlags.clear();
    }
  }
}
