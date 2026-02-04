import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Mic, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (content: string, type: 'text' | 'voice' | 'image', mediaUrl?: string) => Promise<boolean>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSendMessage, disabled, placeholder = 'Type a message...' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (disabled || isSending) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage && !previewImage) return;

    setIsSending(true);
    
    try {
      if (previewImage) {
        await onSendMessage('', 'image', previewImage);
        setPreviewImage(null);
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
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleVoiceRecord = () => {
    // Voice recording placeholder
    setIsRecording(!isRecording);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  return (
    <div className="bg-[#F0F0F0] border-t border-gray-200">
      {/* Image preview */}
      {previewImage && (
        <div className="p-2 bg-white border-b">
          <div className="relative inline-block">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="h-20 rounded"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 p-2">
        {/* Image button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-gray-600 hover:bg-gray-200 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
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

        {/* Text input */}
        <div className="flex-1 bg-white rounded-full border border-gray-300 px-4 py-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[20px] max-h-[120px] border-0 p-0 focus-visible:ring-0 resize-none text-sm bg-transparent"
            rows={1}
          />
        </div>

        {/* Voice / Send button */}
        {message.trim() || previewImage ? (
          <Button
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full flex-shrink-0',
              'bg-[#075E54] hover:bg-[#054C44] text-white'
            )}
            onClick={handleSend}
            disabled={disabled || isSending}
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full flex-shrink-0',
              isRecording ? 'bg-red-500 text-white hover:bg-red-600' : 'text-gray-600 hover:bg-gray-200'
            )}
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
