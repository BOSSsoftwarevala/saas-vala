// Boss Support Module - Support ticket management
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  User,
  Settings,
  Send,
  FileText,
  TrendingUp,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  category: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  assigned_name?: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  user_name?: string;
}

export default function BossSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      loadMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, users!inner(email, full_name), assigned_user!inner(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets((data as Ticket[]).map(t => ({
        ...t,
        user_email: (t as any).users?.email,
        user_name: (t as any).users?.full_name,
        assigned_name: (t as any).assigned_user?.full_name,
      })));
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*, users!inner(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages((data as TicketMessage[]).map(m => ({
        ...m,
        user_name: (m as any).users?.full_name,
      })));
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const updateTicketStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setTickets(prev =>
        prev.map(t =>
          t.id === id ? { ...t, status } : t
        )
      );
      if (selectedTicket?.id === id) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      toast.success(`Ticket ${status}`);
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: replyText,
          is_internal: false,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      setReplyText('');
      loadMessages(selectedTicket.id);
      toast.success('Reply sent');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-blue-500 bg-blue-500/10';
      case 'in_progress':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'resolved':
        return 'text-green-500 bg-green-500/10';
      case 'closed':
        return 'text-slate-500 bg-slate-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'text-slate-500 bg-slate-500/10';
      case 'medium':
        return 'text-blue-500 bg-blue-500/10';
      case 'high':
        return 'text-orange-500 bg-orange-500/10';
      case 'urgent':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'open').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Support Center</h1>
          <p className="text-slate-400">Manage support tickets and customer inquiries</p>
        </div>
        <button
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          New Ticket
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{totalTickets}</h3>
          <p className="text-sm text-slate-400">Total Tickets</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Open</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{openTickets}</h3>
          <p className="text-sm text-slate-400">Open Tickets</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <RefreshCw className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400">In Progress</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{inProgressTickets}</h3>
          <p className="text-sm text-slate-400">In Progress</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Resolved</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{resolvedTickets}</h3>
          <p className="text-sm text-slate-400">Resolved Tickets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets List */}
        <div className="lg:col-span-1 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Tickets</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-48"
              />
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No tickets found</h3>
              <p className="text-slate-400">Support tickets will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    'bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border cursor-pointer transition-all duration-300',
                    selectedTicket?.id === ticket.id
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-slate-700/50 hover:border-slate-600/50'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-white text-sm line-clamp-1">{ticket.subject}</h3>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs', getPriorityColor(ticket.priority))}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">{ticket.user_name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(ticket.status))}>
                      {ticket.status}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Details */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          {!selectedTicket ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select a ticket</h3>
              <p className="text-slate-400">Choose a ticket from the list to view details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Ticket Header */}
              <div className="border-b border-slate-700 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-2">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(selectedTicket.status))}>
                        {selectedTicket.status}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs', getPriorityColor(selectedTicket.priority))}>
                        {selectedTicket.priority}
                      </span>
                      <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTicket.status !== 'closed' && (
                      <button
                        onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                        className="p-2 rounded-lg hover:bg-green-500/20 transition-colors text-slate-400 hover:text-green-500"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                      <Archive className="w-5 h-5 text-slate-400" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                      <Settings className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">{selectedTicket.user_name} ({selectedTicket.user_email})</span>
                  </div>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Category: {selectedTicket.category}</span>
                  {selectedTicket.assigned_name && (
                    <>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">Assigned: {selectedTicket.assigned_name}</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-300 mt-3 bg-slate-800/50 p-4 rounded-lg">{selectedTicket.description}</p>
              </div>

              {/* Messages */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Conversation</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-slate-400 text-sm">No messages yet</p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'p-4 rounded-lg',
                          message.is_internal ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-blue-500/10 border border-blue-500/30'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">{message.user_name || 'Unknown'}</span>
                          <span className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-300">{message.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Reply */}
              {selectedTicket.status !== 'closed' && (
                <div className="border-t border-slate-700 pt-4">
                  <div className="flex gap-3">
                    <textarea
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                      rows={3}
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim()}
                      className="px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
