import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Image, Sparkles, X, FileCode, FileArchive, File, Mic, MicOff, Code, Shield, Server, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceConversation } from '@/hooks/useVoiceConversation';
import { QuickTemplates } from './QuickTemplates';

// Inline compact suggestions data
const compactSuggestions = [
  { id: 'analyze', text: 'Analyze this code for issues', icon: Code },
  { id: 'security', text: 'Run security scan', icon: Shield },
  { id: 'deploy', text: 'Deploy to my server', icon: Server },
  { id: 'fix', text: 'Auto-fix all problems', icon: Wrench },
];
interface UploadedFile {
  file: File;
  preview?: string;
  type: 'image' | 'code' | 'archive' | 'other';
}

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading: boolean;
  disabled?: boolean;
  onVoiceMessage?: (userText: string, aiResponse: string) => void;
  onTemplateSelect?: (template: string) => void;
  showSuggestions?: boolean;
}

const getFileType = (file: File): UploadedFile['type'] => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'php', 'html', 'css', 'json', 'xml', 'md', 'txt'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
  
  if (file.type.startsWith('image/')) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (archiveExts.includes(ext)) return 'archive';
  return 'other';
};

const getFileIcon = (type: UploadedFile['type']) => {
  switch (type) {
    case 'code': return FileCode;
    case 'archive': return FileArchive;
    default: return File;
  }
};

