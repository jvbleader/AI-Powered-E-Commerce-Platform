"use client";
import { useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useMarketplaceStore } from "./use-marketplace-store";
import { persistState, STORAGE_KEY } from "./slices/types";

export function StoreInitializer() {
  const initialize = useMarketplaceStore(state => state.initialize);
  const ready = useMarketplaceStore(state => state.ready);
  const state = useMarketplaceStore(state => state.state);
  const persistTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    initialize();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          useMarketplaceStore.setState((prev) => ({
            ...prev,
            state: { 
              ...prev.state, 
              cartItems: parsed.cartItems || prev.state.cartItems,
              notifications: parsed.notifications || prev.state.notifications,
              products: parsed.products || prev.state.products,
              variants: parsed.variants || prev.state.variants,
              shops: parsed.shops || prev.state.shops
            }
          }));
        } catch (err) {
          console.error("Failed to sync storage:", err);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [initialize]);

  useEffect(() => {
    if (typeof window !== "undefined" && pathname && !pathname.startsWith("/login") && !pathname.startsWith("/register")) {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem("last_visited_page", fullPath);
    }
  }, [pathname]);

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
