"use client";

import { useState, useRef, useEffect } from "react";
import { Send, UserCircle2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/helpers";
import TextareaAutosize from 'react-textarea-autosize';
import { useParams } from "next/navigation";
import { useSupporterChat } from "@/hooks/useSupporterChat";

export default function SupporterChatDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isConnected, sendMessage } = useSupporterChat(id, 'SUPPORTER');

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeout);
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && isConnected) {
      sendMessage(input);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-slate-50">
        <Link href="/supporter/conversations">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            Hội thoại: <span className="text-slate-500 font-mono text-sm">{id ? id.split("-")[0] : ""}...</span>
          </h2>
          <p className="text-xs text-indigo-600 font-medium">
            {isConnected ? "Đã kết nối" : "Đang kết nối..."}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.sender_type === "SUPPORTER" ? "justify-end" : "justify-start")}>
            {msg.sender_type === "CUSTOMER" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mr-3 shadow-xs">
                <UserCircle2 className="h-5 w-5" />
              </div>
            )}
            <div
              className={cn(
                "px-4 py-3 rounded-2xl max-w-[70%] text-sm leading-relaxed shadow-sm break-words",
                msg.sender_type === "SUPPORTER"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-slate-100 text-slate-800 rounded-tl-sm"
              )}
            >
              <p>{msg.content}</p>
              <p className={cn("mt-1 text-[10px] font-semibold text-right", msg.sender_type === "SUPPORTER" ? "text-indigo-200" : "text-slate-400")}>
                {formatDate(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-50 border-t">
        <form onSubmit={handleSend} className="flex gap-3 items-end">
          <TextareaAutosize
            minRows={1}
            maxRows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Nhập câu trả lời cho khách hàng..."
            className="flex-1 min-h-[50px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 resize-none no-scrollbar focus:outline-none"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!input.trim() || !isConnected}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm",
              (!input.trim() || !isConnected)
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105"
            )}
          >
            {!isConnected ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
