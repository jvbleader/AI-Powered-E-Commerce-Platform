"use client";

import React, { useCallback } from "react";
import { Bot, Store, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChatListTime, formatAIChatTime } from "@/lib/chat-message-layout";
import { SellerChatListItem } from "./SellerChatListItem";
import type { SellerSessionSummary } from "@/types/chat";
import type { AIChatSessionSummary } from "@/services/aiChatService";

type SellerSessionSidebarProps = {
  activeTab: "AI" | "SELLER";
  onTabChange: (tab: "AI" | "SELLER") => void;
  sellerSessions: SellerSessionSummary[];
  activeShopId: number | null;
  draftTextsRef: React.RefObject<Record<number, string>>;
  onSelectShop: (shopId: number) => void;
  onConversationAction: (sessionId: string, action: string) => void;
  onSelectAi: () => void;
  aiSessions?: AIChatSessionSummary[];
  activeAiSessionId?: string;
  isLoadingAiSessions?: boolean;
  onSelectAiSession?: (sessionId: string) => void;
  onNewAiChat?: () => void;
  onDeleteAiSession?: (sessionId: string) => void;
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

function aiSessionsEqual(a?: AIChatSessionSummary[], b?: AIChatSessionSummary[]) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].sessionId !== b[i].sessionId ||
      a[i].title !== b[i].title ||
      a[i].updatedAt !== b[i].updatedAt
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
  aiSessions = [],
  activeAiSessionId = "",
  isLoadingAiSessions = false,
  onSelectAiSession,
  onNewAiChat,
  onDeleteAiSession,
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

      {activeTab === "AI" && onNewAiChat && (
        <div className="p-2 border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={onNewAiChat}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs group"
          >
            <Plus className="w-4 h-4 text-emerald-600 transition-transform group-hover:rotate-90 duration-200" />
            <span>Tạo đoạn chat mới</span>
          </button>
        </div>
      )}

      {/* Scroll native nhẹ — không dùng ChatScrollArea (thumb/MO/RO gây jank sidebar) */}
      <div className="chat-widget-scroll-native-hidden min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {activeTab === "AI" && (
          <div className="py-2">
            <div className="text-[11px] font-bold text-slate-500 px-3.5 pb-2 uppercase tracking-wider">
              Lịch sử trò chuyện
            </div>
            {isLoadingAiSessions && aiSessions.length === 0 ? (
              <div className="space-y-2 px-3">
                <div className="h-12 rounded-lg bg-slate-200/60 animate-pulse" />
                <div className="h-12 rounded-lg bg-slate-200/60 animate-pulse" />
                <div className="h-12 rounded-lg bg-slate-200/60 animate-pulse" />
              </div>
            ) : aiSessions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                Chưa có lịch sử trò chuyện AI nào.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
                {aiSessions.map((session) => {
                  const isActive = activeAiSessionId === session.sessionId;
                  return (
                    <div
                      key={session.sessionId}
                      onClick={() => onSelectAiSession?.(session.sessionId)}
                      className={cn(
                        "group relative px-4 py-3 transition-colors cursor-pointer flex items-center justify-between gap-2.5",
                        isActive
                          ? "bg-emerald-50/90"
                          : "bg-white hover:bg-slate-50"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600" />
                      )}
                      <div className="flex-1 min-w-0 pr-1">
                        <h4
                          className={cn(
                            "text-[13px] truncate leading-snug",
                            isActive ? "font-bold text-emerald-950" : "font-medium text-slate-800 group-hover:text-slate-950"
                          )}
                          title={session.title}
                        >
                          {session.title}
                        </h4>
                        <span className={cn(
                          "inline-block text-[11px] mt-1 leading-none tabular-nums font-normal",
                          isActive ? "text-emerald-700 font-medium" : "text-slate-400"
                        )}>
                          {formatAIChatTime(session.updatedAt || session.createdAt)}
                        </span>
                      </div>
                      {onDeleteAiSession && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAiSession(session.sessionId);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all shrink-0"
                          title="Xóa đoạn chat này"
                          aria-label="Xóa đoạn chat này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                      ? draftTextsRef.current?.[session.shop_id] ?? null
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
    prev.activeAiSessionId === next.activeAiSessionId &&
    prev.isLoadingAiSessions === next.isLoadingAiSessions &&
    prev.onSelectAiSession === next.onSelectAiSession &&
    prev.onNewAiChat === next.onNewAiChat &&
    prev.onDeleteAiSession === next.onDeleteAiSession &&
    sessionsEqual(prev.sellerSessions, next.sellerSessions) &&
    aiSessionsEqual(prev.aiSessions, next.aiSessions)
  );
}

export const SellerSessionSidebar = React.memo(SellerSessionSidebarInner, sidebarPropsEqual);

