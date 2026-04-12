// STEP 125: REQUEST SPAM SHIELD - Cooldown per user: X requests/min
import { createClient } from '@supabase/supabase-js';

export interface SpamShieldConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  cooldownSeconds: number;
  penaltyMultiplier: number;
}

export interface ShieldResult {
  allowed: boolean;
  reason?: string;
  remainingRequests?: number;
  cooldownEnds?: string;
  penaltyActive?: boolean;
}

export interface UserRequestStats {
  requestsThisMinute: number;
  requestsThisHour: number;
  requestsToday: number;
  lastRequestTime: string;
  cooldownEnds?: string;
  penaltyEnds?: string;
  violationCount: number;
}

export class RequestSpamShield {
  private static instance: RequestSpamShield;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private config: SpamShieldConfig;
  private userStats = new Map<string, UserRequestStats>(); // userId -> stats
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(config?: Partial<SpamShieldConfig>): RequestSpamShield {
    if (!RequestSpamShield.instance) {
      RequestSpamShield.instance = new RequestSpamShield(config);
    }
    return RequestSpamShield.instance;
  }

  constructor(config: Partial<SpamShieldConfig> = {}) {
    this.config = {
      maxRequestsPerMinute: 5, // 5 requests per minute
      maxRequestsPerHour: 30, // 30 requests per hour
      maxRequestsPerDay: 100, // 100 requests per day
      cooldownSeconds: 300, // 5 minutes cooldown
      penaltyMultiplier: 2, // Penalty doubles cooldown
      ...config
    };

    this.startCleanupTimer();
  }

  // Check if user can send request
  async canSendRequest(userId: string, targetId?: string): Promise<ShieldResult> {
    try {
      // Get current user stats
      const stats = await this.getUserStats(userId);
      
      // Check if user is currently in cooldown
      if (stats.cooldownEnds && new Date(stats.cooldownEnds) > new Date()) {
        return {
          allowed: false,
          reason: `User is in cooldown until ${stats.cooldownEnds}`,
          cooldownEnds: stats.cooldownEnds,
          penaltyActive: !!stats.penaltyEnds
        };
      }

      // Check if user is in penalty period
      if (stats.penaltyEnds && new Date(stats.penaltyEnds) > new Date()) {
        const penaltyMultiplier = this.config.penaltyMultiplier;
        const adjustedLimits = {
          maxRequestsPerMinute: Math.floor(this.config.maxRequestsPerMinute / penaltyMultiplier),
          maxRequestsPerHour: Math.floor(this.config.maxRequestsPerHour / penaltyMultiplier),
          maxRequestsPerDay: Math.floor(this.config.maxRequestsPerDay / penaltyMultiplier)
        };

        if (stats.requestsThisMinute >= adjustedLimits.maxRequestsPerMinute) {
          return {
            allowed: false,
            reason: `Penalty active: Too many requests this minute (${stats.requestsThisMinute}/${adjustedLimits.maxRequestsPerMinute})`,
            penaltyActive: true
          };
        }
      }

      // Check rate limits
      if (stats.requestsThisMinute >= this.config.maxRequestsPerMinute) {
        const violation = await this.recordViolation(userId, 'minute_limit');
        return {
          allowed: false,
          reason: `Too many requests this minute (${stats.requestsThisMinute}/${this.config.maxRequestsPerMinute})`,
          remainingRequests: 0
        };
      }

      if (stats.requestsThisHour >= this.config.maxRequestsPerHour) {
        const violation = await this.recordViolation(userId, 'hour_limit');
        return {
          allowed: false,
          reason: `Too many requests this hour (${stats.requestsThisHour}/${this.config.maxRequestsPerHour})`,
          remainingRequests: 0
        };
      }

      if (stats.requestsToday >= this.config.maxRequestsPerDay) {
        const violation = await this.recordViolation(userId, 'day_limit');
        return {
          allowed: false,
          reason: `Too many requests today (${stats.requestsToday}/${this.config.maxRequestsPerDay})`,
          remainingRequests: 0
        };
      }

      // Check for rapid successive requests to same target
      if (targetId) {
        const targetLimit = await this.checkTargetLimit(userId, targetId);
        if (!targetLimit.allowed) {
          return targetLimit;
        }
      }

      // Calculate remaining requests
      const remainingRequests = Math.min(
        this.config.maxRequestsPerMinute - stats.requestsThisMinute,
        this.config.maxRequestsPerHour - stats.requestsThisHour,
        this.config.maxRequestsPerDay - stats.requestsToday
      );

      return {
        allowed: true,
        remainingRequests
      };

    } catch (error) {
      console.error('Error checking request spam shield:', error);
      return {
        allowed: false,
        reason: 'Error checking spam limits'
      };
    }
  }

