import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// STEP 39: OFFLINE CACHE - Client-side storage interface
interface OfflineCache {
  chats: Chat[];
  messages: Record<string, Message[]>;
  lastSync: number;
}

const CACHE_KEY = 'internal_chat_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getOfflineCache = (): OfflineCache | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const cache = JSON.parse(cached);
    if (Date.now() - cache.lastSync > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return cache;
  } catch {
    return null;
  }
};

const setOfflineCache = (chats: Chat[], messages: Record<string, Message[]>) => {
  try {
    const cache: OfflineCache = {
      chats,
      messages,
      lastSync: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache errors
  }
};

export interface Chat {
  id: string;
  chat_id: string;
  internal_chats: {
    id: string;
    is_group: boolean;
    group_name?: string;
    updated_at: string;
    internal_chat_members: Array<{
      user_id: string;
      internal_users: {
        id: string;
        username: string;
        avatar_url?: string;
      };
    }>;
  };
  last_message?: {
    id: string;
    message_text: string;
    sender_id: string;
    created_at: string;
    delivery_status: string;
  };
  unread_count: number;
  is_pinned: boolean;
  is_muted: boolean;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  message_text: string;
  translated_text?: Record<string, string>;
  voice_url?: string;
  message_type: 'text' | 'voice' | 'image' | 'file';
  created_at: string;
  delivery_status: 'sent' | 'delivered' | 'read' | 'failed';
  sender: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  reply_to_id?: string;
}

export interface TypingUser {
  user_id: string;
  username: string;
  is_typing: boolean;
}

export const useInternalChat = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<any[]>([]);

  // Fetch user's chats with offline cache
  const fetchChats = useCallback(async () => {
    if (!user) return;
    
    try {
      // STEP 39: OFFLINE CACHE - Try to load from cache first
      const cachedData = getOfflineCache();
      if (cachedData) {
        setChats(cachedData.chats);
        // Still fetch fresh data in background
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/internal-chat/chats', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setChats(data.chats);
        
        // STEP 39: Update cache with fresh data
        const currentMessages = { ...messages };
        setOfflineCache(data.chats, currentMessages);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      // STEP 39: If network fails, try to use cached data
      const cachedData = getOfflineCache();
      if (cachedData) {
        setChats(cachedData.chats);
      }
    }
  }, [user, messages]);

  // STEP 55: CHAT LOAD PRIORITY - Load latest messages first, older on scroll
  const fetchMessages = useCallback(async (chatId: string, page: number = 1, direction: 'newer' | 'older' = 'older') => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // STEP 55: Priority-based loading with direction
      const limit = direction === 'newer' ? 20 : 50; // Smaller batches for newer messages
      const response = await fetch(
        `/api/internal-chat/messages?chatId=${chatId}&page=${page}&limit=${limit}&direction=${direction}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setMessages(data.messages);
        } else {
          setMessages(prev => [...data.messages, ...prev]);
        }
        setHasMoreMessages(data.has_more);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Send message
  const sendMessage = useCallback(async (chatId: string, messageText: string, messageType: 'text' | 'voice' = 'text', voiceUrl?: string) => {
    if (!user || !messageText.trim()) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch('/api/internal-chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_text: messageText.trim(),
          message_type: messageType,
          voice_url: voiceUrl
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.message;
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
    return null;
  }, [user]);

  // Set typing indicator
  const setTypingIndicator = useCallback(async (chatId: string, isTyping: boolean) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch('/api/internal-chat/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ chat_id: chatId, is_typing: isTyping })
      });
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  }, [user]);

  // Mark message as read
  const markAsRead = useCallback(async (chatId: string, messageId?: string) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch('/api/internal-chat/read-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId
        })
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [user]);

  // Create new chat
  const createChat = useCallback(async (participantIds: string[], isGroup: boolean = false, groupName?: string) => {
    if (!user || participantIds.length === 0) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch('/api/internal-chat/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          is_group: isGroup,
          participant_ids: participantIds,
          group_name: groupName
        })
      });

      if (response.ok) {
        const data = await response.json();
        await fetchChats(); // Refresh chat list
        return data.chat;
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
    return null;
  }, [user, fetchChats]);

  // Block user
  const blockUser = useCallback(async (userId: string, reason?: string) => {
    if (!user) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const response = await fetch('/api/internal-chat/block-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          blocked_id: userId,
          reason
        })
      });

      if (response.ok) {
        await fetchChats(); // Refresh chat list
        return true;
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    }
    return false;
  }, [user, fetchChats]);

  // Search chats
  const searchChats = useCallback(async (query: string) => {
    if (!user || !query.trim()) return [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(`/api/internal-chat/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.chats;
      }
    } catch (error) {

  // Upload voice message
  const uploadVoice = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    if (!user) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const formData = new FormData();
      formData.append('voice', audioBlob, 'voice.wav');

      const response = await fetch('/api/internal-chat/voice-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        return data.voice_url;
      }
    } catch (error) {
      console.error('Error uploading voice:', error);
    }
    return null;
  }, [user]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Clear existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];

    // Subscribe to new messages for selected chat
    if (selectedChat) {
      const messageSubscription = supabase
        .channel(`messages:${selectedChat.chat_id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'internal_messages',
            filter: `chat_id=eq.${selectedChat.chat_id}`
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            if (newMsg.sender_id !== user.id) {
              setMessages(prev => [...prev, newMsg]);
              await markAsRead(selectedChat.chat_id, newMsg.id);
            }
          }
        )
        .subscribe();

      subscriptionsRef.current.push(messageSubscription);

      // Subscribe to message updates (delivery status)
      const messageUpdateSubscription = supabase
        .channel(`message_updates:${selectedChat.chat_id}`)
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'internal_messages',
            filter: `chat_id=eq.${selectedChat.chat_id}`
          },
          (payload) => {
            const updatedMsg = payload.new as Message;
            setMessages(prev => 
              prev.map(msg => 
                msg.id === updatedMsg.id ? updatedMsg : msg
              )
            );
          }
        )
        .subscribe();

      subscriptionsRef.current.push(messageUpdateSubscription);

      // Subscribe to typing indicators
      const typingSubscription = supabase
        .channel(`typing:${selectedChat.chat_id}`)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'internal_typing_indicators',
            filter: `chat_id=eq.${selectedChat.chat_id}`
          },
          (payload) => {
            if (payload.new && (payload.new as any).user_id !== user.id) {
              setTypingUsers(prev => {
                const updated = prev.filter(u => u.user_id !== (payload.new as any).user_id);
                if ((payload.new as any).is_typing) {
                  updated.push({
                    user_id: (payload.new as any).user_id,
                    username: (payload.new as any).username || 'Unknown',
                    is_typing: true
                  });
                }
                return updated;
              });
            }
          }
        )
        .subscribe();

      subscriptionsRef.current.push(typingSubscription);
    }

    // Subscribe to chat list updates
    const chatListSubscription = supabase
      .channel('chat_list')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_chat_members',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    subscriptionsRef.current.push(chatListSubscription);

    // Subscribe to online status - simplified version
    const presenceSubscription = supabase
      .channel('online_users')
      .on('presence', { event: 'sync' }, () => {
        // For now, just set current user as online
        // Full presence tracking would require additional setup
        setOnlineUsers(new Set([user.id]));
      })
      .subscribe();

    subscriptionsRef.current.push(presenceSubscription);

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [user, selectedChat, fetchChats, markAsRead]);

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Fetch messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.chat_id);
      setTypingUsers([]); // Clear typing indicators
    } else {
      setMessages([]);
      setTypingUsers([]);
    }
  }, [selectedChat, fetchMessages]);

  return {
    chats,
    selectedChat,
    setSelectedChat,
    messages,
    typingUsers,
    isLoading,
    hasMoreMessages,
    onlineUsers,
    fetchChats,
    fetchMessages,
    sendMessage,
    setTypingIndicator,
    markAsRead,
    createChat,
    blockUser,
    searchChats,
    uploadVoice
  };
};
