"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageCircle, Pin, BellOff, Trash2, PinOff, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChatTime } from "@/lib/chat-message-layout";
import type { SellerSessionSummary } from "@/types/chat";

type SellerChatListItemProps = {
  session: SellerSessionSummary;
  isActive: boolean;
  draftPreview?: string | null;
  onSelect: () => void;
  onAction: (action: string) => void;
};

const MENU_ITEMS = [
  { action: "mark_unread", label: "Đánh dấu chưa đọc", icon: MessageCircle },
  { action: "pin", label: "Ghim Trò Chuyện", icon: Pin, toggleAction: "unpin", toggleLabel: "Bỏ ghim", toggleIcon: PinOff, toggleKey: "is_pinned" as const },
  { action: "mute", label: "Tắt thông báo", icon: BellOff, toggleAction: "unmute", toggleLabel: "Bật thông báo", toggleIcon: Bell, toggleKey: "is_muted" as const },
  { action: "delete", label: "Xóa trò chuyện", icon: Trash2, danger: true },
];

function formatUnreadBadge(count?: number, hasUnread?: boolean): string | null {
  if (!hasUnread) return null;
  const value = count && count > 0 ? count : 1;
  return value > 99 ? "99+" : String(value);
}

export function SellerChatListItem({
  session,
  isActive,
  draftPreview,
  onSelect,
  onAction,
}: SellerChatListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const previewText = draftPreview
    ? draftPreview
    : session.last_message || "Chưa có tin nhắn";

  const showDraft = Boolean(draftPreview);
  const showActions = isHovered || isHeld || menuOpen;
  const unreadBadge = formatUnreadBadge(session.unread_count, session.has_unread);

  return (
    <div
      className={cn(
        "relative cursor-pointer flex gap-3.5 items-center transition-colors group px-3.5 py-3.5",
        isActive ? "bg-emerald-50/90" : "hover:bg-slate-100/70"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsHeld(false);
      }}
      onTouchStart={() => setIsHeld(true)}
      onTouchEnd={() => setIsHeld(false)}
      onTouchCancel={() => setIsHeld(false)}
      onClick={onSelect}
    >
      <img
        src={session.shop_avatar || "/placeholder.png"}
        alt="shop avatar"
        className="w-[52px] h-[52px] rounded-full object-cover border border-slate-200 shrink-0"
      />

      <div className="flex-1 min-w-0 flex gap-2">
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "text-[15px] leading-tight truncate",
              session.has_unread ? "font-bold text-slate-900" : "font-semibold text-slate-800"
            )}
          >
            {session.is_pinned ? "📌 " : ""}
            {session.shop_name}
          </h4>

          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <p
              className={cn(
                "text-[13px] leading-snug truncate flex-1",
                session.has_unread ? "font-medium text-slate-700" : "text-slate-500"
              )}
            >
              {showDraft ? (
                <>
                  <span className="text-red-500 font-semibold">[Bản nháp] </span>
                  <span>{previewText}</span>
                </>
              ) : (
                previewText
              )}
            </p>
            {session.is_muted ? (
              <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-1.5 pt-0.5 min-w-[54px]">
          <span
            className={cn(
              "text-xs leading-none tabular-nums",
              session.has_unread ? "text-emerald-600 font-semibold" : "text-slate-400"
            )}
          >
            {formatChatTime(session.updated_at)}
          </span>

          <div className="flex items-center justify-end gap-1 min-h-[18px]">
            {unreadBadge ? (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold leading-none flex items-center justify-center">
                {unreadBadge}
              </span>
            ) : null}

            {showActions ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
                aria-label="Tùy chọn trò chuyện"
              >
                <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2.25} />
              </button>
            ) : (
              <span className="w-[18px] h-[18px] shrink-0" aria-hidden />
            )}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-3 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {MENU_ITEMS.map((item) => {
            const isToggled = item.toggleKey ? Boolean(session[item.toggleKey]) : false;
            const action = isToggled && item.toggleAction ? item.toggleAction : item.action;
            const label = isToggled && item.toggleLabel ? item.toggleLabel : item.label;
            const Icon = isToggled && item.toggleIcon ? item.toggleIcon : item.icon;

            return (
              <button
                key={item.action}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors",
                  item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700"
                )}
                onClick={() => {
                  onAction(action);
                  setMenuOpen(false);
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
