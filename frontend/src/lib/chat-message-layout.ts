export type ChatMessageGroupPosition = "single" | "first" | "middle" | "last";

import { parseApiDateTime } from "@/lib/helpers";


export function parseChatDate(value?: string | Date): Date | null {
  return parseApiDateTime(value);
}

export function formatChatTime(value?: string | Date): string {
  const dateObj = parseChatDate(value);
  if (!dateObj) return "";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);
  return `${parts.hour}:${parts.minute}`;
}

/**
 * Định dạng thời gian cho danh sách phiên chat AI:
 * - Trong ngày: hiển thị giờ phút (HH:mm)
 * - Ngày khác cùng năm: hiển thị ngày tháng (DD/MM)
 * - Từ năm trước trở đi: hiển thị cả ngày tháng năm (DD/MM/YYYY)
 */
export function formatAIChatTime(value?: string | Date): string {
  const dateObj = parseChatDate(value);
  if (!dateObj) return "";

  const now = new Date();
  const isToday =
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear();

  if (isToday) {
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const isCurrentYear = dateObj.getFullYear() === now.getFullYear();
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");

  if (isCurrentYear) {
    return `${day}/${month}`;
  }

  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Thời gian sidebar: hôm nay → giờ, hôm qua → "Hôm qua", lâu hơn → ngày. */

export function formatChatListTime(value?: string | Date): string {
  const dateObj = parseChatDate(value);
  if (!dateObj) return "";

  const dayKey = getChatDayKey(dateObj);
  const todayKey = getChatDayKey(new Date());
  if (dayKey && dayKey === todayKey) {
    return formatChatTime(dateObj);
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey && dayKey === getChatDayKey(yesterday)) {
    return "Hôm qua";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const parts = formatter.formatToParts(dateObj).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatChatDateSeparator(value?: string | Date): string {
  const dateObj = parseChatDate(value);
  if (!dateObj) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

export function getChatDayKey(value?: string | Date): string | null {
  const dateObj = parseChatDate(value);
  if (!dateObj) return null;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(dateObj).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isSameChatDay(a?: string | Date, b?: string | Date): boolean {
  const dayA = getChatDayKey(a);
  const dayB = getChatDayKey(b);
  if (!dayA || !dayB) return false;
  return dayA === dayB;
}

export function shouldShowChatDateSeparator(
  current?: string | Date,
  previous?: string | Date
): boolean {
  if (!previous) return Boolean(parseChatDate(current));
  return !isSameChatDay(current, previous);
}

function isGroupableSender(senderType?: string): boolean {
  return Boolean(senderType && senderType !== "SYSTEM");
}

export function getChatMessageGroupInfo<T extends { created_at?: string; sender_type?: string }>(
  messages: T[],
  index: number
): { position: ChatMessageGroupPosition; showDateSeparator: boolean } {
  const msg = messages[index];
  const prev = index > 0 ? messages[index - 1] : undefined;
  const next = index < messages.length - 1 ? messages[index + 1] : undefined;

  const showDateSeparator = shouldShowChatDateSeparator(msg.created_at, prev?.created_at);

  if (!isGroupableSender(msg.sender_type)) {
    return { position: "single", showDateSeparator };
  }

  const senderKey = msg.sender_type!;
  const groupedWithPrev =
    prev &&
    isGroupableSender(prev.sender_type) &&
    prev.sender_type === senderKey &&
    !showDateSeparator;

  const groupedWithNext =
    next &&
    isGroupableSender(next.sender_type) &&
    next.sender_type === senderKey &&
    !shouldShowChatDateSeparator(next.created_at, msg.created_at);

  if (groupedWithPrev && groupedWithNext) return { position: "middle", showDateSeparator };
  if (groupedWithPrev && !groupedWithNext) return { position: "last", showDateSeparator };
  if (!groupedWithPrev && groupedWithNext) return { position: "first", showDateSeparator };
  return { position: "single", showDateSeparator };
}

export function getChatMessageSpacingClass(
  position: ChatMessageGroupPosition,
  isFirstRenderable: boolean
): string {
  if (isFirstRenderable) return "";
  if (position === "first" || position === "single") return "mt-3";
  return "mt-0.5";
}

export function getChatBubbleTailClass(isMe: boolean, position: ChatMessageGroupPosition): string {
  if (position === "middle" || position === "last") return "";
  return isMe ? "rounded-tr-sm" : "rounded-tl-sm";
}

export function shouldShowIncomingAvatar(
  isMe: boolean,
  showAvatar: boolean,
  position: ChatMessageGroupPosition
): boolean {
  if (isMe || !showAvatar) return false;
  return position === "single" || position === "last";
}

/** Wrap long unbroken strings inside chat bubbles without overflowing the panel. */
export const CHAT_BUBBLE_BODY_CLASS =
  "whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed";

export const CHAT_BUBBLE_WRAPPER_CLASS = "max-w-full min-w-0";
