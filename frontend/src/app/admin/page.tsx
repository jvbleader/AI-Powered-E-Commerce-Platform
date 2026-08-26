"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Calculator,
  Clock,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  fetchAdminComprehensiveStats,
  fetchAdminActionCounts,
  AdminComprehensiveStats,
  AdminActionCounts,
} from "@/services/admin-api";

// Dashboard Component Imports
import { ActionCenter } from "@/components/admin/dashboard/action-center";
import { HeroKpiGrid } from "@/components/admin/dashboard/hero-kpi-grid";
import { MicroKpiGrid } from "@/components/admin/dashboard/micro-kpi-grid";
import { RevenueAreaChart } from "@/components/admin/dashboard/revenue-area-chart";
import { OrderStatusDonut } from "@/components/admin/dashboard/order-status-donut";
import { UserGrowthLines } from "@/components/admin/dashboard/user-growth-lines";
import { TrafficSourcesDonut } from "@/components/admin/dashboard/traffic-sources-donut";
import { TopCategoriesTable } from "@/components/admin/dashboard/top-categories-table";
import { TopSellersTable } from "@/components/admin/dashboard/top-sellers-table";
import { DemographicsTrio } from "@/components/admin/dashboard/demographics-trio";
import { PaymentDonut } from "@/components/admin/dashboard/payment-donut";
import { HourlyHeatmap } from "@/components/admin/dashboard/hourly-heatmap";
import { TopProductsTable } from "@/components/admin/dashboard/top-products-table";

