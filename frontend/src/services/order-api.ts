import { Order, OrderItem } from "@/types/models";
import { apiFetch } from "@/services/api";

export interface ShippingAddressPayload {
  receiver_name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detail_address: string;
  address_type: string;
}

export interface CheckoutCartRequest {
  cart_item_ids: number[];
  address_id: number;
  customer_note?: string;
}

export interface CheckoutDirectItem {
  variant_id: string;
  quantity: number;
}

export interface CheckoutDirectRequest {
  items: CheckoutDirectItem[];
  address_id: number;
  customer_note?: string;
}

export interface CancelOrderRequest {
  reason: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
}

export const orderApi = {
  checkoutCart: (data: CheckoutCartRequest) =>
    apiFetch<Order[]>("/api/v1/orders/checkout-cart", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkoutDirect: (data: CheckoutDirectRequest) =>
    apiFetch<Order[]>("/api/v1/orders/checkout-direct", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyOrders: () =>
    apiFetch<OrderListResponse>("/api/v1/orders"),

  getOrderDetail: (orderCode: string) =>
    apiFetch<Order>(`/api/v1/orders/${orderCode}`),

  confirmReceipt: (orderCode: string) =>
    apiFetch<Order>(`/api/v1/orders/${orderCode}/confirm-receipt`, {
      method: "PATCH",
    }),

  cancelOrder: (orderCode: string, data: CancelOrderRequest) =>
    apiFetch<Order>(`/api/v1/orders/${orderCode}/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
