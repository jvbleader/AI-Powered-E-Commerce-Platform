"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";
import { AIChatMessage, AICitationItem } from "@/services/aiChatService";
import { ChatMessageItem } from "./ChatMessageItem";

function ChatMessageListInner({
  messages,
  isStreaming,
  currentStatus,
  onRetry,
  onOpenCitation,
}: {
  messages: AIChatMessage[];
  isStreaming?: boolean;
  currentStatus?: string | null;
  onRetry?: () => void;
  onOpenCitation?: (citation: AICitationItem) => void;
}) {
  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => (
        <ChatMessageItem
          key={msg.id || idx}
          message={msg}
          isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
          onRetry={idx === messages.length - 1 ? onRetry : undefined}
          onOpenCitation={onOpenCitation}
        />
      ))}

      {currentStatus && (
        <div className="flex items-center gap-2.5 rounded-panel bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-600 animate-fade-in max-w-[80%]">
          <Sparkles className="h-4 w-4 text-emerald-500 animate-spin" />
          <span className="font-medium">{currentStatus}</span>
        </div>
      )}
    </div>
  );
}

export const ChatMessageList = memo(ChatMessageListInner);
