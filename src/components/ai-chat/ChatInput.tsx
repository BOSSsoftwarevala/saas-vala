import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Image, Sparkles, X, FileCode, FileArchive, File, Mic, MicOff, Volume2, Code, Shield, Server, Wrench, ArrowRight } from 'lucide-react';
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
    
    // File size limits - increased for large projects
    const getMaxSize = (file: File): number => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'apk'];
      const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'php', 'html', 'css', 'json', 'xml', 'sql', 'java', 'kt', 'swift', 'go', 'rs', 'c', 'cpp', 'h', 'hpp'];
      // 500MB for archives/APK, 200MB for code, 100MB for others
      if (archiveExts.includes(ext)) return 500 * 1024 * 1024;
      if (codeExts.includes(ext)) return 200 * 1024 * 1024;
      return 100 * 1024 * 1024;
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

      {/* Input Area with stacked buttons */}
      <div className="p-2 max-w-3xl mx-auto">
        <motion.div 
          animate={{ 
            borderColor: isFocused ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--border))',
            boxShadow: isFocused 
              ? '0 0 0 2px hsl(var(--primary) / 0.1), 0 8px 32px -8px hsl(var(--primary) / 0.2)' 
              : '0 0 0 0px transparent'
          }}
          className="relative flex items-end gap-2 bg-muted/20 rounded-2xl border border-border p-2 transition-all duration-300"
        >
          {/* Suggestions popup (opens only when pin is clicked) */}
          <AnimatePresence>
            {showSuggestions && suggestionsOpen && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "absolute left-2 bottom-full mb-2 z-20",
                  "w-[min(520px,calc(100%-16px))]",
                  "rounded-2xl border border-border bg-background/95 backdrop-blur-sm",
                  "shadow-lg"
                )}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Suggested next steps</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          "group flex items-center gap-2 px-3 py-2 rounded-xl text-left",
                          "bg-card/50 hover:bg-primary/10 border border-border hover:border-primary/30",
                          "text-sm text-foreground/85 hover:text-primary transition-all"
                        )}
                      >
                        <div className="h-7 w-7 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center">
                          <suggestion.icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="flex-1 truncate">{suggestion.text}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stacked pins: Suggest + Templates */}
          <div className="flex flex-col gap-0.5">
            {showSuggestions && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSuggestionsOpen((v) => !v)}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-xl transition-colors",
                    suggestionsOpen
                      ? "text-primary bg-primary/10 hover:bg-primary/20"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  )}
                  title="Suggested next steps"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              </motion.div>
            )}

            <QuickTemplates onSelectTemplate={(template) => {
              if (onTemplateSelect) {
                onTemplateSelect(template);
              } else {
                setInput(template);
              }
            }} />
          </div>

          {/* Attachment buttons */}
          <div className="flex gap-0.5">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= 10 || isLoading || disabled}
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                title="Attach files (ZIP, code, documents)"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => imageInputRef.current?.click()}
                disabled={files.length >= 10 || isLoading || disabled}
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                title="Attach images"
              >
                <Image className="h-5 w-5" />
              </Button>
            </motion.div>
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            {voiceState !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-10"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={cn(
                      "w-3 h-3 rounded-full",
                      voiceState === 'listening' && "bg-destructive",
                      voiceState === 'processing' && "bg-amber-500",
                      voiceState === 'speaking' && "bg-primary"
                    )}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {voiceState === 'listening' && (transcript || "🎤 Listening... Speak now!")}
                    {voiceState === 'processing' && "🤖 Processing your request..."}
                    {voiceState === 'speaking' && "🔊 AI is speaking..."}
                  </span>
                </div>
              </motion.div>
            )}
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
                'flex-1 min-h-[36px] max-h-[80px] resize-none border-0 bg-transparent px-2 py-2',
                'text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0'
              )}
              rows={1}
            />
          </div>

          {/* Voice & Send Buttons */}
          <div className="flex gap-1">
            {/* Voice Input Button */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              animate={voiceState !== 'idle' ? { scale: [1, 1.1, 1] } : {}}
              transition={voiceState !== 'idle' ? { duration: 1, repeat: Infinity } : {}}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleVoice}
                disabled={isLoading || disabled || !voiceSupported}
                className={cn(
                  "h-9 w-9 shrink-0 rounded-xl transition-all duration-300",
                  voiceState === 'listening' && "bg-destructive/20 text-destructive hover:bg-destructive/30 ring-2 ring-destructive/50 ring-offset-2 ring-offset-background",
                  voiceState === 'processing' && "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 ring-2 ring-amber-500/50",
                  voiceState === 'speaking' && "bg-primary/20 text-primary hover:bg-primary/30 ring-2 ring-primary/50",
                  voiceState === 'idle' && "text-muted-foreground hover:text-primary hover:bg-primary/10"
                )}
                title={
                  voiceState === 'idle' ? "🎤 Voice mode - speak to AI" :
                  voiceState === 'listening' ? "Listening... (click to stop)" :
                  voiceState === 'processing' ? "Processing..." :
                  "AI is speaking... (click to stop)"
                }
              >
                {voiceState === 'listening' ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <MicOff className="h-5 w-5" />
                  </motion.div>
                ) : voiceState === 'speaking' ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                  >
                    <Volume2 className="h-5 w-5" />
                  </motion.div>
                ) : voiceState === 'processing' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 border-2 border-current border-t-transparent rounded-full"
                  />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
            </motion.div>
            
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              animate={hasContent ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Button
                type="button"
                onClick={handleSend}
                disabled={!hasContent || isLoading || disabled}
                size="icon"
                className={cn(
                  'h-10 w-10 shrink-0 rounded-xl transition-all duration-300',
                  hasContent
                    ? 'bg-gradient-to-br from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-primary-foreground shadow-lg shadow-primary/30' 
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {isLoading ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-5 w-5 border-2 border-current border-t-transparent rounded-full" 
                  />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
