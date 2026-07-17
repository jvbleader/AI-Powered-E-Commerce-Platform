import { Payment } from "@/types/models";
import { apiFetch } from "@/services/api";

export interface PaymentCreateRequest {
  order_codes: string[];
  payment_method: string;
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

  mockCallback: (data: MockPaymentCallbackRequest) =>
    apiFetch<Payment>("/payments/mock-callback", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
