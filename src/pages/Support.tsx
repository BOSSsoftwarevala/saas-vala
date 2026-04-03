import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SupportChannelSidebar } from '@/components/support/SupportChannelSidebar';
import { SupportChatWindow } from '@/components/support/SupportChatWindow';
import { useSupport } from '@/hooks/useSupport';
import { Loader2 } from 'lucide-react';

const Support = () => {
  const {
    channels, activeChannel, messages, members, typingUsers, unreadCounts, loading,
    selectChannel, sendMessage, setTyping, createChannel,
  } = useSupport();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden rounded-lg border bg-background">
        <SupportChannelSidebar
          channels={channels}
          activeChannel={activeChannel}
          unreadCounts={unreadCounts}
          onSelectChannel={selectChannel}
          onCreateChannel={createChannel}
        />
        <SupportChatWindow
          channel={activeChannel}
          messages={messages}
          members={members}
          typingUsers={typingUsers}
          onSend={sendMessage}
          onTyping={setTyping}
        />
      </div>
    </DashboardLayout>
  );
};

export default Support;