  // Record that user sent a request
  async recordRequest(userId: string, targetId?: string): Promise<void> {
    try {
      const now = new Date();
      const stats = await this.getUserStats(userId);

      // Update in-memory stats
      stats.requestsThisMinute++;
      stats.requestsThisHour++;
      stats.requestsToday++;
      stats.lastRequestTime = now.toISOString();

      // Update database
      await this.updateUserStatsInDB(userId, stats, targetId);

      // Log the request
      await this.logRequest(userId, targetId);

    } catch (error) {
      console.error('Error recording request:', error);
    }
  }

  // Get user statistics
  private async getUserStats(userId: string): Promise<UserRequestStats> {
    // Check cache first
    const cached = this.userStats.get(userId);
    if (cached && this.isStatsValid(cached)) {
      return cached;
    }

    // Fetch from database
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [minuteResult, hourResult, dayResult, lastRequest, cooldownInfo] = await Promise.all([
      this.countUserRequests(userId, oneMinuteAgo.toISOString()),
      this.countUserRequests(userId, oneHourAgo.toISOString()),
      this.countUserRequests(userId, todayStart.toISOString()),
      this.getLastRequestTime(userId),
      this.getCooldownInfo(userId)
    ]);

    const stats: UserRequestStats = {
      requestsThisMinute: minuteResult,
      requestsThisHour: hourResult,
      requestsToday: dayResult,
      lastRequestTime: lastRequest || todayStart.toISOString(),
      cooldownEnds: cooldownInfo?.cooldownEnds,
      penaltyEnds: cooldownInfo?.penaltyEnds,
      violationCount: cooldownInfo?.violationCount || 0
    };

    // Cache the stats
    this.userStats.set(userId, stats);

    return stats;
  }

  // Check if cached stats are still valid
  private isStatsValid(stats: UserRequestStats): boolean {
    const now = new Date();
    const lastUpdate = new Date(stats.lastRequestTime);
    
    // Cache is valid for 10 seconds
    return (now.getTime() - lastUpdate.getTime()) < 10000;
  }

  // Count user requests since given time
  private async countUserRequests(userId: string, since: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('request_audit_log')
      .select('id')
      .eq('user_id', userId)
      .gte('timestamp', since);

    if (error) {
      console.error('Error counting user requests:', error);
      return 0;
    }

    return data?.length || 0;
  }

  // Get last request time for user
  private async getLastRequestTime(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('request_audit_log')
      .select('timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data.timestamp;
  }

  // Get cooldown and penalty information
  private async getCooldownInfo(userId: string): Promise<{
    cooldownEnds?: string;
    penaltyEnds?: string;
    violationCount?: number;
  } | null> {
    const { data, error } = await this.supabase
      .from('user_spam_status')
      .select('cooldown_ends, penalty_ends, violation_count')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      cooldownEnds: data.cooldown_ends,
      penaltyEnds: data.penalty_ends,
      violationCount: data.violation_count
    };
  }

  // Check target-specific limits
  private async checkTargetLimit(userId: string, targetId: string): Promise<ShieldResult> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    
    const { data, error } = await this.supabase
      .from('request_audit_log')
      .select('id')
      .eq('user_id', userId)
      .eq('target_id', targetId)
      .gte('timestamp', oneMinuteAgo);

    if (error) {
      console.error('Error checking target limit:', error);
      return { allowed: true };
    }

    const requestsToTarget = data?.length || 0;
    const maxRequestsToTargetPerMinute = 2; // Max 2 requests per minute to same target

    if (requestsToTarget >= maxRequestsToTargetPerMinute) {
      return {
        allowed: false,
        reason: `Too many requests to same target (${requestsToTarget}/${maxRequestsToTargetPerMinute} per minute)`
      };
    }

