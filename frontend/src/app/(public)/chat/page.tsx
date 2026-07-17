"use client";

import { useState } from "react";
import { Bot, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { formatDate } from "@/lib/helpers";

export default function ChatPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const [mode, setMode] = useState<"AI" | "SUPPORTER">("AI");
  const conversation = store.state.conversations[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <Section title="Chat hỗ trợ">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel>
            <div className="grid gap-2">
              <Button variant={mode === "AI" ? "primary" : "secondary"} onClick={() => setMode("AI")}>
                <Bot className="h-4 w-4" />Chat AI
              </Button>
              <Button variant={mode === "SUPPORTER" ? "primary" : "secondary"} onClick={() => setMode("SUPPORTER")}>
                <MessageSquare className="h-4 w-4" />Gặp supporter
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {store.state.conversations.map((item) => (
                <a key={item.id} href={`/supporter/conversations/${item.id}`} className="block rounded-panel border border-line p-3 hover:border-primary/40">
                  <p className="font-bold">{item.title}</p>
                  <p className="text-xs text-muted">{item.mode} - {item.status}</p>
                </a>
              ))}
            </div>
          </Panel>
          {conversation ? (
            <ChatWindow conversationId={conversation.id} mode={mode} />
          ) : (
            <Panel className="min-h-[560px] flex items-center justify-center">
              <p className="text-muted text-sm font-semibold">Không có cuộc trò chuyện nào.</p>
            </Panel>
          )}
        </div>
      </Section>
    </main>
  );

  function ChatWindow({ conversationId, mode }: { conversationId: string; mode?: "AI" | "SUPPORTER" }) {
    const conversationItem = store.state.conversations.find((item) => item.id === conversationId) ?? store.state.conversations[0];
    return (
      <Panel className="min-h-[560px]">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="font-bold">{conversationItem.title}</h3>
            <p className="text-sm text-muted">{mode ?? conversationItem.mode} - {conversationItem.status}</p>
          </div>
          <Button variant="secondary" onClick={() => showToast("Đã gửi yêu cầu hỗ trợ.", "success")}>Chuyển hỗ trợ</Button>
        </div>
        <div className="mt-4 space-y-3">
          {conversationItem.messages.map((message) => (
            <div key={message.id} className={cn("flex", message.sender === "CUSTOMER" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-panel border p-3 text-sm", message.sender === "CUSTOMER" ? "border-primary bg-primary text-white" : "border-line bg-canvas text-ink")}>
                <p className="font-bold">{message.sender}</p>
                <p className="mt-1 leading-6">{message.text}</p>
                <p className="mt-1 text-xs opacity-75">{formatDate(message.createdAt)} - {message.isRead ? "Đã đọc" : "Chưa đọc"}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto]">
          <Input placeholder="Nhập tin nhắn" />
          <Input type="file" aria-label="Đính kèm ảnh hoặc file" />
          <Button onClick={() => showToast("Đã gửi tin nhắn.", "success")}>Gửi</Button>
        </div>
      </Panel>
    );
  }
}
