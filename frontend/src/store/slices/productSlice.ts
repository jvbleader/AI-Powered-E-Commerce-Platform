import { 
  MarketplaceStore, 
  persistState, 
  SELLER_PRODUCT_ROUTES, 
  normalizeBackendProduct,
  BackendProductListResponse,
  BackendProductResponse
} from './types';
import { StateCreator } from "zustand";
import type { AppState, Product, ProductVariant, Category } from "@/types/models";
import { ApiError, apiFetch } from "@/services/api";

export const createProductSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const fetchedSellerProductsRef = { current: false };

  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === 'function' ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };

  return {
    fetchSellerProducts: async (force = false) => {
      const { state, verificationContext } = get();

      if (!get().getCurrentShop()) return { ok: false, message: "Shop không tồn tại." };
      if (!force && fetchedSellerProductsRef.current) return { ok: true, products: [] };
      fetchedSellerProductsRef.current = true;
      try {
        const response = await apiFetch<BackendProductListResponse>(SELLER_PRODUCT_ROUTES.list);
        const normalized = response.items.map((item) => normalizeBackendProduct(item, get().getCurrentShop()!.id));
        const products = normalized.map((n) => n.product);
        const variants = normalized.flatMap((n) => n.variants);
        
        setState((prev: AppState) => {
          const productIds = new Set(products.map((p) => p.id));
          return {
            ...prev,
            products: [...prev.products.filter((p) => p.sellerId !== get().getCurrentShop()!.id), ...products],
            variants: [...prev.variants.filter((v) => !productIds.has(v.productId)), ...variants]
          };
        });
        return { ok: true, products };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tải sản phẩm." };
      }
    },
    fetchSellerProductDetail: async (productId: string) => {
      const { state, verificationContext } = get();

      if (!get().getCurrentShop()) return { ok: false, message: "Shop không tồn tại." };
      try {
        const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.detail(productId));
        const { product, variants } = normalizeBackendProduct(response, get().getCurrentShop()!.id);
        setState((prev: AppState) => ({
          ...prev,
          products: [product, ...prev.products.filter((p) => p.id !== product.id)],
          variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
        }));
        return { ok: true, product, variants, raw: response };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tải chi tiết sản phẩm." };
      }
    },
    createSellerProduct: async (payload: any) => {
      const { state, verificationContext } = get();

      if (!get().getCurrentShop()) return { ok: false, message: "Shop không tồn tại." };
      try {
        const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.create, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        const { product, variants } = normalizeBackendProduct(response, get().getCurrentShop()!.id);
        setState((prev: AppState) => ({
          ...prev,
          products: [product, ...prev.products.filter((p) => p.id !== product.id)],
          variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
        }));
        return { ok: true, product };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi tạo sản phẩm." };
      }
    },
    updateSellerProduct: async (productId: string, payload: any) => {
      const { state, verificationContext } = get();

      if (!get().getCurrentShop()) return { ok: false, message: "Shop không tồn tại." };
      try {
        const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.update(productId), {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        const { product, variants } = normalizeBackendProduct(response, get().getCurrentShop()!.id);
        setState((prev: AppState) => ({
          ...prev,
          products: prev.products.map((p) => p.id === product.id ? product : p),
          variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
        }));
        return { ok: true, product };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi cập nhật sản phẩm." };
      }
    },
    hideSellerProduct: async (productId: string) => {
      const { state, verificationContext } = get();

      if (!get().getCurrentShop()) return { ok: false, message: "Shop không tồn tại." };
      try {
        const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.hide(productId), {
          method: "PATCH"
        });
        const { product, variants } = normalizeBackendProduct(response, get().getCurrentShop()!.id);
        setState((prev: AppState) => ({
          ...prev,
          products: prev.products.map((p) => p.id === product.id ? product : p),
          variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
        }));
        return { ok: true, product };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi ẩn sản phẩm." };
      }
    },
    unhideSellerProduct: async (productId: string) => {
      const { state, verificationContext } = get();

      if (!get().getCurrentShop()) return { ok: false, message: "Shop không tồn tại." };
      try {
        const response = await apiFetch<BackendProductResponse>(SELLER_PRODUCT_ROUTES.unhide(productId), {
          method: "PATCH"
        });
        const { product, variants } = normalizeBackendProduct(response, get().getCurrentShop()!.id);
        setState((prev: AppState) => ({
          ...prev,
          products: prev.products.map((p) => p.id === product.id ? product : p),
          variants: [...variants, ...prev.variants.filter((v) => v.productId !== product.id)]
        }));
        return { ok: true, product };
      } catch (error) {
        return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi hiển thị sản phẩm." };
      }
    },
    deleteSellerProduct: async (productId: string) => {
      const { state, verificationContext } = get();

    try {
      await apiFetch(SELLER_PRODUCT_ROUTES.delete(productId), { method: "DELETE" });
      setState((prev: AppState) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
        variants: prev.variants.filter((v) => v.productId !== productId)
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : "Lỗi khi xóa sản phẩm." };
    }
  },
    saveProduct: async (product: Product, productVariants: ProductVariant[] = []) => {
      const { state, verificationContext } = get();
      const resolvedVariants = productVariants.length > 0
        ? productVariants
        : state.variants.filter((variant: any) => variant.productId === product.id);

      setState((prev: AppState) => {
        const exists = prev.products.some((item) => item.id === product.id);
        const incomingVariantIds = new Set(resolvedVariants.map((variant: any) => variant.id));
        return {
          ...prev,
          products: exists ? prev.products.map((item) => (item.id === product.id ? product : item)) : [product, ...prev.products],
          variants: [
            ...prev.variants.filter((variant: any) => variant.productId !== product.id || !incomingVariantIds.has(variant.id)),
            ...resolvedVariants
          ]
        };
      });
    },
    setCategories: (categories: Category[]) => {
      setState((prev: AppState) => ({ ...prev, categories }));
    },
  };
};
