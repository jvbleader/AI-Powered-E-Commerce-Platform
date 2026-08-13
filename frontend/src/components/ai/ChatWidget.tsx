"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Sparkles, X, Plus, MessageSquareText, ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { ReplyPreviewContent } from "./ReplyPreviewContent";
import { cn } from "@/lib/utils";
import { ChatScrollArea } from "./ChatScrollArea";
import { useCustomerChatInbox } from "@/components/ai/CustomerChatInboxProvider";
import { useSellerChat, type SellerConversation, type SellerMessage } from "@/hooks/useSellerChat";
import { ProductSelectPopup } from "./ProductSelectPopup";
import { OrderSelectPopup } from "./OrderSelectPopup";
import { useChatMediaDraft } from "@/hooks/useChatMediaDraft";
import { useContainWheelScroll } from "@/hooks/useContainWheelScroll";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { apiFetch } from "@/services/api";
import { SellerSessionSidebar } from "./SellerSessionSidebar";
import { SellerMessageList } from "./SellerMessageList";
import { AiComposerInput } from "./AiComposerInput";
import { SellerComposerInput } from "./SellerComposerInput";
import type { SellerSessionSummary } from "@/types/chat";

type PendingShopInfo = {
  id: number;
  name: string;
  avatar: string | null;
  shop_slug?: string | null;
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
  const [showScrollDown, setShowScrollDown] = useState(false);

  // AI Chat
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
  /** Chỉ dùng ref — tránh setState mỗi phím (re-render cả list tin). */
  const draftTextsRef = useRef<Record<number, string>>({});

  const writeSellerDraft = useCallback((shopId: number | null, value: string) => {
    if (!shopId) return;
    const drafts = draftTextsRef.current;
    const trimmed = value.trim();
    if (trimmed) {
      if (drafts[shopId] === value) return;
      draftTextsRef.current = { ...drafts, [shopId]: value };
      return;
    }
    if (!(shopId in drafts)) return;
    const next = { ...drafts };
    delete next[shopId];
    draftTextsRef.current = next;
  }, []);

  const clearSellerDraft = useCallback(() => {
    writeSellerDraft(activeShopId, "");
  }, [activeShopId, writeSellerDraft]);
  
  // Popups
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false);
  
  // Drafts
  const [productDraft, setProductDraft] = useState<any>(null);
  const [orderDraft, setOrderDraft] = useState<any>(null);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  const showToast = useMarketplaceStore((s) => s.showToast);

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

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const sellerScrollRef = useRef<HTMLDivElement>(null);
  useContainWheelScroll(panelRef, isOpen);
  // Chỉ đánh dấu thông báo đã đọc khi user chủ động mở đúng đoạn chat (không phải chỉ mở widget)
  const pendingMarkShopNotifications = useRef<number | null>(null);
  const skipNextSoftScrollRef = useRef(false);

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

      setShowScrollDown((prev) => (prev ? false : prev));
    };

    scroll();
    requestAnimationFrame(scroll);
  }, [activeTab]);

  const handleMessagesScroll = useCallback(() => {
    const container =
      activeTab === "AI" ? aiScrollRef.current : sellerScrollRef.current;
    if (!container) return;
    const nearBottom = isNearBottom(container);
    setShowScrollDown((prev) => (prev === !nearBottom ? prev : !nearBottom));
  }, [activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "AI") {
      if (aiMessages.length > 0) skipNextSoftScrollRef.current = true;
      scrollToLatest(true);
    } else if (activeTab === "SELLER" && activeShopId) {
      if (sellerMessages.length > 0) skipNextSoftScrollRef.current = true;
      scrollToLatest(true);
    }
  }, [isOpen, activeTab, activeShopId, scrollToLatest]);

  const lastAiMessageId = aiMessages[aiMessages.length - 1]?.id;

  useEffect(() => {
    if (!isOpen || activeTab !== "AI" || aiMessages.length === 0) return;
    if (skipNextSoftScrollRef.current) {
      skipNextSoftScrollRef.current = false;
      return;
    }
    scrollToLatest(false);
  }, [aiMessages.length, lastAiMessageId, isOpen, activeTab, scrollToLatest]);

  const lastSellerMessageId = sellerMessages[sellerMessages.length - 1]?.id;

  useEffect(() => {
    if (!isOpen || activeTab !== "SELLER" || !activeShopId) return;
    if (skipNextSoftScrollRef.current) {
      skipNextSoftScrollRef.current = false;
      return;
    }
    scrollToLatest(false);
  }, [sellerMessages.length, lastSellerMessageId, isOpen, activeTab, activeShopId, scrollToLatest]);

  // Cuộn lại khi nội dung đổi kích thước (ảnh/video load xong)
  useEffect(() => {
    if (!isOpen) return;

    const container =
      activeTab === "AI" ? aiScrollRef.current : sellerScrollRef.current;
    if (!container) return;
    if (activeTab === "SELLER" && !activeShopId) return;

    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!isNearBottom(container)) {
          setShowScrollDown((prev) => (prev ? prev : true));
          return;
        }
        container.scrollTop = container.scrollHeight - container.clientHeight;
        setShowScrollDown((prev) => (prev ? false : prev));
      });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    container.querySelectorAll("img, video").forEach((el) => observer.observe(el));

    const mo = new MutationObserver(() => {
      container.querySelectorAll("img, video").forEach((el) => observer.observe(el));
    });
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isOpen, activeTab, activeShopId]);

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
      if (detail?.orderDraft) {
        setOrderDraft(detail.orderDraft);
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

  const scrollToMessage = useCallback((msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('bg-emerald-100/50');
      setTimeout(() => el.classList.remove('bg-emerald-100/50'), 2000);
    }
  }, []);

  const handleReplyToMessage = useCallback((msg: SellerMessage) => {
    setReplyingToMessage(msg);
  }, []);

  const handleAiSend = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    sendAiMessage(text);
  }, [isStreaming, sendAiMessage]);

  const handleSellerSend = useCallback(async (text: string): Promise<boolean> => {
    const trimmed = text.trim();
    if (!trimmed && !productDraft && !orderDraft && !hasMediaDraft) return false;

    if (productDraft) {
      const productAttachmentId = String(productDraft.public_id || productDraft.id || "");
      if (!productAttachmentId || productAttachmentId === "undefined") {
        console.error("Missing product public_id when sending chat product attachment", productDraft);
        return false;
      }
      if (trimmed) {
        await sendSellerMessage("[Sản phẩm]", "PRODUCT", productAttachmentId);
        await sendSellerMessage(trimmed, undefined, undefined, replyingToMessage?.id);
      } else {
        await sendSellerMessage("[Sản phẩm]", "PRODUCT", productAttachmentId, replyingToMessage?.id);
      }
      setProductDraft(null);
      clearSellerDraft();
      setReplyingToMessage(null);
      return true;
    }

    if (orderDraft) {
      const orderCode = orderDraft.orderCode || orderDraft.order_code || orderDraft.id;
      if (trimmed) {
        await sendSellerMessage("[Đơn hàng]", "ORDER", String(orderCode));
        await sendSellerMessage(trimmed, undefined, undefined, replyingToMessage?.id);
      } else {
        await sendSellerMessage("[Đơn hàng]", "ORDER", String(orderCode), replyingToMessage?.id);
      }
      setOrderDraft(null);
      clearSellerDraft();
      setReplyingToMessage(null);
      return true;
    }

    if (hasMediaDraft) {
      const sent = await sendMediaDraft(trimmed);
      if (!sent) return false;
      clearSellerDraft();
      setReplyingToMessage(null);
      return true;
    }

    await sendSellerMessage(trimmed, undefined, undefined, replyingToMessage?.id);
    clearSellerDraft();
    setReplyingToMessage(null);
    return true;
  }, [
    productDraft,
    orderDraft,
    hasMediaDraft,
    sendSellerMessage,
    sendMediaDraft,
    replyingToMessage?.id,
    clearSellerDraft,
  ]);

  const activeShopIdRef = useRef(activeShopId);
  activeShopIdRef.current = activeShopId;
  const sellerSessionsRef = useRef(sellerSessions);
  sellerSessionsRef.current = sellerSessions;
  const conversationActionRef = useRef(conversationAction);
  conversationActionRef.current = conversationAction;
  const scrollToLatestRef = useRef(scrollToLatest);
  scrollToLatestRef.current = scrollToLatest;
  const clearSellerDraftRef = useRef(clearSellerDraft);
  clearSellerDraftRef.current = clearSellerDraft;

  const handleSelectShop = useCallback((shopId: number) => {
    if (shopId === activeShopIdRef.current) return;

    const session = sellerSessionsRef.current.find((item) => item.shop_id === shopId);
    pendingMarkShopNotifications.current = shopId;
    setDeferCreate(false);
    setPendingShopInfo(null);
    setActiveConversationId(session?.id ?? null);
    setActiveShopId(shopId);
    scrollToLatestRef.current(true);
  }, []);

  const handleConversationMenuAction = useCallback(async (sessionId: string, action: string) => {
    const ok = await conversationActionRef.current(sessionId, action);
    if (!ok) return;

    if (action === "delete") {
      const deleted = sellerSessionsRef.current.find((s) => s.id === sessionId);
      if (deleted?.shop_id === activeShopIdRef.current) {
        setActiveShopId(null);
        setActiveConversationId(null);
        setDeferCreate(false);
        setProductDraft(null);
        setOrderDraft(null);
        clearSellerDraftRef.current();
      }
    }
  }, []);

  const handleTabChange = useCallback((tab: "AI" | "SELLER") => {
    setActiveTab(tab);
  }, []);

  const handleSelectAi = useCallback(() => {
    setActiveShopId(null);
    scrollToLatestRef.current(true);
  }, []);

  const handleOpenWidget = () => setIsOpen(true);

  const handleCloseWidget = () => {
    if (activeShopId && deferCreate) {
      setProductDraft(null);
      setOrderDraft(null);
      clearSellerDraft();
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
        <div ref={panelRef} className="chat-widget-panel fixed bottom-0 right-2 z-50 flex h-[min(600px,calc(100vh-48px))] w-[800px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header chung */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-1.5">
            <h2 className="font-heading text-sm font-bold leading-none text-primary flex items-center gap-1.5">
              Chat
              {sellerUnreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[11px] font-black text-emerald-700">
                  {sellerUnreadCount}
                </span>
              )}
            </h2>
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
          <SellerSessionSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            sellerSessions={sellerSessions}
            activeShopId={activeShopId}
            draftTextsRef={draftTextsRef}
            onSelectShop={handleSelectShop}
            onConversationAction={handleConversationMenuAction}
            onSelectAi={handleSelectAi}
          />
          
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
                
                <AiComposerInput isStreaming={isStreaming} onSend={handleAiSend} />
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
                      <Link href={`/shops/${currentShopSession?.shop_slug || pendingShopInfo?.shop_slug || activeShopId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src={activeShopDisplayAvatar} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                        <div>
                          <h3 className="font-bold text-slate-900 text-base leading-none">{activeShopDisplayName}</h3>
                          <p className="text-xs text-slate-500 mt-1">Sẵn sàng hỗ trợ</p>
                        </div>
                      </Link>
                    </div>
                  </div>
                  
                  {/* Seller Messages */}
                  <ChatScrollArea
                    scrollRef={sellerScrollRef}
                    onScroll={handleMessagesScroll}
                    className="bg-slate-50 p-4"
                    overlay={scrollDownButton}
                  >
                    <SellerMessageList
                      messages={sellerMessages}
                      viewerRole="CUSTOMER"
                      peerLabel={currentShopSession?.shop_name || "Shop"}
                      emptyText={
                        isPendingDraftChat
                          ? "Bắt đầu trò chuyện với người bán về sản phẩm này."
                          : "Chưa có tin nhắn nào. Bắt đầu trò chuyện!"
                      }
                      onReply={handleReplyToMessage}
                      onScrollToMessage={scrollToMessage}
                      onClickProduct={setPreviewProduct}
                    />
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
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-start z-10 relative shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Bạn đang chuẩn bị gửi sản phẩm này</p>
              <div className="flex gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm items-center hover:border-emerald-200 transition-colors">
                <img src={productDraft.images?.find((i: any) => i.is_thumbnail)?.image_url || productDraft.images?.[0]?.image_url || '/placeholder.png'} className="w-12 h-12 rounded object-cover border border-slate-100" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 line-clamp-1">{productDraft.name}</p>
                  <p className="text-sm text-emerald-600 font-bold mt-0.5">{Number(productDraft.variants?.[0]?.sale_price || productDraft.variants?.[0]?.price || 0).toLocaleString('vi-VN')}đ</p>
                </div>
                <button 
                  className="ml-3 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  onClick={() => setShowProductPopup(true)}
                >
                  Thay đổi
                </button>
              </div>
            </div>
            <button onClick={() => setProductDraft(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
                    {orderDraft && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-start z-10 relative shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Bạn đang chuẩn bị gửi đơn hàng này</p>
              <div className="flex gap-3 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm items-center hover:border-emerald-200 transition-colors">
                <img src={orderDraft.items?.[0]?.product_image_snapshot || orderDraft.items?.[0]?.thumbnail_url || '/placeholder.png'} className="w-12 h-12 rounded object-cover border border-slate-100" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 line-clamp-1">#{orderDraft.order_code ? orderDraft.order_code.toUpperCase() : (orderDraft.id || '').slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm text-emerald-600 font-bold mt-0.5">{Number(orderDraft.total_amount || 0).toLocaleString('vi-VN')}đ</p>
                </div>
                <button 
                  className="ml-3 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  onClick={() => setShowOrderPopup(true)}
                >
                  Thay đổi
                </button>
              </div>
            </div>
            <button onClick={() => setOrderDraft(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>
                    )}
                    <SellerComposerInput
                      key={activeShopId}
                      shopId={activeShopId}
                      initialValue={draftTextsRef.current[activeShopId] ?? ""}
                      onDraftChange={writeSellerDraft}
                      onSend={handleSellerSend}
                      mediaUploading={mediaUploading}
                      uploadProgress={uploadProgress}
                      mediaDraftItems={mediaDraftItems}
                      hasMediaDraft={hasMediaDraft}
                      canAddMoreMedia={canAddMoreMedia}
                      maxMediaFiles={maxMediaFiles}
                      hasProductDraft={Boolean(productDraft)}
                      hasOrderDraft={Boolean(orderDraft)}
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
                      onToggleProductPopup={() => setShowProductPopup((p) => !p)}
                      onToggleOrderPopup={() => setShowOrderPopup((p) => !p)}
                    />
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
                  {previewProduct.variants?.[0]?.salePrice ? Number(previewProduct.variants[0].salePrice).toLocaleString('vi-VN') : Number(previewProduct.variants?.[0]?.price || 0).toLocaleString('vi-VN')}đ
                </span>
                {previewProduct.variants?.[0]?.salePrice && (
                  <span className="text-sm text-slate-400 line-through">
                    {Number(previewProduct.variants[0].price).toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
