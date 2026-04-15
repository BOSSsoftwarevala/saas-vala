// Boss AI Chat Module - Central AI communication hub
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Send,
  Plus,
  MessageSquare,
  User,
  Bot,
  Search,
  MoreVertical,
  Trash2,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Copy,
  RefreshCw,
  PanelLeft,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Chat {
  id: string;
  user_id: string;
  title: string;
  status: 'active' | 'closed' | 'pending';
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
}

export default function BossAIChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat.id);
    }
  }, [activeChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    setChatsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setChats((data as Chat[]) || []);

      // Auto-select first active chat
      const activeChat = (data as Chat[])?.find(c => c.status === 'active');
      if (activeChat) {
        setActiveChat(activeChat);
      } else if ((data as Chat[])?.length === 0) {
        // Create new chat if none exists
        await createNewChat();
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      toast.error('Failed to load chats');
    } finally {
      setChatsLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as ChatMessage[]) || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_chats')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const newChat = data as Chat;
      setChats(prev => [newChat, ...prev]);
      setActiveChat(newChat);
      setMessages([]);
      toast.success('New chat created');
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeChat) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      // Save user message
      const { data: userMsg, error: userMsgError } = await supabase
        .from('ai_messages')
        .insert({
          chat_id: activeChat.id,
          role: 'user',
          content: userMessage,
          metadata: {},
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      setMessages(prev => [...prev, userMsg as ChatMessage]);

      // Update chat title if first message
      if (messages.length === 0) {
        await supabase
          .from('ai_chats')
          .update({
            title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeChat.id);
      }

      // Generate AI response (mock for now)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const aiResponse = `I understand you're asking about "${userMessage}". As an AI assistant, I can help you with various tasks including product management, key generation, server deployment, and more. How can I assist you further?`;

      const { data: aiMsg, error: aiMsgError } = await supabase
        .from('ai_messages')
        .insert({
          chat_id: activeChat.id,
          role: 'assistant',
          content: aiResponse,
          metadata: {},
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;

      setMessages(prev => [...prev, aiMsg as ChatMessage]);

      // Update chat last message
      await supabase
        .from('ai_chats')
        .update({
          last_message: aiResponse.slice(0, 100),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeChat.id);

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from('ai_chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
      toast.success('Chat deleted');
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'closed':
        return 'text-gray-500 bg-gray-500/10';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 transition-all duration-300 flex flex-col',
          sidebarCollapsed ? 'w-16' : 'w-80'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn('font-bold text-white', sidebarCollapsed && 'hidden')}>
              AI Chats
            </h2>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {sidebarCollapsed ? (
                <PanelLeft className="w-5 h-5 text-slate-400" />
              ) : (
                <X className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={createNewChat}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          )}
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {chatsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No chats yet</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={cn(
                  'w-full p-3 rounded-xl text-left transition-all duration-200 group',
                  activeChat?.id === chat.id
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                    : 'hover:bg-slate-800/50'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg', activeChat?.id === chat.id ? 'bg-blue-500/20' : 'bg-slate-700/50')}>
                    <MessageSquare className="w-4 h-4 text-slate-300" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">{chat.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(chat.status))}>
                          {chat.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(chat.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      {chat.last_message && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{chat.last_message}</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
            {!sidebarCollapsed && <span className="text-sm">AI Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-white">AI Chat</h1>
                <p className="text-sm text-slate-400">AI-powered assistance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <Copy className="w-5 h-5 text-slate-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <MoreVertical className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-slate-700/50 mb-6">
                <Bot className="w-16 h-16 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Start a conversation</h2>
              <p className="text-slate-400 mb-6">Create a new chat to start interacting with AI</p>
              <button
                onClick={createNewChat}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                New Chat
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No messages yet</h3>
                  <p className="text-slate-400">Start the conversation by typing a message below</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-4',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-2xl rounded-2xl p-4',
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                          : 'bg-slate-800/50 border border-slate-700/50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {message.role === 'user' && (
                          <User className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium">
                          {message.role === 'user' ? 'You' : 'AI Assistant'}
                        </span>
                        <span className="text-xs opacity-60">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="p-3 rounded-xl bg-slate-700/50">
                        <User className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                      <span className="text-sm text-slate-400">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {activeChat && (
          <div className="p-6 border-t border-slate-800">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={loading}
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                AI responses are generated based on your conversation context
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
