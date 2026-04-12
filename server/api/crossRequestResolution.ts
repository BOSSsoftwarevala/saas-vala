// STEP 119: CROSS REQUEST RESOLUTION - If A→B and B→A both pending, auto approve or merge
import { createClient } from '@supabase/supabase-js';

export interface CrossRequestPair {
  request1: {
    id: string;
    requester_id: string;
    target_id: string;
    role_type: string;
    status: string;
    created_at: string;
  };
  request2: {
    id: string;
    requester_id: string;
    target_id: string;
    role_type: string;
    status: string;
    created_at: string;
  };
}

export interface ResolutionResult {
  resolved: boolean;
  action: 'auto_approved' | 'merged' | 'no_action';
  requestId?: string;
  chatId?: string;
  message: string;
}

export class CrossRequestResolution {
  private static instance: CrossRequestResolution;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  static getInstance(): CrossRequestResolution {
    if (!CrossRequestResolution.instance) {
      CrossRequestResolution.instance = new CrossRequestResolution();
    }
    return CrossRequestResolution.instance;
  }

  // Check for and resolve cross requests
  async resolveCrossRequests(
    requesterId: string,
    targetId: string
  ): Promise<ResolutionResult> {
    try {
      // Find any pending requests between these users
      const crossRequests = await this.findCrossRequests(requesterId, targetId);
      
      if (!crossRequests) {
        return {
          resolved: false,
          action: 'no_action',
          message: 'No cross requests found'
        };
      }

      // Determine resolution strategy based on roles and timing
      const resolution = await this.determineResolution(crossRequests);
      
      if (resolution.resolved) {
        await this.executeResolution(crossRequests, resolution);
      }

      return resolution;

    } catch (error) {
      console.error('Error resolving cross requests:', error);
      return {
        resolved: false,
        action: 'no_action',
        message: 'Error occurred during resolution'
      };
    }
  }

  // Find cross requests between two users
  private async findCrossRequests(
    requesterId: string,
    targetId: string
  ): Promise<CrossRequestPair | null> {
    const { data, error } = await this.supabase
      .from('chat_requests')
      .select('*')
      .or(`and(requester_id.eq.${requesterId},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${requesterId})`)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error || !data || data.length < 2) {
      return null;
    }

    // We should have exactly 2 pending requests
    if (data.length !== 2) {
      console.warn(`Expected 2 cross requests, found ${data.length}`);
      return null;
    }

    const request1 = data[0];
    const request2 = data[1];

    // Verify they are actually cross requests (A→B and B→A)
    if (
      (request1.requester_id === requesterId && request1.target_id === targetId) &&
      (request2.requester_id === targetId && request2.target_id === requesterId)
    ) {
      return {
        request1: {
          id: request1.id,
          requester_id: request1.requester_id,
          target_id: request1.target_id,
          role_type: request1.role_type,
          status: request1.status,
          created_at: request1.created_at
        },
        request2: {
          id: request2.id,
          requester_id: request2.requester_id,
          target_id: request2.target_id,
          role_type: request2.role_type,
          status: request2.status,
          created_at: request2.created_at
        }
      };
    }

