import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Image, Sparkles, X, FileCode, FileArchive, File, Mic, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadedFile {
  file: File;
  preview?: string;
  type: 'image' | 'code' | 'archive' | 'other';
}

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void;
  isLoading: boolean;
  disabled?: boolean;
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

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    
    // Check file size limit (20MB)
    const maxSize = 20 * 1024 * 1024;
    const validFiles = selectedFiles.filter(file => {
      if (file.size > maxSize) {
        toast.error(`File too large: ${file.name}`, {
          description: 'Maximum file size is 20MB'
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

  const quickSuggestions = [
    { text: 'Upload source code', icon: FileCode },
    { text: 'Analyze my project', icon: Wand2 },
    { text: 'Deploy to server', icon: Sparkles },
    { text: 'Add payment addon', icon: Sparkles }
  ];

  const hasContent = input.trim() || files.length > 0;

  return (
    <div className="border-t border-border bg-gradient-to-t from-background via-background to-transparent">
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

      {/* Quick Suggestions */}
      <AnimatePresence>
        {!input && files.length === 0 && !isFocused && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 pt-4 flex flex-wrap gap-2 max-w-3xl mx-auto"
          >
            {quickSuggestions.map((suggestion, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setInput(suggestion.text)}
                className="group flex items-center gap-2 text-xs px-3 py-2 rounded-full bg-muted/30 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border hover:border-primary/30 transition-all duration-200"
              >
                <suggestion.icon className="h-3.5 w-3.5" />
                {suggestion.text}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pt-4 max-w-3xl mx-auto overflow-hidden"
          >
            <div className="flex flex-wrap gap-2">
              {files.map((uploadedFile, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group flex items-center gap-2.5 bg-muted/50 hover:bg-muted/70 border border-border hover:border-primary/30 rounded-xl p-2.5 pr-9 transition-all duration-200"
                >
                  {uploadedFile.type === 'image' && uploadedFile.preview ? (
                    <img
                      src={uploadedFile.preview}
                      alt={uploadedFile.file.name}
                      className="h-11 w-11 rounded-lg object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      {(() => {
                        const Icon = getFileIcon(uploadedFile.type);
                        return <Icon className="h-5 w-5 text-primary" />;
                      })()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate max-w-[130px]">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {(uploadedFile.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFile(index)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
            <Badge variant="outline" className="mt-3 text-[10px] bg-muted/30">
              {files.length}/10 files attached
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 max-w-3xl mx-auto">
        <motion.div 
          animate={{ 
            borderColor: isFocused ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--border))',
            boxShadow: isFocused 
              ? '0 0 0 2px hsl(var(--primary) / 0.1), 0 8px 32px -8px hsl(var(--primary) / 0.2)' 
              : '0 0 0 0px transparent'
          }}
          className="relative flex items-end gap-2 bg-muted/20 rounded-2xl border border-border p-2 transition-all duration-300"
        >
          {/* Attachment Buttons */}
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
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message SaaS VALA AI..."
            disabled={isLoading || disabled}
            className={cn(
              'flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-2 py-2.5',
              'text-base placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
            rows={1}
          />

          {/* Voice & Send Buttons */}
          <div className="flex gap-1">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isLoading || disabled}
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                title="Voice input (coming soon)"
              >
                <Mic className="h-5 w-5" />
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

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 mt-4"
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 border border-border">
            <Sparkles className="h-3 w-3 text-primary" />
            <p className="text-xs text-muted-foreground">
              Powered by <span className="text-primary font-semibold">SoftwareVala™</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
