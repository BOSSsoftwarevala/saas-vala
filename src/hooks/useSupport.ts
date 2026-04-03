import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  channel_type: string;
  is_archived: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  content: string;
  message_type: string;
  is_edited: boolean;
  created_at: string;
  sender_name?: string;
}

export interface ChannelMember {
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string;
}

export function useSupport() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load channels
  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('is_archived', false)
      .order('created_at');
    if (data) setChannels(data);
    setLoading(false);
  }, []);

  // Join channel automatically
  const ensureMembership = useCallback(async (channelId: string) => {
    if (!user) return;
    await supabase
      .from('chat_channel_members')
      .upsert({ channel_id: channelId, user_id: user.id }, { onConflict: 'channel_id,user_id' });
  }, [user]);

  // Load messages for active channel
  const loadMessages = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) {
      // Fetch sender names
      const senderIds = [...new Set(data.map(m => m.sender_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', senderIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || 'Unknown']));
        }
      }
      setMessages(data.map(m => ({ ...m, sender_name: profileMap[m.sender_id || ''] || 'Unknown' })));
    }
  }, []);

  // Load members
  const loadMembers = useCallback(async (channelId: string) => {
    const { data } = await supabase
      .from('chat_channel_members')
      .select('user_id, role, joined_at')
      .eq('channel_id', channelId);
    if (data) {
      const userIds = data.map(m => m.user_id);
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || 'Unknown']));
        }
      }
      setMembers(data.map(m => ({ ...m, full_name: profileMap[m.user_id] || 'Unknown' })));
    }
  }, []);

  // Select channel
  const selectChannel = useCallback(async (channel: Channel) => {
    setActiveChannel(channel);
    await ensureMembership(channel.id);
    await Promise.all([loadMessages(channel.id), loadMembers(channel.id)]);
    // Update last_read
    if (user) {
      await supabase
        .from('chat_channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channel.id)
        .eq('user_id', user.id);
      setUnreadCounts(prev => ({ ...prev, [channel.id]: 0 }));
    }
  }, [ensureMembership, loadMessages, loadMembers, user]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !activeChannel || !content.trim()) return;
    await supabase.from('chat_messages').insert({
      channel_id: activeChannel.id,
      sender_id: user.id,
      content: content.trim(),
    });
    // Clear typing
    await supabase.from('chat_typing').delete().eq('channel_id', activeChannel.id).eq('user_id', user.id);
  }, [user, activeChannel]);

  // Set typing
  const setTyping = useCallback(async () => {
    if (!user || !activeChannel) return;
    await supabase.from('chat_typing').upsert(
      { channel_id: activeChannel.id, user_id: user.id, started_at: new Date().toISOString() },
      { onConflict: 'channel_id,user_id' }
    );
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      await supabase.from('chat_typing').delete().eq('channel_id', activeChannel.id).eq('user_id', user.id);
    }, 3000);
  }, [user, activeChannel]);

  // Create channel
  const createChannel = useCallback(async (name: string, description: string, type: string) => {
    if (!user) return;
    const { data } = await supabase.from('chat_channels').insert({
      name, description, channel_type: type, created_by: user.id
    }).select().single();
    if (data) {
      await supabase.from('chat_channel_members').insert({ channel_id: data.id, user_id: user.id, role: 'admin' });
      await loadChannels();
      return data;
    }
  }, [user, loadChannels]);

  // Realtime subscriptions
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!activeChannel) return;

    const msgChannel = supabase
      .channel(`chat-messages-${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, async (payload) => {
        const newMsg = payload.new as ChatMessage;
        // Get sender name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', newMsg.sender_id || '')
          .maybeSingle();
        setMessages(prev => [...prev, { ...newMsg, sender_name: profile?.full_name || 'Unknown' }]);
      })
      .subscribe();

    const typingChannel = supabase
      .channel(`chat-typing-${activeChannel.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_typing',
        filter: `channel_id=eq.${activeChannel.id}`
      }, async () => {
        const { data } = await supabase
          .from('chat_typing')
          .select('user_id')
          .eq('channel_id', activeChannel.id);
        if (data) {
          const otherTyping = data.filter(t => t.user_id !== user?.id).map(t => t.user_id);
          setTypingUsers(otherTyping);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [activeChannel, user]);

  // Track unread for non-active channels
  useEffect(() => {
    const channel = supabase
      .channel('chat-unread-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (msg.channel_id !== activeChannel?.id && msg.sender_id !== user?.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [msg.channel_id]: (prev[msg.channel_id] || 0) + 1
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannel, user]);

  return {
    channels, activeChannel, messages, members, typingUsers, unreadCounts, loading,
    selectChannel, sendMessage, setTyping, createChannel, loadChannels,
  };
}
