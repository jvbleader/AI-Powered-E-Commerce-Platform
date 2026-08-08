"use client";

import { type ReactNode } from "react";
import { SupportChatRealtimeProvider } from "@/contexts/SupportChatRealtimeProvider";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

type CustomerSupportInboxProviderProps = {
  children: ReactNode;
  guestId?: string | null;
  enabled?: boolean;
};

function resolveGuestId(propGuestId?: string | null): string | null {
  if (propGuestId) return propGuestId;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("guest_id");
}

/** Giữ multiplex WS nền trên trang hỗ trợ — inbox + conversation trên một socket. */
export function CustomerSupportInboxProvider({
  children,
  guestId = null,
  enabled: enabledProp,
}: CustomerSupportInboxProviderProps) {
  const ready = useMarketplaceStore((s) => s.ready);
  const effectiveGuestId = resolveGuestId(guestId);
  // Luôn cần guest_id trên WS (kể cả khi đã đăng nhập) để subscribe ổn định.
  const enabled = (enabledProp ?? true) && ready && !!effectiveGuestId;

  return (
    <SupportChatRealtimeProvider
      mode="customer"
      guestId={effectiveGuestId}
      asCustomer
      enabled={enabled}
    >
      {children}
    </SupportChatRealtimeProvider>
  );
}
