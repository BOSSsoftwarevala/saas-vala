// Socket Chat Service - Real-time chat with WebSocket
import { supabase } from '@/integrations/supabase/client';

interface ChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface TypingIndicator {
  chat_id: string;
  user_id: string;
  is_typing: boolean;
}

class SocketChatService {
  private static instance: SocketChatService;
  private channels: Map<string, any> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): SocketChatService {
    if (!SocketChatService.instance) {
      SocketChatService.instance = new SocketChatService();
    }
    return SocketChatService.instance;
  }

  subscribeToChat(
    chatId: string,
    onMessage: (message: ChatMessage) => void,
    onTyping?: (indicator: TypingIndicator) => void
  ): () => void {
    const channelName = `chat:${chatId}`;

    // Subscribe to new messages
    const messageChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          onMessage(payload.new as ChatMessage);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[SocketChat] Subscribed to chat: ${chatId}`);
        }
      });

    this.channels.set(channelName, messageChannel);

    // Subscribe to typing indicators
    if (onTyping) {
      const typingChannel = supabase
        .channel(`typing:${chatId}`)
        .on('broadcast', { event: 'typing' }, (payload) => {
          onTyping(payload.payload as TypingIndicator);
        })
        .subscribe();

      this.channels.set(`typing:${chatId}`, typingChannel);
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribeFromChat(chatId);
    };
  }

  unsubscribeFromChat(chatId: string): void {
    const channelName = `chat:${chatId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }

    const typingChannelName = `typing:${chatId}`;
    const typingChannel = this.channels.get(typingChannelName);
    
    if (typingChannel) {
      supabase.removeChannel(typingChannel);
      this.channels.delete(typingChannelName);
    }
  }

  async sendMessage(chatId: string, message: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase.from('chat_messages').insert({
        chat_id: chatId,
        user_id: userId,
        message,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error('[SocketChat] Failed to send message:', error);
      throw error;
    }
  }

  async sendTypingIndicator(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    const channelName = `typing:${chatId}`;
    const channel = this.channels.get(channelName);

    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          chat_id: chatId,
          user_id: userId,
          is_typing: isTyping,
        },
      });
    }

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      const timeoutKey = `${chatId}:${userId}`;
      if (this.typingTimeouts.has(timeoutKey)) {
        clearTimeout(this.typingTimeouts.get(timeoutKey));
      }

      const timeout = setTimeout(() => {
        this.sendTypingIndicator(chatId, userId, false);
      }, 3000);

      this.typingTimeouts.set(timeoutKey, timeout);
    }
  }

  async loadChatHistory(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, users!inner(full_name, avatar_url)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data as ChatMessage[]).map(msg => ({
        ...msg,
        user_name: (msg as any).users?.full_name,
        user_avatar: (msg as any).users?.avatar_url,
      })).reverse();
    } catch (error) {
      console.error('[SocketChat] Failed to load chat history:', error);
      throw error;
    }
  }

  async markAsRead(chatId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('[SocketChat] Failed to mark as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('chat_id')
        .neq('user_id', userId)
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      return (data?.length || 0);
    } catch (error) {
      console.error('[SocketChat] Failed to get unread count:', error);
      return 0;
    }
  }

  cleanup(): void {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();

    this.typingTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.typingTimeouts.clear();
  }
}

export const socketChat = SocketChatService.getInstance();

// Convenience functions
export function subscribeToChat(
  chatId: string,
  onMessage: (message: ChatMessage) => void,
  onTyping?: (indicator: TypingIndicator) => void
) {
  return socketChat.subscribeToChat(chatId, onMessage, onTyping);
}

export async function sendMessage(chatId: string, message: string, userId: string) {
  return socketChat.sendMessage(chatId, message, userId);
}

export async function sendTypingIndicator(chatId: string, userId: string, isTyping: boolean) {
  return socketChat.sendTypingIndicator(chatId, userId, isTyping);
}
