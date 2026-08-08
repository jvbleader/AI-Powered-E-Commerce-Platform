"use client";

import React, { useState, useRef, useEffect, Fragment } from "react";
import { Plus, Loader2, ArrowLeft, Menu, Headset } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAT_WIDGET_SCROLL_CLASS } from "@/lib/chat-scroll";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { useSupporterChat } from "@/hooks/useSupporterChat";
import { useSupportSessions } from "@/hooks/useSupportSessions";
import { CustomerSupportInboxProvider } from "@/components/support/CustomerSupportInboxProvider";
import { formatDate } from "@/lib/helpers";
import {
  getChatMessageGroupInfo,
  getChatMessageSpacingClass,
  shouldShowIncomingAvatar,
} from "@/lib/chat-message-layout";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { SupportChatComposer } from "@/components/support/SupportChatComposer";
import { SupportChatMessageBubble } from "@/components/support/SupportChatMessage";

export default function SupportPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("guest_id");
      if (!id) {
        id = "guest_" + Math.random().toString(36).substring(2, 11);
        localStorage.setItem("guest_id", id);
      }
      setGuestId(id);
    }
  }, []);

  if (!isMounted) {
    return (
      <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-3 md:px-4 py-3 md:py-4 font-body-tech h-[calc(100vh-2rem)] overflow-hidden">
        <header className="flex items-center justify-between pb-3 shrink-0">
          <Link href="/" className="flex items-center gap-2 text-slate-500 font-tech font-bold text-sm md:text-base">
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span>Về trang chủ</span>
          </Link>
          <div className="font-tech font-bold text-lg md:text-xl text-slate-900 flex items-center gap-2">
            Shepoo <span className="text-blue-500">Hỗ trợ</span>
          </div>
          <div className="w-[100px] hidden sm:block" />
        </header>
        <div className="overflow-hidden rounded-xl flex items-center justify-center flex-1 min-h-0 border border-slate-200 bg-white shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      </main>
    );
  }

  return (
    <CustomerSupportInboxProvider guestId={guestId} enabled={isMounted}>
      <SupportPageContent guestId={guestId} />
    </CustomerSupportInboxProvider>
  );
}

