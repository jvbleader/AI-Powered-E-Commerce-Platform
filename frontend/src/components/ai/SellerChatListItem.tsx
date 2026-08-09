"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { ChevronDown, MessageCircle, Pin, BellOff, Trash2, PinOff, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChatListTime } from "@/lib/chat-message-layout";
import type { SellerSessionSummary } from "@/types/chat";

type SellerChatListItemProps = {
  session: SellerSessionSummary;
  isActive: boolean;
  draftPreview?: string | null;
  onSelect: (shopId: number) => void;
  onAction: (sessionId: string, action: string) => void;
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

function SellerChatListItemInner({
  session,
  isActive,
  draftPreview,
  onSelect,
  onAction,
}: SellerChatListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shopId = session.shop_id;

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
  const unreadBadge = formatUnreadBadge(session.unread_count, session.has_unread);

  const handleClick = () => {
    if (shopId) onSelect(shopId);
  };

  return (
    <div
      className={cn(
        "relative cursor-pointer flex gap-3.5 items-center transition-colors group px-3.5 py-3.5",
        isActive ? "bg-emerald-50/90" : "hover:bg-slate-100/70"
      )}
      onClick={handleClick}
    >
      <img
        src={session.shop_avatar || "/placeholder.png"}
        alt=""
        loading="lazy"
        decoding="async"
        width={52}
        height={52}
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
            {session.shop_name}
          </h4>

          <div className="mt-1 min-w-0">
            <p
              className={cn(
                "text-[13px] leading-snug truncate",
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
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 gap-1.5 pt-0.5 min-w-[54px]">
          <span
            className={cn(
              "text-xs leading-none tabular-nums",
              session.has_unread ? "text-emerald-600 font-semibold" : "text-slate-400"
            )}
          >
            {formatChatListTime(session.updated_at)}
          </span>

          <div className="flex items-center justify-end gap-1 min-h-[18px]">
            {session.is_muted ? (
              <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="Đã tắt thông báo" />
            ) : null}
            {session.is_pinned ? (
              <Pin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-label="Đã ghim" />
            ) : null}

            {unreadBadge ? (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-semibold leading-none flex items-center justify-center">
                {unreadBadge}
              </span>
            ) : null}

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                className={cn(
                  "relative z-10 p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-opacity",
                  menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                )}
                aria-label="Tùy chọn trò chuyện"
              >
                <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2.25} />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-0.5 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
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
                          onAction(session.id, action);
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
          </div>
        </div>
      </div>
    </div>
  );
}

function listItemPropsEqual(
  prev: SellerChatListItemProps,
  next: SellerChatListItemProps
) {
  if (prev.isActive !== next.isActive) return false;
  if (prev.draftPreview !== next.draftPreview) return false;
  if (prev.onSelect !== next.onSelect) return false;
  if (prev.onAction !== next.onAction) return false;
  const a = prev.session;
  const b = next.session;
  return (
    a.id === b.id &&
    a.shop_id === b.shop_id &&
    a.updated_at === b.updated_at &&
    a.last_message === b.last_message &&
    a.has_unread === b.has_unread &&
    a.unread_count === b.unread_count &&
    a.is_pinned === b.is_pinned &&
    a.is_muted === b.is_muted &&
    a.shop_name === b.shop_name &&
    a.shop_avatar === b.shop_avatar
  );
}

export const SellerChatListItem = memo(SellerChatListItemInner, listItemPropsEqual);
