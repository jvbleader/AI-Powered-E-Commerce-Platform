export type ChatMessageGroupPosition = "single" | "first" | "middle" | "last";

import { parseApiDateTime } from "@/lib/helpers";

const CHAT_TIMEZONE = "Asia/Ho_Chi_Minh";

export function parseChatDate(value?: string | Date): Date | null {
  return parseApiDateTime(value);
}

export function formatChatTime(value?: string | Date): string {
  const dateObj = parseChatDate(value);
  if (!dateObj) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: CHAT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dateObj);
}

export function formatChatDateSeparator(value?: string | Date): string {
  const dateObj = parseChatDate(value);
  if (!dateObj) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: CHAT_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

export function getChatDayKey(value?: string | Date): string | null {
  const dateObj = parseChatDate(value);
  if (!dateObj) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj);
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