export function ChatInput({ onSend, isLoading, disabled, onVoiceMessage, onTemplateSelect, showSuggestions = true }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Full voice conversation with ElevenLabs
  const { 
    state: voiceState,
    transcript,
    isSupported: voiceSupported,
    toggle: toggleVoice,
  } = useVoiceConversation({
    onTranscript: (text) => {
      setLastVoiceTranscript(text);
    },
    onAiResponse: (response) => {
      // Add both messages to chat
      if (lastVoiceTranscript && onVoiceMessage) {
        onVoiceMessage(lastVoiceTranscript, response);
      }
    }
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;
    
    // File size limits - MEGA INCREASED for large project uploads
    const getMaxSize = (file: File): number => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'apk'];
      const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'php', 'html', 'css', 'json', 'xml', 'sql', 'java', 'kt', 'swift', 'go', 'rs', 'c', 'cpp', 'h', 'hpp'];
      const textExts = ['txt', 'csv', 'md', 'log'];
      // 5GB for archives/APK, 1GB for code, 500MB for text, 200MB for others
      if (archiveExts.includes(ext)) return 5 * 1024 * 1024 * 1024; // 5GB
      if (codeExts.includes(ext)) return 1024 * 1024 * 1024; // 1GB
      if (textExts.includes(ext)) return 500 * 1024 * 1024; // 500MB for txt files
      return 200 * 1024 * 1024; // 200MB for others
    };

    const formatSize = (bytes: number): string => {
      if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / 1024).toFixed(1)} KB`;
    };

    const validFiles = selectedFiles.filter(file => {
      const maxSize = getMaxSize(file);
      if (file.size > maxSize) {
        toast.error(`File too large: ${file.name}`, {
          description: `Size: ${formatSize(file.size)} | Max: ${formatSize(maxSize)}. Try compressing the file.`,
          duration: 5000
        });
        return false;
      }
      return true;
    });

    // Limit to 10 files total
    const remaining = 10 - files.length;
    if (validFiles.length > remaining) {
      toast.warning('File limit reached', {
        description: `Only ${remaining} more file(s) can be added`
      });
    }

    const filesToAdd = validFiles.slice(0, remaining);
    
    const newFiles: UploadedFile[] = filesToAdd.map(file => {
      const type = getFileType(file);
      const uploadedFile: UploadedFile = { file, type };
      
      // Create preview for images
      if (type === 'image') {
        uploadedFile.preview = URL.createObjectURL(file);
      }
      
      return uploadedFile;
    });

    setFiles(prev => [...prev, ...newFiles]);
    
    // Reset input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = () => {
    if ((!input.trim() && files.length === 0) || isLoading || disabled) return;
    
    onSend(input.trim(), files.map(f => f.file));
    setInput('');
    setFiles([]);
    
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasContent = input.trim() || files.length > 0;

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur-sm">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".zip,.rar,.7z,.tar,.gz,.js,.ts,.tsx,.jsx,.py,.php,.html,.css,.json,.xml,.md,.txt,.pdf,.doc,.docx"
        onChange={(e) => handleFileSelect(e)}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleFileSelect(e)}
        className="hidden"
      />


      {/* File Previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-2 pt-2 max-w-3xl mx-auto overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              {files.map((uploadedFile, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group flex items-center gap-2 bg-muted/50 hover:bg-muted/70 border border-border hover:border-primary/30 rounded-lg p-2 pr-8 transition-all duration-200"
                >
                  {uploadedFile.type === 'image' && uploadedFile.preview ? (
                    <img
                      src={uploadedFile.preview}
                      alt={uploadedFile.file.name}
                      className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      {(() => {
                        const Icon = getFileIcon(uploadedFile.type);
                        return <Icon className="h-4 w-4 text-primary" />;
                      })()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium truncate max-w-[100px]">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(uploadedFile.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
            <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full border text-[10px] font-medium bg-muted/30">
              {files.length}/10 files attached
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Icons Row - Above Input */}
      <div className="px-2 pt-2 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-1">
          {/* Left icons */}
          <div className="flex items-center gap-1">
            {showSuggestions && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSuggestionsOpen((v) => !v)}
                className={cn(
                  "h-8 w-8 rounded-lg transition-colors",
                  suggestionsOpen
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title="Suggestions"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            )}

            <QuickTemplates onSelectTemplate={(template) => {
              if (onTemplateSelect) {
                onTemplateSelect(template);
              } else {
                setInput(template);
              }
            }} />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 10 || isLoading || disabled}
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
              title="Attach files"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={files.length >= 10 || isLoading || disabled}
              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
              title="Attach images"
            >
              <Image className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              disabled={isLoading || disabled || !voiceSupported}
              className={cn(
                "h-8 w-8 rounded-lg transition-colors",
                voiceState === 'listening' && "text-destructive bg-destructive/10",
                voiceState === 'processing' && "text-amber-500 bg-amber-500/10",
                voiceState === 'speaking' && "text-primary bg-primary/10",
                voiceState === 'idle' && "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
              title="Voice input"
            >
              {voiceState === 'listening' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>

          {/* Right - File count if any */}
          {files.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {files.length}/10 files
            </span>
          )}
        </div>

        {/* Suggestions Popup */}
        <AnimatePresence>
          {showSuggestions && suggestionsOpen && !isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 overflow-hidden"
            >
              <div className="p-2 rounded-xl border border-border bg-card/50">
                <div className="grid grid-cols-2 gap-1.5">
                  {compactSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => {
                        if (onTemplateSelect) {
                          onTemplateSelect(suggestion.text);
                        } else {
                          setInput(suggestion.text);
                        }
                        setSuggestionsOpen(false);
                        requestAnimationFrame(() => textareaRef.current?.focus());
                      }}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left",
                        "hover:bg-primary/10 border border-transparent hover:border-primary/30",
                        "text-xs text-muted-foreground hover:text-primary transition-all"
                      )}
                    >
                      <suggestion.icon className="h-3.5 w-3.5" />
                      <span className="truncate">{suggestion.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Clean Input Bar */}
      <div className="px-2 pb-2 max-w-3xl mx-auto">
        <div 
          className="flex items-center gap-2 bg-muted/20 rounded-xl border border-border px-3 py-1.5 transition-all duration-200"
          style={{
            borderColor: isFocused ? 'hsl(var(--primary) / 0.5)' : undefined,
            boxShadow: isFocused ? '0 0 0 2px hsl(var(--primary) / 0.1)' : undefined
          }}
        >
          {/* Voice state overlay */}
          {voiceState !== 'idle' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className={cn(
                  "w-2 h-2 rounded-full",
                  voiceState === 'listening' && "bg-destructive",
                  voiceState === 'processing' && "bg-amber-500",
                  voiceState === 'speaking' && "bg-primary"
                )}
              />
              <span>
                {voiceState === 'listening' && (transcript || "Listening...")}
                {voiceState === 'processing' && "Processing..."}
                {voiceState === 'speaking' && "Speaking..."}
              </span>
            </div>
          )}

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message AI..."
            disabled={isLoading || disabled || voiceState !== 'idle'}
            className={cn(
              'flex-1 min-h-[32px] max-h-[80px] resize-none border-0 bg-transparent px-0 py-1',
              'text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0',
              voiceState !== 'idle' && 'hidden'
            )}
            rows={1}
          />

          {/* Send Button */}
          <Button
            type="button"
            onClick={handleSend}
            disabled={!hasContent || isLoading || disabled}
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 rounded-lg transition-all',
              hasContent
                ? 'bg-gradient-to-br from-primary to-orange-500 text-primary-foreground shadow-md' 
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" 
              />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
