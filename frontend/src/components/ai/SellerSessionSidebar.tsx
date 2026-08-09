"use client";

import React, { useCallback } from "react";
import { Bot, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { SellerChatListItem } from "./SellerChatListItem";
import type { SellerSessionSummary } from "@/types/chat";

type SellerSessionSidebarProps = {
  activeTab: "AI" | "SELLER";
  onTabChange: (tab: "AI" | "SELLER") => void;
  sellerSessions: SellerSessionSummary[];
  activeShopId: number | null;
  draftTextsRef: React.RefObject<Record<number, string>>;
  onSelectShop: (shopId: number) => void;
  onConversationAction: (sessionId: string, action: string) => void;
  onSelectAi: () => void;
};

function sessionsEqual(a: SellerSessionSummary[], b: SellerSessionSummary[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.shop_id !== y.shop_id ||
      x.updated_at !== y.updated_at ||
      x.last_message !== y.last_message ||
      x.has_unread !== y.has_unread ||
      x.unread_count !== y.unread_count ||
      x.is_pinned !== y.is_pinned ||
      x.is_muted !== y.is_muted ||
      x.shop_name !== y.shop_name ||
      x.shop_avatar !== y.shop_avatar
    ) {
      return false;
    }
  }
  return true;
}

function SellerSessionSidebarInner({
  activeTab,
  onTabChange,
  sellerSessions,
  activeShopId,
  draftTextsRef,
  onSelectShop,
  onConversationAction,
  onSelectAi,
}: SellerSessionSidebarProps) {
  const handleAiTab = useCallback(() => onTabChange("AI"), [onTabChange]);
  const handleSellerTab = useCallback(() => onTabChange("SELLER"), [onTabChange]);

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50 min-h-0">
      <div className="flex border-b border-slate-200 p-2 gap-1 bg-white">
        <button
          type="button"
          onClick={handleAiTab}
          className={cn(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
            activeTab === "AI" ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <Bot className="w-4 h-4" /> AI
        </button>
        <button
          type="button"
          onClick={handleSellerTab}
          className={cn(
            "flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
            activeTab === "SELLER" ? "bg-emerald-100 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <Store className="w-4 h-4" /> Người Bán
        </button>
      </div>

      {/* Scroll native nhẹ — không dùng ChatScrollArea (thumb/MO/RO gây jank sidebar) */}
      <div className="chat-widget-scroll-native-hidden min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {activeTab === "AI" && (
          <div
            className="p-3 m-2 rounded-xl bg-white border border-emerald-200 cursor-pointer hover:bg-emerald-50"
            onClick={onSelectAi}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Shepoo AI</h4>
                <p className="text-xs text-slate-500 truncate">Trợ lý mua sắm thông minh</p>
              </div>
            </div>
          </div>
        )}
        {activeTab === "SELLER" &&
          (sellerSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Chưa có đoạn chat nào với Người Bán.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sellerSessions.map((session) => (
                <SellerChatListItem
                  key={session.id}
                  session={session}
                  isActive={activeShopId === session.shop_id}
                  draftPreview={
                    session.shop_id && activeShopId !== session.shop_id
                      ? draftTextsRef.current[session.shop_id] ?? null
                      : null
                  }
                  onSelect={onSelectShop}
                  onAction={onConversationAction}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function sidebarPropsEqual(
  prev: SellerSessionSidebarProps,
  next: SellerSessionSidebarProps
) {
  return (
    prev.activeTab === next.activeTab &&
    prev.activeShopId === next.activeShopId &&
    prev.draftTextsRef === next.draftTextsRef &&
    prev.onTabChange === next.onTabChange &&
    prev.onSelectShop === next.onSelectShop &&
    prev.onConversationAction === next.onConversationAction &&
    prev.onSelectAi === next.onSelectAi &&
    sessionsEqual(prev.sellerSessions, next.sellerSessions)
  );
}

export const SellerSessionSidebar = React.memo(SellerSessionSidebarInner, sidebarPropsEqual);
