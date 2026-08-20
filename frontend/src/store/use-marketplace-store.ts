"use client";
import { create } from "zustand";
import { MarketplaceStore as GeneratedMarketplaceStore, AppState, persistState, STORAGE_KEY, LEGACY_STORAGE_KEYS, hydrateSavedState, readVerificationContext, applyBackendUser, AUTH_ROUTES } from "./slices/types";

import { AUTH_BASE_PATH, ApiError, apiFetch } from "@/services/api";
import { fetchMyCart, addToCartApi, updateCartItemApi, removeCartItemApi, selectAllCartApi } from "@/services/cart-api";
import { orderApi } from "@/services/order-api";
import { paymentApi } from "@/services/payment-api";
import { normalizeProduct } from "@/services/product-api";
import { canCustomerCancel, canSellerCancel, createOrderFromGroup, createPaymentFromOrders, getCartRows, makeOrderCode, makePaymentCode, selectedCheckoutGroups } from "@/lib/helpers";

import { createAuthSlice } from "./slices/authSlice";
import { createCartSlice } from "./slices/cartSlice";
import { createOrderSlice } from "./slices/orderSlice";
import { createProductSlice } from "./slices/productSlice";
import { createSellerSlice } from "./slices/sellerSlice";
import { createAddressSlice } from "./slices/addressSlice";
import { createCoreSlice } from "./slices/coreSlice";
import { initialState } from "@/store/initial-state";

// Re-export the store type from slices/types (includes initialize)
export type MarketplaceStore = GeneratedMarketplaceStore;

export const useMarketplaceStore = create<MarketplaceStore>()((set, get, store) => ({
  state: initialState,
  ready: false,
  getCurrentUser: () => { const state = get().state; return state.users.find((u: any) => u.id === state.sessionUserId); },
  getCurrentShop: () => { const state = get().state; return state.shops.find((s: any) => s.userId === state.sessionUserId); },
  verificationContext: undefined,
  getCartRows: () => { const state = get().state; return getCartRows(state.cartItems, state.products, state.variants, state.shops); },
  toast: null,

  ...createAuthSlice(set, get, store),
  ...createCartSlice(set, get, store),
  ...createOrderSlice(set, get, store),
  ...createProductSlice(set, get, store),
  ...createSellerSlice(set, get, store),
  ...createAddressSlice(set, get, store),
  ...createCoreSlice(set, get, store),

  initialize: () => {
    let cancelled = false;
    LEGACY_STORAGE_KEYS.forEach((key: string) => window.localStorage.removeItem(key));
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppState;
        set((prev) => ({ state: hydrateSavedState(parsed) }));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ verificationContext: readVerificationContext(), ready: true });

    apiFetch<any>(AUTH_ROUTES.me)
      .then(async (user) => {
        if (!cancelled) {
          set((prev) => ({ state: applyBackendUser(prev.state, user) }));
          if (user.roles?.includes("SELLER")) {
            get().getSellerApplication().catch(() => {});
          }
          try {
            const cartResp = await fetchMyCart();
            set((prev) => {
              const newProducts = [...prev.state.products];
              const newVariants = [...prev.state.variants];
              const newShops = [...prev.state.shops];

              if (cartResp.products) {
                for (const backendProduct of cartResp.products) {
                  const normalized = normalizeProduct(backendProduct);
                  if (!newProducts.some(p => p.id === normalized.product.id)) {
                    newProducts.push(normalized.product);
                  }
                  for (const variant of normalized.variants) {
                    if (!newVariants.some(v => v.id === variant.id)) {
                      newVariants.push(variant);
                    }
                  }
                  if (normalized.shop && !newShops.some(s => s.id === normalized.shop!.id)) {
                    newShops.push(normalized.shop);
                  }
                }
              }

              return {
                state: {
                  ...prev.state,
                  products: newProducts,
                  variants: newVariants,
                  shops: newShops,
                  cartItems: cartResp.items.map((item: any) => ({
                    id: String(item.id),
                    variantId: item.variantPublicId,
                    quantity: item.quantity,
                    isSelected: item.isSelected
                  }))
                }
              };
            });
          } catch (e) {
            console.error("Failed to load cart:", e);
          }
        }
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && ["NOT_AUTHENTICATED", "USER_NOT_VERIFIED"].includes(error.code ?? "")) {
          set((prev) => {
            const nextState = { ...prev.state, sessionUserId: undefined, activeRole: "GUEST" as const, cartItems: [] };
            if (prev.state.sessionUserId) {
              persistState(nextState);
              window.location.href = "/login";
            }
            return { state: nextState };
          });
        }
      });
  }
}));

export { StoreInitializer, MarketplaceStoreProvider } from "./StoreInitializer";
