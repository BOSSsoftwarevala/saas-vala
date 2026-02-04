import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, Sparkles, Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, FileCode, FileArchive, File, Image } from 'lucide-react';
import { toast } from 'sonner';

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
}

const getFileIcon = (type: FileAttachment['type']) => {
  switch (type) {
    case 'image': return Image;
    case 'code': return FileCode;
    case 'archive': return FileArchive;
    default: return File;
  }
};

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown-like rendering for code blocks
  const renderContent = (content: string) => {
    if (!content) return null;
    
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3);
        const lines = code.split('\n');
        const language = lines[0]?.trim() || '';
        const codeContent = language ? lines.slice(1).join('\n') : code;
        
        return (
          <div key={index} className="my-4 rounded-xl overflow-hidden bg-background border border-border">
            {language && (
              <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
                <span>{language}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(codeContent);
                    toast.success('Code copied');
                  }}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            )}
            <pre className="p-4 overflow-x-auto">
              <code className="text-sm font-mono text-foreground">{codeContent}</code>
            </pre>
          </div>
        );
      }
      
      // Handle inline code
      const inlineCodeParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={index}>
          {inlineCodeParts.map((inline, i) => {
            if (inline.startsWith('`') && inline.endsWith('`')) {
              return (
                <code 
                  key={i} 
                  className="px-1.5 py-0.5 rounded-md bg-muted text-sm font-mono text-primary"
                >
                  {inline.slice(1, -1)}
                </code>
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
    <div
      className={cn(
        'group py-6 px-4 md:px-6',
        isUser ? 'bg-transparent' : 'bg-muted/20'
      )}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          <AvatarFallback
            className={cn(
              'text-sm',
              isUser
                ? 'bg-secondary/20 text-secondary'
                : 'bg-primary/20 text-primary'
            )}
          >
            {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {isUser ? 'You' : 'SaaS VALA AI'}
            </span>
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* File Attachments */}
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg p-2 max-w-[200px]"
                >
                  {file.type === 'image' && file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                      {(() => {
                        const Icon = getFileIcon(file.type);
                        return <Icon className="h-5 w-5 text-muted-foreground" />;
                      })()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message Content */}
          {message.content && (
            <div className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
              {renderContent(message.content)}
            </div>
          )}

          {/* Actions - Only for assistant messages */}
          {!isUser && message.content && (
            <div className="flex items-center gap-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
