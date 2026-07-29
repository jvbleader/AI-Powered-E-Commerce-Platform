"use client";

import { Bot, User } from "lucide-react";
import { AIChatMessage } from "@/services/aiChatService";
import { ProductCardInChat } from "./ProductCardInChat";
import { cn } from "@/lib/utils";

function formatMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-600 font-mono text-xs border border-emerald-100'>$1</code>")
    .replace(/\n/g, "<br/>");
}

export function ChatMessageItem({
  message,
  isStreaming
}: {
  message: AIChatMessage;
  isStreaming?: boolean;
}) {
  const isAssistant = message.role === "assistant";
  const hasContent = Boolean(message.content && message.content.trim().length > 0);
  const hasProducts = Boolean(message.products && message.products.length > 0);

  // If assistant response has no text yet but is streaming without products, show thinking state
  const shouldRenderTextBubble = hasContent || !isAssistant || (isStreaming && !hasProducts);

  return (
    <div className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm mt-1">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div className="space-y-3 max-w-[85%] sm:max-w-[78%]">
        {shouldRenderTextBubble && (
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words",
              message.role === "user"
                ? "bg-emerald-600 text-white rounded-tr-sm border-transparent"
                : "bg-white text-ink border border-slate-200 rounded-tl-sm"
            )}
          >
            {isAssistant ? (
              hasContent ? (
                <div
                  className="prose prose-sm prose-p:leading-relaxed prose-strong:text-ink max-w-none text-ink"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
                />
              ) : (
                <span className="text-muted italic text-xs flex items-center gap-1.5">
                  Đang suy nghĩ...
                </span>
              )
            ) : (
              <span>{message.content}</span>
            )}

            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-emerald-500 animate-pulse" />
            )}
          </div>
        )}

        {/* Embedded Interactive Product Cards */}
        {hasProducts && (
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
            {message.products!.map((prod) => (
              <ProductCardInChat key={prod.id} product={prod} />
            ))}
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100/50 text-emerald-700 mt-1">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
