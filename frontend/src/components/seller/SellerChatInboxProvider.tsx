"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  SellerChatRealtimeProvider,
  useSellerChatInboxSlice,
  type SellerChatInboxSlice,
} from "@/contexts/SellerChatRealtimeProvider";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

const SellerChatInboxContext = createContext<SellerChatInboxSlice | null>(null);

export function SellerChatInboxProvider({ children }: { children: ReactNode }) {
  const sessionUserId = useMarketplaceStore((s) => s.state.sessionUserId);
  const ready = useMarketplaceStore((s) => s.ready);
  const enabled = ready && !!sessionUserId;

  return (
    <SellerChatRealtimeProvider asSeller={true} enabled={enabled}>
      <SellerChatInboxBridge>{children}</SellerChatInboxBridge>
    </SellerChatRealtimeProvider>
  );
}

function SellerChatInboxBridge({ children }: { children: ReactNode }) {
  const value = useSellerChatInboxSlice();
  return (
    <SellerChatInboxContext.Provider value={value}>
      {children}
    </SellerChatInboxContext.Provider>
  );
}

export function useSellerChatInboxContext() {
  const ctx = useContext(SellerChatInboxContext);
  if (!ctx) {
    throw new Error("useSellerChatInboxContext must be used within SellerChatInboxProvider");
  }
  return ctx;
}

export function useOptionalSellerChatInboxContext() {
  return useContext(SellerChatInboxContext);
}
