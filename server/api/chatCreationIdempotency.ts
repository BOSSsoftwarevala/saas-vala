// STEP 121: CHAT CREATION IDEMPOTENCY - Ensure one chat_id per user pair only
import { createClient } from '@supabase/supabase-js';

export interface ChatCreationResult {
  success: boolean;
  chatId?: string;
  existing?: boolean;
  reason?: string;
}

export interface UserPair {
  user1Id: string;
  user2Id: string;
}

export class ChatCreationIdempotency {
  private static instance: ChatCreationIdempotency;
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private creationLocks = new Map<string, NodeJS.Timeout>(); // user_pair -> lock timer

  static getInstance(): ChatCreationIdempotency {
    if (!ChatCreationIdempotency.instance) {
      ChatCreationIdempotency.instance = new ChatCreationIdempotency();
    }
    return ChatCreationIdempotency.instance;
  }

  // Generate consistent user pair key
  private getUserPairKey(user1Id: string, user2Id: string): string {
    const sorted = [user1Id, user2Id].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  // Acquire lock for user pair
  private async acquireLock(userPairKey: string, timeout: number = 10000): Promise<boolean> {
    if (this.creationLocks.has(userPairKey)) {
      return false;
    }

    this.creationLocks.set(userPairKey, setTimeout(() => {
      this.creationLocks.delete(userPairKey);
    }, timeout));

    return true;
  }

  // Release lock for user pair
  private releaseLock(userPairKey: string): void {
    const lock = this.creationLocks.get(userPairKey);
    if (lock) {
      clearTimeout(lock);
      this.creationLocks.delete(userPairKey);
    }
  }

  // Create or get existing chat (idempotent)
  async createOrGetChat(user1Id: string, user2Id: string): Promise<ChatCreationResult> {
    const userPairKey = this.getUserPairKey(user1Id, user2Id);

    // Validate input
    if (user1Id === user2Id) {
      return {
        success: false,
        reason: 'Cannot create chat with same user'
      };
    }

    // Try to acquire lock
    const lockAcquired = await this.acquireLock(userPairKey);
    if (!lockAcquired) {
      // If lock not acquired, wait briefly and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.createOrGetChat(user1Id, user2Id);
    }

    try {
      // Check if chat already exists (both directions)
      const existingChat = await this.findExistingChat(user1Id, user2Id);
      
      if (existingChat) {
        return {
          success: true,
          chatId: existingChat.id,
          existing: true,
          reason: 'Chat already exists'
        };
      }

      // Create new chat
      const newChat = await this.createNewChat(user1Id, user2Id);
      
      return {
        success: true,
        chatId: newChat.id,
        existing: false,
        reason: 'New chat created'
      };

    } finally {
      this.releaseLock(userPairKey);
    }
  }

  // Find existing chat between users
  private async findExistingChat(user1Id: string, user2Id: string): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('id, created_at')
      .or(`and(user_id.eq.${user1Id},other_user_id.eq.${user2Id}),and(user_id.eq.${user2Id},other_user_id.eq.${user1Id})`)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return { id: data.id };
  }

