"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, MessageSquare, Send, Sparkles, RefreshCcw, Loader2, UserCircle2, ArrowLeft, Menu, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { useSupporterChat } from "@/hooks/useSupporterChat";
import { ChatMessageItem } from "@/components/ai/ChatMessageItem";
import { formatDate } from "@/lib/helpers";
import TextareaAutosize from 'react-textarea-autosize';

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

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  };

  useEffect(() => {
    const timeout = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeout);
  }, [messages, currentStatus, isStreaming, activeTab]);

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

  return (
    <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-3 md:px-4 py-3 md:py-4 font-body-tech h-[calc(100vh-2rem)] overflow-hidden">
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

      <div className="overflow-hidden rounded-xl flex flex-row flex-1 min-h-0 border border-slate-200 bg-white relative shadow-sm">
        
        {/* Sidebar */}
        <div 
          className={cn(
            "w-full md:w-[280px] lg:w-[320px] flex-col shrink-0 transition-all z-20 md:static absolute inset-0 md:flex",
            showMobileSidebar ? "flex" : "hidden md:flex"
          )}
        >
          <div className={cn(
            "px-4 border-r flex items-center justify-between h-16 md:h-[76px] shrink-0 shadow-sm relative z-20 transition-colors duration-300 ease-in-out",
            activeTab === "SUPPORTER" ? "bg-blue-500 border-blue-400/50" : "bg-emerald-600 border-emerald-500/50"
          )}>
            <h2 className="font-bold text-lg md:text-xl text-white">Tin nhắn</h2>
            <button 
              onClick={() => setShowMobileSidebar(false)}
              className={cn(
                "md:hidden text-sm font-semibold hover:text-white transition-colors",
                activeTab === "SUPPORTER" ? "text-blue-100" : "text-emerald-100"
              )}
            >
              Đóng
            </button>
          </div>

          <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200 min-h-0 relative z-10">
            <div className="p-3 border-b border-slate-200 shrink-0">
              <div className="flex bg-slate-200/80 p-1 rounded-xl">
                <button 
                  onClick={() => { setActiveTab("AI"); setShowMobileSidebar(false); }}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all",
                    activeTab === "AI" ? "bg-white shadow-sm text-emerald-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <Bot className="w-4 h-4" /> AI Assistant
                </button>
                <button 
                  onClick={() => { setActiveTab("SUPPORTER"); setShowMobileSidebar(false); }}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition-all",
                    activeTab === "SUPPORTER" ? "bg-white shadow-sm text-blue-500" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <MessageSquare className="w-4 h-4" /> Supporter
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
              {activeTab === "AI" ? (
                <button className="w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-left transition-transform hover:-translate-y-0.5">
                  <div>
                    <p className="font-bold text-sm">Phiên chat hiện tại</p>
                    <p className="text-xs text-emerald-100 mt-0.5">Đang trực tuyến</p>
                  </div>
                </button>
              ) : (
                <button className="w-full p-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white shadow-sm text-left transition-transform hover:-translate-y-0.5">
                  <div>
                    <p className="font-bold text-sm">Hỗ trợ khách hàng</p>
                    <p className="text-xs text-blue-100 mt-0.5">Kết nối với nhân viên</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white relative min-w-0">
          
          {/* PERSISTENT HEADER BACKGROUND FOR SMOOTH TRANSITION */}
          <div className={cn(
            "absolute top-0 left-0 right-0 h-16 md:h-[76px] z-0 transition-colors duration-300 ease-in-out shadow-sm",
            activeTab === "SUPPORTER" ? "bg-blue-500" : "bg-emerald-600"
          )} />

          {activeTab === "AI" ? (
            <>
              {/* Header AI */}
              <div className="flex items-center justify-between px-3 md:px-4 bg-transparent relative z-10 h-16 md:h-[76px] shrink-0">
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="ghost"
                    onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                    className="md:hidden text-emerald-100 hover:text-white min-h-0 h-9 w-9 p-0"
                    title="Menu Hộp Thư"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>

                  <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-white/20 text-white shadow-xs">
                    <Bot className="h-5 w-5 md:h-6 md:h-6" />
                  </div>
                  <div>
                    <h1 className="font-bold text-base md:text-lg text-white flex items-center gap-1.5">
                      Shepoo AI
                      <span className="flex h-2 w-2 rounded-full bg-emerald-300 animate-pulse"></span>
                    </h1>
                    <p className="text-[10px] md:text-xs text-emerald-100 mt-1 uppercase tracking-wider">Trợ lý tư vấn bán hàng</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    onClick={() => { setActiveTab("SUPPORTER"); showToast("Đã chuyển sang Supporter", "info"); }} 
                    className="text-xs text-emerald-700 border-emerald-200 bg-white hover:bg-emerald-50 shadow-xs min-h-8 py-1 px-3"
                  >
                    Gặp nhân viên
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={handleClearChat} 
                    className="text-emerald-100 hover:text-white hover:bg-emerald-500/50 min-h-0 h-9 w-9 p-0" 
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
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-5 no-scrollbar">
                {isLoadingHistory ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <p className="text-sm text-slate-500 font-medium">Đang tải lịch sử trò chuyện...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-8 animate-fade-in-up py-8">
                    <div className="text-center">
                      <h2 className="text-xl md:text-2xl font-bold text-slate-800">Xin chào! 👋</h2>
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
              <div className="p-3 md:p-4 bg-slate-100 border-t border-slate-200">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendAI(input); }}
                  className="flex gap-3 items-end max-w-4xl mx-auto"
                >
                  <TextareaAutosize
                    minRows={1}
                    maxRows={5}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAI(input);
                      }
                    }}
                    placeholder="Nhập câu hỏi của bạn..."
                    className="flex-1 min-h-[48px] md:min-h-[56px] rounded-xl border-2 border-slate-200 bg-white px-4 py-3 md:py-4 text-sm md:text-base text-ink placeholder:text-muted/60 transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-sm resize-none no-scrollbar"
                    disabled={isStreaming}
                  />
                  <button
                     type="submit"
                     disabled={!input.trim() || isStreaming}
                     className={cn(
                       "flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm",
                       (!input.trim() || isStreaming)
                         ? "bg-slate-200 text-slate-400 pointer-events-none"
                         : "bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 active:scale-95"
                     )}
                   >
                     {isStreaming ? (
                       <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
                     ) : (
                       <Send className="h-5 w-5 md:h-6 md:w-6 -ml-0.5" />
                     )}
                   </button>
                </form>
              </div>
            </>
          ) : (
            // SUPPORTER TAB
            <CustomerSupportChat onMenuClick={() => setShowMobileSidebar(!showMobileSidebar)} />
          )}
        </div>
      </div>
    </main>
  );
}

