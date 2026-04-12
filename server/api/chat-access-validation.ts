// STEP 49: CHAT ACCESS VALIDATION (HARD) - Every fetch/send verify user belongs to chat
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface ValidationResult {
  isValid: boolean;
  chatId?: string;
  isMember?: boolean;
  isBlocked?: boolean;
  isGroup?: boolean;
  error?: string;
}

export class ChatAccessValidator {
  private static instance: ChatAccessValidator;
  private memberCache = new Map<string, { isValid: boolean; timestamp: number }>();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  static getInstance(): ChatAccessValidator {
    if (!ChatAccessValidator.instance) {
      ChatAccessValidator.instance = new ChatAccessValidator();
    }
    return ChatAccessValidator.instance;
  }

  // STEP 69: CHAT MEMBER CACHE - Cache members list, reduce DB hits
  private getCachedValidation(userId: string, chatId: string): ValidationResult | null {
    const cacheKey = `${userId}-${chatId}`;
    const cached = this.memberCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return { isValid: cached.isValid };
    }
    
    return null;
  }

  private setCachedValidation(userId: string, chatId: string, isValid: boolean) {
    const cacheKey = `${userId}-${chatId}`;
    this.memberCache.set(cacheKey, { isValid, timestamp: Date.now() });
  }

  async validateUserChatAccess(userId: string, chatId: string): Promise<ValidationResult> {
    // Check cache first
    const cached = this.getCachedValidation(userId, chatId);
    if (cached !== null) {
      return cached;
    }

    try {
      // Verify user is member of chat and not blocked
      const { data: membership, error: membershipError } = await supabase
        .from('internal_chat_members')
        .select(`
          id,
          is_blocked,
          is_admin,
          internal_chats(
            id,
            is_group,
            created_at
          )
        `)
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .single();

      if (membershipError || !membership) {
        this.setCachedValidation(userId, chatId, false);
        return {
          isValid: false,
          error: 'User is not a member of this chat'
        };
      }

      if (membership.is_blocked) {
        this.setCachedValidation(userId, chatId, false);
        return {
          isValid: false,
          isBlocked: true,
          error: 'User is blocked from this chat'
        };
      }

      // Additional validation: Check if chat exists and is active
      if (!membership.internal_chats) {
        this.setCachedValidation(userId, chatId, false);
        return {
          isValid: false,
          error: 'Chat not found'
        };
      }

      this.setCachedValidation(userId, chatId, true);
      
      return {
        isValid: true,
        chatId,
        isMember: true,
        isBlocked: false,
        isGroup: membership.internal_chats.is_group
      };

    } catch (error) {
      console.error('Chat access validation error:', error);
      this.setCachedValidation(userId, chatId, false);
      return {
        isValid: false,
        error: 'Validation failed'
      };
    }
  }

  async validateMessageAccess(userId: string, messageId: string): Promise<ValidationResult> {
    try {
      // Get message and verify user belongs to the chat
      const { data: message, error: messageError } = await supabase
        .from('internal_messages')
        .select('chat_id, sender_id')
        .eq('id', messageId)
        .single();

      if (messageError || !message) {
        return {
          isValid: false,
          error: 'Message not found'
        };
      }

      // Validate chat access
      return await this.validateUserChatAccess(userId, message.chat_id);

    } catch (error) {
      console.error('Message access validation error:', error);
      return {
        isValid: false,
        error: 'Validation failed'
      };
    }
  }

  // STEP 68: HARD ACCESS GUARD - Block manual API calls from unauthorized user_id
  async validateApiRequest(req: any): Promise<{ userId: string | null; error?: string }> {
    try {
      // Extract and verify JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { userId: null, error: 'Invalid authorization header' };
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return { userId: null, error: 'Invalid token' };
      }

      // Additional checks
      if (user.banned || user.email_confirmed_at === null) {
        return { userId: null, error: 'Account not authorized' };
      }

      return { userId: user.id };

    } catch (error) {
      console.error('API request validation error:', error);
      return { userId: null, error: 'Request validation failed' };
    }
  }

  // Middleware for API routes
  async requireChatAccess(req: any, res: any, next: any) {
    try {
      const { userId, error } = await this.validateApiRequest(req);
      
      if (error || !userId) {
        return res.status(401).json({ error: error || 'Unauthorized' });
      }

      const { chatId } = req.query;
      if (!chatId || typeof chatId !== 'string') {
        return res.status(400).json({ error: 'Chat ID required' });
      }

      const validation = await this.validateUserChatAccess(userId, chatId);
      
      if (!validation.isValid) {
        return res.status(403).json({ 
          error: validation.error || 'Access denied' 
        });
      }

      // Add validated user and chat info to request
      req.validatedUser = userId;
      req.validatedChat = validation;
      
      next();

    } catch (error) {
      console.error('Chat access middleware error:', error);
      return res.status(500).json({ error: 'Access validation failed' });
    }
  }

  // Clear cache for a specific user (useful when they join/leave chats)
  invalidateUserCache(userId: string) {
    const keysToDelete = [];
    for (const [key] of this.memberCache.entries()) {
      if (key.startsWith(`${userId}-`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.memberCache.delete(key));
  }

  // Cleanup expired cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.memberCache.entries()) {
      if (now - value.timestamp > this.cacheDuration) {
        this.memberCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const chatAccessValidator = ChatAccessValidator.getInstance();

// Run cleanup periodically
setInterval(() => {
  chatAccessValidator.cleanupCache();
}, 10 * 60 * 1000); // Every 10 minutes
