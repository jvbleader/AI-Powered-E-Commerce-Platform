"use client";

import type { Message, SupportAttachment } from "@/hooks/useSupporterChat";
import { cn } from "@/lib/utils";
import { CHAT_MEDIA_PLACEHOLDER, getFileLabelFromUrl } from "@/lib/chat-media";
import {
  formatChatTime,
  getChatBubbleTailClass,
  type ChatMessageGroupPosition,
  CHAT_BUBBLE_BODY_CLASS,
} from "@/lib/chat-message-layout";
import { MediaAttachment } from "@/components/ai/MediaAttachment";
import { ChatMessageMeta } from "@/components/chat/ChatMessageMeta";
import { FileText, Headset, UserCircle2 } from "lucide-react";

function getMessageAttachments(msg: Message): SupportAttachment[] {
  if (msg.attachments?.length) return msg.attachments;
  if (msg.attachment_type && msg.attachment_id) {
    return [{ type: msg.attachment_type, url: msg.attachment_id }];
  }
  return [];
}

function isPlaceholderContent(content: string, attachments: SupportAttachment[]) {
  if (!content.trim()) return true;
  if (content.match(/^\[\d+ tệp đính kèm\]$/)) return true;
  if (attachments.length === 1) {
    const placeholder = CHAT_MEDIA_PLACEHOLDER[attachments[0].type];
    return content === placeholder;
  }
  return attachments.length > 1 && Object.values(CHAT_MEDIA_PLACEHOLDER).includes(content as typeof CHAT_MEDIA_PLACEHOLDER[keyof typeof CHAT_MEDIA_PLACEHOLDER]);
}

export function isSupportAttachmentMessage(msg: Pick<Message, "attachment_type" | "attachment_id" | "attachments">) {
  return Boolean(
    msg.attachments?.length ||
    ((msg.attachment_type === "IMAGE" || msg.attachment_type === "VIDEO" || msg.attachment_type === "FILE") && msg.attachment_id)
  );
}

export function SupportChatMessageBubble({
  msg,
  isMe,
  showAvatar = true,
  groupPosition = "single",
}: {
  msg: Message;
  isMe: boolean;
  showAvatar?: boolean;
  groupPosition?: ChatMessageGroupPosition;
}) {
  if (msg.sender_type === "SYSTEM") {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-slate-100 text-slate-500 text-xs py-1 px-3 rounded-full font-medium">
          {msg.content}
        </div>
      </div>
    );
  }

  const attachments = getMessageAttachments(msg);
  const hasAttachment = attachments.length > 0;
  const hasCaption = Boolean(msg.content?.trim() && !isPlaceholderContent(msg.content, attachments));
  const time = formatChatTime(msg.created_at);
  const tailClass = getChatBubbleTailClass(isMe, groupPosition);

  return (
    <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
      {!isMe && (
        showAvatar ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-500 mr-2.5 mt-auto mb-0.5 shadow-xs">
            {msg.sender_type === "SUPPORTER" ? (
              <Headset className="h-5 w-5" />
            ) : (
              <UserCircle2 className="h-5 w-5" />
            )}
          </div>
        ) : (
          <div className="w-8 shrink-0 mr-2.5" aria-hidden />
        )
      )}

      <div className={cn("flex flex-col gap-1 max-w-[85%] md:max-w-[75%]", isMe ? "items-end" : "items-start")}>
        {hasAttachment && (
          <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
            {attachments.map((attachment, index) => {
              if (attachment.type === "IMAGE") {
                return <MediaAttachment key={`${attachment.url}-${index}`} type="IMAGE" url={attachment.url} />;
              }
              if (attachment.type === "VIDEO") {
                return <MediaAttachment key={`${attachment.url}-${index}`} type="VIDEO" url={attachment.url} />;
              }
              return (
                <a
                  key={`${attachment.url}-${index}`}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm transition-colors",
                    isMe
                      ? "bg-blue-500 border-blue-400 text-white hover:bg-blue-600"
                      : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      isMe ? "bg-white/20" : "bg-blue-50 text-blue-500"
                    )}
                  >
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{getFileLabelFromUrl(attachment.url)}</p>
                    <p className={cn("text-xs mt-0.5", isMe ? "text-blue-100" : "text-slate-500")}>
                      Nhấn để tải xuống
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {(hasCaption || !hasAttachment) && (
          <div
            className={cn(
              "px-3 py-1.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words max-w-full",
              isMe
                ? "bg-blue-500 text-white border-transparent"
                : "bg-white border border-slate-200 text-slate-800",
              tailClass,
              hasAttachment && hasCaption && "mt-0.5"
            )}
          >
            <span className={CHAT_BUBBLE_BODY_CLASS}>
              {msg.content}
              <ChatMessageMeta
                time={time}
                className={isMe ? "text-blue-100" : "text-slate-400"}
              />
            </span>
          </div>
        )}

        {hasAttachment && !hasCaption && (
          <span className={cn("text-[11px] font-medium px-1", isMe ? "text-blue-300" : "text-slate-400")}>
            {time}
          </span>
        )}
      </div>
    </div>
  );
}

export type { Message };
