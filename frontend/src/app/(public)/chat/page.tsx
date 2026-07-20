"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, MessageSquare, Send, Sparkles, RefreshCcw, Loader2, Plus, UserCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { ChatMessage, streamChatMessage } from "@/services/chat-ai-api";
import { formatDate } from "@/lib/helpers";

const SUGGESTIONS = [
  "Tìm tai nghe chống ồn tốt nhất?",
  "Cách theo dõi đơn hàng?",
  "Chính sách đổi trả như nào?",
  "Gợi ý quà tặng dưới 500k",
];

type UI_Message = ChatMessage & { id: string; isStreaming?: boolean; createdAt?: string };

function formatMarkdown(text: string) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
  return html;
}

export default function ChatPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  
  const [activeTab, setActiveTab] = useState<"AI" | "SUPPORTER">("AI");
  const [messages, setMessages] = useState<UI_Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock Supporter Conversations from Store
  const supporterConversations = store.state.conversations.filter(c => c.mode === "SUPPORTER");
  const [activeConvId, setActiveConvId] = useState<string | null>(supporterConversations[0]?.id || null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(scrollToBottom, 10);
    return () => clearTimeout(timeout);
  }, [messages, isTyping, activeTab, activeConvId]);

  const handleSendAI = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: UI_Message = { id: Date.now().toString(), role: "user", content: text, createdAt: new Date().toISOString() };
    const currentHistory = [...messages, userMsg];
    setMessages(currentHistory);
    setInput("");
    setIsTyping(true);

    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: aiMsgId, role: "assistant", content: "", isStreaming: true, createdAt: new Date().toISOString() }]);

    const apiHistory = currentHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

    let streamedContent = "";

    await streamChatMessage(
      text,
      apiHistory.length > 0 ? apiHistory : undefined,
      (chunk) => {
        streamedContent += chunk;
        setMessages((prev) => 
          prev.map((msg) => msg.id === aiMsgId ? { ...msg, content: streamedContent } : msg)
        );
      },
      () => {
        setIsTyping(false);
        setMessages((prev) => prev.map((msg) => msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg));
      },
      (error) => {
        setIsTyping(false);
        showToast("Lỗi kết nối AI. Vui lòng thử lại.", "error");
        setMessages((prev) => prev.filter((msg) => msg.id !== aiMsgId));
      }
    );
  };

  const clearChat = () => {
    setMessages([]);
    showToast("Đã xóa cuộc trò chuyện AI", "success");
  };

  const activeConversation = supporterConversations.find(c => c.id === activeConvId);

  return (
    <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 py-4 font-body-tech h-full overflow-hidden">
      {/* Minimal Header for Chat Page */}
      <header className="flex items-center justify-between pb-4 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-tech font-bold transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Về trang chủ</span>
        </Link>
        <div className="font-tech font-bold text-xl text-slate-900 flex items-center gap-2">
          Shepoo <span className="text-emerald-600">Support</span>
        </div>
        <div className="w-[120px]"></div> {/* Spacer for centering */}
      </header>

      <div className="glass-panel-tech overflow-hidden rounded-3xl flex flex-col lg:flex-row flex-1 min-h-0 border border-white/40 shadow-2xl bg-white/70 backdrop-blur-xl">
        
        {/* Sidebar */}
        <div className="w-full lg:w-[320px] border-r border-emerald-900/10 bg-emerald-50/30 flex flex-col">
          <div className="p-4 border-b border-emerald-900/10">
            <h2 className="font-tech font-bold text-xl text-slate-900 mb-4">Hộp thư hỗ trợ</h2>
            <div className="flex bg-white/60 p-1 rounded-xl shadow-sm border border-white">
              <button 
                onClick={() => setActiveTab("AI")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                  activeTab === "AI" ? "bg-white shadow-sm text-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <Bot className="w-4 h-4" /> AI Assistant
              </button>
              <button 
                onClick={() => setActiveTab("SUPPORTER")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
                  activeTab === "SUPPORTER" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <MessageSquare className="w-4 h-4" /> Supporter
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
            {activeTab === "AI" ? (
              <button className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md text-left transition-transform hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-tech font-bold">Phiên chat hiện tại</p>
                    <p className="text-xs text-emerald-100 mt-0.5">Đang trực tuyến</p>
                  </div>
                </div>
              </button>
            ) : (
              supporterConversations.length > 0 ? (
                supporterConversations.map(conv => (
                  <button 
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={cn(
                      "w-full p-3 rounded-2xl text-left border transition-all",
                      activeConvId === conv.id 
                        ? "bg-white border-indigo-200 shadow-sm" 
                        : "bg-transparent border-transparent hover:bg-white/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", activeConvId === conv.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-500")}>
                        <UserCircle2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm text-slate-900 truncate">{conv.title}</p>
                        <p className="text-xs text-slate-500 truncate">{conv.status === 'OPEN' ? 'Đang xử lý' : 'Đã đóng'}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center p-6 text-sm text-slate-500">
                  Không có cuộc trò chuyện nào.
                </div>
              )
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white/40 relative">
          
          {activeTab === "AI" ? (
            <>
              {/* Header AI */}
              <div className="flex items-center justify-between p-4 border-b border-white/50 bg-white/30 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Bot className="h-6 w-6 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="font-tech font-bold text-lg text-slate-900 flex items-center gap-2">
                      Shepoo AI
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </h1>
                    <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Trợ lý mua sắm thông minh</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setActiveTab("SUPPORTER"); showToast("Đã gửi yêu cầu kết nối Supporter", "success"); }} className="text-indigo-600 bg-white hover:bg-indigo-50 border-indigo-100">
                    Gặp nhân viên
                  </Button>
                  <Button variant="ghost" size="icon" onClick={clearChat} className="text-slate-400 hover:text-emerald-600" title="Làm mới">
                    <RefreshCcw className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Messages AI */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 no-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-8 animate-fade-in-up">
                    <div className="text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 mb-6 shadow-inner text-emerald-600">
                        <Sparkles className="h-10 w-10 text-emerald-500" />
                      </div>
                      <h2 className="text-2xl font-bold font-tech text-slate-800">Xin chào! 👋</h2>
                      <p className="text-slate-500 mt-3 text-sm max-w-sm mx-auto leading-relaxed">
                        Tôi là AI thông minh của Shepoo. Bạn muốn tìm kiếm sản phẩm gì hôm nay?
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                      {SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          onClick={() => handleSendAI(sug)}
                          className="p-4 text-sm text-left rounded-2xl border border-white bg-white/60 hover:bg-white hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-slate-700 font-medium"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                        {msg.role === "assistant" && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mr-3 mt-1 shadow-sm">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "px-5 py-3.5 rounded-[24px] max-w-[85%] md:max-w-[75%] text-[15px] leading-relaxed shadow-sm backdrop-blur-sm border",
                            msg.role === "user"
                              ? "bg-slate-800 text-white rounded-tr-sm border-transparent"
                              : "bg-white/90 border-emerald-100 text-slate-800 rounded-tl-sm"
                          )}
                        >
                          {msg.role === "assistant" ? (
                            <div className="prose prose-sm prose-p:leading-relaxed prose-strong:text-emerald-900 max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                          ) : (
                            msg.content
                          )}
                          {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-emerald-500 animate-pulse" />}
                        </div>
                      </div>
                    ))}
                    {isTyping && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex justify-start">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mr-3 mt-1">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="px-5 py-5 rounded-[24px] bg-white/90 border border-emerald-100 rounded-tl-sm flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input AI */}
              <div className="p-4 bg-white/50 backdrop-blur-lg border-t border-white/50">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendAI(input); }}
                  className="flex items-center gap-2 relative max-w-4xl mx-auto"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nhập câu hỏi của bạn..."
                    className="flex-1 rounded-full pl-5 pr-14 py-7 border-white bg-white/80 shadow-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-500 text-base"
                    disabled={isTyping}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isTyping}
                    className="absolute right-2 rounded-full w-10 h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-transform hover:scale-105"
                  >
                    {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            // SUPPORTER TAB
            activeConversation ? (
              <>
                <div className="flex items-center justify-between p-4 border-b border-white/50 bg-white/30 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-sm">
                      <UserCircle2 className="h-7 w-7" />
                    </div>
                    <div>
                      <h1 className="font-tech font-bold text-lg text-slate-900 flex items-center gap-2">
                        {activeConversation.assignedSupporter || "Nhân viên hỗ trợ"}
                      </h1>
                      <p className="text-xs text-indigo-600 font-semibold">{activeConversation.status === 'OPEN' ? 'Đang online' : 'Offline'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 no-scrollbar">
                  {activeConversation.messages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
                      {msg.sender === "SUPPORTER" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mr-3 mt-1 shadow-sm">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "px-5 py-3.5 rounded-[24px] max-w-[85%] md:max-w-[75%] text-[15px] leading-relaxed shadow-sm backdrop-blur-sm border",
                          msg.sender === "CUSTOMER"
                            ? "bg-slate-900 text-white rounded-tr-sm border-transparent"
                            : "bg-white/80 border-indigo-100 text-slate-800 rounded-tl-sm"
                        )}
                      >
                        <p>{msg.text}</p>
                        <p className={cn("mt-1.5 text-[10px] uppercase tracking-wider font-semibold", msg.sender === "CUSTOMER" ? "text-slate-400" : "text-slate-400")}>
                          {formatDate(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-white/50 backdrop-blur-lg border-t border-white/50">
                  <form className="flex items-center gap-2 relative max-w-4xl mx-auto">
                    <Input
                      placeholder={activeConversation.status === 'CLOSED' ? "Cuộc trò chuyện đã đóng" : "Nhập tin nhắn..."}
                      className="flex-1 rounded-full pl-5 pr-14 py-7 border-white bg-white/80 shadow-sm focus-visible:ring-indigo-500 text-base"
                      disabled={activeConversation.status === 'CLOSED'}
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={activeConversation.status === 'CLOSED'}
                      className="absolute right-2 rounded-full w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-transform hover:scale-105"
                      onClick={() => showToast("Chức năng đang phát triển", "info")}
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                 <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-indigo-300">
                    <MessageSquare className="w-8 h-8" />
                 </div>
                 <p className="text-slate-500 font-medium">Chọn một phiên hỗ trợ để xem</p>
              </div>
            )
          )}
        </div>
      </div>
    </main>
  );
}
