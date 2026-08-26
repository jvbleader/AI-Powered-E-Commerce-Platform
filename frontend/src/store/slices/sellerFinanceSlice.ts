import { StateCreator } from "zustand";
import {
  MarketplaceStore,
  SELLER_FINANCE_ROUTES,
  SellerWalletData,
  SellerWalletTransactionData,
  SellerPayoutData,
  WithdrawalPayload,
  BankAccountPayload,
} from "./types";
import { ApiError, apiFetch } from "@/services/api";

export const createSellerFinanceSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  return {
    fetchSellerWallet: async () => {
      try {
        const wallet = await apiFetch<SellerWalletData>(SELLER_FINANCE_ROUTES.wallet);
        return { ok: true, wallet };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Không thể tải thông tin ví người bán." };
      }
    },

    fetchSellerWalletTransactions: async (params?: {
      tx_type?: string;
      start_date?: string;
      end_date?: string;
      page?: number;
      limit?: number;
    }) => {
      try {
        const queryParams = new URLSearchParams();
        if (params?.tx_type) queryParams.set("tx_type", params.tx_type);
        if (params?.start_date) queryParams.set("start_date", params.start_date);
        if (params?.end_date) queryParams.set("end_date", params.end_date);
        if (params?.page) queryParams.set("page", String(params.page));
        if (params?.limit) queryParams.set("limit", String(params.limit));

        const url = `${SELLER_FINANCE_ROUTES.transactions}?${queryParams.toString()}`;
        const data = await apiFetch<{
          items: SellerWalletTransactionData[];
          total: number;
          page: number;
          limit: number;
        }>(url);

        return { ok: true, items: data.items, total: data.total };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Không thể tải lịch sử giao dịch ví." };
      }
    },

    fetchSellerPayouts: async (params?: { page?: number; limit?: number }) => {
      try {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.set("page", String(params.page));
        if (params?.limit) queryParams.set("limit", String(params.limit));

        const url = `${SELLER_FINANCE_ROUTES.payouts}?${queryParams.toString()}`;
        const data = await apiFetch<{
          items: SellerPayoutData[];
          total: number;
          page: number;
          limit: number;
        }>(url);

        return { ok: true, items: data.items, total: data.total };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Không thể tải lịch sử rút tiền." };
      }
    },

    requestSellerWithdrawal: async (payload: WithdrawalPayload) => {
      try {
        const payout = await apiFetch<SellerPayoutData>(SELLER_FINANCE_ROUTES.withdraw, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return { ok: true, payout };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Yêu cầu rút tiền thất bại." };
      }
    },

    updateSellerBankAccount: async (payload: BankAccountPayload) => {
      try {
        const bankInfo = await apiFetch<{
          bank_name: string;
          bank_account_number: string;
          bank_account_name: string;
        }>(SELLER_FINANCE_ROUTES.bankAccount, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        return { ok: true, bankInfo };
      } catch (error) {
        if (error instanceof ApiError) {
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Cập nhật thông tin ngân hàng thất bại." };
      }
    },
  };
};
