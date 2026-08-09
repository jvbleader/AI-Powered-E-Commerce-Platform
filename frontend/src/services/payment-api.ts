import { Payment } from "@/types/models";
import { apiFetch } from "@/services/api";

export interface PaymentCreateRequest {
  order_codes: string[];
  payment_method: string;
}

export interface VNPayPaymentCreateRequest {
  order_codes: string[];
  bank_code?: string;
}

export interface VNPayPaymentCreateResponse {
  payment: {
    public_id: string;
    payment_code: string;
    payment_method: string;
    payment_gateway?: string | null;
    payment_status: string;
    amount: string;
    transaction_code?: string | null;
    expires_at: string;
    paid_at?: string | null;
    failed_at?: string | null;
    cancelled_at?: string | null;
    created_at: string;
    order_codes: string[];
  };
  payment_url: string;
}

export interface MockPaymentCallbackRequest {
  payment_code: string;
  status: string;
  transaction_code?: string;
}

export const paymentApi = {
  createPayment: (data: PaymentCreateRequest) =>
    apiFetch<Payment>("/payments/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createVNPayPayment: (data: VNPayPaymentCreateRequest) =>
    apiFetch<VNPayPaymentCreateResponse>("/payments/vnpay/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resumeVNPayPayment: (paymentCode: string) =>
    apiFetch<VNPayPaymentCreateResponse>("/payments/vnpay/resume", {
      method: "POST",
      body: JSON.stringify({ payment_code: paymentCode }),
    }),

  mockCallback: (data: MockPaymentCallbackRequest) =>
    apiFetch<Payment>("/payments/mock-callback", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPaymentDetail: (paymentCode: string) =>
    apiFetch<{
      public_id: string;
      payment_code: string;
      payment_method: string;
      payment_gateway?: string | null;
      payment_status: string;
      amount: string;
      transaction_code?: string | null;
      expires_at: string;
      paid_at?: string | null;
      failed_at?: string | null;
      cancelled_at?: string | null;
      created_at: string;
      order_codes: string[];
    }>(`/payments/${encodeURIComponent(paymentCode)}`),
};
