import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  file_name?: string;
  file_url?: string;
  file_size?: number;
  file_type?: string;
}

export interface ChannelMember {
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string;
}

const SUPPORT_UPLOAD_BUCKET = 'support-files';

function canCreateManagedChannel(role: string | null): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'support';
}

function safeParseJson(value: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'file';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

export function useSupport() {
  const { user, role } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const typingWriteThrottle = useRef<number>(0);

  const canAccessChannel = useCallback(async (channelId: string, action: 'read' | 'write' | 'moderate' | 'manage' | 'delete') => {
    if (!user || !channelId) return false;
    const { data, error } = await (supabase as any).rpc('chat_can_access_channel', {
      p_channel_id: channelId,
      p_action: action,
      p_user_id: user.id,
    });
    if (error) return false;
    return Boolean(data);
  }, [user]);

  const hydrateMessages = useCallback(async (rawMessages: ChatMessage[]) => {
    const senderIds = [...new Set(rawMessages.map((m) => m.sender_id).filter(Boolean) as string[])];
    let profileMap: Record<string, string> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', senderIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name || 'Unknown']));
      }
    }

    const resolved = await Promise.all(rawMessages.map(async (m) => {
      const next: ChatMessage = {
        ...m,
        sender_name: profileMap[m.sender_id || ''] || 'Unknown',
      };

      if (m.message_type === 'file') {
        const payload = safeParseJson(m.content);
        if (payload) {
          next.file_name = payload.file_name || 'Attachment';
          next.file_size = Number(payload.file_size) || 0;
          next.file_type = payload.content_type || 'application/octet-stream';

          if (payload.file_path) {
            const { data: signed } = await supabase.storage
              .from(SUPPORT_UPLOAD_BUCKET)
              .createSignedUrl(payload.file_path, 60 * 30);
            next.file_url = signed?.signedUrl;
          }
        }
      }

      return next;
    }));

    return resolved;
  }, []);

  // Load channels
  const loadChannels = useCallback(async () => {
    const { data } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('is_archived', false)
      .order('created_at');
    if (data) {
      setChannels(data);
    }
    setLoading(false);
  }, []);

  // Join channel automatically
  const ensureMembership = useCallback(async (channelId: string) => {
    if (!user) return;
    await supabase
      .from('chat_channel_members')
      .upsert({ channel_id: channelId, user_id: user.id }, { onConflict: 'channel_id,user_id' });
  }, [user]);

  const loadUnreadCounts = useCallback(async () => {
    if (!user) {
      setUnreadCounts({});
      return;
    }

    const { data: memberRows } = await supabase
      .from('chat_channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id);

    if (!memberRows || memberRows.length === 0) {
      setUnreadCounts({});
      return;
    }

    const channelIds = memberRows.map((m) => m.channel_id);
    const lastReadMap = Object.fromEntries(memberRows.map((m) => [m.channel_id, m.last_read_at || '1970-01-01T00:00:00.000Z']));

    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('channel_id, created_at, sender_id')
      .in('channel_id', channelIds)
      .order('created_at', { ascending: false })
      .limit(4000);

    const counts: Record<string, number> = {};
    for (const ch of channelIds) {
      counts[ch] = 0;
    }

    (recentMessages || []).forEach((msg) => {
      if (msg.sender_id === user.id) return;
      const cutoff = new Date(lastReadMap[msg.channel_id] || '1970-01-01T00:00:00.000Z').getTime();
      const created = new Date(msg.created_at || '1970-01-01T00:00:00.000Z').getTime();
      if (created > cutoff) {
        counts[msg.channel_id] = (counts[msg.channel_id] || 0) + 1;
      }
    });

    setUnreadCounts(counts);
  }, [user]);

  const markChannelRead = useCallback(async (channelId: string) => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    await supabase
      .from('chat_channel_members')
      .update({ last_read_at: nowIso })
      .eq('channel_id', channelId)
      .eq('user_id', user.id);

    setUnreadCounts((prev) => ({ ...prev, [channelId]: 0 }));
  }, [user]);

  // Load messages for active channel
  const loadMessages = useCallback(async (channelId: string, searchQuery?: string) => {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });

    if (searchQuery && searchQuery.trim()) {
      query = query.ilike('content', `%${searchQuery.trim()}%`);
    }

    query = query.limit(300);

    const { data } = await query;

    if (data) {
      const hydrated = await hydrateMessages(data as ChatMessage[]);
      setMessages(hydrated);
    }
  }, [hydrateMessages]);

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
    const canRead = await canAccessChannel(channel.id, 'read');
    if (!canRead) {
      toast.error('Access denied for this channel');
      return;
    }

    setActiveChannel(channel);
    await ensureMembership(channel.id);
    await Promise.all([loadMessages(channel.id), loadMembers(channel.id)]);
    await markChannelRead(channel.id);
  }, [canAccessChannel, ensureMembership, loadMessages, loadMembers, markChannelRead]);

  // Send message
  const sendMessage = useCallback(async (content: string, messageType: string = 'text') => {
    if (!user || !activeChannel || !content.trim()) return;

    const canWrite = await canAccessChannel(activeChannel.id, 'write');
    if (!canWrite) {
      toast.error('You do not have permission to send messages here');
      return;
    }

    await supabase.from('chat_messages').insert({
      channel_id: activeChannel.id,
      sender_id: user.id,
      content: content.trim(),
      message_type: messageType,
    });
    // Clear typing
    await supabase.from('chat_typing').delete().eq('channel_id', activeChannel.id).eq('user_id', user.id);
  }, [user, activeChannel, canAccessChannel]);

  const sendFile = useCallback(async (file: File) => {
    if (!user || !activeChannel || !file) return;

    const canWrite = await canAccessChannel(activeChannel.id, 'write');
    if (!canWrite) {
      toast.error('You do not have permission to share files in this channel');
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${activeChannel.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(SUPPORT_UPLOAD_BUCKET)
      .upload(filePath, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    if (uploadError) {
      toast.error(uploadError.message || 'File upload failed');
      return;
    }

    const payload = {
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || 'application/octet-stream',
    };

    const { data: inserted, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        channel_id: activeChannel.id,
        sender_id: user.id,
        message_type: 'file',
        content: JSON.stringify(payload),
      })
      .select('id')
      .maybeSingle();

    if (messageError) {
      toast.error(messageError.message || 'Failed to send file');
      return;
    }

    toast.success(`Shared ${file.name} (${formatFileSize(file.size)})`);
  }, [user, activeChannel, canAccessChannel]);

  // Set typing
  const setTyping = useCallback(async () => {
    if (!user || !activeChannel) return;

    const canWrite = await canAccessChannel(activeChannel.id, 'write');
    if (!canWrite) return;

    const now = Date.now();
    if (now - typingWriteThrottle.current < 800) return;
    typingWriteThrottle.current = now;

    await supabase.from('chat_typing').upsert(
      { channel_id: activeChannel.id, user_id: user.id, started_at: new Date().toISOString() },
      { onConflict: 'channel_id,user_id' }
    );
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      await supabase.from('chat_typing').delete().eq('channel_id', activeChannel.id).eq('user_id', user.id);
    }, 4000);
  }, [user, activeChannel, canAccessChannel]);

  // Create channel
  const createChannel = useCallback(async (name: string, description: string, type: string) => {
    if (!user) return;
    if (type !== 'direct' && !canCreateManagedChannel(role)) {
      toast.error('Only support/admin can create channels');
      return;
    }

    const { data } = await supabase.from('chat_channels').insert({
      name, description, channel_type: type, created_by: user.id
    }).select().single();
    if (data) {
      await supabase.from('chat_channel_members').insert({ channel_id: data.id, user_id: user.id, role: 'admin' });
      await loadChannels();
      return data;
    }
  }, [user, role, loadChannels]);

  const createDirectChannel = useCallback(async (otherUserId: string, displayName?: string) => {
    if (!user || !otherUserId) return null;
    const { data, error } = await (supabase as any).rpc('create_or_get_direct_channel', {
      p_other_user: otherUserId,
      p_label: displayName || null,
    });

    if (error) {
      toast.error(error.message || 'Unable to open direct message');
      return null;
    }

    await loadChannels();
    const { data: channel } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('id', data)
      .maybeSingle();
    if (channel) {
      await selectChannel(channel as Channel);
      return channel;
    }
    return null;
  }, [user, loadChannels, selectChannel]);

  const searchMessages = useCallback(async (query: string) => {
    if (!activeChannel) return;
    const trimmed = query.trim();
    if (!trimmed) {
      await loadMessages(activeChannel.id);
      return;
    }

    const { data, error } = await (supabase as any).rpc('search_chat_messages', {
      p_query: trimmed,
      p_channel_id: activeChannel.id,
      p_limit: 200,
    });

    if (error) {
      await loadMessages(activeChannel.id, trimmed);
      return;
    }

    const hydrated = await hydrateMessages((data || []) as ChatMessage[]);
    setMessages(hydrated.reverse());
  }, [activeChannel, hydrateMessages, loadMessages]);

  // Realtime subscriptions
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!user) return;
    loadUnreadCounts();
  }, [user, loadUnreadCounts]);

  useEffect(() => {
    if (!activeChannel && channels.length > 0) {
      selectChannel(channels[0]);
    }
  }, [activeChannel, channels, selectChannel]);

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
        const hydrated = await hydrateMessages([newMsg]);
        setMessages(prev => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, ...hydrated];
        });

        if (newMsg.sender_id !== user?.id) {
          await markChannelRead(activeChannel.id);
        }
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
  }, [activeChannel, user, hydrateMessages, markChannelRead]);

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

          if (typeof window !== 'undefined' && document.visibilityState !== 'visible') {
            if (window.Notification && Notification.permission === 'granted') {
              new Notification('New support message', {
                body: msg.message_type === 'file' ? 'Shared a file' : msg.content,
              });
            }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannel, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Notification) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = null;
      }
    };
  }, []);

  return {
    channels, activeChannel, messages, members, typingUsers, unreadCounts, loading,
    selectChannel, sendMessage, sendFile, setTyping, createChannel, createDirectChannel, searchMessages, loadChannels,
  };
}
