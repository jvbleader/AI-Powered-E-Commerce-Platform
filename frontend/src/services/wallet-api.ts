import { apiFetch } from "@/services/api";

export interface WalletInfo {
  balance: number;
  status: string;
  has_pin: boolean;
  created_at: string;
}

export interface TopupResponse {
  transaction_code: string;
  amount: number;
  new_balance: number;
  payment_url?: string | null;
}

export interface WalletTransaction {
  transaction_code: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_type: string;
  reference_type: string | null;
  reference_id: number | null;
  description: string;
  created_at: string;
}

export interface WalletTransactionListResponse {
  items: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface WalletPaymentResponse {
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
}

export const walletApi = {
  getWallet: () =>
    apiFetch<WalletInfo>("/wallet"),

  createPin: (pin: string) =>
    apiFetch<WalletInfo>("/wallet/create-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  changePin: (oldPin: string, newPin: string) =>
    apiFetch<WalletInfo>("/wallet/change-pin", {
      method: "PUT",
      body: JSON.stringify({ old_pin: oldPin, new_pin: newPin }),
    }),

  forgotPin: () =>
    apiFetch<{ message: string }>("/wallet/forgot-pin", {
      method: "POST",
    }),

  resetPin: (otp: string, newPin: string) =>
    apiFetch<WalletInfo>("/wallet/reset-pin", {
      method: "POST",
      body: JSON.stringify({ otp, new_pin: newPin }),
    }),

  topup: (amount: number, method: string) =>
    apiFetch<TopupResponse>("/wallet/topup", {
      method: "POST",
      body: JSON.stringify({ amount, method }),
    }),

  payWithWallet: (orderCodes: string[], pin: string) =>
    apiFetch<WalletPaymentResponse>("/wallet/pay", {
      method: "POST",
      body: JSON.stringify({ order_codes: orderCodes, pin }),
    }),

  getTransactions: (limit = 20, offset = 0, transactionType?: string) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (transactionType) params.set("transaction_type", transactionType);
    return apiFetch<WalletTransactionListResponse>(`/wallet/transactions?${params.toString()}`);
  },
};
