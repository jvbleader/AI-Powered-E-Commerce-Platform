"use client";
import { useEffect, useRef, ReactNode } from "react";
import { useMarketplaceStore } from "./use-marketplace-store";
import { persistState } from "./slices/types";

export function StoreInitializer() {
  const initialize = useMarketplaceStore(state => state.initialize);
  const ready = useMarketplaceStore(state => state.ready);
  const state = useMarketplaceStore(state => state.state);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!ready) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistState(state);
      persistTimerRef.current = null;
    }, 500); // Debounce 500ms
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [ready, state]);

  return null;
}

export function MarketplaceStoreProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <StoreInitializer />
      {children}
    </>
  );
}
