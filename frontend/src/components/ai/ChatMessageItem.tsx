"use client";

import { memo, useMemo } from "react";
import { Bot, User, AlertTriangle, RotateCcw } from "lucide-react";
import { AIChatMessage } from "@/services/aiChatService";
import { ProductCardInChat } from "./ProductCardInChat";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/helpers";

function formatMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-600 font-mono text-xs border border-emerald-100'>$1</code>")
    .replace(/\n/g, "<br/>");
}

function ChatMessageItemInner({
  message,
  isStreaming,
  onRetry,
}: {
  message: AIChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
}) {
  const isAssistant = message.role === "assistant";
  const hasContent = Boolean(message.content && message.content.trim().length > 0);
  const hasProducts = Boolean(message.products && message.products.length > 0);
  const html = useMemo(
    () => (isAssistant && hasContent && !message.isError ? formatMarkdown(message.content) : ""),
    [isAssistant, hasContent, message.isError, message.content]
  );

  // If assistant response has no text yet (streaming or background pending), show thinking state
  const shouldRenderTextBubble = hasContent || !isAssistant || !hasProducts || Boolean(message.isError);

  return (
    <div className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
      {isAssistant && (
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm mt-1",
          message.isError ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
        )}>
          {message.isError ? <AlertTriangle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      )}

      <div className="space-y-3 max-w-[calc(85%-10px)] sm:max-w-[calc(78%-10px)]">
        {shouldRenderTextBubble && (
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm break-words",
              message.role === "user"
                ? "bg-emerald-600 text-white rounded-tr-sm border-transparent"
                : message.isError
                ? "bg-rose-50/70 text-rose-900 border border-rose-200/80 rounded-tl-sm"
                : "bg-white text-ink border border-slate-200 rounded-tl-sm"
            )}
            title={message.createdAt ? formatDate(message.createdAt) : undefined}
          >
            {isAssistant ? (
              message.isError ? (
                <div className="flex items-start gap-2.5 text-xs text-rose-900">
                  <div className="space-y-2 flex-1 min-w-0">
                    <p className="leading-relaxed font-medium">{message.content}</p>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100/90 hover:bg-rose-200 text-rose-700 font-bold text-[11px] transition-colors border border-rose-200 shadow-2xs cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Thử lại</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : hasContent ? (
                <div
                  className="prose prose-sm prose-p:leading-relaxed prose-strong:text-ink max-w-none text-ink"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <span className="text-slate-400 italic text-xs flex items-center gap-2 font-medium">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Đang suy nghĩ...
                </span>
              )
            ) : (
              <span>{message.content}</span>
            )}

            {isStreaming && hasContent && (
              <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-emerald-500 animate-pulse" />
            )}
          </div>
        )}

        {/* Embedded Interactive Product Cards */}
        {hasProducts && (
          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
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

export const ChatMessageItem = memo(ChatMessageItemInner);
