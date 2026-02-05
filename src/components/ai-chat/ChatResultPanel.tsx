import { FileText } from "lucide-react";
import { ChatMessage, type Message } from "@/components/ai-chat/ChatMessage";

interface ChatResultPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSuggestionClick: (suggestion: string) => void;
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
              {hasUserMessage
                ? "Left sidebar me message bhejo — output yahan update hoga."
                : "Left sidebar me chat start karo."
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Result</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {isLoading
              ? "Generating…"
              : lastAssistant.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <ChatMessage message={lastAssistant} index={0} />
      </div>
    </div>
  );
}

