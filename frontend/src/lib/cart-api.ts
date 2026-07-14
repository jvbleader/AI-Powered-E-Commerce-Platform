import { apiFetch } from "./api";

export interface CartItemResponse {
  id: number;
  variantPublicId: string;
  quantity: number;
  isSelected: boolean;
}

export interface CartResponse {
  id: number;
  items: CartItemResponse[];
}

export async function fetchMyCart(): Promise<CartResponse> {
  return apiFetch<CartResponse>("/api/v1/cart");
}

export async function addToCartApi(variantId: string, quantity: number): Promise<CartItemResponse> {
  return apiFetch<CartItemResponse>("/api/v1/cart/items", {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId, quantity })
  });
}

export async function updateCartItemApi(itemId: number, quantity?: number, isSelected?: boolean): Promise<CartItemResponse> {
  return apiFetch<CartItemResponse>(`/api/v1/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity, is_selected: isSelected })
  });
}

export async function removeCartItemApi(itemId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/cart/items/${itemId}`, {
    method: "DELETE"
  });
}

export async function selectAllCartApi(isSelected: boolean): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v1/cart/select-all?is_selected=${isSelected}`, {
    method: "PATCH"
  });
}