function CustomerSupportChat({ onMenuClick }: { onMenuClick: () => void }) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initChat = async () => {
      try {
        const { apiFetch } = await import("@/services/api");
        let guestId = localStorage.getItem("guest_id");
        if (!guestId) {
          guestId = "guest_" + Math.random().toString(36).substring(2, 11);
          localStorage.setItem("guest_id", guestId);
        }
        
        try {
          // Check for existing conversation without creating a new one
          const conv = await apiFetch<any>(`/api/support-chat/conversations?guest_id=${guestId}&create=false`, {
            method: "POST"
          });
          if (conv && conv.id) {
            setConversationId(conv.id);
          }
        } catch (e) {
          // 404 No active conversation, safely ignore
        }
      } catch (error) {
        // network error
      } finally {
        setIsInitializing(false);
      }
    };
    initChat();
  }, []);

  const { messages, conversation, isConnected, sendMessage } = useSupporterChat(conversationId, 'CUSTOMER');

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
    }
  }, [messages]);

  // Send pending message when WS connects
  useEffect(() => {
    if (isConnected && pendingMessage) {
      sendMessage(pendingMessage);
      setPendingMessage(null);
    }
  }, [isConnected, pendingMessage, sendMessage]);

  const handleCreateAndSend = async (msg: string) => {
    setIsCreating(true);
    try {
      const { apiFetch } = await import("@/services/api");
      const guestId = localStorage.getItem("guest_id");
      const conv = await apiFetch<any>(`/api/support-chat/conversations?guest_id=${guestId}&create=true`, {
        method: "POST"
      });
      if (conv && conv.id) {
        setPendingMessage(msg);
        setConversationId(conv.id);
      }
    } catch (error) {
      showToast("Lỗi kết nối máy chủ", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isClosed || isCreating) return;
    
    if (!conversationId) {
       handleCreateAndSend(input.trim());
       setInput("");
    } else if (isConnected) {
       sendMessage(input.trim());
       setInput("");
    }
  };

  const assignedSupporter = conversation?.supporter ? conversation.supporter.full_name : "Nhân viên hỗ trợ";
  const isClosed = conversation?.status === "CLOSED";

  return (
    <>
      <div className="flex items-center justify-between px-3 md:px-4 bg-transparent relative z-10 h-16 md:h-[76px] shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={onMenuClick}
            className="md:hidden text-blue-100 hover:text-white min-h-0 h-9 w-9 p-0"
            title="Menu Hộp Thư"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-2xl bg-white/20 text-white shadow-xs">
            <UserCircle2 className="h-6 w-6 md:h-7 md:w-7" />
          </div>
          <div>
            <h1 className="font-tech font-bold text-base md:text-lg text-white">
              {assignedSupporter}
            </h1>
            <p className="text-[10px] md:text-xs text-blue-100 mt-1 font-bold uppercase tracking-wider">
              {isInitializing ? "Đang tải..." : (!conversationId || !conversation ? "Sẵn sàng hỗ trợ" : (isConnected ? (isClosed ? 'Đã đóng' : 'Đang online') : 'Đang kết nối...'))}
            </p>
          </div>
        </div>
      </div>

      {isInitializing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
           <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3 mx-auto" />
        </div>
      ) : (!conversationId || !conversation) ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
           <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
             <UserCircle2 className="w-8 h-8 text-blue-500" />
           </div>
           <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-2">Bạn cần hỗ trợ gì?</h3>
           <p className="text-slate-500 text-sm max-w-[250px]">Hãy gửi tin nhắn đầu tiên để kết nối ngay với tư vấn viên của chúng tôi.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-5 no-scrollbar">
        {messages.map((msg) => {
          if (msg.sender_type === "SYSTEM") {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <div className="bg-slate-100 text-slate-500 text-xs py-1 px-3 rounded-full font-medium">
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className={cn("flex", msg.sender_type === "CUSTOMER" ? "justify-end" : "justify-start")}>
              {msg.sender_type === "SUPPORTER" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-500 mr-2.5 mt-1 shadow-xs">
                  <UserCircle2 className="h-5 w-5" />
                </div>
              )}
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[75%] text-sm leading-relaxed shadow-sm break-words",
                  msg.sender_type === "CUSTOMER"
                    ? "bg-blue-500 text-white rounded-tr-sm border-transparent"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                )}
              >
                <p>{msg.content}</p>
                <p className={cn("mt-1 text-[10px] font-semibold", msg.sender_type === "CUSTOMER" ? "text-blue-100 text-right" : "text-slate-400")}>
                  {formatDate(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      )}

      <div className="p-3 md:p-4 bg-slate-100 border-t border-slate-200">
        <form 
          className="flex gap-3 items-end max-w-4xl mx-auto"
          onSubmit={handleFormSubmit}
        >
          <TextareaAutosize
            minRows={1}
            maxRows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleFormSubmit();
              }
            }}
            placeholder={isClosed ? "Cuộc trò chuyện đã đóng" : "Nhập tin nhắn..."}
            className="flex-1 min-h-[48px] md:min-h-[56px] rounded-xl border-2 border-slate-200 bg-white px-4 py-3 md:py-4 text-sm md:text-base text-ink placeholder:text-muted/60 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-sm resize-none no-scrollbar"
            disabled={isClosed || (!isConnected && !!conversationId) || isCreating || isInitializing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isClosed || (!isConnected && !!conversationId) || isCreating || isInitializing}
            className={cn(
              "flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-xl transition-all duration-300 shadow-sm",
              (!input.trim() || isClosed || (!isConnected && !!conversationId) || isCreating || isInitializing)
                ? "bg-slate-200 text-slate-400 pointer-events-none"
                : "bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 active:scale-95"
            )}
          >
            {isCreating || (!!conversationId && !isConnected) ? (
              <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin text-slate-400" />
            ) : (
              <Send className="h-5 w-5 md:h-6 md:w-6 -ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </>
  );
}
