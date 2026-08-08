"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSellerChatInboxContext } from "@/components/seller/SellerChatInboxProvider";
import { useSellerChat } from "@/hooks/useSellerChat";
import { Send, Image as ImageIcon, Video, User, Loader2, X, MoreHorizontal, Reply, Check, CheckCheck } from "lucide-react";
import { ReplyPreviewContent } from "@/components/ai/ReplyPreviewContent";
import { cn } from "@/lib/utils";
import { CHAT_WIDGET_SCROLL_CLASS } from "@/lib/chat-scroll";
import TextareaAutosize from "react-textarea-autosize";
import { ProductAttachment } from "@/components/ai/ProductAttachment";
import { OrderAttachment } from "@/components/ai/OrderAttachment";
import { ChatMediaMessage, isStandaloneChatAttachment } from "@/components/ai/ChatMediaMessage";
import { ChatMediaDraftPreview, ChatMediaHiddenInputs, ChatMediaUploadStatus } from "@/components/ai/ChatMediaDraftPreview";
import { useChatMediaDraft } from "@/hooks/useChatMediaDraft";
import {
  formatChatTime,
  getChatBubbleTailClass,
  getChatMessageGroupInfo,
  getChatMessageSpacingClass,
  shouldShowIncomingAvatar,
  CHAT_BUBBLE_BODY_CLASS,
  CHAT_BUBBLE_WRAPPER_CLASS,
} from "@/lib/chat-message-layout";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { ChatMessageMeta } from "@/components/chat/ChatMessageMeta";
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

  const openSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

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
              {sessions.map(session => (
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
                      <img src={session.customer_avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className={cn("text-sm truncate", session.has_unread ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                        {session.customer_name || "Khách hàng"}
                      </h4>
                      <span className={cn("text-[10px] shrink-0", session.has_unread ? "text-emerald-600 font-bold" : "text-slate-400")}>
                        {new Date(session.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-xs truncate flex-1", session.has_unread ? "font-bold text-slate-800" : "text-slate-500")}>{session.last_message}</p>
                      {session.has_unread && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
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
                   <path d="M 0 10 C 0 4 4 0 10 0 L 40 0 C 46 0 50 4 50 10 L 50 30 C 50 36 46 40 40 40 L 15 40 L 0 50 Z" fill="#ea580c" />
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

// Temporary icon to avoid importing MessageSquare twice
const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);

function ActiveChatArea({
  conversationId,
  onMarkConversationRead,
}: {
  conversationId: string;
  onMarkConversationRead: (conversationId: string) => void;
}) {
  const { messages, isConnected, sendMessage, markAsRead } = useSellerChat(null, conversationId, 'SELLER');
  const [input, setInput] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const markedReadRef = useRef<string | null>(null);
  const lastInboundIdRef = useRef(0);

  useEffect(() => {
    lastInboundIdRef.current = 0;
    markedReadRef.current = null;
  }, [conversationId]);

  // MARK_READ + đánh dấu notification chỉ khi mở đoạn chat (WS kết nối)
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

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('bg-emerald-100/50');
      setTimeout(() => el.classList.remove('bg-emerald-100/50'), 2000);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && !hasMediaDraft) return;

    if (hasMediaDraft) {
      const sent = await sendMediaDraft(input.trim());
      if (sent) {
        setInput("");
        setReplyingToMessage(null);
      }
      return;
    }

    sendMessage(input.trim(), undefined, undefined, replyingToMessage?.id);
    setInput("");
    setReplyingToMessage(null);
  };

  return (
    <>
      <div className="px-6 py-4 border-b border-line bg-white shadow-sm flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              Trò chuyện với khách hàng
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300")}></div>
              <p className="text-xs text-slate-500">{isConnected ? "Đã kết nối" : "Đang kết nối..."}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className={cn("flex-1 px-4 py-4 bg-[#f8f9fa]", CHAT_WIDGET_SCROLL_CLASS)}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400">
            Chưa có tin nhắn nào trong cuộc trò chuyện này.
          </div>
        ) : (
          messages.map((msg, idx) => {
            const { position, showDateSeparator } = getChatMessageGroupInfo(messages, idx);
            const spacingClass = getChatMessageSpacingClass(position, idx === 0 && !showDateSeparator);
            const isMe = msg.sender_type === 'SELLER';
            const isSystem = msg.sender_type === 'SYSTEM';
            const tailClass = getChatBubbleTailClass(isMe, position);

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="bg-slate-200 text-slate-600 text-xs px-4 py-1.5 rounded-full uppercase tracking-wide font-medium">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && <ChatDateSeparator date={msg.created_at} />}
                <div id={`msg-${msg.id}`} className={cn("flex w-full min-w-0 group transition-colors duration-500 rounded p-0.5 scroll-mt-4", spacingClass, isMe ? "justify-end" : "justify-start")}>
                {!isMe && (
                  shouldShowIncomingAvatar(isMe, true, position) ? (
                    <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 mr-3 overflow-hidden flex items-center justify-center mt-auto mb-0.5">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                  ) : (
                    <div className="w-8 shrink-0 mr-3" aria-hidden />
                  )
                )}
                <div className={cn("flex items-center gap-2 max-w-[80%]", CHAT_BUBBLE_WRAPPER_CLASS)}>
                  {isMe && (
                    <div className="relative group/reply mr-1 flex items-center">
                      <button className="text-slate-400 hover:text-emerald-500 bg-white shadow-sm border border-slate-100 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-0 invisible group-hover/reply:opacity-100 group-hover/reply:visible transition-all z-10">
                        <button onClick={() => setReplyingToMessage(msg)} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 whitespace-nowrap text-sm font-medium">
                          <Reply className="w-4 h-4" />
                          Trả lời
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={cn("flex flex-col", CHAT_BUBBLE_WRAPPER_CLASS)}>
                    <div className={cn(
                      "text-sm relative shadow-sm max-w-full min-w-0 flex flex-col",
                      isMe ? "ml-auto" : "mr-auto",
                      !isStandaloneChatAttachment(msg) ? cn(
                        "rounded-2xl px-3 py-1.5",
                        isMe ? "bg-emerald-50 text-slate-900 border border-emerald-100" : "bg-white border border-slate-200 text-slate-900",
                        tailClass
                      ) : ""
                    )}>
                      {msg.reply_to_id && messages.find(m => m.id === msg.reply_to_id) && (
                        (() => {
                          const replyMsg = messages.find(m => m.id === msg.reply_to_id)!;
                          return (
                            <div 
                              onClick={() => scrollToMessage(replyMsg.id)}
                              className={cn(
                              "mb-2 border-l-[3px] px-2 py-1 bg-black/5 rounded-r max-w-[240px] cursor-pointer hover:bg-black/10 transition-colors",
                              replyMsg.sender_type === 'SELLER' ? "border-teal-500" : "border-orange-500"
                            )}>
                              <div className={cn("font-semibold text-xs", replyMsg.sender_type === 'SELLER' ? "text-teal-600" : "text-orange-500")}>
                                {replyMsg.sender_type === 'SELLER' ? "Bạn" : "Khách hàng"}
                              </div>
                              <div className="text-[13px] text-slate-600 line-clamp-1 mt-0.5">
                                <ReplyPreviewContent type={replyMsg.attachment_type} id={replyMsg.attachment_id} fallback={replyMsg.content} />
                              </div>
                            </div>
                          )
                        })()
                      )}
                      {msg.attachment_type === 'PRODUCT' && msg.attachment_id ? (
                        <div className="flex flex-col gap-1 items-end">
                          <ProductAttachment publicId={msg.attachment_id} isSeller={true} onClickProduct={setPreviewProduct} />
                          {msg.content && msg.content !== "[Sản phẩm]" && (
                            <div className={cn(
                              "rounded-2xl px-5 py-3 text-sm w-full text-left mt-1",
                              isMe ? "bg-emerald-50 text-slate-900 rounded-tr-sm border border-emerald-100" : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm"
                            )}>
                              {msg.content}
                            </div>
                          )}
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] mt-1",
                            "justify-end text-slate-500 opacity-70"
                          )}>
                                            <span>{formatChatTime(msg.created_at)}</span>
                            {isMe && (
                              msg.status === 'READ' ? <CheckCheck className="w-3 h-3 text-emerald-500" /> :
                              msg.status === 'DELIVERED' ? <CheckCheck className="w-3 h-3 text-slate-400" /> :
                              <Check className="w-3 h-3 text-slate-400" />
                            )}
                          </div>
                        </div>
                      ) : msg.attachment_type === 'ORDER' && msg.attachment_id ? (
                        <div className="flex flex-col gap-1 items-end">
                          <OrderAttachment orderId={msg.attachment_id} isSeller={true} />
                          {msg.content && msg.content !== "[Đơn hàng]" && (
                            <div className={cn(
                              "rounded-2xl px-5 py-3 text-sm w-full text-left mt-1",
                              isMe ? "bg-emerald-50 text-slate-900 rounded-tr-sm border border-emerald-100" : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm"
                            )}>
                              {msg.content}
                            </div>
                          )}
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] mt-1",
                            "justify-end text-slate-500 opacity-70"
                          )}>
                                            <span>{formatChatTime(msg.created_at)}</span>
                            {isMe && (
                              msg.status === 'READ' ? <CheckCheck className="w-3 h-3 text-emerald-500" /> :
                              msg.status === 'DELIVERED' ? <CheckCheck className="w-3 h-3 text-slate-400" /> :
                              <Check className="w-3 h-3 text-slate-400" />
                            )}
                          </div>
                        </div>
                      ) : (msg.attachment_type === 'IMAGE' || msg.attachment_type === 'VIDEO') && msg.attachment_id ? (
                        <ChatMediaMessage
                          msg={msg}
                          isMe={isMe}
                          bubbleClassName="px-5 py-3"
                        />
                  ) : (
                    <span className={CHAT_BUBBLE_BODY_CLASS}>
                      {msg.content}
                      <ChatMessageMeta
                        time={formatChatTime(msg.created_at)}
                        className={isMe ? "text-slate-500" : "text-slate-400"}
                      >
                        {isMe && (
                          msg.status === 'READ' ? <CheckCheck className="w-3 h-3 text-emerald-500" /> :
                          msg.status === 'DELIVERED' ? <CheckCheck className="w-3 h-3 text-slate-400" /> :
                          <Check className="w-3 h-3 text-slate-400" />
                        )}
                      </ChatMessageMeta>
                    </span>
                  )}
                    </div>
                  </div>
                  {!isMe && (
                    <div className="relative group/reply ml-1 flex items-center">
                      <button className="text-slate-400 hover:text-emerald-500 bg-white shadow-sm border border-slate-100 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 invisible group-hover/reply:opacity-100 group-hover/reply:visible transition-all z-10">
                        <button onClick={() => setReplyingToMessage(msg)} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 whitespace-nowrap text-sm font-medium">
                          <Reply className="w-4 h-4" />
                          Trả lời
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-white">
        {replyingToMessage && (
          <div className="p-3 bg-slate-50 border-b border-line flex justify-between items-center text-sm">
             <div className={cn(
               "flex flex-col overflow-hidden pl-2 border-l-4",
               replyingToMessage.sender_type === 'SELLER' ? "border-teal-500" : "border-orange-500"
             )}>
               <span className={cn("font-semibold text-xs", replyingToMessage.sender_type === 'SELLER' ? "text-teal-600" : "text-orange-500")}>
                 {replyingToMessage.sender_type === 'SELLER' ? "Bạn" : "Khách hàng"}
               </span>
               <span className="truncate max-w-[300px] text-slate-600 text-xs mt-0.5">
                 <ReplyPreviewContent type={replyingToMessage.attachment_type} id={replyingToMessage.attachment_id} fallback={replyingToMessage.content} />
               </span>
             </div>
             <button onClick={() => setReplyingToMessage(null)} className="p-1 text-slate-400 hover:text-slate-600">
               <X className="w-4 h-4" />
             </button>
          </div>
        )}
        {mediaError && (
          <div className="px-4 pb-2">
            <p className="text-xs text-red-600 whitespace-pre-line">{mediaError}</p>
          </div>
        )}
        <div className="p-4">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all overflow-hidden shadow-sm">
              <ChatMediaUploadStatus uploading={mediaUploading} uploadProgress={uploadProgress} />
              <ChatMediaHiddenInputs
                imageInputRef={imageInputRef}
                videoInputRef={videoInputRef}
                addInputRef={addInputRef}
                onImageChange={handleImageChange}
                onVideoChange={handleVideoChange}
                onAddChange={handleAddChange}
                disabled={mediaUploading}
              />
              <ChatMediaDraftPreview
                items={mediaDraftItems}
                canAddMore={canAddMoreMedia}
                maxFiles={maxMediaFiles}
                onRemove={removeMediaDraftItem}
                onClear={clearMediaDraft}
                onAdd={openAddPicker}
              />
              <TextareaAutosize
                minRows={1}
                maxRows={6}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Nhập phản hồi của bạn..."
                className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-sm max-h-[150px] overflow-y-auto"
              />
              <div className="flex items-center justify-between p-2 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openImagePicker}
                    disabled={mediaUploading || !canAddMoreMedia}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50"
                    title={`Gửi hình ảnh (tối đa ${maxMediaFiles}, 2MB/ảnh)`}
                  >
                    {mediaUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={openVideoPicker}
                    disabled={mediaUploading || !canAddMoreMedia}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors disabled:opacity-50"
                    title={`Gửi video (tối đa ${maxMediaFiles}, 30MB/video)`}
                  >
                    <Video className="w-5 h-5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={mediaUploading || (!input.trim() && !hasMediaDraft)}
                  className="p-2 text-emerald-600 hover:bg-emerald-100 disabled:text-slate-300 disabled:hover:bg-transparent rounded-lg transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Product Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Chi tiết sản phẩm</h3>
              <button onClick={() => setPreviewProduct(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <img src={previewProduct.thumbnailUrl} alt={previewProduct.name} className="w-full aspect-square object-cover rounded-lg bg-slate-100 border border-slate-200" />
              <p className="font-medium text-slate-800 leading-snug">{previewProduct.name}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-emerald-600">
                  {previewProduct.variants?.[0]?.salePrice ? previewProduct.variants[0].salePrice.toLocaleString('vi-VN') : (previewProduct.variants?.[0]?.price || 0).toLocaleString('vi-VN')}đ
                </span>
                {previewProduct.variants?.[0]?.salePrice && (
                  <span className="text-sm text-slate-400 line-through">
                    {previewProduct.variants[0].price.toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setPreviewProduct(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
