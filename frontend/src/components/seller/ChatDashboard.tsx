"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useSellerChatInboxContext } from "@/components/seller/SellerChatInboxProvider";
import { useSellerChat, type SellerMessage } from "@/hooks/useSellerChat";
import { User, Loader2, X } from "lucide-react";
import { ReplyPreviewContent } from "@/components/ai/ReplyPreviewContent";
import { cn } from "@/lib/utils";
import { CHAT_WIDGET_SCROLL_CLASS } from "@/lib/chat-scroll";
import { useChatMediaDraft } from "@/hooks/useChatMediaDraft";
import { formatChatListTime } from "@/lib/chat-message-layout";
import { SellerMessageList } from "@/components/ai/SellerMessageList";
import { SellerDashboardComposer } from "@/components/seller/SellerDashboardComposer";
import { apiFetch } from "@/services/api";

export function ChatDashboard() {
  const { sessions, isLoading: sessionsLoading, markSessionReadLocally } = useSellerChatInboxContext();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId) {
      setActiveSessionId(sessionId);
    }
  }, []);

  const openSession = useCallback((sessionId: string) => {
    setActiveSessionId((prev) => (prev === sessionId ? prev : sessionId));
  }, []);

  return (
    <div className="flex h-full w-full bg-white rounded-panel border border-line overflow-hidden shadow-sm">
      <div className="w-80 border-r border-line flex flex-col bg-slate-50">
        <div className="p-4 border-b border-line bg-white">
          <h2 className="font-bold text-lg text-slate-900">Tin nhắn khách hàng</h2>
        </div>
        <div className={cn("flex-1", CHAT_WIDGET_SCROLL_CLASS)}>
          {sessionsLoading ? (
            <div className="flex justify-center items-center h-full text-emerald-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Chưa có cuộc hội thoại nào.</div>
          ) : (
            <div className="flex flex-col">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => openSession(session.id)}
                  className={cn(
                    "p-4 cursor-pointer flex gap-3 items-center border-b border-line transition-colors",
                    activeSessionId === session.id ? "bg-emerald-50" : "hover:bg-slate-100/50 bg-white"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center">
                    {session.customer_avatar ? (
                      <img
                        src={session.customer_avatar}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4
                        className={cn(
                          "text-sm truncate",
                          session.has_unread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                        )}
                      >
                        {session.customer_name || "Khách hàng"}
                      </h4>
                      <span
                        className={cn(
                          "text-[10px] shrink-0",
                          session.has_unread ? "text-emerald-600 font-bold" : "text-slate-400"
                        )}
                      >
                        {formatChatListTime(session.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-xs truncate flex-1",
                          session.has_unread ? "font-bold text-slate-800" : "text-slate-500"
                        )}
                      >
                        {session.last_message}
                      </p>
                      {session.has_unread && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        {activeSessionId ? (
          <ActiveChatArea
            conversationId={activeSessionId}
            onMarkConversationRead={markSessionReadLocally}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center bg-[#f8f9fa]">
            <div className="w-64 h-48 mb-6 relative flex items-center justify-center">
              <svg viewBox="0 0 200 150" className="w-full h-full text-slate-400">
                <rect x="30" y="40" width="140" height="90" rx="8" fill="#e2e8f0" />
                <rect x="35" y="45" width="130" height="75" rx="4" fill="#ffffff" />
                <path d="M 20 130 L 180 130" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
                <path d="M 80 130 L 120 130 L 115 135 L 85 135 Z" fill="#94a3b8" />
                <rect x="45" y="55" width="60" height="10" rx="2" fill="#3b82f6" />
                <rect x="45" y="70" width="40" height="4" rx="2" fill="#94a3b8" />
                <rect x="45" y="80" width="70" height="4" rx="2" fill="#cbd5e1" />
                <g transform="translate(110, 65)">
                  <path
                    d="M 0 10 C 0 4 4 0 10 0 L 40 0 C 46 0 50 4 50 10 L 50 30 C 50 36 46 40 40 40 L 15 40 L 0 50 Z"
                    fill="#ea580c"
                  />
                  <circle cx="15" cy="20" r="3" fill="#ffffff" />
                  <circle cx="25" cy="20" r="3" fill="#ffffff" />
                  <circle cx="35" cy="20" r="3" fill="#ffffff" />
                </g>
              </svg>
            </div>
            <h4 className="font-semibold text-slate-800 text-lg mb-1">Chào mừng bạn đến với Shepoo Chat</h4>
            <p className="text-sm text-slate-500">Bắt đầu nhắn tin với khách hàng ngay bây giờ!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveChatAreaInner({
  conversationId,
  onMarkConversationRead,
}: {
  conversationId: string;
  onMarkConversationRead: (conversationId: string) => void;
}) {
  const { messages, isConnected, sendMessage, markAsRead } = useSellerChat(null, conversationId, "SELLER");
  const [replyingToMessage, setReplyingToMessage] = useState<SellerMessage | null>(null);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const markedReadRef = useRef<string | null>(null);
  const lastInboundIdRef = useRef(0);

  useEffect(() => {
    lastInboundIdRef.current = 0;
    markedReadRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!isConnected || !conversationId) return;
    if (markedReadRef.current === conversationId) return;
    markedReadRef.current = conversationId;

    markAsRead();
    onMarkConversationRead(conversationId);
    window.dispatchEvent(new CustomEvent("chat-unread-refresh"));

    apiFetch("/notifications/read-by-url", {
      method: "PUT",
      body: JSON.stringify({ action_url: `/seller/chat?session_id=${conversationId}` }),
    })
      .then(() => {
        window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
        window.dispatchEvent(new CustomEvent("notifications-refresh"));
      })
      .catch(() => {});
  }, [isConnected, conversationId, markAsRead, onMarkConversationRead]);

  useEffect(() => {
    if (!isConnected || !conversationId) return;
    const latestInbound = [...messages]
      .reverse()
      .find((message) => message.sender_type === "CUSTOMER");
    if (!latestInbound || latestInbound.id <= lastInboundIdRef.current) return;
    lastInboundIdRef.current = latestInbound.id;
    markAsRead();
    onMarkConversationRead(conversationId);
  }, [messages, isConnected, conversationId, markAsRead, onMarkConversationRead]);

  const {
    draftItems: mediaDraftItems,
    hasDraft: hasMediaDraft,
    imageInputRef,
    videoInputRef,
    addInputRef,
    uploading: mediaUploading,
    uploadProgress,
    openImagePicker,
    openVideoPicker,
    openAddPicker,
    handleImageChange,
    handleVideoChange,
    handleAddChange,
    removeItem: removeMediaDraftItem,
    clearDraft: clearMediaDraft,
    sendDraft: sendMediaDraft,
    canAddMore: canAddMoreMedia,
    maxFiles: maxMediaFiles,
  } = useChatMediaDraft({
    sendMessage,
    replyToId: replyingToMessage?.id,
    onError: (message) => setMediaError(message),
    onComplete: () => {
      setMediaError(null);
      setReplyingToMessage(null);
    },
  });

  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [conversationId, messages.length, lastMessageId]);

  const scrollToMessage = useCallback((msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("bg-emerald-100/50");
    setTimeout(() => el.classList.remove("bg-emerald-100/50"), 2000);
  }, []);

  const handleReply = useCallback((msg: SellerMessage) => {
    setReplyingToMessage(msg);
  }, []);

  const handleSend = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed && !hasMediaDraft) return false;

      if (hasMediaDraft) {
        const sent = await sendMediaDraft(trimmed);
        if (!sent) return false;
        setReplyingToMessage(null);
        return true;
      }

      sendMessage(trimmed, undefined, undefined, replyingToMessage?.id);
      setReplyingToMessage(null);
      return true;
    },
    [hasMediaDraft, sendMediaDraft, sendMessage, replyingToMessage?.id]
  );

  return (
    <>
      <div className="px-6 py-4 border-b border-line bg-white shadow-sm flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Trò chuyện với khách hàng</h3>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                )}
              />
              <p className="text-xs text-slate-500">
                {isConnected ? "Đã kết nối" : "Đang kết nối..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className={cn("flex-1 px-4 py-4 bg-[#f8f9fa]", CHAT_WIDGET_SCROLL_CLASS)}>
        <SellerMessageList
          messages={messages}
          viewerRole="SELLER"
          peerLabel="Khách hàng"
          emptyText="Chưa có tin nhắn nào trong cuộc trò chuyện này."
          showIncomingAvatar
          isSellerAttachments
          onReply={handleReply}
          onScrollToMessage={scrollToMessage}
          onClickProduct={setPreviewProduct}
        />
      </div>

      <div className="border-t border-line bg-white">
        {replyingToMessage && (
          <div className="p-3 bg-slate-50 border-b border-line flex justify-between items-center text-sm">
            <div
              className={cn(
                "flex flex-col overflow-hidden pl-2 border-l-4",
                replyingToMessage.sender_type === "SELLER" ? "border-teal-500" : "border-orange-500"
              )}
            >
              <span
                className={cn(
                  "font-semibold text-xs",
                  replyingToMessage.sender_type === "SELLER" ? "text-teal-600" : "text-orange-500"
                )}
              >
                {replyingToMessage.sender_type === "SELLER" ? "Bạn" : "Khách hàng"}
              </span>
              <span className="truncate max-w-[300px] text-slate-600 text-xs mt-0.5">
                <ReplyPreviewContent
                  type={replyingToMessage.attachment_type}
                  id={replyingToMessage.attachment_id}
                  fallback={replyingToMessage.content}
                />
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToMessage(null)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {mediaError && (
          <div className="px-4 pb-2">
            <p className="text-xs text-red-600 whitespace-pre-line">{mediaError}</p>
          </div>
        )}
        <SellerDashboardComposer
          onSend={handleSend}
          mediaUploading={mediaUploading}
          uploadProgress={uploadProgress}
          mediaDraftItems={mediaDraftItems}
          hasMediaDraft={hasMediaDraft}
          canAddMoreMedia={canAddMoreMedia}
          maxMediaFiles={maxMediaFiles}
          imageInputRef={imageInputRef}
          videoInputRef={videoInputRef}
          addInputRef={addInputRef}
          onImageChange={handleImageChange}
          onVideoChange={handleVideoChange}
          onAddChange={handleAddChange}
          onRemoveMedia={removeMediaDraftItem}
          onClearMedia={clearMediaDraft}
          onAddMedia={openAddPicker}
          openImagePicker={openImagePicker}
          openVideoPicker={openVideoPicker}
        />
      </div>

      {previewProduct && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Chi tiết sản phẩm</h3>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <img
                src={previewProduct.thumbnailUrl}
                alt={previewProduct.name}
                className="w-full aspect-square object-cover rounded-lg bg-slate-100 border border-slate-200"
              />
              <p className="font-medium text-slate-800 leading-snug">{previewProduct.name}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-emerald-600">
                  {previewProduct.variants?.[0]?.salePrice
                    ? previewProduct.variants[0].salePrice.toLocaleString("vi-VN")
                    : (previewProduct.variants?.[0]?.price || 0).toLocaleString("vi-VN")}
                  đ
                </span>
                {previewProduct.variants?.[0]?.salePrice && (
                  <span className="text-sm text-slate-400 line-through">
                    {previewProduct.variants[0].price.toLocaleString("vi-VN")}đ
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ActiveChatArea = memo(ActiveChatAreaInner);
