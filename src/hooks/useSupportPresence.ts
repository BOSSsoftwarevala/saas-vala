import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
  odMlYqnzpJty: string;
  user_name: string;
  is_staff: boolean;
  is_typing: boolean;
  last_seen: string;
}

interface PresenceUser {
  odMlYqnzpJty: string;
  user_name: string;
  is_staff: boolean;
  is_typing: boolean;
  last_seen: string;
}

export function useSupportPresence(ticketId: string | null) {
  const { user, isSuperAdmin } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track presence for a ticket
  useEffect(() => {
    if (!ticketId || !user) return;

    const channel = supabase.channel(`support-presence-${ticketId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>();
        const users: PresenceUser[] = [];
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.odMlYqnzpJty !== user.id) {
              users.push({
                odMlYqnzpJty: presence.odMlYqnzpJty,
                user_name: presence.user_name,
                is_staff: presence.is_staff,
                is_typing: presence.is_typing,
                last_seen: presence.last_seen,
              });
            }
          });
        });

        setOnlineUsers(users);
        setTypingUsers(users.filter((u) => u.is_typing));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            odMlYqnzpJty: user.id,
            user_name: isSuperAdmin ? 'Support Staff' : 'User',
            is_staff: isSuperAdmin,
            is_typing: false,
            last_seen: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [ticketId, user, isSuperAdmin]);

  // Set typing status
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!channelRef.current || !user) return;

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      await channelRef.current.track({
        odMlYqnzpJty: user.id,
        user_name: isSuperAdmin ? 'Support Staff' : 'User',
        is_staff: isSuperAdmin,
        is_typing: isTyping,
        last_seen: new Date().toISOString(),
      });

      // Auto-clear typing after 3 seconds
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 3000);
      }
    },
    [user, isSuperAdmin]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    onlineUsers,
    typingUsers,
    setTyping,
    isOtherUserOnline: onlineUsers.length > 0,
    isOtherUserTyping: typingUsers.length > 0,
  };
}

// Global presence hook for tracking online status across all tickets
export function useGlobalPresence() {
  const { user, isSuperAdmin } = useAuth();
  const [onlineStaff, setOnlineStaff] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('support-global-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ odMlYqnzpJty: string; is_staff: boolean }>();
        const staffIds: string[] = [];
        const userOnlineMap = new Map<string, boolean>();

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.is_staff) {
              staffIds.push(presence.odMlYqnzpJty);
            }
            userOnlineMap.set(presence.odMlYqnzpJty, true);
          });
        });

        setOnlineStaff(staffIds);
        setOnlineUsers(userOnlineMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            odMlYqnzpJty: user.id,
            is_staff: isSuperAdmin,
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [user, isSuperAdmin]);

  return {
    onlineStaff,
    onlineUsers,
    isStaffOnline: onlineStaff.length > 0,
    isUserOnline: (odMlYqnzpJty: string) => onlineUsers.has(odMlYqnzpJty),
  };
}
