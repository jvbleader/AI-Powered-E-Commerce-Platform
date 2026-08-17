"use client";

import { useEffect, useState, useMemo } from "react";
import { RefreshCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { formatVnd, formatDate } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import {
  fetchAdminDetailedStats,
  fetchAdminDashboardStats,
  fetchAdminUsers,
  fetchAdminProducts,
  fetchAdminCategories,
  recalculateAdminStatistics,
  AdminDetailedStats
} from "@/services/admin-api";
import { cn } from "@/lib/utils";
import Link from "next/link";

type TimePreset = "30DAYS" | "7DAYS" | "12MONTHS" | "ALL";

export default function AdminStatisticsPage() {
  const store = useMarketplaceStore();
  const { showToast } = store;

  const [stats, setStats] = useState<AdminDetailedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState("");
  const [timePreset, setTimePreset] = useState<TimePreset>("30DAYS");
  const [chartMode, setChartMode] = useState<"revenue" | "orders">("revenue");
  const [hoveredBar, setHoveredBar] = useState<any | null>(null);

  const loadStats = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setLoading(true);
    }
    setError("");
    try {
      const data = await fetchAdminDetailedStats();
      if (data && (data.total_revenue !== undefined || data.total_orders !== undefined)) {
        setStats(data);
        return;
      }
      throw new Error("Invalid response format");
    } catch (err: any) {
      console.warn("Detailed stats endpoint failed, falling back to aggregate data:", err);
      try {
        const [dashStats, users, products, catsResp] = await Promise.all([
          fetchAdminDashboardStats().catch(() => null),
          fetchAdminUsers().catch(() => store.state.users || []),
          fetchAdminProducts().catch(() => store.state.products || []),
          fetchAdminCategories().catch(() => ({ categories: store.state.categories || [] })),
        ]);

        const allOrders = store.state.orders || [];
        const completedOrders = allOrders.filter((o) => o.orderStatus === "COMPLETED");
        const pendingOrders = allOrders.filter((o) => ["PLACED", "READY_TO_SHIP", "SHIPPING"].includes(o.orderStatus));
        const cancelledOrders = allOrders.filter((o) => o.orderStatus === "CANCELLED");

        const computedCompletedRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalRevenue = dashStats?.total_revenue ? Number(dashStats.total_revenue) : computedCompletedRevenue;
        const pendingRevenue = pendingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        const aov = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

        // Payment breakdown
        let vnpayRev = 0;
        let vnpayCnt = 0;
        let codRev = 0;
        let codCnt = 0;
        completedOrders.forEach((o) => {
          const method = (o.paymentMethod || o.preferredPaymentMethod || "COD").toUpperCase();
          if (method.includes("VNPAY") || method.includes("ONLINE")) {
            vnpayRev += o.totalAmount || 0;
            vnpayCnt += 1;
          } else {
            codRev += o.totalAmount || 0;
            codCnt += 1;
          }
        });

        // User breakdown
        const totalCustomers = (users || []).filter((u: any) => u.roles?.includes("CUSTOMER") && !u.roles?.includes("ADMIN") && !u.roles?.includes("SUPPORTER")).length;
        const totalSellers = dashStats?.total_sellers ?? (users || []).filter((u: any) => u.roles?.includes("SELLER")).length;
        const totalSupporters = (users || []).filter((u: any) => u.roles?.includes("SUPPORTER")).length;
        const totalAdmins = (users || []).filter((u: any) => u.roles?.includes("ADMIN")).length;
        const activeUsers = (users || []).filter((u: any) => u.status === "ACTIVE").length;
        const lockedUsers = (users || []).filter((u: any) => u.status === "LOCKED").length;

        // Order status breakdown
        const orderStatusMap: Record<string, number> = {};
        allOrders.forEach((o) => {
          orderStatusMap[o.orderStatus] = (orderStatusMap[o.orderStatus] || 0) + 1;
        });

        // Daily stats (30 days)
        const dailyStats = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const matchingOrders = completedOrders.filter((o) => {
            const od = o.completedAt || o.createdAt;
            return od && od.startsWith(dateStr);
          });
          const dayRev = matchingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          dailyStats.push({
            date: dateStr,
            revenue: dayRev,
            orders_count: matchingOrders.length,
          });
        }

        // Monthly stats (12 months)
        const monthlyStats = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(now.getMonth() - i, 1);
          const monthStr = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
          const matchingOrders = completedOrders.filter((o) => {
            const od = o.completedAt || o.createdAt;
            if (!od) return false;
            const odDate = new Date(od);
            return odDate.getMonth() === d.getMonth() && odDate.getFullYear() === d.getFullYear();
          });
          const monthRev = matchingOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          monthlyStats.push({
            date: monthStr,
            revenue: monthRev,
            orders_count: matchingOrders.length,
          });
        }

        // Top products
        const topProducts = (products || [])
          .slice()
          .sort((a: any, b: any) => (b.soldCount || 0) - (a.soldCount || 0))
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            image_url: p.thumbnailUrl || p.images?.[0]?.image_url || null,
            sold_count: p.soldCount || 0,
            revenue: (p.soldCount || 0) * (p.minPrice || p.price || 100000),
          }));

        // Top sellers
        const sellerRevenueMap = new Map<string, { totalOrders: number; totalRevenue: number; name: string; logo: string | null }>();

        (store.state.shops || []).forEach((s: any) => {
          const sid = String(s.id || s.sellerId);
          sellerRevenueMap.set(sid, {
            totalOrders: 0,
            totalRevenue: 0,
            name: s.shopName || s.name || "Gian hàng",
            logo: s.logoUrl || s.shopLogoUrl || null,
          });
        });

        completedOrders.forEach((o) => {
          const sid = String(o.sellerId || (o as any).seller_id || "");
          if (sid) {
            const existing = sellerRevenueMap.get(sid) || {
              totalOrders: 0,
              totalRevenue: 0,
              name: (o as any).sellerName || "Gian hàng",
              logo: null,
            };
            existing.totalOrders += 1;
            existing.totalRevenue += (o.totalAmount || 0);
            sellerRevenueMap.set(sid, existing);
          }
        });

        const topSellers = Array.from(sellerRevenueMap.entries())
          .map(([id, val]) => ({
            id,
            shop_name: val.name,
            logo_url: val.logo,
            total_orders: val.totalOrders,
            total_revenue: val.totalRevenue,
          }))
          .sort((a, b) => b.total_revenue - a.total_revenue || b.total_orders - a.total_orders)
          .slice(0, 5);

        const fallbackStats: AdminDetailedStats = {
          total_revenue: totalRevenue,
          pending_revenue: pendingRevenue,
          total_orders: allOrders.length || completedOrders.length,
          completed_orders: completedOrders.length,
          cancelled_orders: cancelledOrders.length,
          average_order_value: aov,
          total_products: products?.length || 0,
          active_products: (products || []).filter((p: any) => p.status === "ACTIVE").length,
          hidden_products: (products || []).filter((p: any) => p.status === "HIDDEN").length,
          total_categories: catsResp?.categories?.length || 0,
          user_breakdown: {
            total_customers: totalCustomers || (dashStats?.total_users ? Math.max(0, dashStats.total_users - totalSellers - totalAdmins) : 0),
            total_sellers: totalSellers,
            total_supporters: totalSupporters,
            total_admins: totalAdmins || 1,
            active_users: activeUsers || (dashStats?.total_users ?? 1),
            locked_users: lockedUsers,
          },
          payment_breakdown: {
            cod_revenue: codRev,
            cod_count: codCnt,
            vnpay_revenue: vnpayRev,
            vnpay_count: vnpayCnt,
          },
          order_status_breakdown: orderStatusMap,
          daily_stats: dailyStats,
          monthly_stats: monthlyStats,
          top_products: topProducts,
          top_sellers: topSellers,
        };

        setStats(fallbackStats);
      } catch (fallbackErr: any) {
        console.error("Fallback stats error:", fallbackErr);
        setError("Không thể tải dữ liệu thống kê từ hệ thống.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await recalculateAdminStatistics();
      showToast("Đã đồng bộ và tính toán lại thống kê toàn sàn thành công!", "success");
      await loadStats();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi đồng bộ CSDL.", "danger");
    } finally {
      setRecalculating(false);
    }
  };

  // Compute active chart data based on time preset
  const chartData = useMemo(() => {
    if (!stats) return [];

    if (timePreset === "12MONTHS" || timePreset === "ALL") {
      return (stats.monthly_stats || []).map((m) => ({
        label: m.date,
        revenue: Number(m.revenue || 0),
        orders: Number(m.orders_count || 0),
      }));
    }

    if (timePreset === "7DAYS") {
      const daily = stats.daily_stats || [];
      return daily.slice(-7).map((d) => {
        const parts = d.date.split("-");
        const shortLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date;
        return {
          label: shortLabel,
          fullDate: d.date,
          revenue: Number(d.revenue || 0),
          orders: Number(d.orders_count || 0),
        };
      });
    }

    // Default 30DAYS
    return (stats.daily_stats || []).map((d) => {
      const parts = d.date.split("-");
      const shortLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date;
      return {
        label: shortLabel,
        fullDate: d.date,
        revenue: Number(d.revenue || 0),
        orders: Number(d.orders_count || 0),
      };
    });
  }, [stats, timePreset]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    if (chartMode === "revenue") {
      const max = Math.max(...chartData.map((d) => d.revenue), 0);
      return max > 0 ? max : 1000000;
    }
    const max = Math.max(...chartData.map((d) => d.orders), 0);
    return max > 0 ? max : 10;
  }, [chartData, chartMode]);

  // Export Summary to CSV
  const handleExportCsv = () => {
    if (!stats) {
      showToast("Chưa có dữ liệu thống kê để xuất báo cáo.", "danger");
      return;
    }

    const rows = [
      ["BÁO CÁO THỐNG KÊ TỔNG QUAN HỆ THỐNG E-COMMERCE"],
      [`Thời gian xuất báo cáo: ${new Date().toLocaleString("vi-VN")}`],
      [],
      ["1. CHỈ SỐ DOANH THU & ĐƠN HÀNG"],
      ["Doanh thu thực nhận (COMPLETED)", formatVnd(stats.total_revenue)],
      ["Doanh thu tạm tính (Đang xử lý/Giao)", formatVnd(stats.pending_revenue)],
      ["Tổng số đơn hàng phát sinh", `${stats.total_orders} đơn`],
      ["Đơn hàng hoàn tất", `${stats.completed_orders} đơn`],
      ["Đơn hàng bị hủy", `${stats.cancelled_orders} đơn`],
      ["Giá trị trung bình đơn (AOV)", formatVnd(stats.average_order_value)],
      [],
      ["2. KÊNH THANH TOÁN"],
      ["VNPay / Trực tuyến", `${formatVnd(stats.payment_breakdown.vnpay_revenue)} (${stats.payment_breakdown.vnpay_count} đơn)`],
      ["COD (Thanh toán khi nhận)", `${formatVnd(stats.payment_breakdown.cod_revenue)} (${stats.payment_breakdown.cod_count} đơn)`],
      [],
      ["3. NGƯỜI DÙNG & GIAN HÀNG"],
      ["Tổng khách hàng (BUYER)", stats.user_breakdown.total_customers],
      ["Tổng người bán (SELLER)", stats.user_breakdown.total_sellers],
      ["Nhân viên hỗ trợ (SUPPORTER)", stats.user_breakdown.total_supporters],
      ["Quản trị viên (ADMIN)", stats.user_breakdown.total_admins],
      ["Tài khoản đang hoạt động", stats.user_breakdown.active_users],
      ["Tài khoản bị khóa", stats.user_breakdown.locked_users],
      [],
      ["4. SẢN PHẨM & DANH MỤC"],
      ["Tổng số sản phẩm", stats.total_products],
      ["Sản phẩm đang hiển thị (ACTIVE)", stats.active_products],
      ["Sản phẩm bị ẩn (HIDDEN)", stats.hidden_products],
      ["Tổng số danh mục", stats.total_categories],
      [],
      ["5. TOP 5 SẢN PHẨM BÁN CHẠY NHẤT"],
      ["STT", "Tên sản phẩm", "Số lượng đã bán", "Doanh thu"],
      ...stats.top_products.map((p, idx) => [
        idx + 1,
        `"${p.name}"`,
        p.sold_count,
        formatVnd(p.revenue),
      ]),
      [],
      ["6. TOP 5 GIAN HÀNG DOANH THU CAO NHẤT"],
      ["STT", "Tên gian hàng", "Số đơn hoàn tất", "Doanh thu"],
      ...stats.top_sellers.map((s, idx) => [
        idx + 1,
        `"${s.shop_name}"`,
        s.total_orders,
        formatVnd(s.total_revenue),
      ]),
    ];

    const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `bao-cao-thong-ke-toan-san-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đã xuất báo cáo CSV thành công!", "success");
  };

  if (loading && !stats) {
    return (
      <Section title="Thống kê">
        <div className="flex h-64 items-center justify-center">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted" />
        </div>
      </Section>
    );
  }

  if (error && !stats) {
    return (
      <Section title="Thống kê">
        <Panel className="p-8 text-center space-y-3">
          <p className="text-sm text-slate-700">{error}</p>
          <Button onClick={() => loadStats(true)} variant="secondary" className="text-xs">
            Thử lại
          </Button>
        </Panel>
      </Section>
    );
  }

  const paymentTotal =
    (stats?.payment_breakdown.vnpay_revenue || 0) + (stats?.payment_breakdown.cod_revenue || 0) || 1;
  const vnpayPercent = Math.round(
    ((stats?.payment_breakdown.vnpay_revenue || 0) / paymentTotal) * 100
  );
  const codPercent = 100 - vnpayPercent;

  const totalUsersCount =
    (stats?.user_breakdown.total_customers || 0) +
    (stats?.user_breakdown.total_sellers || 0) +
    (stats?.user_breakdown.total_supporters || 0) +
    (stats?.user_breakdown.total_admins || 0) || 1;

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={handleExportCsv}
        className="text-xs h-8 px-3"
      >
        <Download className="h-3.5 w-3.5 mr-1" />
        Xuất Excel
      </Button>

      <Button
        variant="secondary"
        onClick={handleRecalculate}
        disabled={recalculating}
        className="text-xs h-8 px-3"
        title="Đồng bộ lại doanh thu & lượt bán"
      >
        <RefreshCcw className={cn("h-3.5 w-3.5 mr-1", recalculating && "animate-spin")} />
        {recalculating ? "Đang đồng bộ..." : "Đồng bộ CSDL"}
      </Button>

      <Button
        variant="secondary"
        onClick={() => loadStats(true)}
        disabled={loading}
        className="text-xs h-8 px-2.5"
      >
        <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
      </Button>
    </div>
  );

  return (
    <Section title="Thống kê" action={headerActions} className="space-y-5">
      {/* 4 KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Panel className="p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Doanh thu</span>
          <p className="mt-1 text-xl font-bold text-ink">
            {formatVnd(stats?.total_revenue || 0)}
          </p>
          <p className="mt-2 text-xs text-muted">
            Tạm tính: <span className="font-semibold text-slate-700">{formatVnd(stats?.pending_revenue || 0)}</span>
          </p>
        </Panel>

        {/* Total Orders */}
        <Panel className="p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Đơn hàng</span>
          <p className="mt-1 text-xl font-bold text-ink">
            {stats?.total_orders || 0}
          </p>
          <p className="mt-2 text-xs text-muted">
            <span className="text-emerald-600 font-semibold">{stats?.completed_orders || 0}</span> hoàn tất •{" "}
            <span className="text-rose-600 font-semibold">{stats?.cancelled_orders || 0}</span> hủy
          </p>
        </Panel>

        {/* Users */}
        <Panel className="p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Người dùng</span>
          <p className="mt-1 text-xl font-bold text-ink">
            {totalUsersCount}
          </p>
          <p className="mt-2 text-xs text-muted">
            {stats?.user_breakdown.total_customers || 0} khách • {stats?.user_breakdown.total_sellers || 0} shop
          </p>
        </Panel>

        {/* Products */}
        <Panel className="p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Sản phẩm</span>
          <p className="mt-1 text-xl font-bold text-ink">
            {stats?.total_products || 0}
          </p>
          <p className="mt-2 text-xs text-muted">
            {stats?.active_products || 0} đang bán • {stats?.total_categories || 0} danh mục
          </p>
        </Panel>
      </div>

      {/* Main Growth Chart */}
      <Panel className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-ink text-sm">
            {chartMode === "revenue" ? "Doanh thu theo thời gian" : "Số đơn hàng theo thời gian"}
          </h3>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-line">
              <button
                type="button"
                onClick={() => setChartMode("revenue")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors",
                  chartMode === "revenue" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                )}
              >
                Doanh thu
              </button>
              <button
                type="button"
                onClick={() => setChartMode("orders")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-colors",
                  chartMode === "orders" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                )}
              >
                Số đơn
              </button>
            </div>

            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-line">
              {[
                { key: "7DAYS", label: "7 ngày" },
                { key: "30DAYS", label: "30 ngày" },
                { key: "12MONTHS", label: "12 tháng" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setTimePreset(p.key as TimePreset)}
                  className={cn(
                    "px-2 py-1 text-xs font-semibold rounded-md transition-colors",
                    timePreset === p.key ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hover info tooltip */}
        <div className="h-5 flex items-center justify-between text-xs text-muted mb-2">
          {hoveredBar ? (
            <span className="font-semibold text-ink">
              {hoveredBar.fullDate || hoveredBar.label}:{" "}
              {chartMode === "orders" ? (
                <span>
                  <strong className="text-blue-700">{hoveredBar.orders} đơn hàng</strong> (Doanh thu: {formatVnd(hoveredBar.revenue)})
                </span>
              ) : (
                <span>
                  <strong className="text-emerald-700">{formatVnd(hoveredBar.revenue)}</strong> ({hoveredBar.orders} đơn hoàn tất)
                </span>
              )}
            </span>
          ) : (
            <span>Di chuột vào cột để xem số liệu</span>
          )}
          <span>AOV: <strong className="text-ink font-semibold">{formatVnd(stats?.average_order_value || 0)}</strong></span>
        </div>

        {/* Chart Bars */}
        <div className="relative pt-2 pb-8 border-b border-line">
          {/* Background guide lines */}
          <div className="absolute inset-x-0 top-2 bottom-8 flex flex-col justify-between pointer-events-none opacity-30">
            <div className="border-b border-dashed border-slate-300 w-full" />
            <div className="border-b border-dashed border-slate-300 w-full" />
            <div className="border-b border-slate-300 w-full" />
          </div>

          <div className="h-44 w-full flex items-stretch gap-1.5 sm:gap-2 relative z-10">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted">
                Chưa có dữ liệu
              </div>
            ) : (
              chartData.map((bar, idx) => {
                const val = chartMode === "revenue" ? bar.revenue : bar.orders;
                const heightPercent =
                  maxChartValue > 0 && val > 0
                    ? Math.max(8, Math.min(100, Math.round((val / maxChartValue) * 100)))
                    : 0;
                const isHovered = hoveredBar === bar;

                return (
                  <div
                    key={idx}
                    className="flex-1 h-full flex flex-col justify-end items-center cursor-pointer group relative"
                    onMouseEnter={() => setHoveredBar(bar)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {val > 0 ? (
                      <div
                        className={cn(
                          "w-full max-w-[28px] rounded-t transition-all duration-150",
                          chartMode === "revenue"
                            ? isHovered
                              ? "bg-slate-950 ring-2 ring-slate-900/20"
                              : "bg-slate-800 hover:bg-slate-900"
                            : isHovered
                            ? "bg-blue-800 ring-2 ring-blue-900/20"
                            : "bg-blue-600 hover:bg-blue-700"
                        )}
                        style={{ height: `${heightPercent}%` }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "h-1 w-full max-w-[12px] rounded-full transition-colors mb-0.5",
                          isHovered ? "bg-slate-400" : "bg-slate-200"
                        )}
                      />
                    )}
                    <span className="absolute -bottom-6 text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap text-center select-none">
                      {chartData.length > 20 && idx % 3 !== 0 ? "" : bar.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Panel>

      {/* Breakdowns: Payment & Orders */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment Channels */}
        <Panel className="p-4 space-y-3">
          <h3 className="font-bold text-ink text-sm">Thanh toán & Đơn hàng</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">VNPay / Trực tuyến ({vnpayPercent}%)</span>
              <span className="font-semibold text-ink">{formatVnd(stats?.payment_breakdown.vnpay_revenue || 0)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div className="h-full bg-blue-600" style={{ width: `${vnpayPercent}%` }} />
              <div className="h-full bg-emerald-600" style={{ width: `${codPercent}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-600">COD / Khi nhận hàng ({codPercent}%)</span>
              <span className="font-semibold text-ink">{formatVnd(stats?.payment_breakdown.cod_revenue || 0)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-line grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-slate-50 border border-line/60">
              <span className="text-[11px] text-muted block">Hoàn tất</span>
              <strong className="text-xs text-emerald-600">{stats?.completed_orders || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-line/60">
              <span className="text-[11px] text-muted block">Đang giao</span>
              <strong className="text-xs text-blue-600">{stats?.order_status_breakdown["SHIPPING"] || 0}</strong>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-line/60">
              <span className="text-[11px] text-muted block">Chờ xử lý</span>
              <strong className="text-xs text-amber-600">
                {(stats?.order_status_breakdown["PLACED"] || 0) + (stats?.order_status_breakdown["READY_TO_SHIP"] || 0)}
              </strong>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-line/60">
              <span className="text-[11px] text-muted block">Đã hủy</span>
              <strong className="text-xs text-rose-600">{stats?.cancelled_orders || 0}</strong>
            </div>
          </div>
        </Panel>

        {/* User Breakdown */}
        <Panel className="p-4 space-y-3">
          <h3 className="font-bold text-ink text-sm">Cơ cấu người dùng</h3>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-line flex justify-between items-center">
              <span className="text-slate-600">Khách hàng</span>
              <strong className="text-ink text-sm">{stats?.user_breakdown.total_customers || 0}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-line flex justify-between items-center">
              <span className="text-slate-600">Người bán (Shop)</span>
              <strong className="text-ink text-sm">{stats?.user_breakdown.total_sellers || 0}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-line flex justify-between items-center">
              <span className="text-slate-600">Hỗ trợ viên (CSKH)</span>
              <strong className="text-ink text-sm">{stats?.user_breakdown.total_supporters || 0}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-line flex justify-between items-center">
              <span className="text-slate-600">Quản trị viên</span>
              <strong className="text-ink text-sm">{stats?.user_breakdown.total_admins || 0}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-line flex items-center justify-between text-xs text-muted">
            <span>Tài khoản đang hoạt động: <strong className="text-emerald-600 font-semibold">{stats?.user_breakdown.active_users || 0}</strong></span>
            <span>Bị khóa: <strong className="text-rose-600 font-semibold">{stats?.user_breakdown.locked_users || 0}</strong></span>
          </div>
        </Panel>
      </div>

      {/* Top 5 Products & Top 5 Sellers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Panel className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink text-sm">Top sản phẩm bán chạy</h3>
            <Link href="/admin/products" className="text-xs text-slate-500 hover:text-ink">
              Xem tất cả →
            </Link>
          </div>

          {!stats?.top_products || stats.top_products.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">Chưa có dữ liệu</p>
          ) : (
            <div className="divide-y divide-line text-xs">
              {stats.top_products.map((p, idx) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-slate-400 font-bold w-4 text-center">{idx + 1}</span>
                    <img
                      src={p.image_url || "/images/placeholder.webp"}
                      alt={p.name}
                      className="h-8 w-8 rounded object-cover border border-line shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{p.name}</p>
                      <p className="text-[11px] text-muted">Đã bán: {p.sold_count}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-ink shrink-0">{formatVnd(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Top Sellers */}
        <Panel className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink text-sm">Top gian hàng</h3>
            <Link href="/admin/sellers" className="text-xs text-slate-500 hover:text-ink">
              Xem tất cả →
            </Link>
          </div>

          {!stats?.top_sellers || stats.top_sellers.length === 0 ? (
            <p className="text-xs text-muted py-4 text-center">Chưa có dữ liệu</p>
          ) : (
            <div className="divide-y divide-line text-xs">
              {stats.top_sellers.map((s, idx) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-slate-400 font-bold w-4 text-center">{idx + 1}</span>
                    {s.logo_url ? (
                      <img
                        src={s.logo_url}
                        alt={s.shop_name}
                        className="h-8 w-8 rounded-full object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 shrink-0">
                        {s.shop_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{s.shop_name}</p>
                      <p className="text-[11px] text-muted">{s.total_orders} đơn hoàn tất</p>
                    </div>
                  </div>
                  <span className="font-semibold text-ink shrink-0">{formatVnd(s.total_revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </Section>
  );
}

