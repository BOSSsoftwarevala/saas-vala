import { useState, useRef, KeyboardEvent, useCallback } from 'react';
import { Send, Mic, Image as ImageIcon, X, Loader2, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useSupportStorage } from '@/hooks/useSupportStorage';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { toast } from 'sonner';

interface ChatInputProps {
  onSendMessage: (content: string, type: 'text' | 'voice' | 'image', mediaUrl?: string, voiceDuration?: number) => Promise<boolean>;
  onTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSendMessage, 
  onTyping,
  disabled, 
  placeholder = 'Type a message...' 
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { uploadImage, uploadVoice, uploading } = useSupportStorage();
  const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    if (disabled || isSending || uploading) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage && !previewImage) return;

    setIsSending(true);
    
    try {
      if (previewImage) {
        // Upload image to storage
        const imageUrl = await uploadImage(previewImage);
        if (imageUrl) {
          await onSendMessage('', 'image', imageUrl);
        }
        setPreviewImage(null);
        setPreviewUrl(null);
      } else {
        await onSendMessage(trimmedMessage, 'text');
      }
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      
      setPreviewImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
    e.target.value = '';
  };

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewImage(null);
    setPreviewUrl(null);
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      // Stop and send
      setIsSending(true);
      try {
        const blob = await stopRecording();
        if (blob) {
          const voiceUrl = await uploadVoice(blob);
          if (voiceUrl) {
            await onSendMessage('', 'voice', voiceUrl, duration);
          }
        }
      } finally {
        setIsSending(false);
      }
    } else {
      // Start recording
      const started = await startRecording();
      if (!started) {
        toast.error('Could not access microphone. Please check permissions.');
      }
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
  };

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    
    // Notify typing
    if (e.target.value.length > 0 && onTyping) {
      onTyping();
    }
  }, [onTyping]);

  const isProcessing = isSending || uploading;

  return (
    <div className="bg-[#F0F0F0] border-t border-gray-200">
      {/* Image preview */}
      {previewUrl && (
        <div className="p-2 bg-white border-b">
          <div className="relative inline-block">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="h-20 rounded"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={clearPreview}
              disabled={isProcessing}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="p-3 bg-red-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-700">
              Recording... {formatDuration(duration)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-100"
            onClick={handleCancelRecording}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2 p-2">
        {/* Image button - hidden during recording */}
        {!isRecording && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-gray-600 hover:bg-gray-200 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageSelect}
            />
          </>
        )}

        {/* Text input - hidden during recording */}
        {!isRecording && (
          <div className="flex-1 bg-white rounded-full border border-gray-300 px-4 py-2">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              className="min-h-[20px] max-h-[120px] border-0 p-0 focus-visible:ring-0 resize-none text-sm bg-transparent"
              rows={1}
            />
          </div>
        )}

        {/* Recording waveform placeholder */}
        {isRecording && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-1">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-[#075E54] rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 24 + 8}px`,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Voice / Send button */}
        {message.trim() || previewImage ? (
          <Button
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full flex-shrink-0',
              'bg-[#075E54] hover:bg-[#054C44] text-white'
            )}
            onClick={handleSend}
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        ) : isRecording ? (
          <Button
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full flex-shrink-0',
              'bg-[#075E54] hover:bg-[#054C44] text-white'
            )}
            onClick={handleVoiceRecord}
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0 text-gray-600 hover:bg-gray-200"
            onClick={handleVoiceRecord}
            disabled={disabled}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
