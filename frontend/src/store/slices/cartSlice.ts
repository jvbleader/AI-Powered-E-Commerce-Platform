import { MarketplaceStore, persistState } from './types';
import { StateCreator } from "zustand";
import type { AppState } from "@/types/models";
import { ApiError } from "@/services/api";
import { addToCartApi, updateCartItemApi, removeCartItemApi, selectAllCartApi } from "@/services/cart-api";

export const createCartSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };

  return {
    addToCart: async (variantId: string, quantity: number) => {
      const { state, verificationContext } = get();

    if (!state.sessionUserId) {
      return { ok: false, message: "Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng." };
    }
    try {
      const apiItem = await addToCartApi(variantId, quantity);
      setState((prev: AppState) => {
        const existingIndex = prev.cartItems.findIndex((item) => item.variantId === variantId);
        if (existingIndex >= 0) {
          const newItems = [...prev.cartItems];
          newItems[existingIndex] = {
            id: String(apiItem.id),
            variantId: apiItem.variantPublicId,
            quantity: apiItem.quantity,
            isSelected: apiItem.isSelected
          };
          return { ...prev, cartItems: newItems };
        }
        return {
          ...prev,
          cartItems: [
            ...prev.cartItems,
            { id: String(apiItem.id), variantId: apiItem.variantPublicId, quantity: apiItem.quantity, isSelected: apiItem.isSelected }
          ]
        };
      });
      return { ok: true, message: "Đã thêm vào giỏ hàng." };
    } catch (e: any) {
      return { ok: false, message: e.message || "Lỗi khi thêm vào giỏ hàng" };
    }
  },
    updateCartItem: async (cartItemId: string, changes: { quantity?: number; isSelected?: boolean }) => {
      const { state, verificationContext } = get();

    try {
      const apiItem = await updateCartItemApi(Number(cartItemId), changes.quantity, changes.isSelected);
      setState((prev: AppState) => ({
        ...prev,
        cartItems: prev.cartItems.map((item) =>
          item.id === cartItemId
            ? { ...item, quantity: apiItem.quantity, isSelected: apiItem.isSelected }
            : item
        )
      }));
    } catch (e) {
      console.error("Failed to update cart item:", e);
    }
  },
    removeCartItem: async (cartItemId: string) => {
      const { state, verificationContext } = get();

    try {
      await removeCartItemApi(Number(cartItemId));
      setState((prev: AppState) => ({ ...prev, cartItems: prev.cartItems.filter((item) => item.id !== cartItemId) }));
    } catch (e) {
      console.error("Failed to remove cart item:", e);
    }
  },
    selectAllCart: async (selected: boolean) => {
      const { state, verificationContext } = get();

    try {
      await selectAllCartApi(selected);
      setState((prev: AppState) => ({ ...prev, cartItems: prev.cartItems.map((item) => ({ ...item, isSelected: selected })) }));
    } catch (e) {
      console.error("Failed to select all cart items:", e);
    }
  },
  };
};
