import { useState } from 'react';
import { Check, CheckCheck, Play, Pause, Lock, Image as ImageIcon, Mic } from 'lucide-react';
import { SupportMessage } from '@/hooks/useSupportChat';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: SupportMessage;
  isOwnMessage: boolean;
  isStaffView: boolean;
}

export function MessageBubble({ message, isOwnMessage, isStaffView }: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isInternalNote = message.is_internal_note && isStaffView;

  return (
    <div
      className={cn(
        'flex w-full mb-2',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3 py-2 shadow-sm relative',
          isInternalNote
            ? 'bg-amber-100 border border-amber-300 text-amber-900'
            : isOwnMessage
            ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-none'
            : 'bg-white text-gray-900 rounded-tl-none'
        )}
      >
        {/* Internal note badge */}
        {isInternalNote && (
          <div className="flex items-center gap-1 text-xs font-medium text-amber-700 mb-1">
            <Lock className="h-3 w-3" />
            Internal Note
          </div>
        )}

        {/* Text message */}
        {message.message_type === 'text' && message.content && (
          <p className="text-sm whitespace-pre-wrap break-words select-none">
            {message.content}
          </p>
        )}

        {/* Voice message */}
        {message.message_type === 'voice' && (
          <div className="flex items-center gap-3 min-w-[200px]">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                isOwnMessage ? 'bg-[#25D366] text-white' : 'bg-[#075E54] text-white'
              )}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <div className="flex-1">
              <div className="h-1 bg-gray-300 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-[#25D366] transition-all duration-300" />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {message.voice_duration ? formatDuration(message.voice_duration) : '0:00'}
                </span>
                <Mic className="h-3 w-3 text-[#25D366]" />
              </div>
            </div>
          </div>
        )}

        {/* Image message */}
        {message.message_type === 'image' && message.media_url && (
          <div className="relative">
            {!imageLoaded && (
              <div className="w-[200px] h-[200px] bg-gray-200 rounded animate-pulse flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <img
              src={message.media_url}
              alt="Shared image"
              className={cn(
                'max-w-[250px] rounded select-none pointer-events-none',
                !imageLoaded && 'hidden'
              )}
              onLoad={() => setImageLoaded(true)}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
            {/* Overlay to prevent download */}
            <div className="absolute inset-0 bg-transparent" onContextMenu={(e) => e.preventDefault()} />
          </div>
        )}

        {/* Timestamp and status */}
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOwnMessage ? 'justify-end' : 'justify-start'
        )}>
          <span className="text-[10px] text-gray-500">
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          {isOwnMessage && (
            message.read_at ? (
              <CheckCheck className="h-3 w-3 text-[#53BDEB]" />
            ) : (
              <Check className="h-3 w-3 text-gray-400" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
