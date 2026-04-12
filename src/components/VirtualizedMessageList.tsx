import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@/hooks/useInternalChat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Check, CheckCheck, Clock } from 'lucide-react';

interface VirtualizedMessageListProps {
  messages: Message[];
  currentUserId: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

const ITEM_HEIGHT = 80; // Approximate height of each message
const BUFFER_SIZE = 5; // Number of items to render above/below viewport

export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  currentUserId,
  onLoadMore,
  hasMore,
  isLoading
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  // Calculate visible range
  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT);
  const totalHeight = messages.length * ITEM_HEIGHT;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setContainerHeight(container.clientHeight);
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const end = Math.min(
      messages.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    );
    
    setStartIndex(start);
    setEndIndex(end);

    // Load more when scrolling near top
    if (scrollTop < 200 && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  }, [scrollTop, containerHeight, messages.length, hasMore, isLoading, onLoadMore]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const visibleMessages = messages.slice(startIndex, endIndex);
  const offsetY = startIndex * ITEM_HEIGHT;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <Clock className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={handleScroll}
      style={{ height: '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Loading indicator at top */}
        {isLoading && (
          <div 
            className="absolute top-0 left-0 right-0 flex justify-center p-2 bg-background/80 backdrop-blur-sm z-10"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            <div className="text-sm text-muted-foreground">Loading older messages...</div>
          </div>
        )}

        {/* Visible messages */}
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleMessages.map((message, index) => {
            const isOwn = message.sender_id === currentUserId;
            
            return (
              <div
                key={message.id}
                className={`flex gap-3 p-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                style={{ height: ITEM_HEIGHT }}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="text-xs">
                    {message.sender.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex-1 min-w-0 ${isOwn ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {message.sender.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
                    {isOwn && getStatusIcon(message.delivery_status)}
                  </div>
                  
                  <div className={`inline-block max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                    isOwn 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="break-words">{message.message_text}</p>
                    
                    {message.translated_text && (
                      <div className="mt-1 pt-1 border-t border-current/20 text-xs opacity-80">
                        <em>Translated</em>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
