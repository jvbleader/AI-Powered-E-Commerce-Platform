import { StateCreator } from "zustand";
import { MarketplaceStore, persistState } from "./types";
import type { AppState, PaymentMethod, PaymentStatus } from "@/types/models";
import { walletApi } from "@/services/wallet-api";
import type { WalletInfo } from "@/services/wallet-api";

export const createWalletSlice: StateCreator<MarketplaceStore, [], [], any> = (set, get) => {
  const setState = (updater: ((state: AppState) => AppState) | Partial<AppState>) => {
    set((store) => {
      const nextState = typeof updater === "function" ? updater(store.state) : { ...store.state, ...updater };
      persistState(nextState);
      return { state: nextState };
    });
  };

  return {
    fetchWallet: async () => {
      try {
        const data = await walletApi.getWallet();
        return { ok: true, wallet: { ...data, balance: Number(data.balance) } };
      } catch (e: any) {
        return { ok: false, message: e.message || "Lỗi khi tải ví" };
      }
    },

    walletTopup: async (amount: number, method: string) => {
      try {
        const result = await walletApi.topup(amount, method);
        if (result.payment_url) {
          return { ok: true, message: "Đang chuyển sang VNPay...", paymentUrl: result.payment_url };
        }
        return { ok: true, message: `Nạp tiền thành công! Mã GD: ${result.transaction_code}` };
      } catch (e: any) {
        return { ok: false, message: e.message || "Lỗi nạp tiền" };
      }
    },

    walletPayOrders: async (orderCodes: string[], pin: string) => {
      if (!get().getCurrentUser()) {
        return { ok: false, message: "Bạn cần đăng nhập." };
      }
      try {
        const raw = await walletApi.payWithWallet(orderCodes, pin);
        const payment = {
          id: raw.public_id,
          paymentCode: raw.payment_code,
          userId: get().getCurrentUser()!.id,
          paymentMethod: "WALLET" as PaymentMethod,
          paymentStatus: raw.payment_status as PaymentStatus,
          amount: parseFloat(raw.amount),
          transactionCode: raw.transaction_code ?? undefined,
          paymentGateway: raw.payment_gateway ?? "WALLET",
          orderCodes: raw.order_codes || orderCodes,
          expiresAt: raw.expires_at,
          createdAt: raw.created_at,
          paidAt: raw.paid_at ?? undefined,
          failedAt: raw.failed_at ?? undefined,
          cancelledAt: raw.cancelled_at ?? undefined,
        };

        setState((prev: AppState) => ({
          ...prev,
          payments: [payment, ...prev.payments],
          lastCheckoutPaymentCode: payment.paymentCode,
          orders: prev.orders.map((order) =>
            orderCodes.includes(order.orderCode)
              ? { ...order, paymentStatus: payment.paymentStatus as PaymentStatus }
              : order
          ),
        }));

        return {
          ok: true,
          message: "Thanh toán bằng ví thành công!",
          paymentCode: raw.payment_code,
        };
      } catch (e: any) {
        return { ok: false, message: e.message || "Lỗi thanh toán bằng ví" };
      }
    },
  };
};
