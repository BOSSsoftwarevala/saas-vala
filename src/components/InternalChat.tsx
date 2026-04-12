import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useInternalChat, Chat, Message, TypingUser } from '@/hooks/useInternalChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Mic, 
  MicOff, 
  Search, 
  MoreVertical, 
  Pin, 
  Volume2, 
  VolumeX,
  Check,
  CheckCheck,
  Clock,
  User,
  Users,
  MessageSquare,
  Settings,
  Ban
} from 'lucide-react';

const InternalChat: React.FC = () => {
  const { user } = useAuth();
  const {
    chats,
    selectedChat,
    setSelectedChat,
    messages,
    typingUsers,
    isLoading,
    hasMoreMessages,
    onlineUsers,
    sendMessage,
    setTypingIndicator,
    markAsRead,
    createChat,
    blockUser,
    searchChats,
    uploadVoice
  } = useInternalChat();
  
  const [newMessage, setNewMessage] = useState('');
  
  // STEP 40: SCROLL POSITION MEMORY - Track scroll positions per chat
  const scrollPositionRef = useRef<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Save scroll position when switching chats
  const saveScrollPosition = useCallback((chatId: string) => {
    if (scrollAreaRef.current) {
      scrollPositionRef.current[chatId] = scrollAreaRef.current.scrollTop;
    }
  }, []);

  // Restore scroll position when chat loads
  const restoreScrollPosition = useCallback((chatId: string) => {
    if (scrollAreaRef.current && scrollPositionRef.current[chatId]) {
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollPositionRef.current[chatId];
        }
      }, 100);
    }
  }, []);

  // Auto-scroll to bottom for new messages (only if at bottom)
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && scrollAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
      
      if (isAtBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [userLanguage, setUserLanguage] = useState('en');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user's language preference
  useEffect(() => {
    const fetchUserLanguage = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('internal_user_languages')
        .select('language_code')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .single();
      
      if (data) {
        setUserLanguage(data.language_code);
      }
    };
    
    fetchUserLanguage();
  }, [user]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (!isTyping && selectedChat) {
      setIsTyping(true);
      sendTypingIndicator(selectedChat.chat_id, true);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendTypingIndicator(selectedChat.chat_id, false);
      }, 3000);
    }
  }, [isTyping, selectedChat]);

  const sendTypingIndicator = async (chatId: string, isTyping: boolean) => {
    try {
      await fetch('/api/internal-chat/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
        },
        body: JSON.stringify({ chat_id: chatId, is_typing })
      });
    } catch (error) {
      console.error('Error setting typing indicator:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsTyping(false);

    const message = await sendMessage(selectedChat.chat_id, messageText, 'text');
    if (!message) {
      setNewMessage(messageText); // Restore message on error
    }
  };

  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        if (selectedChat) {
          const voiceUrl = await uploadVoice(audioBlob);
          if (voiceUrl) {
            await sendMessage(selectedChat.chat_id, '🎤 Voice message', 'voice', voiceUrl);
          }
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const translateMessage = async (text: string, targetLanguage: string) => {
    setIsTranslating(true);
    try {
      const response = await fetch('/api/internal-chat/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
        },
        body: JSON.stringify({
          text,
          target_language: targetLanguage
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.translated_text;
      }
    } catch (error) {
      console.error('Error translating message:', error);
    } finally {
      setIsTranslating(false);
    }
    return text;
  };

  const getDeliveryIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.internal_chats.is_group) {
      return chat.internal_chats.group_name || 'Group Chat';
    }
    
    const otherMember = chat.internal_chats.internal_chat_members.find(
      m => m.user_id !== user?.id
    );
    
    return otherMember?.internal_users.username || 'Unknown User';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.internal_chats.is_group) {
      return <Users className="w-8 h-8" />;
    }
    
    const otherMember = chat.internal_chats.internal_chat_members.find(
      m => m.user_id !== user?.id
    );
    
    return otherMember?.internal_users.avatar_url || null;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Chat List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold mb-4">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`flex items-center p-4 hover:bg-accent cursor-pointer border-b ${
                selectedChat?.chat_id === chat.chat_id ? 'bg-accent' : ''
              }`}
            >
              <Avatar className="w-12 h-12 mr-3">
                <AvatarImage src={getChatAvatar(chat) || undefined} />
                <AvatarFallback>
                  {chat.internal_chats.is_group ? (
                    <Users className="w-6 h-6" />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium truncate">
                    {getChatName(chat)}
                  </h3>
                  <div className="flex items-center space-x-1">
                    {chat.is_pinned && <Pin className="w-3 h-3 text-yellow-500" />}
                    {chat.is_muted && <VolumeX className="w-3 h-3 text-gray-400" />}
                    <span className="text-xs text-muted-foreground">
                      {new Date(chat.internal_chats.updated_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message?.message_text || 'No messages yet'}
                  </p>
                  {chat.unread_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {chat.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center">
              <Avatar className="w-10 h-10 mr-3">
                <AvatarImage src={getChatAvatar(selectedChat) || undefined} />
                <AvatarFallback>
                  {selectedChat.internal_chats.is_group ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{getChatName(selectedChat)}</h3>
                {typingUsers.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {typingUsers.map(u => u.username).join(', ')} is typing...
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Volume2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Block className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex mb-4 ${
                  message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`max-w-xs lg:max-w-md ${
                  message.sender_id === user?.id ? 'order-2' : 'order-1'
                }`}>
                  {message.sender_id !== user?.id && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {message.sender.username}
                    </p>
                  )}
                  
                  <div className={`rounded-lg p-3 ${
                    message.sender_id === user?.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.message_text}</p>
                    
                    {message.voice_url && (
                      <audio controls className="mt-2 w-full">
                        <source src={message.voice_url} type="audio/wav" />
                      </audio>
                    )}
                  </div>
                  
                  <div className={`flex items-center mt-1 text-xs text-muted-foreground ${
                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}>
                    <span>{new Date(message.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}</span>
                    {message.sender_id === user?.id && (
                      <span className="ml-2">
                        {getDeliveryIcon(message.delivery_status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={isRecording ? stopRecording : startRecording}
                className={isRecording ? 'text-red-500' : ''}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
                disabled={isRecording}
              />
              
              <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a chat</h3>
            <p className="text-muted-foreground">Choose a conversation from the list to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalChat;
