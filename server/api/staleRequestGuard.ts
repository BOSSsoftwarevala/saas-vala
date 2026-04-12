// STEP 120: STALE REQUEST GUARD - Block approval if request expired
import { createClient } from '@supabase/supabase-js';

export interface RequestExpiryConfig {
  defaultExpiryHours: number;
  maxExpiryHours: number;
  adminExpiryHours: number;
  resellerExpiryHours: number;
  userExpiryHours: number;
}

export interface ExpiryCheckResult {
  isValid: boolean;
  expired: boolean;
  timeRemaining: number; // minutes
  expiryTime: string;
  reason?: string;
  canExtend?: boolean;
}

export class StaleRequestGuard {
  private static instance: StaleRequestGuard;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private config: RequestExpiryConfig;

  static getInstance(config?: Partial<RequestExpiryConfig>): StaleRequestGuard {
    if (!StaleRequestGuard.instance) {
      StaleRequestGuard.instance = new StaleRequestGuard(config);
    }
    return StaleRequestGuard.instance;
  }

  constructor(config: Partial<RequestExpiryConfig> = {}) {
    this.config = {
      defaultExpiryHours: 24, // 24 hours default
      maxExpiryHours: 168, // 1 week maximum
      adminExpiryHours: 72, // 3 days for admin
      resellerExpiryHours: 48, // 2 days for reseller
      userExpiryHours: 24, // 1 day for user
      ...config
    };
  }

  // Check if request is still valid (not expired)
  async checkRequestValidity(requestId: string): Promise<ExpiryCheckResult> {
    try {
      // Get request details
      const { data: request, error } = await this.supabase
        .from('chat_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !request) {
        return {
          isValid: false,
          expired: false,
          timeRemaining: 0,
          expiryTime: '',
          reason: 'Request not found'
        };
      }

      // Check if already processed
      if (request.status !== 'pending') {
        return {
          isValid: false,
          expired: false,
          timeRemaining: 0,
          expiryTime: '',
          reason: `Request already ${request.status}`
        };
      }

      // Get requester role for expiry calculation
      const requesterRole = await this.getUserRole(request.requester_id);
      const expiryHours = this.getExpiryHoursForRole(requesterRole);

      // Calculate expiry time
      const createdAt = new Date(request.created_at);
      const expiryTime = new Date(createdAt.getTime() + expiryHours * 60 * 60 * 1000);
      const now = new Date();

      // Check if expired
      const isExpired = now > expiryTime;
      const timeRemaining = isExpired ? 0 : Math.floor((expiryTime.getTime() - now.getTime()) / (1000 * 60));

      if (isExpired) {
        // Auto-mark as expired
        await this.markRequestAsExpired(requestId);
        
        return {
          isValid: false,
          expired: true,
          timeRemaining: 0,
          expiryTime: expiryTime.toISOString(),
          reason: `Request expired ${Math.floor((now.getTime() - expiryTime.getTime()) / (1000 * 60 * 60))} hours ago`,
          canExtend: false
        };
      }

      return {
        isValid: true,
        expired: false,
        timeRemaining,
        expiryTime: expiryTime.toISOString(),
        canExtend: timeRemaining < 60 // Can extend if less than 1 hour remaining
      };

    } catch (error) {
      console.error('Error checking request validity:', error);
      return {
        isValid: false,
        expired: false,
        timeRemaining: 0,
        expiryTime: '',
        reason: 'Error checking request validity'
      };
    }
  }

  // Get expiry hours based on user role
  private getExpiryHoursForRole(role: string): number {
    switch (role) {
      case 'admin':
        return this.config.adminExpiryHours;
      case 'reseller':
        return this.config.resellerExpiryHours;
      case 'user':
        return this.config.userExpiryHours;
      default:
        return this.config.defaultExpiryHours;
    }
  }

  // Get user role
  private async getUserRole(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return 'user';
    }