    return { allowed: true };
  }

  // Record violation and apply penalty
  private async recordViolation(userId: string, violationType: string): Promise<void> {
    try {
      const now = new Date();
      const cooldownEnds = new Date(now.getTime() + this.config.cooldownSeconds * 1000);
      const penaltyEnds = new Date(now.getTime() + this.config.cooldownSeconds * this.config.penaltyMultiplier * 1000);

      // Update user spam status
      const { error } = await this.supabase
        .from('user_spam_status')
        .upsert({
          user_id: userId,
          cooldown_ends: cooldownEnds.toISOString(),
          penalty_ends: penaltyEnds.toISOString(),
          violation_count: this.supabase.rpc('increment', { x: 1 }),
          last_violation: now.toISOString(),
          last_violation_type: violationType
        });

      if (error) {
        console.error('Error recording violation:', error);
      }

      // Clear cache for this user
      this.userStats.delete(userId);

      console.log(`Violation recorded for user ${userId}: ${violationType}`);

    } catch (error) {
      console.error('Error recording violation:', error);
    }
  }

  // Update user stats in database
  private async updateUserStatsInDB(userId: string, stats: UserRequestStats, targetId?: string): Promise<void> {
    try {
      await this.supabase
        .from('request_audit_log')
        .insert({
          user_id: userId,
          target_id: targetId,
          timestamp: new Date().toISOString(),
          requests_this_minute: stats.requestsThisMinute,
          requests_this_hour: stats.requestsThisHour,
          requests_today: stats.requestsToday
        });

    } catch (error) {
      console.error('Error updating user stats in DB:', error);
    }
  }

  // Log request for audit
  private async logRequest(userId: string, targetId?: string): Promise<void> {
    try {
      await this.supabase
        .from('request_audit_log')
        .insert({
          user_id: userId,
          target_id: targetId,
          timestamp: new Date().toISOString(),
          action: 'request_sent'
        });

    } catch (error) {
      console.error('Error logging request:', error);
    }
  }

  // Manually put user in cooldown (admin function)
  async setCooldown(userId: string, durationSeconds: number, reason: string): Promise<boolean> {
    try {
      const now = new Date();
      const cooldownEnds = new Date(now.getTime() + durationSeconds * 1000);

      const { error } = await this.supabase
        .from('user_spam_status')
        .upsert({
          user_id: userId,
          cooldown_ends: cooldownEnds.toISOString(),
          manual_cooldown: true,
          manual_cooldown_reason: reason,
          manual_cooldown_set_at: now.toISOString()
        });

      if (error) {
        console.error('Error setting cooldown:', error);
        return false;
      }

      // Clear cache
      this.userStats.delete(userId);

      console.log(`Manual cooldown set for user ${userId}: ${durationSeconds}s - ${reason}`);
      return true;

    } catch (error) {
      console.error('Error setting cooldown:', error);
      return false;
    }
  }

  // Clear user's spam status (admin function)
  async clearSpamStatus(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_spam_status')
        .update({
          cooldown_ends: null,
          penalty_ends: null,
          violation_count: 0,
          manual_cooldown: false,
          cleared_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing spam status:', error);
        return false;
      }

      // Clear cache
      this.userStats.delete(userId);

      console.log(`Spam status cleared for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error clearing spam status:', error);
      return false;
    }
  }

  // Get spam shield statistics
  async getSpamStats(): Promise<{
    totalRequests: number;
    activeCooldowns: number;
    activePenalties: number;
    violationsToday: number;
    topViolators: Array<{ userId: string; violationCount: number }>;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [requestsResult, cooldownsResult, penaltiesResult, violatorsResult] = await Promise.all([
      this.supabase
        .from('request_audit_log')
        .select('id', { count: 'exact' })
        .gte('timestamp', today),
      
      this.supabase
        .from('user_spam_status')
        .select('user_id')
        .not('cooldown_ends', 'is', null)
        .gt('cooldown_ends', new Date().toISOString()),
      
      this.supabase
        .from('user_spam_status')
        .select('user_id')
        .not('penalty_ends', 'is', null)
        .gt('penalty_ends', new Date().toISOString()),
      
      this.supabase
        .from('user_spam_status')
        .select('user_id, violation_count')
        .gt('violation_count', 0)
        .order('violation_count', { ascending: false })
        .limit(10)
    ]);

    const totalRequests = requestsResult.count || 0;
    const activeCooldowns = cooldownsResult.data?.length || 0;
    const activePenalties = penaltiesResult.data?.length || 0;
    const topViolators = violatorsResult.data?.map(item => ({
      userId: item.user_id,
      violationCount: item.violation_count
    })) || [];

    return {
      totalRequests,
      activeCooldowns,
      activePenalties,
      violationsToday: activeCooldowns + activePenalties,
      topViolators
    };
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [userId, stats] of this.userStats.entries()) {
      // Remove stats older than 1 hour
      const lastUpdate = new Date(stats.lastRequestTime).getTime();
      if (now - lastUpdate > 60 * 60 * 1000) {
        keysToDelete.push(userId);
      }
    }

    for (const userId of keysToDelete) {
      this.userStats.delete(userId);
    }

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired spam shield entries`);
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<SpamShieldConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): SpamShieldConfig {
    return { ...this.config };
  }

  // Destroy instance
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.userStats.clear();
  }
}

export const requestSpamShield = RequestSpamShield.getInstance();
