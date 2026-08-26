import { apiFetch } from "@/services/api";

export interface StageBreakdown {
  processing: number;
  in_transit: number;
  delivered_pending: number;
}

export interface PaymentMethodBreakdown {
  vnpay: number;
  cod: number;
}

export interface FinanceBreakdown {
  by_stage: StageBreakdown;
  by_payment_method: PaymentMethodBreakdown;
}

export interface PlatformFinanceSummary {
  total_cash_inflow?: number;
  total_cash_outflow?: number;
  total_platform_held_liquidity?: number;
  escrow_holding_balance: number;
  total_shipping_fee_held?: number;
  total_seller_available_balance: number;
  total_platform_revenue: number;
  total_payment_fee_collected: number;
  total_commission_fee_collected: number;
  total_payouts_disbursed: number;
  total_refunded_amount?: number;
  total_sellers_with_balance: number;
  total_active_escrow_orders: number;
  breakdown: FinanceBreakdown;
}

export interface PlatformFinanceTransaction {
  id: number;
  transaction_type: string;
  amount: number;
  escrow_before: number;
  escrow_after: number;
  revenue_before: number;
  revenue_after: number;
  order_id?: number | null;
  payout_id?: number | null;
  description: string;
  created_at: string;
}

export interface PaginatedPlatformFinanceTransactions {
  items: PlatformFinanceTransaction[];
  total: number;
  page: number;
  page_size: number;
}

export const adminFinanceApi = {
  getSummary: () => apiFetch<PlatformFinanceSummary>("/admin/finance/summary"),
  reconcile: () =>
    apiFetch<PlatformFinanceSummary>("/admin/finance/reconcile", {
      method: "POST",
    }),
  getTransactions: (params?: { transaction_type?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.transaction_type) query.set("transaction_type", params.transaction_type);
    if (params?.page) query.set("page", params.page.toString());
    if (params?.page_size) query.set("page_size", params.page_size.toString());
    const qs = query.toString();
    return apiFetch<PaginatedPlatformFinanceTransactions>(
      `/admin/finance/transactions${qs ? `?${qs}` : ""}`
    );
  },
};
