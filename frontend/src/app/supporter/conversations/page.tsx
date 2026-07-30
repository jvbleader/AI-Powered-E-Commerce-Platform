"use client";

import { useEffect, useState, useRef } from "react";
import { Send, UserCircle2, Loader2, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/helpers";
import TextareaAutosize from 'react-textarea-autosize';
import { useSupporterChat } from "@/hooks/useSupporterChat";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function SupporterWorkspace() {
  const [activeTab, setActiveTab] = useState<"QUEUE" | "ACTIVE">("ACTIVE");
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      const { apiFetch } = await import("@/services/api");
      const endpoint = activeTab === "QUEUE" ? "/api/support-chat/conversations?unassigned=true" : "/api/support-chat/conversations?active=true";
      const data = await apiFetch<any[]>(endpoint);
      if (data) setConversations(data);
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[600px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden m-4 shadow-sm">
      {/* Column 1: List */}
      <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 border-b flex gap-2">
          <Button 
            variant={activeTab === "ACTIVE" ? "default" : "outline"} 
            className={cn("flex-1", activeTab === "ACTIVE" && "bg-blue-500 hover:bg-blue-600")}
            onClick={() => setActiveTab("ACTIVE")}
          >
            Đang xử lý
          </Button>
          <Button 
            variant={activeTab === "QUEUE" ? "default" : "outline"} 
            className={cn("flex-1", activeTab === "QUEUE" && "bg-blue-500 hover:bg-blue-600")}
            onClick={() => setActiveTab("QUEUE")}
          >
            Hàng đợi
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-3 space-y-2">
          {conversations.length === 0 ? (
            <p className="text-center text-slate-400 text-sm mt-4">Không có dữ liệu</p>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.id} 
                onClick={() => setSelectedConvId(conv.id)}
                className={cn(
                  "p-3 rounded-lg cursor-pointer border transition-all",
                  selectedConvId === conv.id ? "bg-blue-50 border-blue-200 shadow-xs" : "bg-white border-transparent hover:bg-slate-50"
                )}
              >
                <div className="font-bold text-sm text-slate-800 flex justify-between items-start">
                  <span>{conv.customer ? conv.customer.full_name : (conv.customer_id ? `User #${conv.customer_id}` : "Khách vãng lai")}</span>
                  {conv.status === "CLOSED" && <span className="text-[10px] text-slate-400 font-normal">Đã đóng</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">{formatDate(conv.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 2: Chat area */}
      <div className="flex-1 bg-slate-50 flex flex-col min-w-0">
        {selectedConvId ? <ChatBox conversationId={selectedConvId} onStateChange={fetchConversations} /> : (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-3">
            <MessageSquare className="w-16 h-16 opacity-20" />
            <p className="font-medium text-lg text-slate-400">Chọn một hội thoại để bắt đầu</p>
          </div>
        )}
      </div>
      
      {/* Column 3: Context Panel */}
      <div className="w-[300px] bg-white border-l border-slate-200 shrink-0 hidden lg:block">
        {selectedConvId ? <ContextPanel conversationId={selectedConvId} onStateChange={fetchConversations} setSelectedConvId={setSelectedConvId}/> : null}
      </div>
    </div>
  );
}

function ChatBox({ conversationId, onStateChange }: { conversationId: string, onStateChange: () => void }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, conversation, isConnected, sendMessage, refetchConversation } = useSupporterChat(conversationId, 'SUPPORTER');
  const store = useMarketplaceStore();

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView();
  }, [messages]);

  const handleJoin = async () => {
    try {
      const { apiFetch } = await import("@/services/api");
      await apiFetch(`/api/support-chat/conversations/${conversationId}/join`, { method: "POST" });
    } catch (e: any) {
      store.showToast(e.message || "Lỗi", "error");
    } finally {
      onStateChange();
      await refetchConversation();
    }
  };

  const isAssignedToMe = Boolean(
    conversation?.supporter?.public_id && 
    store.getCurrentUser()?.id && 
    conversation.supporter.public_id === store.getCurrentUser()?.id
  );
  const isUnassigned = conversation?.supporter_id === null;

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex items-center gap-3 p-4 border-b bg-slate-50 shrink-0">
        <h2 className="font-bold text-lg text-slate-800">
           Hội thoại: <span className="text-slate-500 font-mono text-sm">{conversationId.split("-")[0]}...</span>
        </h2>
        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", isConnected ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
          {isConnected ? "Đã kết nối" : "Ngắt kết nối"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-4 md:p-6 space-y-4 relative">
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
            <div key={msg.id} className={cn("flex", msg.sender_type === "SUPPORTER" ? "justify-end" : "justify-start")}>
              {msg.sender_type === "CUSTOMER" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mr-2 shadow-xs">
                  <UserCircle2 className="h-5 w-5" />
                </div>
              )}
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl max-w-[75%] text-sm leading-relaxed shadow-sm break-words",
                  msg.sender_type === "SUPPORTER"
                    ? "bg-blue-500 text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                )}
              >
                <p>{msg.content}</p>
                <p className={cn("mt-1 text-[10px] font-semibold", msg.sender_type === "SUPPORTER" ? "text-blue-200 text-right" : "text-slate-400")}>
                  {formatDate(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-50 border-t relative">
        {isUnassigned && conversation?.status === "OPEN" && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <Button onClick={handleJoin} className="bg-blue-500 hover:bg-blue-600 font-bold px-8 shadow-md text-white rounded-full">
              Nhận khách hàng này
            </Button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); if(input.trim() && isConnected) { sendMessage(input); setInput(""); } }} className="flex gap-3">
          <TextareaAutosize
            minRows={1} maxRows={4} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if(input.trim() && isConnected) { sendMessage(input); setInput(""); } } }}
            placeholder="Nhập câu trả lời..."
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none outline-none shadow-sm"
            disabled={!isConnected || !isAssignedToMe || conversation?.status === "CLOSED"}
          />
          <Button type="submit" disabled={!input.trim() || !isConnected || !isAssignedToMe || conversation?.status === "CLOSED"} className="h-12 w-12 bg-blue-500 hover:bg-blue-600 shrink-0 shadow-sm rounded-xl">
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function ContextPanel({ conversationId, onStateChange, setSelectedConvId }: { conversationId: string, onStateChange: () => void, setSelectedConvId: (id: string|null) => void }) {
  const { conversation } = useSupporterChat(conversationId, 'SUPPORTER');
  const store = useMarketplaceStore();

  const handleClose = async () => {
    try {
      const { apiFetch } = await import("@/services/api");
      await apiFetch(`/api/support-chat/conversations/${conversationId}/close`, { method: "POST" });
      store.showToast("Đã kết thúc hội thoại", "success");
      onStateChange();
    } catch (e: any) {
      store.showToast(e.message || "Lỗi", "error");
    }
  };

  const isAssignedToMe = Boolean(
    conversation?.supporter?.public_id && 
    store.getCurrentUser()?.id && 
    conversation.supporter.public_id === store.getCurrentUser()?.id
  );

  if (!conversation) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b bg-white text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto flex items-center justify-center text-blue-400 mb-4 shadow-sm">
          <User className="w-10 h-10" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">
          {conversation.customer ? conversation.customer.full_name : (conversation.customer_id ? `User #${conversation.customer_id}` : "Khách vãng lai")}
        </h3>
        {conversation.guest_id && <p className="text-xs text-slate-400 mt-1 break-all">ID: {conversation.guest_id.substring(0, 8)}...</p>}
      </div>
      
      <div className="p-4 space-y-4 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 font-bold mb-1.5 uppercase tracking-wider">Trạng thái</p>
          <div className="flex items-center gap-2 text-sm font-bold">
            {conversation.status === "OPEN" ? <span className="text-emerald-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Mở</span> : <span className="text-slate-500">Đã kết thúc</span>}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] text-slate-500 font-bold mb-1.5 uppercase tracking-wider">Ngày tạo</p>
          <p className="text-sm font-medium text-slate-700">{formatDate(conversation.created_at)}</p>
        </div>
      </div>
      
      <div className="p-4 bg-white border-t">
        <Button variant="destructive" className="w-full font-bold shadow-sm" onClick={handleClose} disabled={conversation.status === "CLOSED" || !isAssignedToMe}>
          Kết thúc cuộc gọi
        </Button>
      </div>
    </div>
  );
}
