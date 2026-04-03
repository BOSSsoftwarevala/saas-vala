import { useState } from 'react';
import { SupportWorkspaceSidebar } from '@/components/support/SupportWorkspaceSidebar';
import { SupportChannelSidebar } from '@/components/support/SupportChannelSidebar';
import { SupportChatWindow } from '@/components/support/SupportChatWindow';
import { SupportThreadPanel } from '@/components/support/SupportThreadPanel';
import { useSupport } from '@/hooks/useSupport';
import { Loader2 } from 'lucide-react';

const Support = () => {
  const {
    channels, activeChannel, messages, members, typingUsers, unreadCounts, loading,
    selectChannel, sendMessage, setTyping, createChannel,
  } = useSupport();
  const [threadMessage, setThreadMessage] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[hsl(215,72%,8%)]">
        <Loader2 className="h-10 w-10 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[hsl(215,72%,8%)]">
      {/* Workspace icon sidebar (leftmost narrow bar like Slack) */}
      <SupportWorkspaceSidebar />

      {/* Channel sidebar */}
      <SupportChannelSidebar
        channels={channels}
        activeChannel={activeChannel}
        unreadCounts={unreadCounts}
        onSelectChannel={selectChannel}
        onCreateChannel={createChannel}
      />

      {/* Main chat area */}
      <SupportChatWindow
        channel={activeChannel}
        messages={messages}
        members={members}
        typingUsers={typingUsers}
        onSend={sendMessage}
        onTyping={setTyping}
        onOpenThread={(msgId) => setThreadMessage(msgId)}
      />

      {/* Thread panel (Slack-style right panel) */}
      {threadMessage && (
        <SupportThreadPanel
          messageId={threadMessage}
          onClose={() => setThreadMessage(null)}
        />
      )}
    </div>
  );
};

export default Support;