    return null;
  }

  // Determine resolution strategy
  private async determineResolution(
    crossRequests: CrossRequestPair
  ): Promise<ResolutionResult> {
    const { request1, request2 } = crossRequests;

    // Get user roles for both users
    const [user1Role, user2Role] = await Promise.all([
      this.getUserRole(request1.requester_id),
      this.getUserRole(request2.requester_id)
    ]);

    // Auto-approval rules
    if (this.shouldAutoApprove(user1Role, user2Role)) {
      return {
        resolved: true,
        action: 'auto_approved',
        requestId: request1.id, // Use first request as primary
        message: 'Auto-approved due to role-based rules'
      };
    }

    // If both users are same role level, merge requests
    if (user1Role === user2Role) {
      return {
        resolved: true,
        action: 'merged',
        requestId: request1.id, // Keep earlier request
        message: 'Merged mutual requests'
      };
    }

    // If higher role user requested first, auto-approve
    if (this.compareRoles(user1Role, user2Role) > 0) {
      return {
        resolved: true,
        action: 'auto_approved',
        requestId: request1.id,
        message: 'Auto-approved (higher role user requested first)'
      };
    }

    // Otherwise, merge
    return {
      resolved: true,
      action: 'merged',
      requestId: request1.id,
      message: 'Merged mutual requests'
    };
  }

  // Get user role
  private async getUserRole(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return 'user'; // Default role
    }

    return data.role || 'user';
  }

  // Check if should auto-approve based on roles
  private shouldAutoApprove(role1: string, role2: string): boolean {
    // Admin ↔ Admin: auto approve
    if (role1 === 'admin' && role2 === 'admin') {
      return true;
    }

    // Admin ↔ Reseller: auto approve
    if ((role1 === 'admin' && role2 === 'reseller') || 
        (role1 === 'reseller' && role2 === 'admin')) {
      return true;
    }

    // Reseller ↔ Reseller: auto approve
    if (role1 === 'reseller' && role2 === 'reseller') {
      return true;
    }

    return false;
  }

  // Compare roles (return >1 if role1 > role2, <1 if role1 < role2, 0 if equal)
  private compareRoles(role1: string, role2: string): number {
    const roleHierarchy = {
      'admin': 3,
      'reseller': 2,
      'user': 1
    };

    const level1 = roleHierarchy[role1 as keyof typeof roleHierarchy] || 0;
    const level2 = roleHierarchy[role2 as keyof typeof roleHierarchy] || 0;

    return level1 - level2;
  }

  // Execute the resolution
  private async executeResolution(
    crossRequests: CrossRequestPair,
    resolution: ResolutionResult
  ): Promise<void> {
    const { request1, request2 } = crossRequests;

    if (resolution.action === 'auto_approved') {
      await this.autoApproveRequest(request1, request2);
    } else if (resolution.action === 'merged') {
      await this.mergeRequests(request1, request2);
    }
  }

  // Auto-approve request and create chat
  private async autoApproveRequest(
    primaryRequest: CrossRequestPair['request1'],
    secondaryRequest: CrossRequestPair['request2']
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update primary request to approved
    const { error: updateError } = await this.supabase
      .from('chat_requests')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: 'system', // System auto-approval
        auto_approval_reason: 'cross_request_mutual_interest'
      })
      .eq('id', primaryRequest.id);

    if (updateError) {
      throw new Error(`Failed to auto-approve request: ${updateError.message}`);
    }

    // Mark secondary request as resolved (merged)
    await this.supabase
      .from('chat_requests')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: 'system',
        auto_approval_reason: 'cross_request_merged',
        merged_into: primaryRequest.id
      })
      .eq('id', secondaryRequest.id);

    // Create chat between users
    const chatId = await this.createChat(
      primaryRequest.requester_id,
      primaryRequest.target_id
    );

    // Log the auto-approval
    await this.logAutoApproval(primaryRequest, secondaryRequest, chatId);

    console.log(`Auto-approved cross request: ${primaryRequest.id}, created chat: ${chatId}`);
  }

  // Merge two requests
  private async mergeRequests(
    primaryRequest: CrossRequestPair['request1'],
    secondaryRequest: CrossRequestPair['request2']
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update primary request with merge information
    await this.supabase
      .from('chat_requests')
      .update({
        status: 'pending',
        merged_with: secondaryRequest.id,
        merged_at: now,
        merge_reason: 'cross_request_mutual_interest'
      })
      .eq('id', primaryRequest.id);

    // Mark secondary request as merged
    await this.supabase
      .from('chat_requests')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: 'system',
        auto_approval_reason: 'cross_request_merged',
        merged_into: primaryRequest.id
      })
      .eq('id', secondaryRequest.id);

    // Log the merge
    await this.logMerge(primaryRequest, secondaryRequest);

    console.log(`Merged cross requests: ${primaryRequest.id} + ${secondaryRequest.id}`);
  }

  // Create chat between users
  private async createChat(user1Id: string, user2Id: string): Promise<string> {
    // Check if chat already exists
    const { data: existingChat } = await this.supabase
      .from('chats')
      .select('id')
      .or(`and(user_id.eq.${user1Id},other_user_id.eq.${user2Id}),and(user_id.eq.${user2Id},other_user_id.eq.${user1Id})`)
      .limit(1)
      .single();

    if (existingChat) {
      return existingChat.id;
    }

    // Create new chat
    const { data, error } = await this.supabase
      .from('chats')
      .insert({
        user_id: user1Id,
        other_user_id: user2Id,
        created_at: new Date().toISOString(),
        created_via: 'cross_request_auto_approval'
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create chat: ${error?.message}`);
    }

    return data.id;
  }

  // Log auto-approval event
  private async logAutoApproval(
    primaryRequest: CrossRequestPair['request1'],
    secondaryRequest: CrossRequestPair['request2'],
    chatId: string
  ): Promise<void> {
    await this.supabase
      .from('approval_audit_log')
      .insert({
        request_id: primaryRequest.id,
        approver_id: 'system',
        decision: 'approved',
        timestamp: new Date().toISOString(),
        previous_status: 'pending',
        approval_type: 'auto_approval',
        cross_request_id: secondaryRequest.id,
        chat_id: chatId,
        reason: 'cross_request_mutual_interest'
      });
  }

  // Log merge event
  private async logMerge(
    primaryRequest: CrossRequestPair['request1'],
    secondaryRequest: CrossRequestPair['request2']
  ): Promise<void> {
    await this.supabase
      .from('approval_audit_log')
      .insert({
        request_id: primaryRequest.id,
        approver_id: 'system',
        decision: 'merged',
        timestamp: new Date().toISOString(),
        previous_status: 'pending',
        approval_type: 'merge',
        cross_request_id: secondaryRequest.id,
        reason: 'cross_request_mutual_interest'
      });
  }

  // Check for pending cross requests system-wide (for background processing)
  async checkAllCrossRequests(): Promise<number> {
    try {
      // Find all user pairs with multiple pending requests
      const { data, error } = await this.supabase
        .from('chat_requests')
        .select('requester_id, target_id')
        .eq('status', 'pending');

      if (error || !data) {
        return 0;
      }

      // Group by user pairs
      const userPairs = new Map<string, number>();
      
      for (const request of data) {
        const pairKey = this.getUserPairKey(request.requester_id, request.target_id);
        userPairs.set(pairKey, (userPairs.get(pairKey) || 0) + 1);
      }

      // Find pairs with exactly 2 requests
      const crossRequestPairs = Array.from(userPairs.entries())
        .filter(([_, count]) => count === 2)
        .map(([pairKey, _]) => pairKey);

      let resolvedCount = 0;

      // Resolve each cross request pair
      for (const pairKey of crossRequestPairs) {
        const [user1Id, user2Id] = pairKey.split('_');
        const result = await this.resolveCrossRequests(user1Id, user2Id);
        
        if (result.resolved) {
          resolvedCount++;
        }
      }

      console.log(`Resolved ${resolvedCount} cross request pairs`);
      return resolvedCount;

    } catch (error) {
      console.error('Error checking cross requests:', error);
      return 0;
    }
  }

  // Generate user pair key
  private getUserPairKey(user1Id: string, user2Id: string): string {
    const sorted = [user1Id, user2Id].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  // Get cross request statistics
  async getCrossRequestStats(): Promise<{
    totalPendingRequests: number;
    crossRequestPairs: number;
    autoApprovedToday: number;
    mergedToday: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [pendingResult, autoApprovedResult, mergedResult] = await Promise.all([
      this.supabase
        .from('chat_requests')
        .select('id')
        .eq('status', 'pending'),
      
      this.supabase
        .from('approval_audit_log')
        .select('id')
        .eq('approval_type', 'auto_approval')
        .gte('timestamp', today),
      
      this.supabase
        .from('approval_audit_log')
        .select('id')
        .eq('decision', 'merged')
        .gte('timestamp', today)
    ]);

    const totalPendingRequests = pendingResult.data?.length || 0;
    const autoApprovedToday = autoApprovedResult.data?.length || 0;
    const mergedToday = mergedResult.data?.length || 0;

    // Calculate cross request pairs (simplified)
    const crossRequestPairs = Math.floor(totalPendingRequests / 2);

    return {
      totalPendingRequests,
      crossRequestPairs,
      autoApprovedToday,
      mergedToday
    };
  }
}

export const crossRequestResolution = CrossRequestResolution.getInstance();
