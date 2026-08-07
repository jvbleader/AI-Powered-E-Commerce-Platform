"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, Sparkles, X, Plus, Send, Loader2, MessageSquareText, Store, Image as ImageIcon, Video, Package, ShoppingBag, ArrowLeft, Smile, ClipboardList, MoreHorizontal, Reply, Check, CheckCheck } from "lucide-react";
import { useAIChatStream } from "@/hooks/useAIChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { ProductAttachment } from "./ProductAttachment";
import { ReplyPreviewContent } from "./ReplyPreviewContent";
import { cn } from "@/lib/utils";
import TextareaAutosize from 'react-textarea-autosize';
import { useSellerChatSessions } from "@/hooks/useSellerChatSessions";
import { useSellerChat } from "@/hooks/useSellerChat";
import { ProductSelectPopup } from "./ProductSelectPopup";
import { OrderSelectPopup } from "./OrderSelectPopup";
import { OrderAttachment } from "./OrderAttachment";

const SUGGESTIONS = [
  "Tư vấn son màu đỏ gạch dưới 200k",
  "Tìm tai nghe bluetooth pin trâu",
  "Chính sách bảo hành sản phẩm?",
  "Đề xuất đồ gia dụng bán chạy"
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'AI' | 'SELLER'>('AI');
  const [activeShopId, setActiveShopId] = useState<number | null>(null);

  // AI Chat
  const [aiInput, setAiInput] = useState("");
  const { messages: aiMessages, isStreaming, currentStatus, sendMessage: sendAiMessage, clearChat: clearAiChat } = useAIChatStream();

  // Seller Chat
  const { sessions: sellerSessions, loadSessions } = useSellerChatSessions();
  const { messages: sellerMessages, sendMessage: sendSellerMessage, conversation: sellerConversation, markAsRead: markSellerAsRead, markAsDelivered: markSellerAsDelivered } = useSellerChat(activeShopId);
  const [sellerInput, setSellerInput] = useState("");
  
  // Popups
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false);
  
  // Drafts
  const [productDraft, setProductDraft] = useState<any>(null);
  const [orderDraft, setOrderDraft] = useState<any>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to allow render
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [aiMessages, sellerMessages, isOpen, activeTab]);

  // Global event listener to open chat from anywhere
  useEffect(() => {
    const handleOpenChat = (e: CustomEvent) => {
      setIsOpen(true);
      if (e.detail?.shopId) {
        setActiveTab('SELLER');
        setActiveShopId(e.detail.shopId);
      }
      if (e.detail?.productDraft) {
        setProductDraft(e.detail.productDraft);
      }
    };
    window.addEventListener('open-chat-widget', handleOpenChat as EventListener);
    return () => window.removeEventListener('open-chat-widget', handleOpenChat as EventListener);
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'SELLER') {
      loadSessions();
      markSellerAsRead();
    } else if (!isOpen && sellerMessages.length > 0) {
      markSellerAsDelivered();
    }
  }, [isOpen, activeTab, loadSessions, sellerMessages, markSellerAsRead, markSellerAsDelivered]);

  useEffect(() => {
    let interval: any;
    if (activeTab === 'SELLER') {
      loadSessions(true);
      interval = setInterval(() => loadSessions(true), 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, loadSessions]);

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

  const handleSellerSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!sellerInput.trim() && !productDraft && !orderDraft) return;
    
    if (productDraft) {
      if (sellerInput.trim()) {
        sendSellerMessage("[Sản phẩm]", 'PRODUCT', String(productDraft.public_id));
        setTimeout(() => sendSellerMessage(sellerInput.trim(), undefined, undefined, replyingToMessage?.id), 100);
      } else {
        sendSellerMessage("[Sản phẩm]", 'PRODUCT', String(productDraft.public_id), replyingToMessage?.id);
      }
      setProductDraft(null);
    } else if (orderDraft) {
      const orderCode = orderDraft.id || orderDraft.order_code;
      if (sellerInput.trim()) {
        sendSellerMessage(`Tôi muốn hỏi về đơn hàng #${orderCode.slice(0, 8).toUpperCase()}`, 'ORDER', String(orderCode));
        setTimeout(() => sendSellerMessage(sellerInput.trim(), undefined, undefined, replyingToMessage?.id), 100);
      } else {
        sendSellerMessage(`Tôi muốn hỏi về đơn hàng #${orderCode.slice(0, 8).toUpperCase()}`, 'ORDER', String(orderCode), replyingToMessage?.id);
      }
      setOrderDraft(null);
    } else {
      sendSellerMessage(sellerInput.trim(), undefined, undefined, replyingToMessage?.id);
    }
    setSellerInput("");
    setReplyingToMessage(null);
  };

  const handleSelectShop = (shopId: number) => {
    setActiveShopId(shopId);
  };

  const currentShopSession = sellerSessions.find(s => s.shop_id === activeShopId);

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-soft transition-all duration-300 hover:scale-105 active:scale-95 group",
          isOpen ? "bg-slate-800" : "bg-emerald-500"
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6 transition-transform group-hover:rotate-90" />
        ) : (
          <MessageSquareText className="h-6 w-6 transition-transform group-hover:scale-110" />
        )}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-canvas"></span>
          </span>
        )}
      </button>

      {/* Chat Dialog Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[600px] w-[800px] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-5">
          
          {/* Sidebar */}
          <div className="w-[280px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
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
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'AI' && (
                <div 
                  className="p-3 m-2 rounded-xl bg-white border border-emerald-200 cursor-pointer hover:bg-emerald-50"
                  onClick={() => setActiveShopId(null)}
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
                  <div className="p-2 space-y-1">
                    {sellerSessions.map(session => (
                      <div 
                        key={session.id}
                        onClick={() => handleSelectShop(session.shop_id!)}
                        className={cn(
                          "p-2 rounded-lg cursor-pointer flex gap-3 items-center transition-colors",
                          activeShopId === session.shop_id ? "bg-emerald-50 border border-emerald-100" : "hover:bg-slate-200/50 border border-transparent"
                        )}
                      >
                         <img src={session.shop_avatar || '/placeholder.png'} alt="shop avatar" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                         <div className="flex-1 min-w-0">
                           <div className="flex justify-between items-baseline">
                              <h4 className="font-bold text-sm text-slate-900 truncate">{session.shop_name}</h4>
                              <span className="text-[10px] text-slate-400 shrink-0">{new Date(session.updated_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <p className="text-xs text-slate-500 truncate">{session.last_message}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
          
          {/* Main Area */}
          <div className="flex-1 flex flex-col relative bg-white min-w-0">
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
                  <div className="flex-1 overflow-y-auto p-4">
                    <ChatMessageList
                      messages={aiMessages}
                      isStreaming={isStreaming}
                      currentStatus={currentStatus}
                    />
                    <div ref={messagesEndRef} />
                  </div>
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
                      <img src={currentShopSession?.shop_avatar || '/placeholder.png'} className="w-10 h-10 rounded-full border border-slate-200 object-cover" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-none">{currentShopSession?.shop_name || "Đang kết nối..."}</h3>
                        <p className="text-xs text-slate-500 mt-1">Sẵn sàng hỗ trợ</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Seller Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {sellerMessages.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa có tin nhắn nào. Bắt đầu trò chuyện!</div>
                    ) : (
                       sellerMessages.map(msg => {
                         const isMe = msg.sender_type === 'CUSTOMER';
                         const isSystem = msg.sender_type === 'SYSTEM';
                         
                         if (isSystem) {
                           return (
                             <div key={msg.id} className="flex justify-center my-4">
                                <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full uppercase tracking-wide font-medium">{msg.content}</span>
                             </div>
                           )
                         }
                         
                         return (
                           <div key={msg.id} id={`msg-${msg.id}`} className={cn("flex w-full group transition-colors duration-500 rounded p-0.5 scroll-mt-4", isMe ? "justify-end" : "justify-start")}>
                              <div className="flex items-center gap-2 max-w-[80%]">
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
                                <div className="flex flex-col">
                                  <div className={cn(
                                    "text-sm w-fit",
                                    isMe ? "ml-auto" : "mr-auto",
                                    msg.attachment_type === 'PRODUCT' ? "" : cn(
                                      "rounded-2xl px-4 py-2.5",
                                      isMe ? "bg-emerald-50 text-slate-900 rounded-tr-sm shadow-sm border border-emerald-100" : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"
                                    )
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
                                            <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
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
                                         {msg.content && (
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
                                            <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                                            {isMe && (
                                              msg.status === 'READ' ? <CheckCheck className="w-3 h-3 text-emerald-500" /> :
                                              msg.status === 'DELIVERED' ? <CheckCheck className="w-3 h-3 text-slate-400" /> :
                                              <Check className="w-3 h-3 text-slate-400" />
                                            )}
                                         </div>
                                       </div>
                                     ) : (
                                       <>
                                         {msg.content}
                                         <div className={cn(
                                           "flex items-center gap-1 text-[10px] mt-1",
                                           isMe ? "justify-end text-slate-500" : "justify-start text-slate-400"
                                         )}>
                                            <span>{new Date(msg.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                                            {isMe && (
                                              msg.status === 'READ' ? <CheckCheck className="w-3 h-3 text-emerald-500" /> :
                                              msg.status === 'DELIVERED' ? <CheckCheck className="w-3 h-3 text-slate-400" /> :
                                              <Check className="w-3 h-3 text-slate-400" />
                                            )}
                                         </div>
                                       </>
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
                         )
                       })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
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
                    
                    <form onSubmit={handleSellerSubmit} className="p-3">
                      <div className="bg-white rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all overflow-hidden flex flex-col shadow-sm">
                        <TextareaAutosize
                          minRows={1}
                          maxRows={5}
                          value={sellerInput}
                          onChange={(e) => setSellerInput(e.target.value)}
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
                               <button type="button" className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors">
                                <ImageIcon className="w-4 h-4" />
                                <span className="absolute bottom-full left-0 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                                  Hình ảnh
                                  <span className="absolute top-full left-3 border-[4px] border-transparent border-t-slate-800" />
                                </span>
                              </button>
                              <button type="button" className="group relative p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-emerald-600 rounded-md transition-colors">
                                <Video className="w-4 h-4" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[11px] font-medium text-white bg-slate-800 rounded shadow-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-[350ms] whitespace-nowrap z-50 pointer-events-none">
                                  Video
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
                             disabled={(!sellerInput.trim() && !productDraft && !orderDraft)}
                             className={cn(
                               "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all mr-0.5",
                               (!sellerInput.trim() && !productDraft && !orderDraft)
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
      )}
    </>
  );
}
