"use client";

import { useState } from "react";
import { Bot, Sparkles, X, RotateCcw, Send, Loader2, MessageSquareText } from "lucide-react";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { cn } from "@/lib/utils";
import TextareaAutosize from 'react-textarea-autosize';

const SUGGESTIONS = [
  "Tư vấn son màu đỏ gạch dưới 200k",
  "Tìm tai nghe bluetooth pin trâu",
  "Chính sách bảo hành sản phẩm?",
  "Đề xuất đồ gia dụng bán chạy"
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isStreaming, currentStatus, sendMessage, clearChat } = useAIChatStream();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleSuggestionClick = (text: string) => {
    sendMessage(text);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-soft transition-all duration-300 hover:scale-105 active:scale-95 group"
        aria-label={isOpen ? "Thu hồi Trợ Lý AI" : "Mở Trợ Lý AI"}
      >
        {isOpen ? (
          <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
        ) : (
          <MessageSquareText className="h-6 w-6 transition-transform group-hover:scale-110" />
        )}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-canvas"></span>
        </span>
      </button>

      {/* Chat Dialog Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 grid grid-rows-[auto_1fr_auto] h-[520px] w-[340px] sm:w-[380px] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between bg-emerald-600 px-4 py-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-panel bg-white/20">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm leading-none flex items-center gap-1.5">
                  Shepoo AI
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                </h3>
                <p className="text-[11px] text-emerald-100 mt-1">Trợ lý tư vấn bán hàng</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="rounded-panel p-1.5 hover:bg-emerald-500/50 text-emerald-100 hover:text-white transition-colors"
                title="Làm mới cuộc trò chuyện"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-panel p-1.5 hover:bg-emerald-500/50 text-emerald-100 hover:text-white transition-colors"
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body Messages or Empty Suggestions */}
          {messages.length === 0 ? (
            <div className="min-h-0 overflow-y-auto flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div>
                <h4 className="font-bold text-ink text-base">Xin chào! 👋</h4>
                <p className="text-xs text-muted mt-1 max-w-[260px]">
                  Tôi có thể giúp bạn tìm sản phẩm, kiểm tra tồn kho & tư vấn mua sắm.
                </p>
              </div>
              <div className="w-full space-y-2 pt-2">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => handleSuggestionClick(sug)}
                    className="w-full text-left text-xs p-3 rounded-panel border border-line bg-white hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-ink transition-all font-medium flex items-center gap-2"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              currentStatus={currentStatus}
            />
          )}

          {/* Input Footer */}
          <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4 bg-slate-100 rounded-b-2xl flex gap-3 items-end">
            <TextareaAutosize
              minRows={1}
              maxRows={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 min-h-[44px] rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/60 transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-sm resize-none no-scrollbar"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm",
                (!input.trim() || isStreaming)
                  ? "bg-slate-200 text-slate-400 pointer-events-none"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 active:scale-95"
              )}
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5 -ml-0.5" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
