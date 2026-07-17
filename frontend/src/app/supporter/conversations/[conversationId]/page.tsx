"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/containers";
import { formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
  isRead: boolean;
}

export default function SupporterChatPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const store = useMarketplaceStore();
  const { showToast } = store;

  const conversation =
    store.state.conversations.find((item) => item.id === conversationId) ??
    store.state.conversations[0];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    setMessages(conversation?.messages || []);
  }, [conversation]);

  if (!conversation) {
    return (
      <Panel className="min-h-[560px] flex items-center justify-center">
        <p className="text-muted text-sm font-semibold">
          Không có cuộc trò chuyện nào.
        </p>
      </Panel>
    );
  }

  const handleTransfer = () => {
    const updatedConversations = store.state.conversations.map((item) =>
      item.id === conversationId ? { ...item, mode: "AI" as const, status: "CLOSED" as const } : item
    );
    store.setConversations(updatedConversations);
    showToast("Đã gửi yêu cầu hỗ trợ chuyển AI.", "success");
  };

  const handleSend = () => {
    if (!inputText.trim()) {
      showToast("Vui lòng nhập tin nhắn.", "danger");
      return;
    }
    const newMessage = {
      id: Date.now().toString(),
      sender: "SUPPORTER" as const,
      text: inputText,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    const updatedConversations = store.state.conversations.map((item) =>
      item.id === conversationId ? { ...item, messages: [...item.messages, newMessage] } : item
    );
    store.setConversations(updatedConversations);
    showToast("Đã gửi tin nhắn.", "success");
    setInputText("");
  };

  return (
    <Panel className="min-h-[560px]">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 className="font-bold">{conversation.title}</h3>
          <p className="text-sm text-muted">
            {conversation.mode} - {conversation.status}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleTransfer}
        >
          Chuyển hỗ trợ
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.sender === "CUSTOMER" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[78%] rounded-panel border p-3 text-sm",
                message.sender === "CUSTOMER"
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-canvas text-ink"
              )}
            >
              <p className="font-bold">{message.sender}</p>
              <p className="mt-1 leading-6">{message.text}</p>
              <p className="mt-1 text-xs opacity-75">
                {formatDate(message.createdAt)} -{" "}
                {message.isRead ? "Đã đọc" : "Chưa đọc"}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto]">
        <Input placeholder="Nhập tin nhắn" value={inputText} onChange={(e) => setInputText(e.target.value)} />
        <Input type="file" aria-label="Đính kèm ảnh hoặc file" />
        <Button onClick={handleSend}>Gửi</Button>
      </div>
    </Panel>
  );
}
