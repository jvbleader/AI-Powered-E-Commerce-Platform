import { Order, OrderReturn } from "@/types/models";
import { apiFetch } from "@/services/api";
import type {
  BackendOrderResponse,
  BackendOrderListResponse,
  BackendOrderReturnResponse,
  BackendDisputeListResponse
} from "@/store/slices/types";

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
  payment_method?: string;
  shipping_providers?: { shop_public_id: string; shipping_provider_public_id: string }[];
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

export interface RequestOrderReturnPayload {
  reason: string;
  description: string;
  evidence_images?: string[];
}

export interface DisputeOrderReturnPayload {
  dispute_reason: string;
}

export interface RejectReturnPayload {
  reject_reason: string;
}

export interface ResolveDisputePayload {
  decision: string;
  note: string;
}

export const orderApi = {
  checkoutCart: (data: CheckoutCartRequest) =>
    apiFetch<Order[]>("/orders/checkout-cart", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  checkoutDirect: (data: CheckoutDirectRequest) =>
    apiFetch<Order[]>("/orders/checkout-direct", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyOrders: () =>
    apiFetch<OrderListResponse>("/orders"),

  getOrderDetail: (orderCode: string) =>
    apiFetch<Order>(`/orders/${orderCode}`),

  confirmReceipt: (orderCode: string) =>
    apiFetch<Order>(`/orders/${orderCode}/confirm-receipt`, {
      method: "PATCH",
    }),

  cancelOrder: (orderCode: string, data: CancelOrderRequest) =>
    apiFetch<Order>(`/orders/${orderCode}/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  requestOrderReturn: (orderCode: string, data: RequestOrderReturnPayload) =>
    apiFetch<BackendOrderReturnResponse>(`/orders/${orderCode}/return/request`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  disputeOrderReturn: (orderCode: string, data: DisputeOrderReturnPayload) =>
    apiFetch<BackendOrderReturnResponse>(`/orders/${orderCode}/return/dispute`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getOrderReturn: (orderCode: string) =>
    apiFetch<BackendOrderReturnResponse>(`/orders/${orderCode}/return`),

  // Seller Order actions
  markOrderDelivered: (orderId: string) =>
    apiFetch<BackendOrderResponse>(`/seller/orders/${orderId}/delivered`, {
      method: "POST",
    }),

  approveSellerReturn: (orderId: string) =>
    apiFetch<BackendOrderReturnResponse>(`/seller/orders/${orderId}/return/approve`, {
      method: "POST",
    }),

  rejectSellerReturn: (orderId: string, data: RejectReturnPayload) =>
    apiFetch<BackendOrderReturnResponse>(`/seller/orders/${orderId}/return/reject`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  confirmReceivedReturn: (orderId: string) =>
    apiFetch<BackendOrderReturnResponse>(`/seller/orders/${orderId}/return/confirm-received`, {
      method: "POST",
    }),

  // Dispute / Moderation actions
  fetchDisputes: (statusFilter?: string, skip: number = 0, limit: number = 50) => {
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    params.append("skip", String(skip));
    params.append("limit", String(limit));
    return apiFetch<BackendDisputeListResponse>(`/api/moderation/disputes?${params.toString()}`);
  },

  fetchDisputeDetail: (disputeId: string) =>
    apiFetch<BackendOrderReturnResponse>(`/api/moderation/disputes/${disputeId}`),

  resolveDispute: (disputeId: string, data: ResolveDisputePayload) =>
    apiFetch<BackendOrderReturnResponse>(`/api/moderation/disputes/${disputeId}/resolve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const disputeApi = {
  getDisputes: (statusFilter?: string, skip: number = 0, limit: number = 50) =>
    orderApi.fetchDisputes(statusFilter, skip, limit),
  getDisputeDetail: (disputeId: string) =>
    orderApi.fetchDisputeDetail(disputeId),
  resolveDispute: (disputeId: string, decision: string, note: string) =>
    orderApi.resolveDispute(disputeId, { decision, note }),
};
