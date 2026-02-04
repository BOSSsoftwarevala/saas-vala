import { useRef, useEffect } from 'react';
import { SupportHeader } from './SupportHeader';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { StaffControls } from './StaffControls';
import { TypingIndicator } from './TypingIndicator';
import { SupportTicket, SupportMessage } from '@/hooks/useSupportChat';
import { useSupportPresence } from '@/hooks/useSupportPresence';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ChatWindowProps {
  ticket: SupportTicket | null;
  messages: SupportMessage[];
  loading?: boolean;
  onSendMessage: (content: string, type: 'text' | 'voice' | 'image', mediaUrl?: string, voiceDuration?: number) => Promise<boolean>;
  onBack?: () => void;
  showBackButton?: boolean;
  onUpdateStatus?: (status: SupportTicket['status']) => Promise<boolean>;
  onSendInternalNote?: (content: string) => Promise<boolean>;
}

export function ChatWindow({
  ticket,
  messages,
  loading,
  onSendMessage,
  onBack,
  showBackButton,
  onUpdateStatus,
  onSendInternalNote,
}: ChatWindowProps) {
  const { user, isSuperAdmin } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Presence tracking
  const { 
    typingUsers, 
    setTyping, 
    isOtherUserOnline,
    isOtherUserTyping 
  } = useSupportPresence(ticket?.id || null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherUserTyping]);

  // Handle typing status
  const handleTyping = () => {
    setTyping(true);
  };

  // Wrap onSendMessage to clear typing status
  const handleSendMessage = async (
    content: string, 
    type: 'text' | 'voice' | 'image', 
    mediaUrl?: string,
    voiceDuration?: number
  ) => {
    setTyping(false);
    return onSendMessage(content, type, mediaUrl, voiceDuration);
  };

  if (!ticket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#ECE5DD] p-8">
        <div className="text-center">
          <div className="h-24 w-24 rounded-full bg-[#075E54]/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-12 w-12 text-[#075E54]/50" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Select a conversation
          </h3>
          <p className="text-sm text-gray-500">
            Choose a support ticket from the list to start chatting
          </p>
        </div>
      </div>
    );
  }

  const isPending = ticket.status === 'pending';
  const isResolved = ticket.status === 'resolved';
  const canChat = !isPending && !isResolved;

  // Get the name of who's typing
  const typingUserName = typingUsers.length > 0 
    ? typingUsers[0].is_staff ? 'Support' : ticket.user_name
    : 'Someone';

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header with online status */}
      <SupportHeader 
        activeTicket={ticket} 
        onBack={onBack}
        showBackButton={showBackButton}
        isOtherUserOnline={isOtherUserOnline}
      />

      {/* Staff controls */}
      {isSuperAdmin && onUpdateStatus && onSendInternalNote && (
        <StaffControls
          ticket={ticket}
          onUpdateStatus={onUpdateStatus}
          onSendInternalNote={onSendInternalNote}
        />
      )}

      {/* Messages area */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23075E54' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#ECE5DD',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-[#075E54]" />
          </div>
        ) : (
          <>
            {/* Pending notice */}
            {isPending && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center mb-4">
                <p className="text-sm text-yellow-800">
                  {isSuperAdmin 
                    ? 'This request is pending approval. Approve it to start the conversation.'
                    : 'Your request is pending approval. You will be notified when a staff member opens the chat.'}
                </p>
              </div>
            )}

            {/* Resolved notice */}
            {isResolved && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center mb-4">
                <p className="text-sm text-blue-800">
                  This conversation has been marked as resolved.
                </p>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.sender_id === user?.id}
                isStaffView={isSuperAdmin}
              />
            ))}

            {/* Typing indicator */}
            {isOtherUserTyping && (
              <TypingIndicator userName={typingUserName} />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={!canChat}
        placeholder={
          isPending 
            ? 'Waiting for approval...' 
            : isResolved 
            ? 'This conversation is closed'
            : 'Type a message...'
        }
      />
    </div>
  );
}
