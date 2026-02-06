import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/components/ai-chat/ChatMessage";

interface ChatResultPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSuggestionClick: (suggestion: string) => void;
}

function ResultMarkdown({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="text-[15px] text-foreground/90 leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-code:text-primary prose-a:text-primary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold text-primary mt-3 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold text-foreground mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 ml-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 ml-2">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !className;

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/10 text-sm font-mono text-primary border border-primary/20">
                  {children}
                </code>
              );
            }

            const codeContent = String(children).replace(/\n$/, "");

            return (
              <div className="my-4 rounded-xl overflow-hidden bg-background/80 border border-border">
                <pre className="p-4 overflow-x-auto">
                  <code className="text-sm font-mono text-foreground leading-relaxed">{codeContent}</code>
                </pre>
              </div>
            );
          },
          pre: ({ children }) => <>{children}</>,
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
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-foreground/80">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border/50" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-border rounded-lg overflow-hidden">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 text-sm text-foreground/90">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatResultPanel({ messages, isLoading }: ChatResultPanelProps) {
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && (m.content || "").trim().length > 0);

  if (!lastAssistant) {
    const hasUserMessage = messages.some((m) => m.role === "user" && (m.content || "").trim().length > 0);

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Result yahin show hoga</p>
            <p className="text-xs text-muted-foreground">
              {hasUserMessage ? "Left sidebar me message bhejo — output yahan update hoga." : "Left sidebar me chat start karo."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-w-0">
      <div className="w-full min-w-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Result</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {isLoading ? "Generating…" : lastAssistant.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="px-4 py-6">
          <ResultMarkdown content={lastAssistant.content} />
        </div>
      </div>
    </div>
  );
}

