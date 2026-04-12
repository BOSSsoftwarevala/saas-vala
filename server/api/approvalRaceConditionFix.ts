// STEP 117: APPROVAL RACE CONDITION FIX - If both users send request at same time, merge into single request
import { createClient } from '@supabase/supabase-js';

export interface ChatRequest {
  id: string;
  requester_id: string;
  target_id: string;
  role_type: 'user' | 'reseller' | 'admin';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  approved_at?: string;
  version: number;
  hash: string;
}

export interface RaceConditionResult {
  success: boolean;
  requestId?: string;
  merged?: boolean;
  existingRequestId?: string;
  action: 'created' | 'merged' | 'exists';
}

export class ApprovalRaceConditionFix {
  private static instance: ApprovalRaceConditionFix;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private requestLocks = new Map<string, NodeJS.Timeout>(); // user_pair -> lock timer

  static getInstance(): ApprovalRaceConditionFix {
    if (!ApprovalRaceConditionFix.instance) {
      ApprovalRaceConditionFix.instance = new ApprovalRaceConditionFix();
    }
    return ApprovalRaceConditionFix.instance;
  }

  // Generate user pair key for locking
  private getUserPairKey(requesterId: string, targetId: string): string {
    // Sort IDs to ensure consistent key regardless of direction
    const sorted = [requesterId, targetId].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  // Generate request hash for integrity
  private generateRequestHash(request: Omit<ChatRequest, 'id' | 'hash'>): string {
    const data = JSON.stringify({
      requester_id: request.requester_id,
      target_id: request.target_id,
      role_type: request.role_type,
      status: request.status,
      created_at: request.created_at,
      version: request.version
    });
    
    // Simple hash implementation (in production, use crypto)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Acquire lock for user pair
  private async acquireLock(userPairKey: string, timeout: number = 5000): Promise<boolean> {
    if (this.requestLocks.has(userPairKey)) {
      // Lock already exists, wait and retry
      return false;
    }

    // Set lock
    this.requestLocks.set(userPairKey, setTimeout(() => {
      this.requestLocks.delete(userPairKey);
    }, timeout));

    return true;
  }

  // Release lock for user pair
  private releaseLock(userPairKey: string): void {
    const lock = this.requestLocks.get(userPairKey);
    if (lock) {
      clearTimeout(lock);
      this.requestLocks.delete(userPairKey);
    }
  }

  // Handle request creation with race condition protection
  async handleRequestCreation(
    requesterId: string,
    targetId: string,
    roleType: 'user' | 'reseller' | 'admin'
  ): Promise<RaceConditionResult> {
    const userPairKey = this.getUserPairKey(requesterId, targetId);

    // Try to acquire lock
    const lockAcquired = await this.acquireLock(userPairKey);
    if (!lockAcquired) {
      // If lock not acquired, check existing requests and return appropriate result
      const existing = await this.findExistingRequest(requesterId, targetId);
      if (existing) {
        return {
          success: true,
          requestId: existing.id,
          action: 'exists',
          existingRequestId: existing.id
        };
      }
      
      // If no existing request, wait briefly and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.handleRequestCreation(requesterId, targetId, roleType);
    }

    try {
      // Check for existing requests within lock
      const existingRequest = await this.findExistingRequest(requesterId, targetId);
      
      if (existingRequest) {
        // Handle existing request based on status
        if (existingRequest.status === 'pending') {
          // Both users requested simultaneously, merge requests
          await this.mergeRequests(existingRequest, requesterId, targetId, roleType);
          
          return {
            success: true,
            requestId: existingRequest.id,
            merged: true,
            action: 'merged',
            existingRequestId: existingRequest.id
          };
        } else if (existingRequest.status === 'approved') {
          // Request already approved
          return {
            success: true,
            requestId: existingRequest.id,
            action: 'exists',
            existingRequestId: existingRequest.id
          };
        } else {
          // Request rejected or expired, create new one
          const newRequest = await this.createNewRequest(requesterId, targetId, roleType);
          
          return {
            success: true,
            requestId: newRequest.id,
            action: 'created'
          };
        }
      }

      // No existing request, create new one
      const newRequest = await this.createNewRequest(requesterId, targetId, roleType);
      
      return {
        success: true,
        requestId: newRequest.id,
        action: 'created'
      };

    } finally {
      // Always release lock
      this.releaseLock(userPairKey);
    }
  }

  // Find existing request between users
  private async findExistingRequest(
    requesterId: string,
    targetId: string
  ): Promise<ChatRequest | null> {
    const { data, error } = await this.supabase
      .from('chat_requests')
      .select('*')
      .or(`and(requester_id.eq.${requesterId},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${requesterId})`)
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ChatRequest;
  }

  // Create new request
  private async createNewRequest(
    requesterId: string,
    targetId: string,
    roleType: 'user' | 'reseller' | 'admin'
  ): Promise<ChatRequest> {
    const now = new Date().toISOString();
    const version = 1;
    
    const requestData: Omit<ChatRequest, 'id' | 'hash'> = {
      requester_id: requesterId,
      target_id: targetId,
      role_type: roleType,
      status: 'pending',
      created_at: now,
      version
    };

    const hash = this.generateRequestHash(requestData);

    const { data, error } = await this.supabase
      .from('chat_requests')
      .insert({
        ...requestData,
        hash
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create request: ${error?.message}`);
    }

    console.log(`Created new request: ${data.id} between ${requesterId} and ${targetId}`);
    return data as ChatRequest;
  }

  // Merge simultaneous requests
  private async mergeRequests(
    existingRequest: ChatRequest,
    requesterId: string,
    targetId: string,
    roleType: 'user' | 'reseller' | 'admin'
  ): Promise<void> {
    // Update existing request to reflect mutual interest
    const updatedData = {
      status: 'pending' as const,
      version: existingRequest.version + 1,
      // Add metadata about merge
      merged_at: new Date().toISOString(),
      merge_initiator: requesterId
    };

    const newHash = this.generateRequestHash({
      ...existingRequest,
      ...updatedData
    });

    const { error } = await this.supabase
      .from('chat_requests')
      .update({
        ...updatedData,
        hash: newHash
      })
      .eq('id', existingRequest.id)
      .eq('version', existingRequest.version); // Optimistic locking

    if (error) {
      throw new Error(`Failed to merge request: ${error.message}`);
    }

    console.log(`Merged request: ${existingRequest.id} for mutual interest between ${requesterId} and ${targetId}`);
  }

  // Handle approval with race condition protection
  async handleApproval(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected'
  ): Promise<{ success: boolean; message: string }> {
    // Acquire lock for this specific request
    const lockKey = `approval_${requestId}`;
    const lockAcquired = await this.acquireLock(lockKey, 3000);
    
    if (!lockAcquired) {
      return {
        success: false,
        message: 'Request is currently being processed'
      };
    }

    try {
      // Get current request state
      const { data: request, error: fetchError } = await this.supabase
        .from('chat_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        return {
          success: false,
          message: 'Request not found'
        };
      }

      // Validate request state
      if (request.status !== 'pending') {
        return {
          success: false,
          message: `Request already ${request.status}`
        };
      }

      // Check if approver is authorized
      if (request.target_id !== approverId && request.requester_id !== approverId) {
        // Check if approver is admin (additional authorization logic)
        const isAdmin = await this.checkIfAdmin(approverId);
        if (!isAdmin) {
          return {
            success: false,
            message: 'Not authorized to approve this request'
          };
        }
      }

      // Update request with approval
      const now = new Date().toISOString();
      const updatedData = {
        status: decision,
        approved_at: decision === 'approved' ? now : null,
        approver_id: approverId,
        version: request.version + 1
      };

      const newHash = this.generateRequestHash({
        ...request,
        ...updatedData
      });

      const { error: updateError } = await this.supabase
        .from('chat_requests')
        .update({
          ...updatedData,
          hash: newHash
        })
        .eq('id', requestId)
        .eq('version', request.version); // Optimistic locking

      if (updateError) {
        // Check if it's a version conflict (race condition)
        if (updateError.message.includes('version')) {
          return {
            success: false,
            message: 'Request was modified by another process'
          };
        }
        throw new Error(`Failed to update request: ${updateError.message}`);
      }

      // If approved, create chat
      if (decision === 'approved') {
        await this.createChatAfterApproval(request.requester_id, request.target_id);
      }

      console.log(`Request ${requestId} ${decision} by ${approverId}`);
      
      return {
        success: true,
        message: `Request ${decision} successfully`
      };

    } finally {
      this.releaseLock(lockKey);
    }
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

  // Create chat after approval
  private async createChatAfterApproval(requesterId: string, targetId: string): Promise<void> {
    // Check if chat already exists
    const { data: existingChat } = await this.supabase
      .from('chats')
      .select('id')
      .or(`and(user_id.eq.${requesterId},other_user_id.eq.${targetId}),and(user_id.eq.${targetId},other_user_id.eq.${requesterId})`)
      .limit(1)
      .single();

    if (existingChat) {
      console.log(`Chat already exists between ${requesterId} and ${targetId}`);
      return;
    }

    // Create new chat
    const { error: chatError } = await this.supabase
      .from('chats')
      .insert({
        user_id: requesterId,
        other_user_id: targetId,
        created_at: new Date().toISOString()
      });

    if (chatError) {
      throw new Error(`Failed to create chat: ${chatError.message}`);
    }

    console.log(`Created chat between ${requesterId} and ${targetId}`);
  }

  // Cleanup expired locks
  cleanupLocks(): void {
    // This is called automatically by timeout callbacks
    // Just log for debugging
    console.log(`Active locks: ${this.requestLocks.size}`);
  }

  // Get statistics
  getStats(): {
    activeLocks: number;
    lockTypes: string[];
  } {
    const lockTypes = Array.from(this.requestLocks.keys()).map(key => 
      key.includes('approval_') ? 'approval' : 'request'
    );

    return {
      activeLocks: this.requestLocks.size,
      lockTypes: [...new Set(lockTypes)]
    };
  }
}

export const approvalRaceConditionFix = ApprovalRaceConditionFix.getInstance();
