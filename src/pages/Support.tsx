import { useState, useEffect } from 'react';
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

  // Auto-select first channel (like Slack does)
  useEffect(() => {
    if (!loading && channels.length > 0 && !activeChannel) {
      const general = channels.find(c => c.name === 'general');
      selectChannel(general || channels[0]);
    }
  }, [loading, channels, activeChannel, selectChannel]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#3F0E40' }}>
        <div className="flex flex-col items-center gap-[12px]">
          <div className="w-[52px] h-[52px] rounded-[12px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #611f69, #4a154b)' }}>
            <span className="text-white font-[900] text-[24px]">S</span>
          </div>
          <Loader2 className="h-[24px] w-[24px] animate-spin text-white/60" />
          <span className="text-[14px] font-medium text-white/60">Loading SaasVala Support...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: '#1A1D21' }}>
      {/* Workspace icon sidebar (leftmost narrow bar — Slack style) */}
      <SupportWorkspaceSidebar />

      {/* Channel sidebar — Slack style */}
      <SupportChannelSidebar
        channels={channels}
        activeChannel={activeChannel}
        unreadCounts={unreadCounts}
        onSelectChannel={selectChannel}
        onCreateChannel={createChannel}
      />

      {/* Main chat area — Slack style */}
      <SupportChatWindow
        channel={activeChannel}
        messages={messages}
        members={members}
        typingUsers={typingUsers}
        onSend={sendMessage}
        onTyping={setTyping}
        onOpenThread={(msgId) => setThreadMessage(msgId)}
      />

      {/* Thread panel — Slack style */}
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