function formatCalculatedTime(isoString?: string | null) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const timeStr = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dateStr = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${timeStr} - ${dateStr}`;
  } catch {
    return isoString;
  }
}

const DASHBOARD_SNAPSHOT_KEY = "shepoo_admin_dashboard_latest_snapshot";

export default function AdminDashboardPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;
  const currentUser = store.getCurrentUser();

  const [stats, setStats] = useState<AdminComprehensiveStats | null>(null);
  const [actionCounts, setActionCounts] = useState<AdminActionCounts | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [timePreset, setTimePreset] = useState("TODAY");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load the SINGLE latest snapshot from localStorage on initial mount only
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_SNAPSHOT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStats(parsed.stats || null);
        setLastCalculatedAt(parsed.calculatedAt || null);
        if (parsed.timePreset) setTimePreset(parsed.timePreset);
        if (parsed.startDate) setStartDate(parsed.startDate);
        if (parsed.endDate) setEndDate(parsed.endDate);
        if (parsed.actionCounts) setActionCounts(parsed.actionCounts);
      } else {
        setStats(null);
        setLastCalculatedAt(null);
      }
    } catch {
      setStats(null);
      setLastCalculatedAt(null);
    }

    // Always fetch lightweight pending action counts in background
    fetchAdminActionCounts().then(setActionCounts).catch(() => null);
  }, []);

  // Admin triggers calculation manually (overwrites the single latest snapshot)
  const handleCalculate = async () => {
    setCalculating(true);

    try {
      const [compData, actionsData] = await Promise.all([
        fetchAdminComprehensiveStats(timePreset, startDate || undefined, endDate || undefined),
        fetchAdminActionCounts().catch(() => null),
      ]);

      const now = new Date().toISOString();
      const snapshot = {
        calculatedAt: now,
        timePreset,
        startDate,
        endDate,
        stats: compData,
        actionCounts: actionsData,
      };

      try {
        localStorage.setItem(DASHBOARD_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch (e) {
        console.warn("Failed to persist dashboard snapshot:", e);
      }

      setStats(compData);
      setLastCalculatedAt(now);
      if (actionsData) setActionCounts(actionsData);
      showToast("Đã tính toán số liệu thống kê thành công!", "success");
    } catch (err: any) {
      console.error("Failed to calculate comprehensive dashboard stats:", err);
      showToast(err.message || "Lỗi khi tính toán số liệu thống kê.", "danger");
    } finally {
      setCalculating(false);
    }
  };

  const adminGreeting = currentUser?.fullName ? currentUser.fullName : "Admin";

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div>
          <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            Xin chào, {adminGreeting} <span className="text-lg">👋</span>
          </h1>
          <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
            <span>Tổng quan hoạt động sàn Shepoo</span>
            <span className="text-slate-300">•</span>
            {lastCalculatedAt ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50/90 px-2.5 py-0.5 rounded-lg border border-emerald-200/70 shadow-2xs">
                <Clock className="h-3 w-3 text-emerald-600" />
                <span>Tính lúc: <strong className="font-bold text-emerald-900">{formatCalculatedTime(lastCalculatedAt)}</strong></span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium bg-amber-50/90 px-2.5 py-0.5 rounded-lg border border-amber-200/70 shadow-2xs">
                <AlertCircle className="h-3 w-3 text-amber-600" />
                <span>Chưa có dữ liệu tính toán</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset & Custom Date Picker */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Preset Dropdown */}
            <div className="relative">
              <select
                value={startDate || endDate ? "CUSTOM" : timePreset}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "CUSTOM") {
                    if (!startDate) {
                      const d = new Date();
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(d.getDate() - 7);
                      setStartDate(sevenDaysAgo.toISOString().slice(0, 10));
                      setEndDate(d.toISOString().slice(0, 10));
                    }
                  } else {
                    setTimePreset(val);
                    setStartDate("");
                    setEndDate("");
                  }
                }}
                className="h-9 appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-7 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer transition-all"
              >
                <option value="TODAY">Hôm nay</option>
                <option value="7DAYS">7 ngày qua</option>
                <option value="30DAYS">30 ngày qua</option>
                <option value="12MONTHS">12 tháng qua</option>
                <option value="ALL">Tất cả</option>
                <option value="CUSTOM">Tùy chọn ngày</option>
              </select>
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Custom Date Range Pill */}
            {(startDate || endDate || timePreset === "CUSTOM") && (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/40 px-2.5 py-1 text-xs text-slate-700 shadow-2xs h-9 transition-all">
                <span className="text-[11px] font-medium text-slate-500">Từ</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                />
                <span className="text-slate-400">–</span>
                <span className="text-[11px] font-medium text-slate-500">Đến</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setTimePreset("TODAY");
                    }}
                    className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Xóa bộ lọc ngày tùy chỉnh"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tính toán Button */}
          <Button
            variant="primary"
            onClick={handleCalculate}
            disabled={calculating}
            className="h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Bấm để tính toán số liệu cho khoảng thời gian đã chọn"
          >
            <Calculator className={cn("h-3.5 w-3.5", calculating && "animate-spin")} />
            {calculating ? "Đang tính toán..." : stats ? "Tính toán lại" : "Tính toán"}
          </Button>
        </div>
      </div>

      {/* Action Center (Tác vụ cần xử lý: Duyệt shop, vi phạm, đề xuất category, khiếu nại) */}
      <ActionCenter counts={actionCounts} loading={false} />

      {/* Main Dashboard Content */}
      {!stats && !calculating ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white/80 backdrop-blur-xs my-4 shadow-xs">
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5 shadow-inner">
            <Calculator className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-4">
            Chưa có dữ liệu thống kê cho khoảng thời gian này
          </h3>
          <Button
            onClick={handleCalculate}
            disabled={calculating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Calculator className="h-4 w-4" />
            Bắt đầu tính toán
          </Button>
        </div>
      ) : (
        <>
          {/* 5 Hero KPI Cards */}
          <HeroKpiGrid kpis={stats?.hero_kpis || null} loading={calculating} />

          {/* 5 Micro-KPIs (Chỉ số phụ: Hoàn đơn, AOV, Lượt truy cập, CVR, Đánh giá) */}
          <MicroKpiGrid kpis={stats?.micro_kpis || null} loading={calculating} />

          {/* Row 1: Doanh thu (Area Chart) + Tăng trưởng người dùng (Multi-line Chart) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RevenueAreaChart
              data={stats?.revenue_chart || []}
              loading={calculating}
            />
            <UserGrowthLines
              data={stats?.user_growth_chart || []}
              loading={calculating}
            />
          </div>

          {/* Row 2: 3 Biểu đồ phân bổ tròn (Trạng thái đơn, Nguồn truy cập, Kênh thanh toán & Tài chính) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <OrderStatusDonut
              data={stats?.order_status_donut || []}
              totalOrders={stats?.total_orders_count || 0}
              loading={calculating}
            />
            <TrafficSourcesDonut
              data={stats?.traffic_sources || []}
              totalVisits={stats?.total_visits_count || 0}
              loading={calculating}
            />
            <PaymentDonut
              overview={stats?.finance_overview || null}
              loading={calculating}
            />
          </div>

          {/* Row 3: Phân tích nhân khẩu học (3 biểu đồ: Thiết bị, Độ tuổi, Giới tính) */}
          <DemographicsTrio
            data={stats?.demographics || null}
            totalVisits={stats?.total_visits_count}
            loading={calculating}
          />

          {/* Row 4: Khung giờ hoạt động (Heatmap 24h) + Top người bán theo doanh thu */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HourlyHeatmap
              data={stats?.hourly_heatmap || []}
              loading={calculating}
            />
            <TopSellersTable
              sellers={stats?.top_sellers || []}
              loading={calculating}
            />
          </div>

          {/* Row 5: Top danh mục theo doanh thu + Top sản phẩm bán chạy */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopCategoriesTable
              categories={stats?.top_categories || []}
              loading={calculating}
            />
            <TopProductsTable
              products={stats?.top_products || []}
              loading={calculating}
            />
          </div>
        </>
      )}
    </div>
  );
}
