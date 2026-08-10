"use client";

import React, { memo, useMemo } from "react";
import { MoreHorizontal, Reply, Check, CheckCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { ProductAttachment } from "./ProductAttachment";
import { OrderAttachment } from "./OrderAttachment";
import { ChatMediaMessage, isStandaloneChatAttachment } from "./ChatMediaMessage";
import { ReplyPreviewContent } from "./ReplyPreviewContent";
import type { SellerMessage } from "@/hooks/useSellerChat";

type ViewerRole = "CUSTOMER" | "SELLER";

type SellerMessageListProps = {
  messages: SellerMessage[];
  /** Ai đang xem hội thoại — quyết định phía "Tôi". */
  viewerRole?: ViewerRole;
  /** Nhãn phía đối diện (shop name hoặc "Khách hàng"). */
  peerLabel?: string;
  emptyText: string;
  showIncomingAvatar?: boolean;
  isSellerAttachments?: boolean;
  onReply: (msg: SellerMessage) => void;
  onScrollToMessage: (msgId: number) => void;
  onClickProduct?: (product: any) => void;
};

function StatusTicks({ status, isMe }: { status: SellerMessage["status"]; isMe: boolean }) {
  if (!isMe) return null;
  if (status === "READ") return <CheckCheck className="w-3 h-3 text-emerald-500" />;
  if (status === "DELIVERED") return <CheckCheck className="w-3 h-3 text-slate-400" />;
  return <Check className="w-3 h-3 text-slate-400" />;
}

function replyLabel(
  replySender: SellerMessage["sender_type"],
  viewerRole: ViewerRole,
  peerLabel: string
) {
  if (replySender === viewerRole) return "Bạn";
  return peerLabel;
}

function SellerMessageListInner({
  messages,
  viewerRole = "CUSTOMER",
  peerLabel = "Shop",
  emptyText,
  showIncomingAvatar = false,
  isSellerAttachments = false,
  onReply,
  onScrollToMessage,
  onClickProduct,
}: SellerMessageListProps) {
  const byId = useMemo(() => {
    const map = new Map<number, SellerMessage>();
    for (const msg of messages) map.set(msg.id, msg);
    return map;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div>
      {messages.map((msg, idx) => {
        const { position, showDateSeparator } = getChatMessageGroupInfo(messages, idx);
        const spacingClass = getChatMessageSpacingClass(position, idx === 0 && !showDateSeparator);
        const isMe = msg.sender_type === viewerRole;
        const isSystem = msg.sender_type === "SYSTEM";
        const tailClass = getChatBubbleTailClass(isMe, position);
        const replyMsg = msg.reply_to_id ? byId.get(msg.reply_to_id) : undefined;

        if (isSystem) {
          return (
            <div key={msg.id} className="flex justify-center my-4">
              <span className="bg-slate-200 text-slate-600 text-[10px] px-3 py-1 rounded-full uppercase tracking-wide font-medium">
                {msg.content}
              </span>
            </div>
          );
        }

        return (
          <React.Fragment key={msg.id}>
            {showDateSeparator && <ChatDateSeparator date={msg.created_at} />}
            <div
              id={`msg-${msg.id}`}
              className={cn(
                "flex w-full min-w-0 group transition-colors duration-500 rounded p-0.5 scroll-mt-4",
                spacingClass,
                isMe ? "justify-end" : "justify-start"
              )}
            >
              {showIncomingAvatar &&
                !isMe &&
                (shouldShowIncomingAvatar(isMe, true, position) ? (
                  <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0 mr-3 overflow-hidden flex items-center justify-center mt-auto mb-0.5">
                    <User className="w-5 h-5 text-slate-400" />
                  </div>
                ) : (
                  <div className="w-8 shrink-0 mr-3" aria-hidden />
                ))}
              <div className={cn("flex items-center gap-2", viewerRole === "CUSTOMER" ? "max-w-[calc(80%-10px)]" : "max-w-[calc(80%-30px)]", CHAT_BUBBLE_WRAPPER_CLASS)}>
                {isMe && (
                  <div className="relative group/reply mr-1 flex items-center">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-emerald-500 bg-white shadow-sm border border-slate-100 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 opacity-0 invisible group-hover/reply:opacity-100 group-hover/reply:visible transition-all z-10">
                      <button
                        type="button"
                        onClick={() => onReply(msg)}
                        className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 whitespace-nowrap text-sm font-medium"
                      >
                        <Reply className="w-4 h-4" />
                        Trả lời
                      </button>
                    </div>
                  </div>
                )}
                <div className={cn("flex flex-col", CHAT_BUBBLE_WRAPPER_CLASS)}>
                  <div
                    className={cn(
                      "text-sm max-w-full min-w-0",
                      isMe ? "ml-auto" : "mr-auto",
                      !isStandaloneChatAttachment(msg)
                        ? cn(
                            "rounded-2xl px-3 py-1.5",
                            isMe
                              ? "bg-emerald-50 text-slate-900 shadow-sm border border-emerald-100"
                              : "bg-white border border-slate-200 text-slate-900 shadow-sm",
                            tailClass
                          )
                        : ""
                    )}
                  >
                    {replyMsg && (
                      <div
                        onClick={() => onScrollToMessage(replyMsg.id)}
                        className={cn(
                          "mb-2 border-l-[3px] px-2 py-1 bg-black/5 rounded-r max-w-[240px] cursor-pointer hover:bg-black/10 transition-colors",
                          replyMsg.sender_type === "CUSTOMER" ? "border-orange-500" : "border-teal-500"
                        )}
                      >
                        <div
                          className={cn(
                            "font-semibold text-xs",
                            replyMsg.sender_type === "CUSTOMER" ? "text-orange-500" : "text-teal-600"
                          )}
                        >
                          {replyLabel(replyMsg.sender_type, viewerRole, peerLabel)}
                        </div>
                        <div className="text-[13px] text-slate-600 line-clamp-1 mt-0.5">
                          <ReplyPreviewContent
                            type={replyMsg.attachment_type}
                            id={replyMsg.attachment_id}
                            fallback={replyMsg.content}
                          />
                        </div>
                      </div>
                    )}
                    {msg.attachment_type === "PRODUCT" && msg.attachment_id ? (
                      <div className="flex flex-col gap-1 items-end">
                        <ProductAttachment
                          publicId={msg.attachment_id}
                          isSeller={isSellerAttachments}
                          onClickProduct={onClickProduct}
                        />
                        {msg.content && msg.content !== "[Sản phẩm]" && (
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-sm w-full text-left mt-1",
                              isMe
                                ? "bg-emerald-50 text-slate-900 rounded-tr-sm shadow-sm border border-emerald-100"
                                : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"
                            )}
                          >
                            {msg.content}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] mt-1 justify-end text-slate-500">
                          <span>{formatChatTime(msg.created_at)}</span>
                          <StatusTicks status={msg.status} isMe={isMe} />
                        </div>
                      </div>
                    ) : msg.attachment_type === "ORDER" && msg.attachment_id ? (
                      <div className="flex flex-col gap-1 items-end">
                        <OrderAttachment orderId={msg.attachment_id} isSeller={isSellerAttachments} />
                        {msg.content && msg.content !== "[Đơn hàng]" && (
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-sm w-full text-left mt-1",
                              isMe
                                ? "bg-emerald-50 text-slate-900 rounded-tr-sm shadow-sm border border-emerald-100"
                                : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"
                            )}
                          >
                            {msg.content}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] mt-1 justify-end text-slate-500">
                          <span>{formatChatTime(msg.created_at)}</span>
                          <StatusTicks status={msg.status} isMe={isMe} />
                        </div>
                      </div>
                    ) : (msg.attachment_type === "IMAGE" || msg.attachment_type === "VIDEO") &&
                      msg.attachment_id ? (
                      <ChatMediaMessage msg={msg} isMe={isMe} />
                    ) : (
                      <span className={CHAT_BUBBLE_BODY_CLASS}>
                        {msg.content}
                        <ChatMessageMeta
                          time={formatChatTime(msg.created_at)}
                          className={isMe ? "text-slate-500" : "text-slate-400"}
                        >
                          <StatusTicks status={msg.status} isMe={isMe} />
                        </ChatMessageMeta>
                      </span>
                    )}
                  </div>
                </div>
                {!isMe && (
                  <div className="relative group/reply ml-1 flex items-center">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-emerald-500 bg-white shadow-sm border border-slate-100 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 invisible group-hover/reply:opacity-100 group-hover/reply:visible transition-all z-10">
                      <button
                        type="button"
                        onClick={() => onReply(msg)}
                        className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 whitespace-nowrap text-sm font-medium"
                      >
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
      })}
    </div>
  );
}

export const SellerMessageList = memo(SellerMessageListInner);
