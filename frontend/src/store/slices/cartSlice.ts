import { MarketplaceStore, persistState } from './types';
import { StateCreator } from "zustand";
import type { AppState } from "@/types/models";
import { ApiError } from "@/services/api";
import { addToCartApi, updateCartItemApi, removeCartItemApi, selectAllCartApi, fetchMyCart } from "@/services/cart-api";
import { normalizeProduct } from "@/services/product-api";

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
      await get().refreshCart();
      return { ok: true, message: "Đã thêm vào giỏ hàng." };
    } catch (e: any) {
      return { ok: false, message: e.message || "Lỗi khi thêm vào giỏ hàng" };
    }
  },
    buyNow: async (variantId: string, quantity: number) => {
      const { state } = get();

      if (!state.sessionUserId) {
        return { ok: false, message: "Vui lòng đăng nhập để mua hàng." };
      }
      try {
        await selectAllCartApi(false);
        const existingItem = state.cartItems.find((item: any) => item.variantId === variantId);
        
        if (existingItem) {
          await updateCartItemApi(Number(existingItem.id), quantity, true);
        } else {
          const apiItem = await addToCartApi(variantId, quantity);
          await updateCartItemApi(apiItem.id, quantity, true);
        }
        
        await get().refreshCart();
        return { ok: true, message: "Đã chuẩn bị đơn hàng." };
      } catch (e: any) {
        return { ok: false, message: e.message || "Lỗi khi đặt hàng trực tiếp" };
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
    refreshCart: async () => {
      const { state } = get();
      if (!state.sessionUserId) return;
      try {
        const cartResp = await fetchMyCart();
        setState((prev: AppState) => {
          const newProducts = [...prev.products];
          const newVariants = [...prev.variants];
          const newShops = [...prev.shops];

          if (cartResp.products) {
            for (const backendProduct of cartResp.products) {
              const normalized = normalizeProduct(backendProduct);
              const pIndex = newProducts.findIndex((p) => p.id === normalized.product.id);
              if (pIndex >= 0) {
                newProducts[pIndex] = normalized.product;
              } else {
                newProducts.push(normalized.product);
              }

              for (const variant of normalized.variants) {
                const vIndex = newVariants.findIndex((v) => v.id === variant.id);
                if (vIndex >= 0) {
                  newVariants[vIndex] = variant;
                } else {
                  newVariants.push(variant);
                }
              }

              if (normalized.shop) {
                const sIndex = newShops.findIndex((s) => s.id === normalized.shop!.id);
                if (sIndex >= 0) {
                  newShops[sIndex] = normalized.shop!;
                } else {
                  newShops.push(normalized.shop!);
                }
              }
            }
          }

          return {
            ...prev,
            products: newProducts,
            variants: newVariants,
            shops: newShops,
            cartItems: cartResp.items.map((item: any) => ({
              id: String(item.id),
              variantId: item.variantPublicId,
              quantity: item.quantity,
              isSelected: item.isSelected
            }))
          };
        });
      } catch (e) {
        console.error("Failed to refresh cart:", e);
      }
    },
  };
};

