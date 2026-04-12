import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ConnectionRecoveryOptions {
  chatId: string;
  onReconnected: () => void;
  onMissedMessages: (messages: any[]) => void;
  onConnectionLost: () => void;
}

export const useConnectionRecovery = ({
  chatId,
  onReconnected,
  onMissedMessages,
  onConnectionLost
}: ConnectionRecoveryOptions) => {
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000; // Start with 1 second
  const subscriptionRef = useRef<any>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);

  // STEP 47: HEARTBEAT SYSTEM - Ping every few seconds
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('internal_messages')
          .select('id')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.warn('Heartbeat failed:', error);
          handleConnectionLost();
        } else {
          // Connection is healthy
          reconnectAttemptsRef.current = 0;
        }
      } catch (error) {
        console.warn('Heartbeat error:', error);
        handleConnectionLost();
      }
    }, 30000); // Ping every 30 seconds
  }, [chatId]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const handleConnectionLost = useCallback(() => {
    console.log('Connection lost, attempting to recover...');
    onConnectionLost();
    stopHeartbeat();
    
    if (!isConnectingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
      isConnectingRef.current = true;
      attemptReconnect();
    }
  }, [onConnectionLost, stopHeartbeat]);

  const attemptReconnect = useCallback(async () => {
    reconnectAttemptsRef.current++;
    const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff

    console.log(`Reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }

      // STEP 61: SOCKET RE-SYNC - Fetch missed messages using last_message_id
      const missedMessages = await fetchMissedMessages();
      if (missedMessages.length > 0) {
        onMissedMessages(missedMessages);
        lastMessageIdRef.current = missedMessages[missedMessages.length - 1].id;
      }

      // Re-establish subscription
      const subscription = supabase
        .channel(`chat-${chatId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'internal_messages',
            filter: `chat_id=eq.${chatId}`
          },
          (payload) => {
            // Update last message ID
            lastMessageIdRef.current = payload.new.id;
            onReconnected();
          }
        )
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'internal_messages',
            filter: `chat_id=eq.${chatId}`
          },
          () => {
            onReconnected();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully reconnected to chat');
            reconnectAttemptsRef.current = 0;
            isConnectingRef.current = false;
            startHeartbeat();
            onReconnected();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Subscription failed:', status);
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              attemptReconnect();
            } else {
              console.error('Max reconnect attempts reached');
              isConnectingRef.current = false;
            }
          }
        });

      subscriptionRef.current = subscription;

    } catch (error) {
      console.error('Reconnect failed:', error);
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        attemptReconnect();
      } else {
        isConnectingRef.current = false;
      }
    }
  }, [chatId, onReconnected, onMissedMessages, startHeartbeat]);

  const fetchMissedMessages = useCallback(async () => {
    try {
      let query = supabase
        .from('internal_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (lastMessageIdRef.current) {
        // Only fetch messages newer than our last known message
        query = query.gt('created_at', 
          (await supabase
            .from('internal_messages')
            .select('created_at')
            .eq('id', lastMessageIdRef.current)
            .single()
          ).data?.created_at || new Date(0).toISOString()
        );
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Failed to fetch missed messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching missed messages:', error);
      return [];
    }
  }, [chatId]);

  const updateLastMessageId = useCallback((messageId: string) => {
    lastMessageIdRef.current = messageId;
  }, []);

  const manualReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    handleConnectionLost();
  }, [handleConnectionLost]);

  useEffect(() => {
    // Start heartbeat on mount
    startHeartbeat();

    return () => {
      // Cleanup on unmount
      stopHeartbeat();
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [startHeartbeat, stopHeartbeat]);

  return {
    manualReconnect,
    updateLastMessageId,
    isConnected: reconnectAttemptsRef.current === 0,
    reconnectAttempts: reconnectAttemptsRef.current
  };
};
