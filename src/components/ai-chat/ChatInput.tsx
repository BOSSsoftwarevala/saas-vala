import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Image, Sparkles, X, FileCode, FileArchive, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, acceptType: 'all' | 'image') => {
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
    'Upload source code',
    'Analyze my project',
    'Deploy to server',
    'Add payment addon'
  ];

  return (
    <div className="border-t border-border bg-background">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".zip,.rar,.7z,.tar,.gz,.js,.ts,.tsx,.jsx,.py,.php,.html,.css,.json,.xml,.md,.txt,.pdf,.doc,.docx"
        onChange={(e) => handleFileSelect(e, 'all')}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => handleFileSelect(e, 'image')}
        className="hidden"
      />

      {/* Quick Suggestions */}
      {!input && files.length === 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2 max-w-3xl mx-auto">
          {quickSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* File Previews */}
      {files.length > 0 && (
        <div className="px-4 pt-3 max-w-3xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {files.map((uploadedFile, index) => (
              <div
                key={index}
                className="relative group flex items-center gap-2 bg-muted/50 border border-border rounded-lg p-2 pr-8"
              >
                {uploadedFile.type === 'image' && uploadedFile.preview ? (
                  <img
                    src={uploadedFile.preview}
                    alt={uploadedFile.file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    {(() => {
                      const Icon = getFileIcon(uploadedFile.type);
                      return <Icon className="h-5 w-5 text-muted-foreground" />;
                    })()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate max-w-[120px]">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(uploadedFile.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
          <Badge variant="outline" className="mt-2 text-[10px]">
            {files.length}/10 files
          </Badge>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-muted/30 rounded-2xl border border-border p-2 focus-within:border-primary/50 focus-within:bg-muted/50 transition-all">
          {/* Attachment Buttons */}
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={files.length >= 10 || isLoading || disabled}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground rounded-xl"
              title="Attach files (ZIP, code, documents)"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={files.length >= 10 || isLoading || disabled}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground rounded-xl"
              title="Attach images"
            >
              <Image className="h-5 w-5" />
            </Button>
          </div>

          {/* Text Input */}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message SaaS VALA AI..."
            disabled={isLoading || disabled}
            className={cn(
              'flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent px-2 py-2.5',
              'text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0'
            )}
            rows={1}
          />

          {/* Send Button */}
          <Button
            type="button"
            onClick={handleSend}
            disabled={(!input.trim() && files.length === 0) || isLoading || disabled}
            size="icon"
            className={cn(
              'h-10 w-10 shrink-0 rounded-xl transition-all duration-200',
              (input.trim() || files.length > 0)
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25' 
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="text-xs text-muted-foreground">
            SaaS VALA AI may produce inaccurate information. <span className="text-primary font-medium">Powered by SoftwareVala™</span>
          </p>
        </div>
      </div>
    </div>
  );
}
