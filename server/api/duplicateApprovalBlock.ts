// STEP 118: DUPLICATE APPROVAL BLOCK - Prevent double approve / double reject
import { createClient } from '@supabase/supabase-js';

export interface ApprovalRecord {
  requestId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  timestamp: string;
  previousStatus?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DuplicateCheckResult {
  allowed: boolean;
  reason?: string;
  existingApproval?: ApprovalRecord;
}

export class DuplicateApprovalBlock {
  private static instance: DuplicateApprovalBlock;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private approvalCache = new Map<string, ApprovalRecord>(); // requestId -> approval record
  private userApprovalCache = new Map<string, Set<string>>(); // userId -> set of requestIds
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  static getInstance(): DuplicateApprovalBlock {
    if (!DuplicateApprovalBlock.instance) {
      DuplicateApprovalBlock.instance = new DuplicateApprovalBlock();
    }
    return DuplicateApprovalBlock.instance;
  }

  constructor() {
    this.startCleanupTimer();
  }

  // Check if approval is allowed (no duplicate)
  async checkApprovalAllowed(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    ipAddress?: string,
    userAgent?: string
  ): Promise<DuplicateCheckResult> {
    // Check cache first
    const cached = this.approvalCache.get(requestId);
    if (cached) {
      if (cached.approverId === approverId) {
        // Same user trying to approve again
        return {
          allowed: false,
          reason: `You have already ${cached.decision} this request`,
          existingApproval: cached
        };
      }
    }

    // Check user's approval history
    const userApprovals = this.userApprovalCache.get(approverId);
    if (userApprovals && userApprovals.has(requestId)) {
      return {
        allowed: false,
        reason: 'You have already processed this request'
      };
    }

    // Check database for existing approval
    const existingApproval = await this.findExistingApproval(requestId, approverId);
    if (existingApproval) {
      // Cache the existing approval
      this.cacheApproval(existingApproval);
      
      return {
        allowed: false,
        reason: `Request already ${existingApproval.decision} by you`,
        existingApproval
      };
    }

    // Check if request is still in approvable state
    const requestStatus = await this.getRequestStatus(requestId);
    if (requestStatus && requestStatus !== 'pending') {
      return {
        allowed: false,
        reason: `Request is already ${requestStatus}`
      };
    }

    // Approval is allowed
    return { allowed: true };
  }

  // Record approval in database and cache
  async recordApproval(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    previousStatus: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const approvalRecord: ApprovalRecord = {
      requestId,
      approverId,
      decision,
      timestamp: new Date().toISOString(),
      previousStatus,
      ipAddress,
      userAgent
    };

    // Insert into database
    const { error } = await this.supabase
      .from('approval_audit_log')
      .insert(approvalRecord);

    if (error) {
      throw new Error(`Failed to record approval: ${error.message}`);
    }

    // Cache the approval
    this.cacheApproval(approvalRecord);

    console.log(`Recorded approval: ${decision} for request ${requestId} by ${approverId}`);
  }

  // Find existing approval in database
  private async findExistingApproval(
    requestId: string,
    approverId: string
  ): Promise<ApprovalRecord | null> {
    const { data, error } = await this.supabase
      .from('approval_audit_log')
      .select('*')
      .eq('request_id', requestId)
      .eq('approver_id', approverId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      requestId: data.request_id,
      approverId: data.approver_id,
      decision: data.decision,
      timestamp: data.timestamp,
      previousStatus: data.previous_status,
      ipAddress: data.ip_address,
      userAgent: data.user_agent
    };
  }

