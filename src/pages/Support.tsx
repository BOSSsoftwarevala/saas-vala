import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TicketList } from '@/components/support/TicketList';
import { ChatWindow } from '@/components/support/ChatWindow';
import { NewTicketModal } from '@/components/support/NewTicketModal';
import { useSupportChat } from '@/hooks/useSupportChat';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Support() {
  const {
    tickets,
    messages,
    activeTicket,
    loading,
    messagesLoading,
    createTicket,
    sendMessage,
    updateTicketStatus,
    selectTicket,
    setActiveTicket,
    isSuperAdmin,
  } = useSupportChat();

  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const isMobile = useIsMobile();

  const handleSendMessage = async (
    content: string,
    type: 'text' | 'voice' | 'image',
    mediaUrl?: string
  ) => {
    if (!activeTicket) return false;
    return sendMessage(activeTicket.id, content, type, mediaUrl);
  };

  const handleSendInternalNote = async (content: string) => {
    if (!activeTicket) return false;
    return sendMessage(activeTicket.id, content, 'text', undefined, undefined, true);
  };

  const handleUpdateStatus = async (status: 'pending' | 'open' | 'resolved' | 'escalated') => {
    if (!activeTicket) return false;
    return updateTicketStatus(activeTicket.id, status);
  };

  const handleCreateTicket = async (userName: string, userEmail: string) => {
    const ticket = await createTicket(userName, userEmail);
    if (ticket) {
      selectTicket(ticket);
    }
    return ticket;
  };

  // Mobile view: show either list or chat
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-4rem)] flex flex-col -m-4 md:-m-6">
          {activeTicket ? (
            <ChatWindow
              ticket={activeTicket}
              messages={messages}
              loading={messagesLoading}
              onSendMessage={handleSendMessage}
              onBack={() => setActiveTicket(null)}
              showBackButton
              onUpdateStatus={isSuperAdmin ? handleUpdateStatus : undefined}
              onSendInternalNote={isSuperAdmin ? handleSendInternalNote : undefined}
            />
          ) : (
            <TicketList
              tickets={tickets}
              onSelectTicket={selectTicket}
              onNewTicket={() => setShowNewTicketModal(true)}
              loading={loading}
              isStaff={isSuperAdmin}
            />
          )}
        </div>

        <NewTicketModal
          open={showNewTicketModal}
          onOpenChange={setShowNewTicketModal}
          onCreateTicket={handleCreateTicket}
        />
      </DashboardLayout>
    );
  }

  // Desktop view: side-by-side
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex -m-4 md:-m-6 overflow-hidden">
        {/* Ticket list sidebar */}
        <div className="w-80 border-r border-border flex-shrink-0">
          <TicketList
            tickets={tickets}
            activeTicketId={activeTicket?.id}
            onSelectTicket={selectTicket}
            onNewTicket={() => setShowNewTicketModal(true)}
            loading={loading}
            isStaff={isSuperAdmin}
          />
        </div>

        {/* Chat window */}
        <ChatWindow
          ticket={activeTicket}
          messages={messages}
          loading={messagesLoading}
          onSendMessage={handleSendMessage}
          onUpdateStatus={isSuperAdmin ? handleUpdateStatus : undefined}
          onSendInternalNote={isSuperAdmin ? handleSendInternalNote : undefined}
        />
      </div>

      <NewTicketModal
        open={showNewTicketModal}
        onOpenChange={setShowNewTicketModal}
        onCreateTicket={handleCreateTicket}
      />
    </DashboardLayout>
  );
}
