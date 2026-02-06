import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, Sparkles, Copy, Check, RotateCcw, FileCode, FileArchive, File, Image, Pin } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
 import ReactMarkdown from 'react-markdown';
 import remarkGfm from 'remark-gfm';
import { MessageReactions } from './MessageReactions';

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
  isPinned?: boolean;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
}

const getFileIcon = (type: FileAttachment['type']) => {
  switch (type) {
    case 'image': return Image;
    case 'code': return FileCode;
    case 'archive': return FileArchive;
    default: return File;
  }
};

export function ChatMessage({ message, index = 0, isPinned, onPin, onUnpin }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
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

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-foreground mt-4 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-primary mt-3 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-foreground mt-2 mb-1">{children}</h4>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed">{children}</p>
          ),
          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-foreground/90">{children}</em>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2 ml-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 ml-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground/90">{children}</li>
          ),
          // Code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;
            
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/10 text-sm font-mono text-primary border border-primary/20">
                  {children}
                </code>
              );
            }
            
            const language = match ? match[1] : '';
            const codeContent = String(children).replace(/\n$/, '');
            
            return (
              <motion.div 
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
          },
          // Pre (wrapper for code blocks)
          pre: ({ children }) => <>{children}</>,
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-foreground/80">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-4 border-border/50" />
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-border rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-foreground/90">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
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
        'group py-6 px-4 md:px-6 transition-colors duration-300 relative',
        isUser ? 'bg-transparent' : 'bg-muted/10',
        isPinned && 'bg-primary/5 border-l-2 border-primary'
      )}
    >
      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute top-2 right-4 flex items-center gap-1 text-xs text-primary">
          <Pin className="h-3 w-3 fill-primary" />
          <span>Pinned</span>
        </div>
      )}
      
      <div className="max-w-3xl mx-auto">
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header - Name first, then icon */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-semibold",
              isUser ? "text-secondary" : "text-primary"
            )}>
              {isUser ? 'You' : 'VALA AI'}
            </span>
            {/* Small icon AFTER name */}
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
              isUser 
                ? "bg-secondary/20 text-secondary" 
                : "bg-primary/20 text-primary"
            )}>
              {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            </div>
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
            <div className="text-[15px] text-foreground/90 leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-primary prose-a:text-primary">
              {renderContent(message.content)}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
