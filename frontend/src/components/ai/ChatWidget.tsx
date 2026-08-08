"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Sparkles, X, Plus, Send, Loader2, MessageSquareText, Store, Image as ImageIcon, Video, ShoppingBag, ArrowLeft, ClipboardList, MoreHorizontal, Reply, Check, CheckCheck, ChevronDown } from "lucide-react";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { ProductAttachment } from "./ProductAttachment";
import { ReplyPreviewContent } from "./ReplyPreviewContent";
import { cn } from "@/lib/utils";
import { ChatScrollArea } from "./ChatScrollArea";
import TextareaAutosize from 'react-textarea-autosize';
import { useCustomerChatInbox } from "@/components/ai/CustomerChatInboxProvider";
import { useSellerChat, type SellerConversation } from "@/hooks/useSellerChat";
import { ProductSelectPopup } from "./ProductSelectPopup";
import { OrderSelectPopup } from "./OrderSelectPopup";
import { OrderAttachment } from "./OrderAttachment";
import { ChatMediaMessage, isStandaloneChatAttachment } from "./ChatMediaMessage";
import { ChatMediaDraftPreview, ChatMediaHiddenInputs, ChatMediaUploadStatus } from "./ChatMediaDraftPreview";
import { useChatMediaDraft } from "@/hooks/useChatMediaDraft";
import {
  formatChatTime,
  getChatBubbleTailClass,
  getChatMessageGroupInfo,
  getChatMessageSpacingClass,
  CHAT_BUBBLE_BODY_CLASS,
  CHAT_BUBBLE_WRAPPER_CLASS,
} from "@/lib/chat-message-layout";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { ChatMessageMeta } from "@/components/chat/ChatMessageMeta";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { apiFetch } from "@/services/api";
import { SellerChatListItem } from "./SellerChatListItem";
import type { SellerSessionSummary } from "@/types/chat";

type PendingShopInfo = {
  id: number;
  name: string;
  avatar: string | null;
};

const SUGGESTIONS = [
  "Tư vấn son màu đỏ gạch dưới 200k",
  "Tìm tai nghe bluetooth pin trâu",
  "Chính sách bảo hành sản phẩm?",
  "Đề xuất đồ gia dụng bán chạy"
];

const SCROLL_BOTTOM_THRESHOLD = 64;

