"use client";

import { useState } from "react";
import { Bot, Sparkles, X, RotateCcw, Send, Loader2 } from "lucide-react";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95 group"
        aria-label={isOpen ? "Thu hồi Trợ Lý AI" : "Mở Trợ Lý AI"}
      >
        {isOpen ? (
          <X className="h-7 w-7 transition-transform group-hover:rotate-90" />
        ) : (
          <Sparkles className="h-7 w-7 transition-transform group-hover:rotate-12" />
        )}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
        </span>
      </button>

      {/* Chat Dialog Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[580px] w-[380px] sm:w-[420px] flex-col overflow-hidden rounded-3xl border border-emerald-100 bg-white/95 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none flex items-center gap-1.5">
                  Shepoo AI Assistant
                  <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                </h3>
                <p className="text-[11px] text-emerald-100 mt-1">Trợ lý tư vấn bán hàng</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="rounded-lg p-1.5 hover:bg-white/20 text-emerald-100 hover:text-white transition-colors"
                title="Làm mới cuộc trò chuyện"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 hover:bg-white/20 text-emerald-100 hover:text-white transition-colors"
                title="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body Messages or Empty Suggestions */}
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="h-16 w-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                <Sparkles className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-base">Xin chào! 👋</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
                  Tôi có thể giúp bạn tìm sản phẩm, kiểm tra tồn kho & tư vấn mua sắm.
                </p>
              </div>
              <div className="w-full space-y-2 pt-2">
                {SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => handleSuggestionClick(sug)}
                    className="w-full text-left text-xs p-2.5 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-emerald-50 hover:border-emerald-200 text-slate-700 transition-all font-medium"
                  >
                    💡 {sug}
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
          <form onSubmit={handleSubmit} className="border-t border-slate-100 p-3 bg-white flex gap-2 items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi của bạn..."
              className="flex-1 text-xs rounded-full border-slate-200 py-5 pl-4 focus-visible:ring-emerald-500"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="rounded-full h-10 w-10 p-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 min-h-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
