"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Landmark,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/containers";
import { formatVnd } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { adminFinanceApi, PlatformFinanceSummary } from "@/services/admin-finance-api";

export default function AdminFinancePage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [summary, setSummary] = useState<PlatformFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const data = await adminFinanceApi.getSummary();
      setSummary(data);
      if (isManual) {
        showToast("Đã làm mới dữ liệu tài chính sàn thành công", "success");
      }
    } catch (err: any) {
      const msg = err?.message || "Không thể tải dữ liệu tài chính sàn";
      setError(msg);
      showToast(msg, "danger");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Root Treasury Cash Flow (Dòng tiền gốc thực tế)
  const totalCashInflow = summary?.total_cash_inflow || 0;
  const totalCashOutflow = summary?.total_cash_outflow || 0;
  const totalPlatformLiquidity =
    summary?.total_platform_held_liquidity ?? Math.max(0, totalCashInflow - totalCashOutflow);

  const escrowAmount = summary?.escrow_holding_balance || 0;
  const shippingAmount = summary?.total_shipping_fee_held || 0;
  const sellerAmount = summary?.total_seller_available_balance || 0;
  const revenueAmount = summary?.total_platform_revenue || 0;
  const payoutsAmount = summary?.total_payouts_disbursed || 0;

  const liquiditySafe = totalPlatformLiquidity || 1;
  const escrowHoldingPct = ((escrowAmount / liquiditySafe) * 100).toFixed(2);
  const shippingHoldingPct = ((shippingAmount / liquiditySafe) * 100).toFixed(2);
  const sellerHoldingPct = ((sellerAmount / liquiditySafe) * 100).toFixed(2);
  const revenueHoldingPct = ((revenueAmount / liquiditySafe) * 100).toFixed(2);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <Landmark className="h-6 w-6" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Quản lý Tài chính & Ký quỹ Sàn
          </h1>
        </div>

        <Button
          variant="outline"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 h-9 text-xs px-3.5 shadow-2xs hover:bg-slate-50"
        >
          <RefreshCcw className={cn("h-4 w-4", (refreshing || loading) && "animate-spin text-primary")} />
          <span>Làm mới</span>
        </Button>
      </div>

      {error ? (
        <Panel className="p-6 bg-rose-50 border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-rose-900">Không thể tải dữ liệu tài chính</h3>
              <p className="text-sm text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => loadData(true)} className="h-9 text-xs px-3">
            Thử lại
          </Button>
        </Panel>
      ) : null}

      {/* Master Hero Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 text-slate-900 space-y-6">
        {/* Hàng 1: Số tiền to bên trái, Dòng phương trình kế toán bên phải */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            {loading ? (
              <div className="h-12 w-64 bg-slate-100 rounded-lg animate-pulse my-1" />
            ) : (
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
                {formatVnd(totalPlatformLiquidity)}
              </span>
            )}
          </div>

          {/* Dòng phương trình kế toán gốc */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
              Tổng tiền đã vào sàn: <strong className="text-slate-900">{formatVnd(totalCashInflow)}</strong>
            </span>
            <span className="text-slate-400 font-bold text-sm">−</span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
              Đã xuất giải ngân/hoàn: <strong className="text-rose-700">{formatVnd(totalCashOutflow)}</strong>
            </span>
            <span className="text-slate-400 font-bold text-sm">=</span>
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-800 font-semibold">
              Tiền còn trong sàn: {formatVnd(totalPlatformLiquidity)}
            </span>
          </div>
        </div>

        {/* Hàng 2: 5 ô nhỏ trải ngang bên dưới */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Ký quỹ hàng */}
          <div
            style={{ backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }}
            className="rounded-xl p-3.5 border flex flex-col justify-between"
          >
            <div style={{ color: "#2563eb" }} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <ShieldCheck className="h-4 w-4" style={{ color: "#2563eb" }} />
              <span>1. Ký quỹ hàng</span>
            </div>
            <div style={{ color: "#2563eb" }} className="text-base sm:text-lg font-bold mt-2">
              {formatVnd(escrowAmount)}
            </div>
            <div style={{ color: "#2563eb" }} className="text-[11px] font-medium mt-1">
              {escrowHoldingPct}% tổng quỹ
            </div>
          </div>

          {/* 2. Quỹ ship giữ */}
          <div
            style={{ backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }}
            className="rounded-xl p-3.5 border flex flex-col justify-between"
          >
            <div style={{ color: "#0284c7" }} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Truck className="h-4 w-4" style={{ color: "#0284c7" }} />
              <span>2. Quỹ ship giữ</span>
            </div>
            <div style={{ color: "#0284c7" }} className="text-base sm:text-lg font-bold mt-2">
              {formatVnd(shippingAmount)}
            </div>
            <div style={{ color: "#0284c7" }} className="text-[11px] font-medium mt-1">
              {shippingHoldingPct}% tổng quỹ
            </div>
          </div>

          {/* 3. Ví Shop giữ hộ */}
          <div
            style={{ backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }}
            className="rounded-xl p-3.5 border flex flex-col justify-between"
          >
            <div style={{ color: "#059669" }} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Wallet className="h-4 w-4" style={{ color: "#059669" }} />
              <span>3. Ví Shop giữ hộ</span>
            </div>
            <div style={{ color: "#059669" }} className="text-base sm:text-lg font-bold mt-2">
              {formatVnd(sellerAmount)}
            </div>
            <div style={{ color: "#059669" }} className="text-[11px] font-medium mt-1">
              {sellerHoldingPct}% tổng quỹ
            </div>
          </div>

          {/* 4. Doanh thu sàn */}
          <div
            style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
            className="rounded-xl p-3.5 border flex flex-col justify-between"
          >
            <div style={{ color: "#d97706" }} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <TrendingUp className="h-4 w-4" style={{ color: "#d97706" }} />
              <span>4. Doanh thu sàn</span>
            </div>
            <div style={{ color: "#d97706" }} className="text-base sm:text-lg font-bold mt-2">
              {formatVnd(revenueAmount)}
            </div>
            <div style={{ color: "#d97706" }} className="text-[11px] font-medium mt-1">
              {revenueHoldingPct}% tổng quỹ
            </div>
          </div>

          {/* 5. Tổng tiền đã giải ngân */}
          <div
            style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
            className="rounded-xl p-3.5 border flex flex-col justify-between col-span-2 sm:col-span-1"
          >
            <div style={{ color: "#475569" }} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Building2 className="h-4 w-4" style={{ color: "#475569" }} />
              <span>5. Đã giải ngân</span>
            </div>
            <div style={{ color: "#0f172a" }} className="text-base sm:text-lg font-bold mt-2">
              {formatVnd(payoutsAmount)}
            </div>
            <div style={{ color: "#64748b" }} className="text-[11px] font-medium mt-1">
              Đã chuyển về STK Shop
            </div>
          </div>
        </div>

        {/* 4-color Liquidity Composition Bar */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="h-3.5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${escrowHoldingPct}%`, backgroundColor: "#2563eb" }}
              className="h-full transition-all duration-500"
              title={`Ký quỹ hàng: ${formatVnd(escrowAmount)} (${escrowHoldingPct}%)`}
            />
            <div
              style={{
                width: `${shippingHoldingPct}%`,
                minWidth: shippingAmount > 0 ? "10px" : "0px",
                backgroundColor: "#0ea5e9",
              }}
              className="h-full transition-all duration-500"
              title={`Quỹ tiền ship: ${formatVnd(shippingAmount)} (${shippingHoldingPct}%)`}
            />
            <div
              style={{ width: `${sellerHoldingPct}%`, backgroundColor: "#059669" }}
              className="h-full transition-all duration-500"
              title={`Ví Người Bán: ${formatVnd(sellerAmount)} (${sellerHoldingPct}%)`}
            />
            <div
              style={{
                width: `${revenueHoldingPct}%`,
                minWidth: revenueAmount > 0 ? "10px" : "0px",
                backgroundColor: "#f59e0b",
              }}
              className="h-full transition-all duration-500"
              title={`Doanh thu sàn: ${formatVnd(revenueAmount)} (${revenueHoldingPct}%)`}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between text-xs font-semibold pt-0.5 gap-2">
            <div className="flex items-center gap-1.5" style={{ color: "#1d4ed8" }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: "#2563eb" }} />
              <span>Ký Quỹ Tiền Hàng ({escrowHoldingPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "#0369a1" }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: "#0ea5e9" }} />
              <span>Quỹ Tiền Ship ({shippingHoldingPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "#047857" }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: "#059669" }} />
              <span>Ví Người Bán ({sellerHoldingPct}%)</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "#b45309" }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: "#f59e0b" }} />
              <span>Doanh Thu Phí Sàn ({revenueHoldingPct}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