function isNearBottom(container: HTMLElement, threshold = SCROLL_BOTTOM_THRESHOLD) {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'AI' | 'SELLER'>('AI');
  const [activeShopId, setActiveShopId] = useState<number | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [deferCreate, setDeferCreate] = useState(false);
  const [pendingShopInfo, setPendingShopInfo] = useState<PendingShopInfo | null>(null);
  const [draftTextsByShopId, setDraftTextsByShopId] = useState<Record<number, string>>({});
  const [showScrollDown, setShowScrollDown] = useState(false);

  // AI Chat
  const [aiInput, setAiInput] = useState("");
  const { messages: aiMessages, isStreaming, currentStatus, sendMessage: sendAiMessage, clearChat: clearAiChat } = useAIChatStream();

  // Seller Chat inbox — WS nền khi user đăng nhập (DELIVERED + badge)
  const {
    sessions: sellerSessions,
    unreadCount: sellerUnreadCount,
    markSessionReadLocally,
    conversationAction,
    loadSessions: reloadSellerSessions,
  } = useCustomerChatInbox();

  const handleConversationCreated = useCallback((conversation: SellerConversation) => {
    setActiveConversationId(conversation.id);
    setDeferCreate(false);
    setPendingShopInfo(null);
    reloadSellerSessions(true);
  }, [reloadSellerSessions]);

  // Chỉ giữ WS khi widget đang mở — đóng widget thì presence tắt để shop nhắn sẽ có thông báo
  const {
    messages: sellerMessages,
    sendMessage: sendSellerMessage,
    conversation: sellerConversation,
    activeConversationId: sellerActiveConversationId,
    markAsRead: markSellerAsRead,
    isConnected: isSellerChatConnected,
  } = useSellerChat(
    isOpen && activeTab === 'SELLER' ? activeShopId : null,
    isOpen && activeTab === 'SELLER' ? activeConversationId : null,
    'CUSTOMER',
    {
      deferCreate: deferCreate,
      onConversationCreated: handleConversationCreated,
    }
  );
  const [sellerInput, setSellerInput] = useState("");
  const draftTextsRef = useRef(draftTextsByShopId);
  draftTextsRef.current = draftTextsByShopId;

  const syncSellerDraft = useCallback((shopId: number | null, value: string) => {
    if (!shopId) return;
    setDraftTextsByShopId((prev) => {
      const trimmed = value.trim();
      if (trimmed) {
        if (prev[shopId] === value) return prev;
        return { ...prev, [shopId]: value };
      }
      if (!(shopId in prev)) return prev;
      const next = { ...prev };
      delete next[shopId];
      return next;
    });
  }, []);

  const updateSellerInput = useCallback((value: string) => {
    setSellerInput(value);
    syncSellerDraft(activeShopId, value);
  }, [activeShopId, syncSellerDraft]);

  const clearSellerInput = useCallback(() => {
    setSellerInput("");
    syncSellerDraft(activeShopId, "");
  }, [activeShopId, syncSellerDraft]);
  
  // Popups
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false);
  
  // Drafts
  const [productDraft, setProductDraft] = useState<any>(null);
  const [orderDraft, setOrderDraft] = useState<any>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  const { showToast } = useMarketplaceStore();

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
    sendMessage: sendSellerMessage,
    replyToId: replyingToMessage?.id,
    onError: (message) => showToast(message, "danger"),
    onComplete: (count) => {
      showToast(`Đã gửi ${count} file thành công.`, "success");
      setReplyingToMessage(null);
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const sellerScrollRef = useRef<HTMLDivElement>(null);
  // Chỉ đánh dấu thông báo đã đọc khi user chủ động mở đúng đoạn chat (không phải chỉ mở widget)
  const pendingMarkShopNotifications = useRef<number | null>(null);

  const scrollToLatest = useCallback((force = false) => {
    const container =
      activeTab === "AI" ? aiScrollRef.current : sellerScrollRef.current;

    const scroll = () => {
      if (!force && container && !isNearBottom(container)) {
        setShowScrollDown((prev) => (prev ? prev : true));
        return;
      }

      if (container) {
        container.scrollTop = container.scrollHeight - container.clientHeight;
      }

      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      setShowScrollDown((prev) => (prev ? false : prev));
    };

    scroll();
    requestAnimationFrame(scroll);
    requestAnimationFrame(() => requestAnimationFrame(scroll));
    [0, 50, 150, 300, 600].forEach((delay) => setTimeout(scroll, delay));
  }, [activeTab]);

  const handleMessagesScroll = useCallback(() => {
    const container =
      activeTab === "AI" ? aiScrollRef.current : sellerScrollRef.current;
    if (!container) return;
    const nearBottom = isNearBottom(container);
    setShowScrollDown((prev) => (prev === !nearBottom ? prev : !nearBottom));
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen || activeTab !== "AI") return;
    scrollToLatest(true);
  }, [isOpen, activeTab, scrollToLatest]);

  useEffect(() => {
    if (!isOpen || activeTab !== "AI" || aiMessages.length === 0) return;
    scrollToLatest(false);
  }, [isOpen, activeTab, aiMessages, scrollToLatest]);

  useEffect(() => {
    if (!isOpen || activeTab !== "SELLER" || !activeShopId) return;
    scrollToLatest(true);
  }, [isOpen, activeTab, activeShopId, scrollToLatest]);

  const lastSellerMessageId = sellerMessages[sellerMessages.length - 1]?.id;

  useEffect(() => {
    if (!isOpen || activeTab !== "SELLER" || !activeShopId) return;
    scrollToLatest(false);
  }, [isOpen, activeTab, activeShopId, sellerMessages.length, lastSellerMessageId, scrollToLatest]);

  // Cuộn lại khi nội dung đổi kích thước (ảnh/video load xong)
  useEffect(() => {
    if (!isOpen) return;

    const container =
      activeTab === "AI" ? aiScrollRef.current : sellerScrollRef.current;
    if (!container) return;
    if (activeTab === "SELLER" && !activeShopId) return;

    const scroll = () => {
      if (!isNearBottom(container)) {
        setShowScrollDown((prev) => (prev ? prev : true));
        return;
      }
      container.scrollTop = container.scrollHeight - container.clientHeight;
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      setShowScrollDown((prev) => (prev ? false : prev));
    };

    const observer = new ResizeObserver(scroll);
    observer.observe(container);
    container.querySelectorAll("img, video").forEach((el) => observer.observe(el));

    scroll();

    return () => observer.disconnect();
  }, [isOpen, activeTab, activeShopId, aiMessages.length, sellerMessages.length]);

  useEffect(() => {
    setShowScrollDown(false);
  }, [activeTab, activeShopId]);

  const openSellerShopChat = useCallback(async (
    shopId: number,
    options?: { shopInfo?: PendingShopInfo; fromProductPage?: boolean }
  ) => {
    pendingMarkShopNotifications.current = shopId;

    const shouldCheckExisting = options?.fromProductPage !== false;
    if (shouldCheckExisting) {
      try {
        const existing = await apiFetch<SellerSessionSummary | null>(
          `/api/seller-chat/conversations/by-shop/${shopId}`
        );
        if (existing) {
          setDeferCreate(false);
          setPendingShopInfo(null);
          setActiveConversationId(existing.id);
          setActiveShopId(shopId);
          return;
        }
      } catch {
        // Fall through to deferred create
      }
    }

    setDeferCreate(true);
    setActiveConversationId(null);
    setActiveShopId(shopId);
    setPendingShopInfo(
      options?.shopInfo ?? {
        id: shopId,
        name: "Người bán",
        avatar: null,
      }
    );
  }, []);

  // Global event listener to open chat from anywhere
  useEffect(() => {
    const handleOpenChat = async (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setIsOpen(true);
      if (detail?.shopId) {
        setActiveTab('SELLER');
        await openSellerShopChat(Number(detail.shopId), {
          shopInfo: detail.shopInfo,
          fromProductPage: Boolean(detail?.fromProductPage),
        });
      }
      if (detail?.productDraft) {
        setProductDraft(detail.productDraft);
      }
    };
    window.addEventListener('open-chat-widget', handleOpenChat);
    return () => window.removeEventListener('open-chat-widget', handleOpenChat);
  }, [openSellerShopChat]);

  // Deep-link from notification: /chat?tab=SELLER&session_id=...&shop_id=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "SELLER") return;

    const shopIdParam = params.get("shop_id");
    setIsOpen(true);
    setActiveTab("SELLER");
    if (shopIdParam) {
      void openSellerShopChat(Number(shopIdParam));
    }
  }, [openSellerShopChat]);

  const lastSellerInboundIdRef = useRef(0);

  useEffect(() => {
    lastSellerInboundIdRef.current = 0;
  }, [sellerConversation?.id, sellerActiveConversationId, activeConversationId]);

  // MARK_READ + đánh dấu notification khi mở đúng đoạn chat (WS kết nối)
  useEffect(() => {
    const convId = sellerActiveConversationId ?? sellerConversation?.id;
    if (!isOpen || activeTab !== "SELLER" || !convId || !activeShopId || !isSellerChatConnected) return;

    markSellerAsRead();
    markSessionReadLocally(convId);
    window.dispatchEvent(new CustomEvent("chat-unread-refresh"));

    apiFetch("/notifications/read-by-url", {
      method: "PUT",
      body: JSON.stringify({ shop_id: activeShopId }),
    })
      .then(() => {
        window.dispatchEvent(new CustomEvent("chat-unread-refresh"));
        window.dispatchEvent(new CustomEvent("notifications-refresh"));
      })
      .catch(() => {});
  }, [isOpen, activeTab, sellerActiveConversationId, sellerConversation?.id, activeShopId, isSellerChatConnected, markSellerAsRead, markSessionReadLocally]);

  useEffect(() => {
    const convId = sellerActiveConversationId ?? sellerConversation?.id;
    if (!isOpen || activeTab !== "SELLER" || !isSellerChatConnected || !convId) return;
    const latestInbound = [...sellerMessages]
      .reverse()
      .find((message) => message.sender_type === "SELLER");
    if (!latestInbound || latestInbound.id <= lastSellerInboundIdRef.current) return;
    lastSellerInboundIdRef.current = latestInbound.id;
    markSellerAsRead();
    markSessionReadLocally(convId);
  }, [
    sellerMessages,
    isOpen,
    activeTab,
    isSellerChatConnected,
    sellerActiveConversationId,
    sellerConversation?.id,
    markSellerAsRead,
    markSessionReadLocally,
  ]);

  useEffect(() => {
    if (!activeShopId) {
      setSellerInput((prev) => (prev === "" ? prev : ""));
      return;
    }
    const next = draftTextsRef.current[activeShopId] ?? "";
    setSellerInput((prev) => (prev === next ? prev : next));
  }, [activeShopId]);

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('bg-emerald-100/50');
      setTimeout(() => el.classList.remove('bg-emerald-100/50'), 2000);
    }
  };

  const handleAiSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!aiInput.trim() || isStreaming) return;
    sendAiMessage(aiInput);
    setAiInput("");
  };

  const handleSellerSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!sellerInput.trim() && !productDraft && !orderDraft && !hasMediaDraft) return;
    
    if (productDraft) {
      const productAttachmentId = String(productDraft.public_id || productDraft.id || "");
      if (!productAttachmentId || productAttachmentId === "undefined") {
        console.error("Missing product public_id when sending chat product attachment", productDraft);
        return;
      }
      if (sellerInput.trim()) {
        await sendSellerMessage("[Sản phẩm]", 'PRODUCT', productAttachmentId);
        await sendSellerMessage(sellerInput.trim(), undefined, undefined, replyingToMessage?.id);
      } else {
        await sendSellerMessage("[Sản phẩm]", 'PRODUCT', productAttachmentId, replyingToMessage?.id);
      }
      setProductDraft(null);
      clearSellerInput();
      setReplyingToMessage(null);
    } else if (orderDraft) {
      const orderCode = orderDraft.id || orderDraft.order_code;
      if (sellerInput.trim()) {
        await sendSellerMessage("[Đơn hàng]", 'ORDER', String(orderCode));
        await sendSellerMessage(sellerInput.trim(), undefined, undefined, replyingToMessage?.id);
      } else {
        await sendSellerMessage("[Đơn hàng]", 'ORDER', String(orderCode), replyingToMessage?.id);
      }
      setOrderDraft(null);
      clearSellerInput();
      setReplyingToMessage(null);
    } else if (hasMediaDraft) {
      const caption = sellerInput.trim();
      const sent = await sendMediaDraft(caption);
      if (sent) {
        clearSellerInput();
        setReplyingToMessage(null);
      }
    } else {
      await sendSellerMessage(sellerInput.trim(), undefined, undefined, replyingToMessage?.id);
      clearSellerInput();
      setReplyingToMessage(null);
    }
  };

  const handleSelectShop = (shopId: number) => {
    const session = sellerSessions.find((item) => item.shop_id === shopId);
    pendingMarkShopNotifications.current = shopId;
    setDeferCreate(false);
    setPendingShopInfo(null);
    setActiveConversationId(session?.id ?? null);
    setActiveShopId(shopId);
    scrollToLatest(true);
  };

  const handleConversationMenuAction = async (sessionId: string, action: string) => {
    const ok = await conversationAction(sessionId, action);
    if (!ok) return;

    if (action === "delete") {
      const deleted = sellerSessions.find((s) => s.id === sessionId);
      if (deleted?.shop_id === activeShopId) {
        setActiveShopId(null);
        setActiveConversationId(null);
        setDeferCreate(false);
        setProductDraft(null);
        setOrderDraft(null);
        clearSellerInput();
      }
    }
  };

  const handleOpenWidget = () => setIsOpen(true);

  const handleCloseWidget = () => {
    if (activeShopId && deferCreate) {
      setProductDraft(null);
      setOrderDraft(null);
      clearSellerInput();
    }
    setIsOpen(false);
    setActiveShopId(null);
    setActiveConversationId(null);
    setDeferCreate(false);
    setPendingShopInfo(null);
    setShowScrollDown(false);
    pendingMarkShopNotifications.current = null;
  };

  const scrollDownButton = showScrollDown ? (
    <button
      type="button"
      onClick={() => scrollToLatest(true)}
      className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-white text-emerald-600 shadow-md transition-all hover:shadow-lg active:scale-95"
      aria-label="Xuống tin mới nhất"
      title="Xuống tin mới nhất"
    >
      <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
    </button>
  ) : null;

  const currentShopSession = sellerSessions.find(s => s.shop_id === activeShopId);
  const activeShopDisplayName = currentShopSession?.shop_name || pendingShopInfo?.name || "Đang kết nối...";
  const activeShopDisplayAvatar = currentShopSession?.shop_avatar || pendingShopInfo?.avatar || '/placeholder.png';
  const isPendingDraftChat = deferCreate && !currentShopSession;

  return (
    <>
      {/* Nút Chat nổi — kiểu Shopee, màu hệ thống */}
      {!isOpen && (
        <div className="fixed bottom-0 right-2 z-50">
          <button
            onClick={handleOpenWidget}
            className="relative flex items-center gap-2 rounded-t-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:bg-emerald-600 active:scale-[0.98]"
          >
            <MessageSquareText className="h-5 w-5 shrink-0" />
            Chat
            {sellerUnreadCount > 0 && (
              <span className="absolute -top-2 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#ee4d2d] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {sellerUnreadCount > 99 ? "99+" : sellerUnreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Khung chat — dính mép dưới, lề phải vài px */}
      {isOpen && (
        <div className="chat-widget-panel fixed bottom-0 right-2 z-50 flex h-[min(600px,calc(100vh-48px))] w-[800px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header chung */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-1.5">
            <h2 className="font-heading text-sm font-bold leading-none text-primary">Chat</h2>
            <button
              onClick={handleCloseWidget}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Thu gọn"
              aria-label="Thu gọn chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <div className="w-[280px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 min-h-0">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 p-2 gap-1 bg-white">
              <button 
                onClick={() => setActiveTab('AI')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
                  activeTab === 'AI' ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Bot className="w-4 h-4" /> AI
              </button>
              <button 
                onClick={() => setActiveTab('SELLER')}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
                  activeTab === 'SELLER' ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Store className="w-4 h-4" /> Người Bán
              </button>
            </div>
            
            {/* List */}
            <ChatScrollArea className="">
              {activeTab === 'AI' && (
                <div 
                  className="p-3 m-2 rounded-xl bg-white border border-emerald-200 cursor-pointer hover:bg-emerald-50"
                  onClick={() => {
                    setActiveShopId(null);
                    scrollToLatest(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Shepoo AI</h4>
                      <p className="text-xs text-slate-500 truncate">Trợ lý mua sắm thông minh</p>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'SELLER' && (
                sellerSessions.length === 0 ? (
                   <div className="p-8 text-center text-slate-500 text-sm">Chưa có đoạn chat nào với Người Bán.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sellerSessions.map(session => (
                      <SellerChatListItem
                        key={session.id}
                        session={session}
                        isActive={activeShopId === session.shop_id}
                        draftPreview={
                          session.shop_id && activeShopId !== session.shop_id
                            ? draftTextsByShopId[session.shop_id] ?? null
                            : null
                        }
                        onSelect={() => {
                          handleSelectShop(session.shop_id!);
                        }}
                        onAction={(action) => handleConversationMenuAction(session.id, action)}
                      />
                    ))}
                  </div>
                )
              )}
            </ChatScrollArea>
          </div>
          
          {/* Main Area */}
          <div className="flex-1 flex flex-col relative bg-white min-w-0 min-h-0 overflow-hidden">
            {activeTab === 'AI' ? (
              <>
                 <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-none">Shepoo AI</h3>
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                         <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                         Luôn sẵn sàng
                      </p>
                    </div>
                  </div>
                  <button onClick={clearAiChat} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full" title="Tạo chat mới">
                    <Plus className="w-5 h-5" />
                  </button>
                 </div>
                 
                 {aiMessages.length === 0 ? (
                  <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center space-y-6">
                    <div>
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bot className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg">Xin chào! 👋</h4>
                      <p className="text-sm text-slate-500 mt-2 max-w-sm">Tôi có thể giúp bạn tìm sản phẩm, kiểm tra tồn kho & tư vấn mua sắm.</p>
                    </div>
                    <div className="w-full max-w-sm space-y-2">
                      {SUGGESTIONS.map((sug) => (
                        <button
                          key={sug}
                          onClick={() => sendAiMessage(sug)}
                          className="w-full text-left text-sm p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-medium flex items-center gap-3 shadow-sm"
                        >
                          <Sparkles className="h-4 w-4 text-emerald-500" />
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ChatScrollArea
                    scrollRef={aiScrollRef}
                    onScroll={handleMessagesScroll}
                    className="p-4"
                    overlay={scrollDownButton}
                  >
                    <ChatMessageList
                      messages={aiMessages}
                      isStreaming={isStreaming}
                      currentStatus={currentStatus}
                    />
                    <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
                  </ChatScrollArea>
                )}
                
                <form onSubmit={handleAiSubmit} className="p-3 border-t border-slate-200 bg-slate-50">
                  <div className="flex items-end gap-2 bg-white rounded-xl border border-slate-200 p-1 pl-3 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                    <TextareaAutosize
                      minRows={1}
                      maxRows={5}
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAiSubmit();
                        }
                      }}
                      placeholder="Hỏi AI..."
                      className="flex-1 min-h-[40px] py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none no-scrollbar"
                    />
                    <button
                      type="submit"
                      disabled={!aiInput.trim() || isStreaming}
                      className={cn(
                        "m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all",
                        (!aiInput.trim() || isStreaming)
                          ? "text-slate-300 pointer-events-none"
                          : "bg-emerald-500 text-white hover:bg-emerald-600"
                      )}
                    >
                      {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              // Seller Chat Area
              activeShopId ? (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                      <button className="sm:hidden" onClick={() => setActiveShopId(null)}>
                         <ArrowLeft className="w-5 h-5 text-slate-500" />
                      </button>
                      <img src={activeShopDisplayAvatar} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-none">{activeShopDisplayName}</h3>
                        <p className="text-xs text-slate-500 mt-1">Sẵn sàng hỗ trợ</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Seller Messages */}
                  <ChatScrollArea
                    scrollRef={sellerScrollRef}
                    onScroll={handleMessagesScroll}
                    className="bg-slate-50 p-4"
                    overlay={scrollDownButton}
                  >
                    {sellerMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        {isPendingDraftChat
                          ? "Bắt đầu trò chuyện với người bán về sản phẩm này."
                          : "Chưa có tin nhắn nào. Bắt đầu trò chuyện!"}
                      </div>
                    ) : (
                      <div>
                       {sellerMessages.map((msg, idx) => {
                         const { position, showDateSeparator } = getChatMessageGroupInfo(sellerMessages, idx);
                         const spacingClass = getChatMessageSpacingClass(position, idx === 0 && !showDateSeparator);
                         const isMe = msg.sender_type === 'CUSTOMER';
                         const isSystem = msg.sender_type === 'SYSTEM';
                         const tailClass = getChatBubbleTailClass(isMe, position);
                         
                         if (isSystem) {
                           return (
                             <div key={msg.id} className="flex justify-center my-4">
                                <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full uppercase tracking-wide font-medium">{msg.content}</span>
                             </div>
                           )
                         }
                         
                         return (
                           <React.Fragment key={msg.id}>
                             {showDateSeparator && <ChatDateSeparator date={msg.created_at} />}
                             <div id={`msg-${msg.id}`} className={cn("flex w-full min-w-0 group transition-colors duration-500 rounded p-0.5 scroll-mt-4", spacingClass, isMe ? "justify-end" : "justify-start")}>
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
                                    "text-sm max-w-full min-w-0",
                                    isMe ? "ml-auto" : "mr-auto",
                                    !isStandaloneChatAttachment(msg) ? cn(
                                      "rounded-2xl px-3 py-1.5",
                                      isMe ? "bg-emerald-50 text-slate-900 shadow-sm border border-emerald-100" : "bg-white border border-slate-200 text-slate-900 shadow-sm",
                                      tailClass
                                    ) : ""
                                  )}>
                                     {msg.reply_to_id && sellerMessages.find(m => m.id === msg.reply_to_id) && (
                                       (() => {
                                         const replyMsg = sellerMessages.find(m => m.id === msg.reply_to_id)!;
                                         return (
                                            <div 
                                              onClick={() => scrollToMessage(replyMsg.id)}
                                              className={cn(
                                              "mb-2 border-l-[3px] px-2 py-1 bg-black/5 rounded-r max-w-[240px] cursor-pointer hover:bg-black/10 transition-colors",
                                              replyMsg.sender_type === 'CUSTOMER' ? "border-orange-500" : "border-teal-500"
                                            )}>
                                              <div className={cn("font-semibold text-xs", replyMsg.sender_type === 'CUSTOMER' ? "text-orange-500" : "text-teal-600")}>
                                                {replyMsg.sender_type === 'CUSTOMER' ? "Bạn" : (currentShopSession?.shop_name || "Shop")}
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
                                         <ProductAttachment publicId={msg.attachment_id} />
                                         {msg.content && msg.content !== "[Sản phẩm]" && (
                                           <div className={cn(
                                              "rounded-2xl px-4 py-2.5 text-sm w-full text-left mt-1",
                                              isMe ? "bg-emerald-50 text-slate-900 rounded-tr-sm shadow-sm border border-emerald-100" : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"
                                           )}>
                                             {msg.content}
                                           </div>
                                         )}
                                         <div className={cn(
                                           "flex items-center gap-1 text-[10px] mt-1",
                                           "justify-end text-slate-500"
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
                                         <OrderAttachment orderId={msg.attachment_id} />
                                         {msg.content && msg.content !== "[Đơn hàng]" && (
                                           <div className={cn(
                                              "rounded-2xl px-4 py-2.5 text-sm w-full text-left mt-1",
                                              isMe ? "bg-emerald-50 text-slate-900 rounded-tr-sm shadow-sm border border-emerald-100" : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"
                                           )}>
                                             {msg.content}
                                           </div>
                                         )}
                                         <div className={cn(
                                           "flex items-center gap-1 text-[10px] mt-1",
                                           "justify-end text-slate-500"
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
                                       <ChatMediaMessage msg={msg} isMe={isMe} />
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
                         )
                       })}
                      </div>
                    )}
                    <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
                  </ChatScrollArea>
                  
                  {/* Seller Input */}
                  <div className="border-t border-slate-200 bg-white">
                     {replyingToMessage && (
                       <div className="p-2 px-3 bg-slate-50 border-b border-line flex justify-between items-center text-sm">
                          <div className={cn(
                            "flex flex-col overflow-hidden pl-2 border-l-4",
                            replyingToMessage.sender_type === 'CUSTOMER' ? "border-orange-500" : "border-teal-500"
                          )}>
                            <span className={cn("font-semibold text-xs", replyingToMessage.sender_type === 'CUSTOMER' ? "text-orange-500" : "text-teal-600")}>
                              {replyingToMessage.sender_type === 'CUSTOMER' ? "Bạn" : (currentShopSession?.shop_name || "Shop")}
                            </span>
                            <span className="truncate max-w-[200px] text-slate-600 text-xs mt-0.5">
                              <ReplyPreviewContent type={replyingToMessage.attachment_type} id={replyingToMessage.attachment_id} fallback={replyingToMessage.content} />
                            </span>
                          </div>
                         <button onClick={() => setReplyingToMessage(null)} className="p-1 text-slate-400 hover:text-slate-600">
                           <X className="w-4 h-4" />
                         </button>
                      </div>
                    )}
                    {/* Draft Preview */}
                    {productDraft && (
                       <div className="p-3 bg-slate-50 border-b border-line flex justify-between items-start">
                         <div>
                            <p className="text-xs text-slate-500 mb-2">Bạn đang trao đổi với Người bán về sản phẩm này</p>
                            <div className="flex gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm items-center">
                               <img src={productDraft.images?.find((i: any) => i.is_thumbnail)?.image_url || productDraft.images?.[0]?.image_url || '/placeholder.png'} className="w-12 h-12 rounded object-cover border border-slate-100" />
                               <div>
                                 <p className="text-sm font-medium text-slate-900 line-clamp-1">{productDraft.name}</p>
                                 <p className="text-sm text-emerald-600 font-bold">{(productDraft.variants?.[0]?.sale_price || productDraft.variants?.[0]?.price || 0).toLocaleString('vi-VN')}đ</p>
                               </div>
                               <button 
                                 className="ml-4 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
                                 onClick={() => setShowProductPopup(true)}
                               >
                                 Thay đổi
                               </button>
                            </div>
                         </div>
                         <button onClick={() => setProductDraft(null)} className="p-1 text-slate-400 hover:text-slate-600">
                           <X className="w-5 h-5" />
                         </button>
                      </div>
                    )}
                    {orderDraft && (
                       <div className="p-3 bg-slate-50 border-b border-line flex justify-between items-start">
                         <div>
                            <p className="text-xs text-slate-500 mb-2">Bạn đang thắc mắc về đơn hàng này</p>
                            <div className="flex gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm items-center">
                               <img src={orderDraft.items?.[0]?.thumbnail_url || orderDraft.items?.[0]?.product_image_snapshot || '/placeholder.png'} className="w-12 h-12 rounded object-cover border border-slate-100" />
                               <div>
                                 <p className="text-sm font-medium text-slate-900 line-clamp-1">Đơn hàng #{(orderDraft.id || orderDraft.order_code || '').slice(0, 8).toUpperCase()}</p>
                                 <p className="text-sm text-emerald-600 font-bold">{orderDraft.total_amount?.toLocaleString('vi-VN')}đ</p>
                               </div>
                               <button 
                                 type="button"
                                 className="ml-4 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
                                 onClick={() => setShowOrderPopup(true)}
                               >
                                 Thay đổi
                               </button>
                            </div>
                         </div>
                         <button type="button" onClick={() => setOrderDraft(null)} className="p-1 text-slate-400 hover:text-slate-600">
                           <X className="w-5 h-5" />
                         </button>
                      </div>
                    )}
                    <ChatMediaUploadStatus uploading={mediaUploading} uploadProgress={uploadProgress} />
                    
                    <form onSubmit={handleSellerSubmit} className="p-3">
                      <div className="bg-white rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all overflow-hidden flex flex-col shadow-sm">
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
                          maxRows={5}
                          value={sellerInput}
                          onChange={(e) => updateSellerInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSellerSubmit();
                            }
                          }}
                          placeholder="Nhập nội dung tin nhắn"
                          className="w-full min-h-[40px] py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none no-scrollbar"
                        />
                        <div className="flex items-center justify-between p-1.5 border-t border-slate-50 bg-slate-50/50">
                           <div className="flex items-center gap-1">
                               <button
                                 type="button"
                                 disabled={mediaUploading || !canAddMoreMedia}
                                 onClick={openImagePicker}
                                 className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors disabled:opacity-50"
                               >
                                {mediaUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                <span className="absolute bottom-full left-0 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                                  Hình ảnh (tối đa {maxMediaFiles}, 2MB/ảnh)
                                  <span className="absolute top-full left-3 border-[4px] border-transparent border-t-slate-800" />
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={mediaUploading || !canAddMoreMedia}
                                onClick={openVideoPicker}
                                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors disabled:opacity-50"
                              >
                                <Video className="w-4 h-4" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                                  Video (tối đa {maxMediaFiles}, 30MB/video)
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
                                </span>
                              </button>
                              <button 
                                id="product-popup-trigger"
                                type="button"
                                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors" 
                                onClick={() => setShowProductPopup(p => !p)}
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                                  Gửi Sản phẩm
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
                                </span>
                              </button>
                              <button 
                                id="order-popup-trigger"
                                type="button"
                                className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors" 
                                onClick={() => setShowOrderPopup(p => !p)}
                              >
                                <ClipboardList className="w-4 h-4" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                                  Gửi Đơn hàng
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800" />
                                </span>
                              </button>
                           </div>
                           <button
                             type="submit"
                             disabled={mediaUploading || (!sellerInput.trim() && !productDraft && !orderDraft && !hasMediaDraft)}
                             className={cn(
                               "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all mr-0.5",
                               (mediaUploading || (!sellerInput.trim() && !productDraft && !orderDraft && !hasMediaDraft))
                                 ? "text-slate-300 pointer-events-none"
                                 : "text-emerald-600 hover:bg-emerald-100"
                             )}
                           >
                              <Send className="w-5 h-5 -ml-0.5" />
                           </button>
                        </div>
                      </div>
                    </form>
                  </div>
                  
                  {/* Popups for Seller */}
                  {activeShopId && (
                    <>
                       <ProductSelectPopup 
                         isOpen={showProductPopup} 
                         shopId={activeShopId} 
                         onClose={() => setShowProductPopup(false)}
                         onSelect={(product) => setProductDraft(product)}
                       />
                       <OrderSelectPopup 
                         isOpen={showOrderPopup} 
                         shopId={activeShopId} 
                         onClose={() => setShowOrderPopup(false)}
                         onSelect={(order) => setOrderDraft(order)}
                       />
                    </>
                  )}
                </>
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
                  <p className="text-sm text-slate-500">Bắt đầu nhắn tin với người bán ngay bây giờ!</p>
                </div>
              )
            )}
          </div>
          </div>
        </div>
      )}
    </>
  );
}
