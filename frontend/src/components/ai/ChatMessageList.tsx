"use client";

import { Sparkles } from "lucide-react";
import { AIChatMessage } from "@/services/aiChatService";
import { ChatMessageItem } from "./ChatMessageItem";

export function ChatMessageList({
  messages,
  isStreaming,
  currentStatus
}: {
  messages: AIChatMessage[];
  isStreaming?: boolean;
  currentStatus?: string | null;
}) {
  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => (
        <ChatMessageItem
          key={msg.id || idx}
          message={msg}
          isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
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
