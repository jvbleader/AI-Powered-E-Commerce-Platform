"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  SellerChatRealtimeProvider,
  useSellerChatInboxSlice,
  type SellerChatInboxSlice,
} from "@/contexts/SellerChatRealtimeProvider";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

const CustomerChatInboxContext = createContext<SellerChatInboxSlice | null>(null);

/** Giữ multiplex WS nền khi user đăng nhập — inbox + conversation trên một socket. */
export function CustomerChatInboxProvider({ children }: { children: ReactNode }) {
  const sessionUserId = useMarketplaceStore((s) => s.state.sessionUserId);
  const ready = useMarketplaceStore((s) => s.ready);
  const enabled = ready && !!sessionUserId;

  return (
    <SellerChatRealtimeProvider asSeller={false} enabled={enabled}>
      <CustomerChatInboxBridge>{children}</CustomerChatInboxBridge>
    </SellerChatRealtimeProvider>
  );
}

function CustomerChatInboxBridge({ children }: { children: ReactNode }) {
  const value = useSellerChatInboxSlice();
  return (
    <CustomerChatInboxContext.Provider value={value}>
      {children}
    </CustomerChatInboxContext.Provider>
  );
}

export function useCustomerChatInbox() {
  const ctx = useContext(CustomerChatInboxContext);
  if (!ctx) {
    throw new Error("useCustomerChatInbox must be used within CustomerChatInboxProvider");
  }
  return ctx;
}