function SupportPageContent({ guestId }: { guestId: string | null }) {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [activeSupportSessionId, setActiveSupportSessionId] = useState<string | null>(null);

  const { supportSessions, isLoadingSupportSessions, updateSessionLocally } =
    useSupportSessions();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionIdFromUrl = urlParams.get("session_id");

      if (sessionIdFromUrl) {
        setActiveSupportSessionId(sessionIdFromUrl);
      } else {
        sessionStorage.removeItem("support_active_session_id");
        setActiveSupportSessionId(null);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (activeSupportSessionId) {
        sessionStorage.setItem("support_active_session_id", activeSupportSessionId);
      } else {
        sessionStorage.removeItem("support_active_session_id");
      }
    }
  }, [activeSupportSessionId]);

  const handleSupportSessionClick = async (sessionId: string) => {
    setActiveSupportSessionId(sessionId);
    setShowMobileSidebar(false);

    try {
      const { apiFetch } = await import("@/services/api");
      await apiFetch("/notifications/read-by-url", {
        method: "PUT",
        body: JSON.stringify({ action_url: `/support?session_id=${sessionId}` }),
      });
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
      updateSessionLocally(sessionId, { has_unread: false });
    } catch {
      // ignore
    }
  };

  const handleClearSupportChat = () => {
    setActiveSupportSessionId(null);
  };

  return (
    <main className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-3 md:px-4 py-3 md:py-4 font-body-tech h-[calc(100vh-2rem)] overflow-hidden">
      <header className="flex items-center justify-between pb-3 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-500 hover:text-blue-500 font-tech font-bold text-sm md:text-base transition-colors"
        >
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          <span>Về trang chủ</span>
        </Link>
        <div className="font-tech font-bold text-lg md:text-xl text-slate-900 flex items-center gap-2">
          Shepoo <span className="text-blue-500">Hỗ trợ</span>
        </div>
        <div className="w-[100px] hidden sm:block" />
      </header>

      <div className="overflow-hidden rounded-xl flex flex-row flex-1 min-h-0 border border-slate-200 bg-white relative shadow-sm">
        {/* Sidebar */}
        <div
          className={cn(
            "w-full md:w-[280px] lg:w-[320px] flex-col shrink-0 transition-all z-20 md:static absolute inset-0 md:flex",
            showMobileSidebar ? "flex" : "hidden md:flex"
          )}
        >
          <div className="px-4 border-r flex items-center justify-between h-16 md:h-[76px] shrink-0 shadow-sm relative z-20 bg-blue-500 border-blue-400/50">
            <h2 className="font-bold text-lg md:text-xl text-white">Tin nhắn</h2>
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="md:hidden text-sm font-semibold text-blue-100 hover:text-white transition-colors"
            >
              Đóng
            </button>
          </div>

          <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200 min-h-0 relative z-10">
            <div className={cn("flex-1 p-3 space-y-2", CHAT_WIDGET_SCROLL_CLASS)}>
              {isLoadingSupportSessions ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {supportSessions.map((session) => {
                    const isActive = session.id === activeSupportSessionId;
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSupportSessionClick(session.id)}
                        className={cn(
                          "w-full p-4 rounded-2xl shadow-sm text-left transition-transform hover:-translate-y-0.5 border relative",
                          isActive
                            ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-400"
                            : session.has_unread
                              ? "bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300 shadow-sm font-bold"
                              : "bg-white hover:bg-blue-50 text-slate-700 border-slate-200"
                        )}
                      >
                        <div className="flex flex-col gap-1 pr-4">
                          <p
                            className={cn(
                              "font-bold text-sm line-clamp-1",
                              isActive ? "text-white" : "text-slate-800"
                            )}
                          >
                            {session.last_message || "Yêu cầu hỗ trợ"}
                          </p>
                          <p
                            className={cn(
                              "text-xs mt-0.5",
                              isActive ? "text-blue-100" : "text-slate-500"
                            )}
                          >
                            {formatDate(session.updated_at)}
                          </p>
                        </div>
                        {session.has_unread && (
                          <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white relative min-w-0">
          <div className="absolute top-0 left-0 right-0 h-16 md:h-[76px] z-0 bg-blue-500 shadow-sm" />

          <CustomerSupportChat
            conversationId={activeSupportSessionId}
            setConversationId={setActiveSupportSessionId}
            onMenuClick={() => setShowMobileSidebar(!showMobileSidebar)}
            onClearChat={handleClearSupportChat}
            guestId={guestId}
          />
        </div>
      </div>
    </main>
  );
}

function CustomerSupportChat({
  conversationId,
  setConversationId,
  onMenuClick,
  onClearChat,
  guestId,
}: {
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  onMenuClick: () => void;
  onClearChat: () => void;
  guestId: string | null;
}) {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const sessionUserId = store.state.sessionUserId;
  const [isInitializing, setIsInitializing] = useState(!guestId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | null>(conversationId);
  const pendingNewRequestRef = useRef(false);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (guestId) setIsInitializing(false);
  }, [guestId]);

  const handleClearChat = () => {
    pendingNewRequestRef.current = true;
    conversationIdRef.current = null;
    onClearChat();
  };

  const { messages, conversation, isConnected, sendMessage, prepareConversation } = useSupporterChat(
    conversationId,
    "CUSTOMER",
    guestId
  );

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
    }
  }, [messages]);

  const ensureConversation = async (): Promise<string | null> => {
    if (conversationIdRef.current && !pendingNewRequestRef.current) {
      return conversationIdRef.current;
    }

    try {
      const { apiFetch } = await import("@/services/api");
      const forceNew = pendingNewRequestRef.current || !conversationIdRef.current;
      pendingNewRequestRef.current = false;
      const id = guestId || localStorage.getItem("guest_id");
      let query: string;
      if (sessionUserId) {
        query = forceNew ? "create=true&force_new=true" : "create=true";
        if (id) {
          query += `&guest_id=${encodeURIComponent(id)}`;
        }
      } else if (id) {
        query = forceNew
          ? `guest_id=${encodeURIComponent(id)}&create=true&force_new=true`
          : `guest_id=${encodeURIComponent(id)}&create=true`;
      } else {
        showToast("Không thể xác định phiên khách", "danger");
        return null;
      }
      const conv = await apiFetch<{ id: string }>(`/api/support-chat/conversations?${query}`, {
        method: "POST",
      });
      if (conv?.id) {
        conversationIdRef.current = conv.id;
        setConversationId(conv.id);
        prepareConversation(conv.id);
        return conv.id;
      }
    } catch {
      showToast("Lỗi kết nối máy chủ", "danger");
    }
    return null;
  };

  const assignedSupporter = conversation?.supporter
    ? conversation.supporter.full_name
    : "Nhân viên hỗ trợ";
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
            <Headset className="h-6 w-6 md:h-7 md:w-7" />
          </div>
          <div>
            <h1 className="font-bold text-base md:text-lg text-white">{assignedSupporter}</h1>
            <p className="text-[10px] md:text-xs text-blue-100 mt-1 uppercase tracking-wider">
              {isInitializing
                ? "Đang tải..."
                : !conversationId
                  ? "Sẵn sàng hỗ trợ"
                  : isConnected
                    ? isClosed
                      ? "Đã đóng"
                      : "Đang online"
                    : "Đang kết nối..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleClearChat}
            className="text-xs !text-white border border-white/20 !bg-black/15 hover:!bg-black/30 shadow-xs min-h-8 py-1 px-2 md:px-3 flex items-center gap-1.5 transition-colors"
            title="Tạo yêu cầu mới"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">Yêu cầu mới</span>
          </Button>
        </div>
      </div>

      {isInitializing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3 mx-auto" />
        </div>
      ) : !conversationId ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Headset className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg md:text-xl font-bold text-slate-800 mb-2">Bạn cần hỗ trợ gì?</h3>
          <p className="text-slate-500 text-sm max-w-[250px]">
            Hãy gửi tin nhắn hoặc đính kèm ảnh, video, tệp để kết nối với tư vấn viên.
          </p>
        </div>
      ) : (
        <div className={cn("flex-1 p-4 md:p-6", CHAT_WIDGET_SCROLL_CLASS)}>
          {messages.map((msg, idx) => {
            const { position, showDateSeparator } = getChatMessageGroupInfo(messages, idx);
            const isMe = msg.sender_type === "CUSTOMER";
            const spacingClass = getChatMessageSpacingClass(
              position,
              idx === 0 && !showDateSeparator
            );

            return (
              <Fragment key={msg.id}>
                {showDateSeparator && <ChatDateSeparator date={msg.created_at} />}
                <div className={spacingClass}>
                  <SupportChatMessageBubble
                    msg={msg}
                    isMe={isMe}
                    groupPosition={position}
                    showAvatar={shouldShowIncomingAvatar(
                      isMe,
                      msg.sender_type === "SUPPORTER",
                      position
                    )}
                  />
                </div>
              </Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      <SupportChatComposer
        conversationId={conversationId}
        guestId={guestId}
        isConnected={isConnected}
        disabled={isInitializing}
        sendMessage={sendMessage}
        onEnsureConversation={ensureConversation}
        placeholder={
          isClosed ? "Nhập tin nhắn để mở lại yêu cầu hỗ trợ..." : "Nhập tin nhắn..."
        }
        onError={(message) => showToast(message, "danger")}
      />
    </>
  );
}
