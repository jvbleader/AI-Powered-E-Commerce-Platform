"use client";

import React from "react";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHAT_MEDIA_PLACEHOLDER } from "@/lib/chat-media";
import { formatChatTime, CHAT_BUBBLE_BODY_CLASS } from "@/lib/chat-message-layout";
import { ChatMessageMeta } from "@/components/chat/ChatMessageMeta";
import { MediaAttachment, MediaAttachmentFallback } from "@/components/ai/MediaAttachment";
import type { SellerMessage } from "@/hooks/useSellerChat";

function MediaMessageOverlay({
  msg,
  isMe,
}: {
  msg: SellerMessage;
  isMe: boolean;
}) {
  return (
    <>
      <span>{formatChatTime(msg.created_at)}</span>
      {isMe && (
        msg.status === "READ" ? (
          <CheckCheck className="w-3 h-3 text-emerald-300" />
        ) : msg.status === "DELIVERED" ? (
          <CheckCheck className="w-3 h-3 text-white/80" />
        ) : (
          <Check className="w-3 h-3 text-white/80" />
        )
      )}
    </>
  );
}

export function ChatMediaMessage({
  msg,
  isMe,
  bubbleClassName,
}: {
  msg: SellerMessage;
  isMe: boolean;
  bubbleClassName?: string;
}) {
  const mediaType = msg.attachment_type === "VIDEO" ? "VIDEO" : "IMAGE";
  const placeholder = CHAT_MEDIA_PLACEHOLDER[mediaType];
  const hasCaption = Boolean(msg.content && msg.content.trim() && msg.content !== placeholder);

  return (
    <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
      {msg.attachment_id ? (
        <MediaAttachment
          type={mediaType}
          url={msg.attachment_id}
          overlay={<MediaMessageOverlay msg={msg} isMe={isMe} />}
        />
      ) : (
        <MediaAttachmentFallback type={mediaType} />
      )}
      {hasCaption && (
        <div
          className={cn(
            "rounded-2xl px-3 py-1.5 text-sm w-full text-left mt-1",
            isMe
              ? "bg-emerald-50 text-slate-900 rounded-tr-sm shadow-sm border border-emerald-100"
              : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm",
            bubbleClassName
          )}
        >
          <span className={CHAT_BUBBLE_BODY_CLASS}>
            {msg.content}
            <ChatMessageMeta
              time={formatChatTime(msg.created_at)}
              className={isMe ? "text-slate-500" : "text-slate-400"}
            >
              {isMe && (
                msg.status === "READ" ? (
                  <CheckCheck className="w-3 h-3 text-emerald-500" />
                ) : msg.status === "DELIVERED" ? (
                  <CheckCheck className="w-3 h-3 text-slate-400" />
                ) : (
                  <Check className="w-3 h-3 text-slate-400" />
                )
              )}
            </ChatMessageMeta>
          </span>
        </div>
      )}
    </div>
  );
}

export function isChatMediaMessage(msg: Pick<SellerMessage, "attachment_type">) {
  return msg.attachment_type === "IMAGE" || msg.attachment_type === "VIDEO";
}

export function isStandaloneChatAttachment(msg: Pick<SellerMessage, "attachment_type">) {
  return (
    msg.attachment_type === "PRODUCT" ||
    msg.attachment_type === "ORDER" ||
    msg.attachment_type === "IMAGE" ||
    msg.attachment_type === "VIDEO"
  );
}