  // Create new chat with integrity checks
  private async createNewChat(user1Id: string, user2Id: string): Promise<{ id: string }> {
    const now = new Date().toISOString();
    const userPairKey = this.getUserPairKey(user1Id, user2Id);

    // Double-check no race condition occurred
    const existingCheck = await this.findExistingChat(user1Id, user2Id);
    if (existingCheck) {
      return existingCheck;
    }

    // Create chat with unique constraint protection
    const { data, error } = await this.supabase
      .from('chats')
      .insert({
        user_id: user1Id,
        other_user_id: user2Id,
        created_at: now,
        updated_at: now,
        status: 'active',
        user_pair_key: userPairKey, // Additional field for uniqueness
        created_via: 'approval_system'
      })
      .select('id')
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505' || error.message.includes('duplicate key')) {
        // Chat was created by another process, fetch it
        const existingChat = await this.findExistingChat(user1Id, user2Id);
        if (existingChat) {
          return existingChat;
        }
      }
      throw new Error(`Failed to create chat: ${error.message}`);
    }

    // Create chat members entries
    await this.createChatMembers(data.id, user1Id, user2Id);

    console.log(`Created new chat ${data.id} between ${user1Id} and ${user2Id}`);
    return { id: data.id };
  }

  // Create chat members entries
  private async createChatMembers(chatId: string, user1Id: string, user2Id: string): Promise<void> {
    const now = new Date().toISOString();
    
    const { error } = await this.supabase
      .from('chat_members')
      .insert([
        {
          chat_id: chatId,
          user_id: user1Id,
          role: 'member',
          joined_at: now,
          added_by: 'system'
        },
        {
          chat_id: chatId,
          user_id: user2Id,
          role: 'member',
          joined_at: now,
          added_by: 'system'
        }
      ]);

    if (error) {
      // Don't fail the whole operation, but log the error
      console.error('Failed to create chat members:', error);
    }
  }

  // Get chat by user pair
  async getChatByUserPair(user1Id: string, user2Id: string): Promise<{ id: string } | null> {
    return this.findExistingChat(user1Id, user2Id);
  }

  // Verify chat ownership and integrity
  async verifyChatIntegrity(chatId: string, user1Id: string, user2Id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('user_id, other_user_id, user_pair_key, status')
      .eq('id', chatId)
      .single();

    if (error || !data) {
      return false;
    }

    // Check if users match (in any order)
    const usersMatch = 
      (data.user_id === user1Id && data.other_user_id === user2Id) ||
      (data.user_id === user2Id && data.other_user_id === user1Id);

    // Check user pair key
    const expectedPairKey = this.getUserPairKey(user1Id, user2Id);
    const pairKeyMatch = data.user_pair_key === expectedPairKey;

    // Check status
    const statusValid = data.status === 'active';

    return usersMatch && pairKeyMatch && statusValid;
  }

  // Get all chats for a user
  async getUserChats(userId: string): Promise<Array<{ id: string; other_user_id: string; created_at: string }>> {
    const { data, error } = await this.supabase
      .from('chats')
      .select('id, user_id, other_user_id, created_at')
      .or(`user_id.eq.${userId},other_user_id.eq.${userId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(chat => ({
      id: chat.id,
      other_user_id: chat.user_id === userId ? chat.other_user_id : chat.user_id,
      created_at: chat.created_at
    }));
  }

  // Clean up duplicate chats (maintenance function)
  async cleanupDuplicateChats(): Promise<number> {
    try {
      // Find user pairs with multiple chats
      const { data: duplicatePairs, error } = await this.supabase
        .from('chats')
        .select('user_pair_key')
        .eq('status', 'active')
        .group('user_pair_key')
        .having('count(*) > 1');

      if (error || !duplicatePairs) {
        return 0;
      }

      let cleanedCount = 0;

      for (const pair of duplicatePairs) {
        const cleaned = await this.cleanupDuplicateChatForPair(pair.user_pair_key);
        cleanedCount += cleaned;
      }

      console.log(`Cleaned up ${cleanedCount} duplicate chats`);
      return cleanedCount;

    } catch (error) {
      console.error('Error cleaning up duplicate chats:', error);
      return 0;
    }
  }

  // Clean up duplicates for specific user pair
  private async cleanupDuplicateChatForPair(userPairKey: string): Promise<number> {
    const { data: chats, error } = await this.supabase
      .from('chats')
      .select('id, created_at')
      .eq('user_pair_key', userPairKey)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error || !chats || chats.length <= 1) {
      return 0;
    }

    // Keep the oldest chat, mark others as inactive
    const chatsToDeactivate = chats.slice(1);
    let deactivatedCount = 0;

    for (const chat of chatsToDeactivate) {
      const { error: updateError } = await this.supabase
        .from('chats')
        .update({
          status: 'inactive',
          deactivated_at: new Date().toISOString(),
          deactivation_reason: 'duplicate_cleanup'
        })
        .eq('id', chat.id);

      if (!updateError) {
        deactivatedCount++;
        console.log(`Deactivated duplicate chat ${chat.id}`);
      }
    }

    return deactivatedCount;
  }

  // Get statistics
  async getChatStats(): Promise<{
    totalChats: number;
    activeChats: number;
    duplicatePairs: number;
    chatsCreatedToday: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [totalResult, duplicateResult, todayResult] = await Promise.all([
      this.supabase
        .from('chats')
        .select('id', { count: 'exact' })
        .eq('status', 'active'),
      
      this.supabase
        .from('chats')
        .select('user_pair_key')
        .eq('status', 'active')
        .group('user_pair_key')
        .having('count(*) > 1'),
      
      this.supabase
        .from('chats')
        .select('id', { count: 'exact' })
        .eq('status', 'active')
        .gte('created_at', today)
    ]);

    const totalChats = totalResult.count || 0;
    const duplicatePairs = duplicateResult.data?.length || 0;
    const chatsCreatedToday = todayResult.count || 0;

    return {
      totalChats,
      activeChats: totalChats,
      duplicatePairs,
      chatsCreatedToday
    };
  }

  // Release all locks (emergency function)
  releaseAllLocks(): void {
    for (const [key, timer] of this.creationLocks.entries()) {
      clearTimeout(timer);
    }
    this.creationLocks.clear();
  }

  // Get lock statistics
  getLockStats(): { activeLocks: number; lockKeys: string[] } {
    return {
      activeLocks: this.creationLocks.size,
      lockKeys: Array.from(this.creationLocks.keys())
    };
  }
}

export const chatCreationIdempotency = ChatCreationIdempotency.getInstance();
