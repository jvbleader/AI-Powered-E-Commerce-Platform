"use client";

import { useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottomInstant = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    } else if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  useEffect(() => {
    scrollToBottomInstant();
    const frameId = requestAnimationFrame(scrollToBottomInstant);
    return () => cancelAnimationFrame(frameId);
  }, [messages, currentStatus]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[460px] no-scrollbar">
      {messages.map((msg, idx) => (
        <ChatMessageItem
          key={msg.id || idx}
          message={msg}
          isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
        />
      ))}

      {currentStatus && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 p-3 text-xs text-emerald-800 animate-fade-in max-w-[80%]">
          <Sparkles className="h-4 w-4 text-emerald-600 animate-spin" />
          <span className="font-medium">{currentStatus}</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