    return data.role || 'user';
  }

  // Mark request as expired
  private async markRequestAsExpired(requestId: string): Promise<void> {
    const { error } = await this.supabase
      .from('chat_requests')
      .update({
        status: 'expired',
        expired_at: new Date().toISOString(),
        expiry_reason: 'automatic_expiry'
      })
      .eq('id', requestId)
      .eq('status', 'pending'); // Only update if still pending

    if (error) {
      console.error('Failed to mark request as expired:', error);
    } else {
      console.log(`Request ${requestId} marked as expired`);
    }
  }

  // Extend request expiry (if allowed)
  async extendRequestExpiry(
    requestId: string,
    requesterId: string,
    additionalHours: number = 24
  ): Promise<{ success: boolean; reason?: string; newExpiryTime?: string }> {
    try {
      // Check current validity
      const validityCheck = await this.checkRequestValidity(requestId);
      
      if (!validityCheck.isValid && !validityCheck.expired) {
        return {
          success: false,
          reason: validityCheck.reason
        };
      }

      // Get request details
      const { data: request, error } = await this.supabase
        .from('chat_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error || !request) {
        return {
          success: false,
          reason: 'Request not found'
        };
      }

      // Verify requester
      if (request.requester_id !== requesterId) {
        return {
          success: false,
          reason: 'Not authorized to extend this request'
        };
      }

      // Check if extension is allowed
      if (!validityCheck.canExtend && !validityCheck.expired) {
        return {
          success: false,
          reason: 'Extension not allowed (too much time remaining)'
        };
      }

      // Get role and calculate new expiry
      const requesterRole = await this.getUserRole(requesterId);
      const maxExpiryHours = this.getExpiryHoursForRole(requesterRole);
      
      const createdAt = new Date(request.created_at);
      const currentExpiryTime = new Date(validityCheck.expiryTime);
      const newExpiryTime = new Date(currentExpiryTime.getTime() + additionalHours * 60 * 60 * 1000);
      
      // Check if new expiry exceeds maximum
      const maxAllowedExpiry = new Date(createdAt.getTime() + maxExpiryHours * 60 * 60 * 1000);
      if (newExpiryTime > maxAllowedExpiry) {
        return {
          success: false,
          reason: `Extension would exceed maximum expiry time of ${maxExpiryHours} hours`
        };
      }

      // Update request with new expiry
      const { error: updateError } = await this.supabase
        .from('chat_requests')
        .update({
          extended_at: new Date().toISOString(),
          extended_by: requesterId,
          extension_hours: additionalHours,
          // Note: actual expiry is calculated, not stored
        })
        .eq('id', requestId);

      if (updateError) {
        return {
          success: false,
          reason: 'Failed to extend request'
        };
      }

      console.log(`Request ${requestId} extended by ${additionalHours} hours`);
      
      return {
        success: true,
        newExpiryTime: newExpiryTime.toISOString()
      };

    } catch (error) {
      console.error('Error extending request expiry:', error);
      return {
        success: false,
        reason: 'Error extending request'
      };
    }
  }

  // Block approval if request is expired
  async validateApprovalAttempt(
    requestId: string,
    approverId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const validityCheck = await this.checkRequestValidity(requestId);
    
    if (!validityCheck.isValid) {
      return {
        allowed: false,
        reason: validityCheck.reason || 'Request is not valid for approval'
      };
    }

    // Additional check: ensure approver is authorized
    const request = await this.getRequestDetails(requestId);
    if (!request) {
      return {
        allowed: false,
        reason: 'Request not found'
      };
    }

    // Check if approver is the target user or has admin privileges
    const isTarget = request.target_id === approverId;
    const isAdmin = await this.checkIfAdmin(approverId);
    
    if (!isTarget && !isAdmin) {
      return {
        allowed: false,
        reason: 'Not authorized to approve this request'
      };
    }

    return { allowed: true };
  }

  // Get request details
  private async getRequestDetails(requestId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('chat_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    return error ? null : data;
  }

  // Check if user is admin
  private async checkIfAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.role === 'admin';
  }

  // Clean up expired requests (background job)
  async cleanupExpiredRequests(): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      // Find requests that should be expired
      const { data: requestsToExpire, error } = await this.supabase
        .from('chat_requests')
        .select('id, requester_id, created_at')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - this.config.maxExpiryHours * 60 * 60 * 1000).toISOString());

      if (error || !requestsToExpire) {
        return 0;
      }

      let expiredCount = 0;

      for (const request of requestsToExpire) {
        const validityCheck = await this.checkRequestValidity(request.id);
        if (validityCheck.expired) {
          expiredCount++;
        }
      }

      console.log(`Cleaned up ${expiredCount} expired requests`);
      return expiredCount;

    } catch (error) {
      console.error('Error cleaning up expired requests:', error);
      return 0;
    }
  }

  // Get expiry statistics
  async getExpiryStats(): Promise<{
    totalPending: number;
    expiringSoon: number; // Less than 1 hour
    expiredToday: number;
    extendedToday: number;
  }> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [pendingResult, expiredResult, extendedResult] = await Promise.all([
      this.supabase
        .from('chat_requests')
        .select('id, created_at')
        .eq('status', 'pending'),
      
      this.supabase
        .from('chat_requests')
        .select('id')
        .eq('status', 'expired')
        .gte('expired_at', todayStart),
      
      this.supabase
        .from('chat_requests')
        .select('id')
        .not('extended_at', 'is', null)
        .gte('extended_at', todayStart)
    ]);

    const totalPending = pendingResult.data?.length || 0;
    const expiredToday = expiredResult.data?.length || 0;
    const extendedToday = extendedResult.data?.length || 0;

    // Calculate expiring soon
    let expiringSoon = 0;
    if (pendingResult.data) {
      for (const request of pendingResult.data) {
        const createdAt = new Date(request.created_at);
        const requesterRole = await this.getUserRole(request.requester_id);
        const expiryHours = this.getExpiryHoursForRole(requesterRole);
        const expiryTime = new Date(createdAt.getTime() + expiryHours * 60 * 60 * 1000);
        
        if (expiryTime <= oneHourFromNow && expiryTime > now) {
          expiringSoon++;
        }
      }
    }

    return {
      totalPending,
      expiringSoon,
      expiredToday,
      extendedToday
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<RequestExpiryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): RequestExpiryConfig {
    return { ...this.config };
  }
}

export const staleRequestGuard = StaleRequestGuard.getInstance();
