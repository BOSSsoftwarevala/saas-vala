// STEP 122: HARD SERVER VALIDATION - Backend must re-check approval status before message insert
import { createClient } from '@supabase/supabase-js';

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  chatId?: string;
  approvalStatus?: string;
}

export interface MessageValidationContext {
  senderId: string;
  receiverId: string;
  chatId?: string;
  messageId?: string;
  clientMessageId?: string;
}

export class HardServerValidation {
  private static instance: HardServerValidation;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private validationCache = new Map<string, { result: ValidationResult; timestamp: number }>();
  private cacheExpiry = 30000; // 30 seconds

  static getInstance(): HardServerValidation {
    if (!HardServerValidation.instance) {
      HardServerValidation.instance = new HardServerValidation();
    }
    return HardServerValidation.instance;
  }

  // Validate message send permission (hard check)
  async validateMessageSend(context: MessageValidationContext): Promise<ValidationResult> {
    const cacheKey = this.getCacheKey(context);
    
    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Step 1: Validate basic user existence and status
      const userValidation = await this.validateUsers(context.senderId, context.receiverId);
      if (!userValidation.allowed) {
        return this.cacheAndReturn(cacheKey, userValidation);
      }

      // Step 2: Check if chat exists and is valid
      const chatValidation = await this.validateChat(context);
      if (!chatValidation.allowed) {
        return this.cacheAndReturn(cacheKey, chatValidation);
      }

      // Step 3: Hard check approval status
      const approvalValidation = await this.validateApprovalStatus(context.senderId, context.receiverId);
      if (!approvalValidation.allowed) {
        return this.cacheAndReturn(cacheKey, approvalValidation);
      }

      // Step 4: Verify chat membership
      const membershipValidation = await this.validateChatMembership(
        context.senderId,
        context.receiverId,
        chatValidation.chatId!
      );
      if (!membershipValidation.allowed) {
        return this.cacheAndReturn(cacheKey, membershipValidation);
      }

      // Step 5: Check for blocks or restrictions
      const restrictionValidation = await this.validateRestrictions(context.senderId, context.receiverId);
      if (!restrictionValidation.allowed) {
        return this.cacheAndReturn(cacheKey, restrictionValidation);
      }

      // All validations passed
      const result: ValidationResult = {
        allowed: true,
        chatId: chatValidation.chatId,
        approvalStatus: 'approved'
      };

      return this.cacheAndReturn(cacheKey, result);

    } catch (error) {
      console.error('Error in hard server validation:', error);
      const errorResult: ValidationResult = {
        allowed: false,
        reason: 'Validation error occurred'
      };
      return this.cacheAndReturn(cacheKey, errorResult);
    }
  }

  // Validate both users exist and are active
  private async validateUsers(senderId: string, receiverId: string): Promise<ValidationResult> {
    const { data: users, error } = await this.supabase
      .from('users')
      .select('id, status, role, disabled_at')
      .in('id', [senderId, receiverId]);

    if (error || !users || users.length !== 2) {
      return {
        allowed: false,
        reason: 'One or both users not found'
      };
    }

    for (const user of users) {
      if (user.status !== 'active') {
        return {
          allowed: false,
          reason: `User ${user.id} is not active (status: ${user.status})`
        };
      }

      if (user.disabled_at) {
        return {
          allowed: false,
          reason: `User ${user.id} is disabled`
        };
      }
    }

    return { allowed: true };
  }

  // Validate chat exists and is accessible
  private async validateChat(context: MessageValidationContext): Promise<ValidationResult> {
    let chatId = context.chatId;

    // If chatId not provided, find existing chat
    if (!chatId) {
      const existingChat = await this.findExistingChat(context.senderId, context.receiverId);
      if (!existingChat) {
        return {
          allowed: false,
          reason: 'No chat exists between users'
        };
      }
      chatId = existingChat.id;
    }

    // Verify chat details
    const { data: chat, error } = await this.supabase
      .from('chats')
      .select('id, user_id, other_user_id, status, created_at')
      .eq('id', chatId)
      .single();

    if (error || !chat) {
      return {
        allowed: false,
        reason: 'Chat not found'
      };
    }

    if (chat.status !== 'active') {
      return {
        allowed: false,
        reason: `Chat is not active (status: ${chat.status})`
      };
    }

    // Verify users match the chat
    const usersMatch = 
      (chat.user_id === context.senderId && chat.other_user_id === context.receiverId) ||
      (chat.user_id === context.receiverId && chat.other_user_id === context.senderId);

    if (!usersMatch) {
      return {
        allowed: false,
        reason: 'Users do not match chat participants'
      };
    }

    return {
      allowed: true,
      chatId: chat.id
    };
  }

  // Hard check approval status between users
  private async validateApprovalStatus(senderId: string, receiverId: string): Promise<ValidationResult> {
    // Check if there's an approved request between these users
    const { data: approvedRequest, error } = await this.supabase
      .from('chat_requests')
      .select('id, status, approved_at, requester_id, target_id')
      .or(`and(requester_id.eq.${senderId},target_id.eq.${receiverId}),and(requester_id.eq.${receiverId},target_id.eq.${senderId})`)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !approvedRequest) {
      return {
        allowed: false,
        reason: 'No approved chat request found between users'
      };
    }

    // Verify approval is not too old (optional security check)
    const approvalTime = new Date(approvedRequest.approved_at);
    const now = new Date();
    const daysSinceApproval = (now.getTime() - approvalTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceApproval > 365) { // 1 year
      return {
        allowed: false,
        reason: 'Chat approval has expired (too old)'
      };
    }

    return {
      allowed: true,
      approvalStatus: 'approved'
    };
  }

  // Validate both users are members of the chat
  private async validateChatMembership(
    senderId: string,
    receiverId: string,
    chatId: string
  ): Promise<ValidationResult> {
    const { data: members, error } = await this.supabase
      .from('chat_members')
      .select('user_id, role, status')
      .eq('chat_id', chatId)
      .in('user_id', [senderId, receiverId]);

    if (error || !members || members.length !== 2) {
      return {
        allowed: false,
        reason: 'One or both users are not chat members'
      };
    }

    for (const member of members) {
      if (member.status !== 'active') {
        return {
          allowed: false,
          reason: `User ${member.user_id} is not an active chat member`
        };
      }
    }

    return { allowed: true };
  }

  // Check for blocks or other restrictions
  private async validateRestrictions(senderId: string, receiverId: string): Promise<ValidationResult> {
    // Check if sender is blocked by receiver
    const { data: block, error } = await this.supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', receiverId)
      .eq('blocked_id', senderId)
      .eq('active', true)
      .limit(1)
      .single();

    if (block && !error) {
      return {
        allowed: false,
        reason: 'Sender is blocked by receiver'
      };
    }

    // Check if receiver is blocked by sender (shouldn't prevent sending, but log for monitoring)
    const { data: reverseBlock } = await this.supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', senderId)
      .eq('blocked_id', receiverId)
      .eq('active', true)
      .limit(1)
      .single();

    if (reverseBlock) {
      console.warn(`User ${senderId} is sending to blocked user ${receiverId}`);
      // Still allow sending, but this could be configurable
    }

    return { allowed: true };
  }

  // Find existing chat between users
  private async findExistingChat(user1Id: string, user2Id: string): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('id')
      .or(`and(user_id.eq.${user1Id},other_user_id.eq.${user2Id}),and(user_id.eq.${user2Id},other_user_id.eq.${user1Id})`)
      .eq('status', 'active')
      .limit(1)
      .single();

    return error ? null : data;
  }

  // Validate message fetch permission
  async validateMessageFetch(userId: string, chatId: string): Promise<ValidationResult> {
    // Check if user is member of the chat
    const { data: membership, error } = await this.supabase
      .from('chat_members')
      .select('role, status')
      .eq('chat_id', chatId)
      .eq('user_id', userId)
      .single();

    if (error || !membership) {
      return {
        allowed: false,
        reason: 'User is not a member of this chat'
      };
    }

    if (membership.status !== 'active') {
      return {
        allowed: false,
        reason: 'User membership is not active'
      };
    }

    // Additional check: verify chat is active
    const { data: chat, error: chatError } = await this.supabase
      .from('chats')
      .select('status')
      .eq('id', chatId)
      .single();

    if (chatError || !chat || chat.status !== 'active') {
      return {
        allowed: false,
        reason: 'Chat is not active'
      };
    }

    return { allowed: true };
  }

  // Generate cache key
  private getCacheKey(context: MessageValidationContext): string {
    return `${context.senderId}_${context.receiverId}_${context.chatId || 'nochat'}`;
  }

  // Get cached result
  private getCachedResult(cacheKey: string): ValidationResult | null {
    const cached = this.validationCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.validationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  // Cache and return result
  private cacheAndReturn(cacheKey: string, result: ValidationResult): ValidationResult {
    this.validationCache.set(cacheKey, {
      result: { ...result },
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (this.validationCache.size > 1000) {
      this.cleanupCache();
    }

    return result;
  }

  // Clean up expired cache entries
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.validationCache.delete(key);
    }

    console.log(`Cleaned up ${keysToDelete.length} expired validation cache entries`);
  }

  // Clear cache for specific users
  clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];

    for (const [key] of this.validationCache.keys()) {
      if (key.startsWith(userId + '_') || key.endsWith('_' + userId)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.validationCache.delete(key);
    }
  }

  // Get validation statistics
  getValidationStats(): {
    cacheSize: number;
    cacheHitRate: number;
    totalValidations: number;
  } {
    // This would need additional tracking in a real implementation
    return {
      cacheSize: this.validationCache.size,
      cacheHitRate: 0.85, // Example value
      totalValidations: 0
    };
  }

  // Clear all cache
  clearAllCache(): void {
    this.validationCache.clear();
  }

  // Emergency validation bypass (for system maintenance)
  async emergencyBypassValidation(context: MessageValidationContext, reason: string): Promise<ValidationResult> {
    console.warn(`EMERGENCY BYPASS: ${reason} for ${context.senderId} → ${context.receiverId}`);
    
    // Log the bypass for audit
    await this.supabase
      .from('validation_bypass_log')
      .insert({
        sender_id: context.senderId,
        receiver_id: context.receiverId,
        chat_id: context.chatId,
        reason,
        timestamp: new Date().toISOString(),
        bypassed_by: 'system_emergency'
      });

    return {
      allowed: true,
      reason: `Emergency bypass: ${reason}`
    };
  }
}

export const hardServerValidation = HardServerValidation.getInstance();
