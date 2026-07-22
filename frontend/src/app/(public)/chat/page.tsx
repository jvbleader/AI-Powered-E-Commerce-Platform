"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, MessageSquare, Send, Sparkles, RefreshCcw, Loader2, UserCircle2, ArrowLeft, Menu, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { ChatMessageItem } from "@/components/ai/ChatMessageItem";
import { formatDate } from "@/lib/helpers";

const SUGGESTIONS = [
  "Tìm tai nghe chống ồn tốt nhất?",
  "Cách theo dõi đơn hàng?",
  "Chính sách đổi trả như nào?",
  "Gợi ý quà tặng dưới 500k",
];

export default function ChatPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  
  const [activeTab, setActiveTab] = useState<"AI" | "SUPPORTER">("AI");
  const [input, setInput] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    currentStatus,
    isLoadingHistory,
    error,
    sendMessage,
    clearChat: clearAIChat
  } = useAIChatStream();

  // Mock Supporter Conversations from Store
  const supporterConversations = store.state.conversations.filter(c => c.mode === "SUPPORTER");
  const [activeConvId, setActiveConvId] = useState<string | null>(supporterConversations[0]?.id || null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeout);
  }, [messages, currentStatus, isStreaming, activeTab, activeConvId]);

  const handleSendAI = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  };

  const handleClearChat = () => {
    clearAIChat();
    showToast("Đã xóa cuộc trò chuyện AI", "success");
  };

  const activeConversation = supporterConversations.find(c => c.id === activeConvId);

  return (
    <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4 font-body-tech h-[calc(100vh-2rem)] overflow-hidden">
      {/* Minimal Header for Chat Page */}
      <header className="flex items-center justify-between pb-3 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-tech font-bold text-sm md:text-base transition-colors">
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          <span>Về trang chủ</span>
        </Link>
        <div className="font-tech font-bold text-lg md:text-xl text-slate-900 flex items-center gap-2">
          Shepoo <span className="text-emerald-600">Support</span>
        </div>
        <div className="w-[100px] hidden sm:block"></div> {/* Spacer for centering */}
      </header>

      <div className="glass-panel-tech overflow-hidden rounded-3xl flex flex-row flex-1 min-h-0 border border-white/60 shadow-xl bg-white/70 backdrop-blur-xl relative">
        
        {/* Sidebar */}
        <div 
          className={cn(
            "w-full md:w-[280px] lg:w-[320px] border-r border-emerald-900/10 bg-emerald-50/30 flex-col shrink-0 transition-all z-20 md:static absolute inset-0 md:flex",
            showMobileSidebar ? "flex bg-white/95" : "hidden md:flex"
          )}
        >
          <div className="p-4 border-b border-emerald-900/10 flex items-center justify-between">
            <h2 className="font-tech font-bold text-lg md:text-xl text-slate-900">Hộp thư hỗ trợ</h2>
            <button 
              onClick={() => setShowMobileSidebar(false)}
              className="md:hidden text-slate-500 hover:text-slate-800 text-sm font-semibold"
            >
              Đóng
            </button>
          </div>

          <div className="p-3 border-b border-emerald-900/10">
            <div className="flex bg-white/70 p-1 rounded-xl shadow-xs border border-white">
              <button 
                onClick={() => { setActiveTab("AI"); setShowMobileSidebar(false); }}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all",
                  activeTab === "AI" ? "bg-white shadow-xs text-emerald-700" : "text-slate-500 hover:bg-white/50"
                )}
              >
                <Bot className="w-4 h-4" /> AI Assistant
              </button>
              <button 
                onClick={() => { setActiveTab("SUPPORTER"); setShowMobileSidebar(false); }}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all",
                  activeTab === "SUPPORTER" ? "bg-white shadow-xs text-indigo-600" : "text-slate-500 hover:bg-white/50"
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
                    <p className="font-tech font-bold text-sm">Phiên chat hiện tại</p>
                    <p className="text-xs text-emerald-100 mt-0.5">Đang trực tuyến</p>
                  </div>
                </div>
              </button>
            ) : (
              supporterConversations.length > 0 ? (
                supporterConversations.map(conv => (
                  <button 
                    key={conv.id}
                    onClick={() => { setActiveConvId(conv.id); setShowMobileSidebar(false); }}
                    className={cn(
                      "w-full p-3 rounded-2xl text-left border transition-all",
                      activeConvId === conv.id 
                        ? "bg-white border-indigo-200 shadow-xs" 
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
        <div className="flex-1 flex flex-col bg-white/40 relative min-w-0">
          
          {activeTab === "AI" ? (
            <>
              {/* Header AI */}
              <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/50 bg-white/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                    className="md:hidden text-slate-600 hover:text-emerald-600"
                    title="Menu Hộp Thư"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>

                  <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xs">
                    <Bot className="h-5 w-5 md:h-6 md:h-6 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="font-tech font-bold text-base md:text-lg text-slate-900 flex items-center gap-1.5">
                      Shepoo AI
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </h1>
                    <p className="text-[10px] md:text-xs text-emerald-600 font-bold uppercase tracking-wider">Trợ lý mua sắm thông minh</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setActiveTab("SUPPORTER"); showToast("Đã chuyển sang Supporter", "info"); }} 
                    className="text-xs text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-50 shadow-xs"
                  >
                    Gặp nhân viên
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleClearChat} 
                    className="text-slate-500 hover:text-emerald-600 hover:bg-white/80" 
                    title="Xóa cuộc trò chuyện"
                  >
                    <RefreshCcw className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </div>
              </div>

              {/* Error Banner if any */}
              {error && (
                <div className="p-3 bg-rose-50/90 border-b border-rose-100 text-rose-700 text-xs font-medium flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                  <button onClick={handleClearChat} className="underline hover:text-rose-900 text-xs font-semibold">
                    Thử lại
                  </button>
                </div>
              )}

              {/* Messages AI */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 no-scrollbar">
                {isLoadingHistory ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <p className="text-sm text-slate-500 font-medium">Đang tải lịch sử trò chuyện...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-8 animate-fade-in-up py-8">
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-3xl bg-emerald-50 mb-5 shadow-inner text-emerald-600">
                        <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-emerald-500" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold font-tech text-slate-800">Xin chào! 👋</h2>
                      <p className="text-slate-500 mt-2 text-xs md:text-sm max-w-sm mx-auto leading-relaxed">
                        Tôi là AI thông minh của Shepoo. Bạn muốn tìm kiếm sản phẩm gì hôm nay?
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                      {SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          onClick={() => handleSendAI(sug)}
                          className="p-3.5 text-xs md:text-sm text-left rounded-2xl border border-white bg-white/70 hover:bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 text-slate-700 font-medium"
                        >
                          💡 {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((msg, idx) => (
                      <ChatMessageItem
                        key={msg.id || idx}
                        message={msg}
                        isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
                      />
                    ))}

                    {currentStatus && (
                      <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 p-3.5 text-xs md:text-sm text-emerald-800 animate-fade-in max-w-[80%] shadow-xs">
                        <Sparkles className="h-4 w-4 text-emerald-600 animate-spin shrink-0" />
                        <span className="font-medium">{currentStatus}</span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input AI */}
              <div className="p-3 md:p-4 bg-white/60 backdrop-blur-lg border-t border-white/60">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendAI(input); }}
                  className="flex items-center relative max-w-4xl mx-auto"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Nhập câu hỏi của bạn..."
                    className="w-full rounded-full pl-5 pr-12 py-5 md:py-6 border-emerald-100 bg-white/90 shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-500 text-sm md:text-base placeholder:text-slate-400"
                    disabled={isStreaming}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isStreaming}
                    className="absolute right-1.5 rounded-full w-9 h-9 md:w-10 md:h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs transition-all hover:scale-105 disabled:opacity-40"
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            // SUPPORTER TAB
            activeConversation ? (
              <>
                <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/50 bg-white/50 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                      className="md:hidden text-slate-600 hover:text-indigo-600"
                      title="Menu Hộp Thư"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                    <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-xs">
                      <UserCircle2 className="h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    <div>
                      <h1 className="font-tech font-bold text-base md:text-lg text-slate-900">
                        {activeConversation.assignedSupporter || "Nhân viên hỗ trợ"}
                      </h1>
                      <p className="text-[10px] md:text-xs text-indigo-600 font-bold">{activeConversation.status === 'OPEN' ? 'Đang online' : 'Offline'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 no-scrollbar">
                  {activeConversation.messages.map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
                      {msg.sender === "SUPPORTER" && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mr-2.5 mt-1 shadow-xs">
                          <UserCircle2 className="h-5 w-5" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[75%] text-sm leading-relaxed shadow-xs backdrop-blur-xs border",
                          msg.sender === "CUSTOMER"
                            ? "bg-slate-900 text-white rounded-tr-xs border-transparent"
                            : "bg-white border-indigo-100 text-slate-800 rounded-tl-xs"
                        )}
                      >
                        <p>{msg.text}</p>
                        <p className={cn("mt-1 text-[10px] font-semibold text-slate-400")}>
                          {formatDate(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 md:p-4 bg-white/60 backdrop-blur-lg border-t border-white/60">
                  <form className="flex items-center relative max-w-4xl mx-auto">
                    <Input
                      placeholder={activeConversation.status === 'CLOSED' ? "Cuộc trò chuyện đã đóng" : "Nhập tin nhắn..."}
                      className="w-full rounded-full pl-5 pr-12 py-5 md:py-6 border-indigo-100 bg-white/90 shadow-xs focus-visible:ring-2 focus-visible:ring-indigo-500 text-sm md:text-base placeholder:text-slate-400"
                      disabled={activeConversation.status === 'CLOSED'}
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={activeConversation.status === 'CLOSED'}
                      className="absolute right-1.5 rounded-full w-9 h-9 md:w-10 md:h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all hover:scale-105"
                      onClick={() => showToast("Chức năng đang phát triển", "info")}
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                 <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-3 text-indigo-400">
                    <MessageSquare className="w-8 h-8" />
                 </div>
                 <p className="text-slate-600 font-bold text-base">Hỗ trợ từ Nhân viên</p>
                 <p className="text-slate-400 text-xs mt-1 max-w-xs">Chọn một cuộc trò chuyện từ danh sách hoặc chuyển sang AI Assistant</p>
              </div>
            )
          )}
        </div>
      </div>
    </main>
  );
}
