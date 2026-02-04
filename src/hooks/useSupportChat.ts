import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: 'pending' | 'open' | 'resolved' | 'escalated';
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  ip_hash: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: 'user' | 'staff';
  message_type: 'text' | 'voice' | 'image';
  content: string | null;
  media_url: string | null;
  voice_duration: number | null;
  is_internal_note: boolean;
  delivered_at: string;
  read_at: string | null;
  created_at: string;
}

export function useSupportChat() {
  const { user, isSuperAdmin } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for a ticket
  const fetchMessages = useCallback(async (ticketId: string) => {
    if (!user) return;
    
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [user]);

  // Create new ticket
  const createTicket = async (userName: string, userEmail: string) => {
    if (!user) return null;

    try {
      // Generate ticket number
      const { data: ticketNumData, error: ticketNumError } = await supabase
        .rpc('generate_ticket_number');

      if (ticketNumError) throw ticketNumError;

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumData,
          user_id: user.id,
          user_name: userName,
          user_email: userEmail,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Support request created');
      await fetchTickets();
      return data as SupportTicket;
    } catch (err) {
      console.error('Error creating ticket:', err);
      toast.error('Failed to create support request');
      return null;
    }
  };

  // Send message
  const sendMessage = async (
    ticketId: string, 
    content: string, 
    messageType: 'text' | 'voice' | 'image' = 'text',
    mediaUrl?: string,
    voiceDuration?: number,
    isInternalNote: boolean = false
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          sender_type: isSuperAdmin ? 'staff' : 'user',
          message_type: messageType,
          content: messageType === 'text' ? content : null,
          media_url: mediaUrl || null,
          voice_duration: voiceDuration || null,
          is_internal_note: isInternalNote,
        });

      if (error) throw error;

      // Log the action
      await supabase.from('support_audit_logs').insert({
        ticket_id: ticketId,
        action: 'message_sent',
        actor_id: user.id,
        actor_type: isSuperAdmin ? 'staff' : 'user',
        details: { message_type: messageType },
      });

      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
      return false;
    }
  };

  // Update ticket status (staff only)
  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status']) => {
    if (!user || !isSuperAdmin) return false;

    try {
      const updateData: Record<string, unknown> = { status };
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      // Log the action
      await supabase.from('support_audit_logs').insert({
        ticket_id: ticketId,
        action: `status_changed_to_${status}`,
        actor_id: user.id,
        actor_type: 'staff',
        details: { new_status: status },
      });

      toast.success(`Ticket marked as ${status}`);
      await fetchTickets();
      return true;
    } catch (err) {
      console.error('Error updating ticket:', err);
      toast.error('Failed to update ticket status');
      return false;
    }
  };

  // Approve ticket (staff only) - changes status from pending to open
  const approveTicket = async (ticketId: string) => {
    return updateTicketStatus(ticketId, 'open');
  };

  // Set active ticket and load messages
  const selectTicket = async (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    await fetchMessages(ticket.id);
  };

  // Subscribe to realtime messages
  useEffect(() => {
    if (!activeTicket) return;

    const channel = supabase
      .channel(`support-messages-${activeTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
        (payload) => {
          const newMessage = payload.new as SupportMessage;
          // Only add if it's not an internal note (unless staff)
          if (!newMessage.is_internal_note || isSuperAdmin) {
            setMessages((prev) => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTicket, isSuperAdmin]);

  // Initial fetch
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    messages,
    activeTicket,
    loading,
    messagesLoading,
    createTicket,
    sendMessage,
    updateTicketStatus,
    approveTicket,
    selectTicket,
    setActiveTicket,
    fetchTickets,
    isSuperAdmin,
  };
}