  // Get current request status
  private async getRequestStatus(requestId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('chat_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.status;
  }

  // Cache approval record
  private cacheApproval(approval: ApprovalRecord): void {
    // Cache by request ID
    this.approvalCache.set(approval.requestId, approval);

    // Cache by user ID
    if (!this.userApprovalCache.has(approval.approverId)) {
      this.userApprovalCache.set(approval.approverId, new Set());
    }
    this.userApprovalCache.get(approval.approverId)!.add(approval.requestId);

    // Set expiry for this specific approval
    setTimeout(() => {
      this.uncacheApproval(approval.requestId, approval.approverId);
    }, this.cacheExpiry);
  }

  // Remove approval from cache
  private uncacheApproval(requestId: string, approverId: string): void {
    this.approvalCache.delete(requestId);
    
    const userApprovals = this.userApprovalCache.get(approverId);
    if (userApprovals) {
      userApprovals.delete(requestId);
      if (userApprovals.size === 0) {
        this.userApprovalCache.delete(approverId);
      }
    }
  }

  // Check for rapid approval attempts (potential spam)
  async checkRapidApprovalAttempts(
    approverId: string,
    timeWindow: number = 60000 // 1 minute
  ): Promise<{ allowed: boolean; count: number; reason?: string }> {
    const timeAgo = new Date(Date.now() - timeWindow).toISOString();

    const { data, error } = await this.supabase
      .from('approval_audit_log')
      .select('id')
      .eq('approver_id', approverId)
      .gte('timestamp', timeAgo);

    if (error) {
      console.error('Error checking rapid approval attempts:', error);
      return { allowed: true, count: 0 };
    }

    const count = data?.length || 0;
    const maxAllowed = 10; // Max 10 approvals per minute

    if (count >= maxAllowed) {
      return {
        allowed: false,
        count,
        reason: `Too many approval attempts. Please wait before trying again.`
      };
    }

    return { allowed: true, count };
  }

  // Check for approval pattern anomalies
  async checkApprovalAnomaly(
    approverId: string,
    decision: 'approved' | 'rejected'
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check if user is approving all requests without consideration
    const timeWindow = 10 * 60 * 1000; // 10 minutes
    const timeAgo = new Date(Date.now() - timeWindow).toISOString();

    const { data, error } = await this.supabase
      .from('approval_audit_log')
      .select('decision')
      .eq('approver_id', approverId)
      .eq('decision', decision)
      .gte('timestamp', timeAgo);

    if (error) {
      console.error('Error checking approval anomaly:', error);
      return { allowed: true };
    }

    const sameDecisionCount = data?.length || 0;
    
    // If user made 10+ same decisions in 10 minutes, flag as potential anomaly
    if (sameDecisionCount >= 10) {
      console.warn(`Approval anomaly detected for user ${approverId}: ${sameDecisionCount} ${decision} decisions in 10 minutes`);
      
      // Don't block, but log for monitoring
      // In production, you might want to add additional verification
    }

    return { allowed: true };
  }

  // Get approval statistics for a user
  async getUserApprovalStats(approverId: string): Promise<{
    totalApprovals: number;
    totalRejections: number;
    recentApprovals: number;
    recentRejections: number;
  }> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('approval_audit_log')
      .select('decision, timestamp')
      .eq('approver_id', approverId)
      .gte('timestamp', last24Hours);

    if (error || !data) {
      return {
        totalApprovals: 0,
        totalRejections: 0,
        recentApprovals: 0,
        recentRejections: 0
      };
    }

    const stats = data.reduce((acc, record) => {
      if (record.decision === 'approved') {
        acc.totalApprovals++;
      } else {
        acc.totalRejections++;
      }
      return acc;
    }, { totalApprovals: 0, totalRejections: 0 });

    return {
      ...stats,
      recentApprovals: stats.totalApprovals,
      recentRejections: stats.totalRejections
    };
  }

  // Check if request has any approvals (from any user)
  async hasAnyApprovals(requestId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('approval_audit_log')
      .select('id')
      .eq('request_id', requestId)
      .limit(1);

    if (error) {
      console.error('Error checking request approvals:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  }

  // Get all approvals for a request
  async getRequestApprovals(requestId: string): Promise<ApprovalRecord[]> {
    const { data, error } = await this.supabase
      .from('approval_audit_log')
      .select('*')
      .eq('request_id', requestId)
      .order('timestamp', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(record => ({
      requestId: record.request_id,
      approverId: record.approver_id,
      decision: record.decision,
      timestamp: record.timestamp,
      previousStatus: record.previous_status,
      ipAddress: record.ip_address,
      userAgent: record.user_agent
    }));
  }

  // Clear cache for specific request
  clearRequestCache(requestId: string): void {
    const approval = this.approvalCache.get(requestId);
    if (approval) {
      this.uncacheApproval(requestId, approval.approverId);
    }
  }

  // Clear all cache
  clearAllCache(): void {
    this.approvalCache.clear();
    this.userApprovalCache.clear();
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cacheExpiry);
  }

  // Cleanup expired cache entries
  private cleanup(): void {
    // Cache entries are automatically cleaned by individual expiry timers
    // This is just for logging and any additional cleanup needed
    console.log(`Duplicate approval block cache stats: ${this.approvalCache.size} request approvals, ${this.userApprovalCache.size} users`);
  }

  // Get cache statistics
  getCacheStats(): {
    cachedRequests: number;
    cachedUsers: number;
    totalCachedApprovals: number;
  } {
    const totalCachedApprovals = Array.from(this.userApprovalCache.values())
      .reduce((total, userSet) => total + userSet.size, 0);

    return {
      cachedRequests: this.approvalCache.size,
      cachedUsers: this.userApprovalCache.size,
      totalCachedApprovals
    };
  }

  // Destroy instance
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clearAllCache();
  }
}

export const duplicateApprovalBlock = DuplicateApprovalBlock.getInstance();
