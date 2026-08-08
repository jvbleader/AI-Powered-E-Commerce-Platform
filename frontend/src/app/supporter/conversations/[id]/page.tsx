"use client";

import { useRef, useEffect } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { useSupporterChat } from "@/hooks/useSupporterChat";
import {
  getChatMessageGroupInfo,
  getChatMessageSpacingClass,
  shouldShowIncomingAvatar,
} from "@/lib/chat-message-layout";
import { ChatDateSeparator } from "@/components/chat/ChatDateSeparator";
import { SupportChatComposer } from "@/components/support/SupportChatComposer";
import { SupportChatMessageBubble } from "@/components/support/SupportChatMessage";

export default function SupporterChatDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isConnected, sendMessage } = useSupporterChat(id, "SUPPORTER");

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4 border-b bg-slate-50">
        <Link href="/supporter/conversations">
          <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            Hội thoại: <span className="text-slate-500 font-mono text-sm">{id ? id.split("-")[0] : ""}...</span>
          </h2>
          <p className="text-xs text-indigo-600 font-medium">
            {isConnected ? "Đã kết nối" : "Đang kết nối..."}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {messages.map((msg, idx) => {
          const { position, showDateSeparator } = getChatMessageGroupInfo(messages, idx);
          const isMe = msg.sender_type === "SUPPORTER";
          const spacingClass = getChatMessageSpacingClass(position, idx === 0 && !showDateSeparator);

          return (
            <div key={msg.id}>
              {showDateSeparator && <ChatDateSeparator date={msg.created_at} />}
              <div className={spacingClass}>
                <SupportChatMessageBubble
                  msg={msg}
                  isMe={isMe}
                  groupPosition={position}
                  showAvatar={shouldShowIncomingAvatar(isMe, msg.sender_type === "CUSTOMER", position)}
                />
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <SupportChatComposer
        conversationId={id}
        isConnected={isConnected}
        disabled={!isConnected}
        sendMessage={sendMessage}
        placeholder="Nhập câu trả lời cho khách hàng..."
        compact
      />
    </div>
  );
}
