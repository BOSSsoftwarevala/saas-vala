import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, Sparkles, Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, FileCode, FileArchive, File, Image } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export interface FileAttachment {
  name: string;
  size: number;
  type: 'image' | 'code' | 'archive' | 'other';
  preview?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: FileAttachment[];
}

interface ChatMessageProps {
  message: Message;
  index?: number;
}

const getFileIcon = (type: FileAttachment['type']) => {
  switch (type) {
    case 'image': return Image;
    case 'code': return FileCode;
    case 'archive': return FileArchive;
    default: return File;
  }
};

export function ChatMessage({ message, index = 0 }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Enhanced markdown rendering for code blocks
  const renderContent = (content: string) => {
    if (!content) return null;
    
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, partIndex) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const lines = code.split('\n');
        const language = lines[0]?.trim() || '';
        const codeContent = language ? lines.slice(1).join('\n') : code;
        
        return (
          <motion.div 
            key={partIndex} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="my-4 rounded-xl overflow-hidden bg-background/80 border border-border group"
          >
            {language && (
              <div className="px-4 py-2.5 bg-muted/50 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-3.5 w-3.5" />
                  <span className="font-medium">{language}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(codeContent);
                    toast.success('Code copied');
                  }}
                  className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  Copy
                </Button>
              </div>
            )}
            <pre className="p-4 overflow-x-auto">
              <code className="text-sm font-mono text-foreground leading-relaxed">{codeContent}</code>
            </pre>
          </motion.div>
        );
      }
      
      // Handle inline code and bold text
      const formattedParts = part.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
      return (
        <span key={partIndex}>
          {formattedParts.map((inline, i) => {
            if (inline.startsWith('`') && inline.endsWith('`')) {
              return (
                <code 
                  key={i} 
                  className="px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/10 text-sm font-mono text-primary border border-primary/20"
                >
                  {inline.slice(1, -1)}
                </code>
              );
            }
            if (inline.startsWith('**') && inline.endsWith('**')) {
              return (
                <strong key={i} className="font-semibold text-foreground">
                  {inline.slice(2, -2)}
                </strong>
              );
            }
            return inline;
          })}
        </span>
      );
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: Math.min(index * 0.05, 0.3),
        ease: [0.16, 1, 0.3, 1]
      }}
      className={cn(
        'group py-6 px-4 md:px-6 transition-colors duration-300',
        isUser ? 'bg-transparent' : 'bg-muted/10'
      )}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
        >
          <Avatar className={cn(
            "h-9 w-9 shrink-0 mt-0.5 ring-2 ring-offset-2 ring-offset-background transition-all duration-300",
            isUser 
              ? "ring-secondary/30 hover:ring-secondary/50" 
              : "ring-primary/30 hover:ring-primary/50"
          )}>
            <AvatarFallback
              className={cn(
                'text-sm font-medium',
                isUser
                  ? 'bg-gradient-to-br from-secondary/20 to-cyan-500/20 text-secondary'
                  : 'bg-gradient-to-br from-primary/20 to-orange-500/20 text-primary'
              )}
            >
              {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-semibold",
              isUser ? "text-secondary" : "text-primary"
            )}>
              {isUser ? 'You' : 'SaaS VALA AI'}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                GPT-5
              </span>
            )}
          </div>

          {/* File Attachments */}
          {message.files && message.files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {message.files.map((file, fileIndex) => (
                <motion.div
                  key={fileIndex}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: fileIndex * 0.1 }}
                  className="flex items-center gap-2.5 bg-muted/50 hover:bg-muted/70 border border-border hover:border-primary/30 rounded-xl p-2.5 max-w-[220px] transition-all duration-200 group/file cursor-pointer"
                >
                  {file.type === 'image' && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-12 w-12 rounded-lg object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0 group-hover/file:from-primary/10 group-hover/file:to-primary/5 transition-colors">
                      {(() => {
                        const Icon = getFileIcon(file.type);
                        return <Icon className="h-5 w-5 text-muted-foreground group-hover/file:text-primary transition-colors" />;
                      })()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate group-hover/file:text-primary transition-colors">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Message Content */}
          {message.content && (
            <div className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {renderContent(message.content)}
            </div>
          )}

          {/* Actions - Only for assistant messages */}
          {!isUser && message.content && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-1 pt-3 opacity-0 group-hover:opacity-100 transition-all duration-300"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLiked(true)}
                className={cn(
                  "h-8 px-2.5 rounded-lg transition-all",
                  liked === true 
                    ? "text-success bg-success/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLiked(false)}
                className={cn(
                  "h-8 px-2.5 rounded-lg transition-all",
                  liked === false 
                    ? "text-destructive bg-destructive/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
