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
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#1a1d21' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#ababad' }} />
          <span className="text-[14px] font-medium" style={{ color: '#ababad' }}>Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: '#1a1d21' }}>
      {/* Workspace icon sidebar (leftmost narrow bar) */}
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

      {/* Thread panel */}
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
