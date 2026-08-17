"use client";

import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  RefreshCcw,
  Download,
  ArrowUpRight,
  CreditCard,
  Truck,
  Search,
  Package,
  Layers,
  ChevronRight,
  Filter,
  BarChart3,
  Percent,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import {
  formatVnd,
  formatDate,
  orderStatusLabel,
  paymentStatusLabel,
  parseApiDateTime,
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";
import type { BackendSellerDashboardSummary } from "@/store/slices/types";
import type { Order } from "@/types/models";
import { cn } from "@/lib/utils";
import Link from "next/link";

type TimePreset = "ALL" | "TODAY" | "7DAYS" | "30DAYS" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";

const formatLocalTime = (isoString?: string | null) => {
  if (!isoString) return "";
  let cleanIso = isoString;
  if (!cleanIso.endsWith("Z") && !cleanIso.includes("+") && !cleanIso.includes("-", 10)) {
    cleanIso += "Z";
  }
  const date = new Date(cleanIso);
  if (isNaN(date.getTime())) return isoString;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {} as Record<string, string>);

  return `${parts.hour}:${parts.minute}:${parts.second} ${parts.day}/${parts.month}/${parts.year}`;
};

export default function SellerRevenuePage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;

  const [timePreset, setTimePreset] = useState<TimePreset>("30DAYS");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"COMPLETED" | "ALL" | "CANCELLED">("COMPLETED");

  const [summary, setSummary] = useState<BackendSellerDashboardSummary | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const [hoveredChartBar, setHoveredChartBar] = useState<any | null>(null);

  const handleFetchSummary = async (recalculate = false) => {
    if (recalculate) {
      if (cooldownLeft > 0) {
        const minutesLeft = Math.ceil(cooldownLeft / 60);
        showToast(`Bạn chỉ có thể cập nhật dữ liệu 5 phút một lần. Vui lòng thử lại sau ${minutesLeft} phút.`, "danger");
        return;
      }
      setRecalculating(true);
    }
    try {
      const res = await store.fetchSellerDashboardSummary(recalculate);
      if (res.ok && res.summary) {
        setSummary(res.summary);
        if (recalculate) {
          showToast("Đã đồng bộ lại dữ liệu doanh thu từ CSDL thành công!", "success");
        }
      } else if (res.message) {
        showToast(res.message, "danger");
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật dữ liệu", "danger");
    } finally {
      if (recalculate) {
        setRecalculating(false);
      }
    }
  };

  useEffect(() => {
    if (shop?.status === "APPROVED") {
      store.fetchSellerOrders();
      store.fetchSellerProducts();
      handleFetchSummary(false);
    }
  }, [shop?.status, store.fetchSellerOrders, store.fetchSellerProducts]);

  useEffect(() => {
    if (!summary?.updated_at) {
      setCooldownLeft(0);
      return;
    }

    const updateCooldown = () => {
      let iso = summary.updated_at!;
      if (!iso.endsWith("Z") && !iso.includes("+") && !iso.includes("-", 10)) {
        iso += "Z";
      }
      const updatedTime = new Date(iso).getTime();
      const now = Date.now();
      const elapsedSec = Math.floor((now - updatedTime) / 1000);
      const remainingSec = 300 - elapsedSec;
      setCooldownLeft(remainingSec > 0 ? remainingSec : 0);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [summary?.updated_at]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem doanh thu." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  const allShopOrders = store.state.orders.filter((order) => order.sellerId === shop.id);

  // Time filter boundary computation
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (timePreset === "TODAY") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (timePreset === "7DAYS") {
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (timePreset === "30DAYS") {
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (timePreset === "THIS_MONTH") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (timePreset === "LAST_MONTH") {
      start.setMonth(now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
    } else if (timePreset === "CUSTOM") {
      const parsedStart = new Date(`${customStartDate}T00:00:00`);
      const parsedEnd = new Date(`${customEndDate}T23:59:59`);
      return {
        start: isNaN(parsedStart.getTime()) ? null : parsedStart,
        end: isNaN(parsedEnd.getTime()) ? null : parsedEnd
      };
    } else {
      // ALL
      return { start: null, end: null };
    }

    return { start, end };
  }, [timePreset, customStartDate, customEndDate]);

  // Filter orders by time and payment method
  const filteredOrders = useMemo(() => {
    return allShopOrders.filter((order) => {
      const orderDate = parseApiDateTime(order.completedAt) || parseApiDateTime(order.createdAt);
      if (!orderDate) return false;

      if (dateRange.start && orderDate < dateRange.start) return false;
      if (dateRange.end && orderDate > dateRange.end) return false;

      if (paymentMethodFilter !== "ALL") {
        const method = (order.paymentMethod || order.preferredPaymentMethod || "COD").toUpperCase();
        if (paymentMethodFilter === "COD" && !method.includes("COD")) return false;
        if (paymentMethodFilter === "VNPAY" && !method.includes("VNPAY") && !method.includes("ONLINE")) return false;
      }

      return true;
    });
  }, [allShopOrders, dateRange, paymentMethodFilter]);

  // Metrics computation
  const completedOrders = useMemo(
    () => filteredOrders.filter((o) => o.orderStatus === "COMPLETED"),
    [filteredOrders]
  );
  const pendingOrders = useMemo(
    () => filteredOrders.filter((o) => ["PLACED", "CONFIRMED", "SHIPPING"].includes(o.orderStatus)),
    [filteredOrders]
  );
  const cancelledOrders = useMemo(
    () => filteredOrders.filter((o) => o.orderStatus === "CANCELLED"),
    [filteredOrders]
  );

  const totalCompletedRevenue = useMemo(
    () => completedOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [completedOrders]
  );
  const totalPendingRevenue = useMemo(
    () => pendingOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [pendingOrders]
  );
  const totalCancelledAmount = useMemo(
    () => cancelledOrders.reduce((sum, o) => sum + o.totalAmount, 0),
    [cancelledOrders]
  );

  const totalItemsSold = useMemo(
    () =>
      completedOrders.reduce(
        (sum, o) => sum + (o.items?.reduce((iSum, item) => iSum + item.quantity, 0) || 0),
        0
      ),
    [completedOrders]
  );

  const averageOrderValue = useMemo(
    () => (completedOrders.length > 0 ? totalCompletedRevenue / completedOrders.length : 0),
    [totalCompletedRevenue, completedOrders.length]
  );

  const completionRate = useMemo(() => {
    const totalFinished = completedOrders.length + cancelledOrders.length;
    if (totalFinished === 0) return 100;
    return Math.round((completedOrders.length / totalFinished) * 100);
  }, [completedOrders.length, cancelledOrders.length]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    let vnpayAmount = 0;
    let vnpayCount = 0;
    let codAmount = 0;
    let codCount = 0;

    completedOrders.forEach((order) => {
      const method = (order.paymentMethod || order.preferredPaymentMethod || "COD").toUpperCase();
      if (method.includes("VNPAY") || method.includes("ONLINE")) {
        vnpayAmount += order.totalAmount;
        vnpayCount += 1;
      } else {
        codAmount += order.totalAmount;
        codCount += 1;
      }
    });

    const total = totalCompletedRevenue || 1;
    return {
      vnpay: { amount: vnpayAmount, count: vnpayCount, percent: Math.round((vnpayAmount / total) * 100) },
      cod: { amount: codAmount, count: codCount, percent: Math.round((codAmount / total) * 100) },
    };
  }, [completedOrders, totalCompletedRevenue]);

  // Top Selling Products
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { id: string; name: string; image: string; quantity: number; revenue: number }>();

    completedOrders.forEach((order) => {
      order.items?.forEach((item) => {
        const key = item.productId || item.productNameSnapshot;
        const current = productMap.get(key) || {
          id: item.productId || "",
          name: item.productNameSnapshot || "Sản phẩm",
          image: item.productImageSnapshot || "/images/placeholder.webp",
          quantity: 0,
          revenue: 0
        };
        current.quantity += item.quantity;
        current.revenue += item.subtotal || (item.unitPrice * item.quantity);
        productMap.set(key, current);
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [completedOrders]);

  // Revenue Chart Aggregation (By Day or Month)
  const chartData = useMemo(() => {
    if (timePreset === "ALL") {
      // Group by Month (Last 12 months or active history)
      const monthsMap = new Map<string, { label: string; revenue: number; count: number }>();
      
      // Initialize recent 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i, 1);
        const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
        const label = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
        monthsMap.set(key, { label, revenue: 0, count: 0 });
      }

      completedOrders.forEach((order) => {
        const d = parseApiDateTime(order.completedAt) || parseApiDateTime(order.createdAt);
        if (!d) return;
        const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
        if (monthsMap.has(key)) {
          const cur = monthsMap.get(key)!;
          cur.revenue += order.totalAmount;
          cur.count += 1;
        } else {
          monthsMap.set(key, { label: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`, revenue: order.totalAmount, count: 1 });
        }
      });

      return Array.from(monthsMap.values());
    }

    // Daily aggregation
    const daysMap = new Map<string, { label: string; dateStr: string; revenue: number; count: number }>();
    const start = dateRange.start ? new Date(dateRange.start) : new Date(Date.now() - 29 * 86400000);
    const end = dateRange.end ? new Date(dateRange.end) : new Date();

    const cur = new Date(start);
    // Limit to max 31 days for daily chart
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10);
      const label = `${cur.getDate()}/${cur.getMonth() + 1}`;
      daysMap.set(key, { label, dateStr: key, revenue: 0, count: 0 });
      cur.setDate(cur.getDate() + 1);
    }

    completedOrders.forEach((order) => {
      const d = parseApiDateTime(order.completedAt) || parseApiDateTime(order.createdAt);
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        item.revenue += order.totalAmount;
        item.count += 1;
      }
    });

    return Array.from(daysMap.values());
  }, [completedOrders, timePreset, dateRange]);

  const maxChartRevenue = useMemo(() => {
    return Math.max(...chartData.map((d) => d.revenue), 100000);
  }, [chartData]);

  // Orders Table Display List
  const tableOrders = useMemo(() => {
    let list = filteredOrders;
    if (activeTab === "COMPLETED") {
      list = list.filter((o) => o.orderStatus === "COMPLETED");
    } else if (activeTab === "CANCELLED") {
      list = list.filter((o) => o.orderStatus === "CANCELLED");
    }

    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.orderCode.toLowerCase().includes(q) ||
          (o.receiverName && o.receiverName.toLowerCase().includes(q)) ||
          (o.shipment?.receiverName && o.shipment.receiverName.toLowerCase().includes(q)) ||
          o.items?.some((i) => i.productNameSnapshot?.toLowerCase().includes(q))
      );
    }

    return list;
  }, [filteredOrders, activeTab, orderSearchQuery]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      showToast("Không có đơn hàng nào trong bộ lọc để xuất báo cáo.", "danger");
      return;
    }

    const headers = [
      "Mã đơn hàng",
      "Ngày đặt hàng",
      "Ngày hoàn thành",
      "Người nhận",
      "Số điện thoại",
      "Địa chỉ",
      "Trạng thái đơn",
      "Trạng thái thanh toán",
      "Phương thức TT",
      "Đơn vị VC",
      "Doanh thu (VNĐ)"
    ];

    const rows = filteredOrders.map((o) => [
      `"${o.orderCode}"`,
      `"${formatDate(o.createdAt)}"`,
      `"${o.completedAt ? formatDate(o.completedAt) : "-"}"`,
      `"${o.receiverName || o.shipment?.receiverName || "Khách hàng"}"`,
      `"${o.phone || o.shipment?.receiverPhone || ""}"`,
      `"${o.shippingAddress || o.shipment?.detailAddress || ""}"`,
      `"${orderStatusLabel[o.orderStatus] || o.orderStatus}"`,
      `"${paymentStatusLabel[o.paymentStatus] || o.paymentStatus}"`,
      `"${o.paymentMethod || o.preferredPaymentMethod || "COD"}"`,
      `"${o.shipment?.shippingProviderName || "-"}"`,
      o.totalAmount
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `bao-cao-doanh-thu-${shop.shopSlug}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đã xuất báo cáo CSV thành công!", "success");
  };

  return (
    <Section title="Báo cáo doanh thu & Tài chính" className="space-y-6 pb-8">
      {/* Header Info & Sync Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-panel border border-line shadow-xs">
        <div>
          <h2 className="text-base font-bold text-ink">Tổng quan hiệu suất kinh doanh</h2>
          <p className="text-xs text-muted mt-0.5">
            {summary?.updated_at
              ? `Dữ liệu thống kê CSDL cập nhật lúc: ${formatLocalTime(summary.updated_at)}`
              : "Theo dõi dòng tiền, đơn hàng hoàn thành và tăng trưởng shop."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs h-9 px-3"
            title="Xuất danh sách đơn hàng đã lọc sang file CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất Excel / CSV
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleFetchSummary(true)}
            disabled={recalculating || cooldownLeft > 0}
            className="flex items-center gap-1.5 text-xs h-9 px-3"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating
              ? "Đang tính toán..."
              : cooldownLeft > 0
              ? `Cập nhật DB (${Math.floor(cooldownLeft / 60)}:${String(cooldownLeft % 60).padStart(2, "0")})`
              : "Cập nhật dữ liệu CSDL"}
          </Button>
        </div>
      </div>

      {/* Date & Filters Toolbar */}
      <div className="bg-white p-4 rounded-panel border border-line shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted mr-1">Thời gian:</span>
            {[
              { key: "TODAY", label: "Hôm nay" },
              { key: "7DAYS", label: "7 ngày qua" },
              { key: "30DAYS", label: "30 ngày qua" },
              { key: "THIS_MONTH", label: "Tháng này" },
              { key: "LAST_MONTH", label: "Tháng trước" },
              { key: "ALL", label: "Tất cả" },
              { key: "CUSTOM", label: "Tùy chọn ngày" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setTimePreset(p.key as TimePreset)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  timePreset === p.key
                    ? "bg-primary text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-ink border border-line/60"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted whitespace-nowrap">Thanh toán:</span>
            <Select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="h-8 text-xs w-36"
            >
              <option value="ALL">Tất cả hình thức</option>
              <option value="COD">Chỉ COD</option>
              <option value="VNPAY">Chỉ VNPay / Online</option>
            </Select>
          </div>
        </div>

        {/* Custom Date Picker Inputs */}
        {timePreset === "CUSTOM" && (
          <div className="pt-2 border-t border-line/60 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-muted">Từ ngày:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-muted">Đến ngày:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel className="p-4 relative overflow-hidden bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Doanh thu thực nhận</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">{formatVnd(totalCompletedRevenue)}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-emerald-900/70 border-t border-emerald-100 pt-2 font-medium">
            <span>Đơn hoàn thành</span>
            <span className="font-bold text-emerald-700">{completedOrders.length} đơn</span>
          </div>
        </Panel>

        <Panel className="p-4 relative overflow-hidden bg-gradient-to-br from-sky/5 to-white border-sky/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-sky uppercase tracking-wider">Doanh thu tạm tính</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky/15 text-sky">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-800">{formatVnd(totalPendingRevenue)}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted border-t border-sky/15 pt-2 font-medium">
            <span>Đang xử lý / giao hàng</span>
            <span className="font-bold text-slate-800">{pendingOrders.length} đơn</span>
          </div>
        </Panel>

        <Panel className="p-4 relative overflow-hidden bg-gradient-to-br from-amber-50/40 to-white border-amber-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Giá trị trung bình đơn</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-800">{formatVnd(averageOrderValue)}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted border-t border-amber-100 pt-2 font-medium">
            <span>Tổng sản phẩm đã bán</span>
            <span className="font-bold text-slate-800">{totalItemsSold} SP</span>
          </div>
        </Panel>

        <Panel className="p-4 relative overflow-hidden bg-gradient-to-br from-purple-50/40 to-white border-purple-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Tỷ lệ hoàn thành</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-800">{completionRate}%</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted border-t border-purple-100 pt-2 font-medium">
            <span>Đã hủy: {cancelledOrders.length} đơn</span>
            <span className="text-rose-600 font-bold">-{formatVnd(totalCancelledAmount)}</span>
          </div>
        </Panel>
      </div>

      {/* Visual Chart & Payment Method Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <Panel className="lg:col-span-2 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-ink text-sm flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Biểu đồ tăng trưởng doanh thu ({timePreset === "ALL" ? "Theo tháng" : "Theo ngày"})
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Tổng doanh thu hoàn thành trong kỳ: <strong className="text-emerald-600">{formatVnd(totalCompletedRevenue)}</strong>
                </p>
              </div>

              {hoveredChartBar && (
                <div className="bg-slate-900 text-white text-xs px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-2">
                  <span className="font-semibold text-emerald-400">{hoveredChartBar.label}:</span>
                  <span>{formatVnd(hoveredChartBar.revenue)}</span>
                  <span className="text-slate-300">({hoveredChartBar.count} đơn)</span>
                </div>
              )}
            </div>

            {/* Interactive Bar Chart Visualization */}
            <div className="mt-6 h-48 w-full flex items-end gap-1 sm:gap-2 pb-6 pt-4 border-b border-line px-1 relative">
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted">
                  Không có dữ liệu trong khoảng thời gian này
                </div>
              ) : (
                chartData.map((bar, idx) => {
                  const heightPercent = maxChartRevenue > 0 ? Math.max(4, Math.round((bar.revenue / maxChartRevenue) * 100)) : 4;
                  const isHovered = hoveredChartBar === bar;

                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
                      onMouseEnter={() => setHoveredChartBar(bar)}
                      onMouseLeave={() => setHoveredChartBar(null)}
                    >
                      <div
                        className={cn(
                          "w-full max-w-[28px] rounded-t-md transition-all duration-200",
                          bar.revenue > 0
                            ? isHovered
                              ? "bg-emerald-500 shadow-md scale-y-105"
                              : "bg-emerald-600/80 hover:bg-emerald-600"
                            : "bg-slate-200/70"
                        )}
                        style={{ height: `${heightPercent}%` }}
                      />
                      <span className="absolute -bottom-5 text-[10px] font-medium text-slate-400 truncate max-w-[32px] text-center">
                        {chartData.length > 20 && idx % 3 !== 0 ? "" : bar.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Đơn vị: VNĐ</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-xs bg-emerald-600" />
              Doanh thu đơn hàng hoàn thành
            </span>
          </div>
        </Panel>

        {/* Payment Methods & Quick Breakdown */}
        <Panel className="p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-ink text-sm flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-sky" />
              Kênh thanh toán & Dòng tiền
            </h3>
            <p className="text-xs text-muted mt-0.5">Tỷ trọng nguồn tiền theo phương thức thanh toán</p>

            <div className="mt-6 space-y-4">
              {/* VNPay / Online */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <CreditCard className="h-3.5 w-3.5 text-sky" />
                    VNPay / Thanh toán trực tuyến
                  </span>
                  <span className="text-ink font-bold">{formatVnd(paymentBreakdown.vnpay.amount)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-sky transition-all duration-500"
                    style={{ width: `${paymentBreakdown.vnpay.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted font-medium">
                  <span>{paymentBreakdown.vnpay.count} đơn hàng</span>
                  <span>{paymentBreakdown.vnpay.percent}% tổng doanh thu</span>
                </div>
              </div>

              {/* COD */}
              <div className="space-y-1.5 pt-2 border-t border-line/60">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Truck className="h-3.5 w-3.5 text-emerald-600" />
                    COD (Thanh toán khi nhận hàng)
                  </span>
                  <span className="text-ink font-bold">{formatVnd(paymentBreakdown.cod.amount)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${paymentBreakdown.cod.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted font-medium">
                  <span>{paymentBreakdown.cod.count} đơn hàng</span>
                  <span>{paymentBreakdown.cod.percent}% tổng doanh thu</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-line/60 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">💡 Lưu ý đối soát:</p>
            <p className="mt-1 text-[11px] leading-relaxed">
              Doanh thu từ các đơn COD sẽ được hãng vận chuyển đối soát và chuyển về tài khoản ngân hàng của shop theo lịch định kỳ.
            </p>
          </div>
        </Panel>
      </div>

      {/* Top Revenue Generating Products */}
      <Panel className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-ink text-sm flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600" />
              Sản phẩm đóng góp doanh thu cao nhất
            </h3>
            <p className="text-xs text-muted mt-0.5">Top mặt hàng mang lại dòng tiền lớn nhất cho shop trong khoảng thời gian đã chọn</p>
          </div>
          <Link
            href="/seller/products"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Quản lý tất cả sản phẩm <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {topProducts.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted">
            Chưa có sản phẩm nào có đơn hàng hoàn thành trong kỳ này.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {topProducts.map((prod, rank) => {
              const share = totalCompletedRevenue > 0 ? Math.round((prod.revenue / totalCompletedRevenue) * 100) : 0;

              return (
                <div
                  key={prod.id || rank}
                  className="bg-slate-50/80 rounded-xl border border-line p-3 flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="relative shrink-0">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="h-12 w-12 rounded-lg object-cover border border-line"
                        />
                        <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white">
                          #{rank + 1}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-ink line-clamp-2 leading-snug" title={prod.name}>
                          {prod.name}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-line/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted font-medium">Đã bán:</span>
                      <span className="font-bold text-slate-800">{prod.quantity} chiếc</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted font-medium">Doanh thu:</span>
                      <span className="font-black text-emerald-600">{formatVnd(prod.revenue)}</span>
                    </div>
                    <div className="mt-1.5 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-right text-muted font-medium">
                      {share}% tổng doanh thu
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Completed & Filtered Orders Breakdown Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex gap-4">
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors -mb-[13px]",
                activeTab === "COMPLETED"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-primary"
              )}
              onClick={() => setActiveTab("COMPLETED")}
            >
              Đơn hàng hoàn tất ({completedOrders.length})
            </button>
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors -mb-[13px]",
                activeTab === "ALL"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-primary"
              )}
              onClick={() => setActiveTab("ALL")}
            >
              Tất cả đơn trong kỳ ({filteredOrders.length})
            </button>
            <button
              type="button"
              className={cn(
                "pb-2 text-sm font-semibold transition-colors -mb-[13px]",
                activeTab === "CANCELLED"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted hover:text-primary"
              )}
              onClick={() => setActiveTab("CANCELLED")}
            >
              Đơn đã hủy ({cancelledOrders.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <Input
              placeholder="Tìm theo mã đơn, khách hàng, SP..."
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs w-full"
            />
          </div>
        </div>

        {tableOrders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-panel border border-line text-muted text-sm">
            Không tìm thấy đơn hàng nào phù hợp với điều kiện lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-panel border border-line bg-white shadow-xs">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 border-b border-line uppercase">
                <tr>
                  <th className="px-4 py-3">Mã đơn hàng</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Thanh toán</th>
                  <th className="px-4 py-3">Vận chuyển</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Doanh thu đơn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tableOrders.map((order) => {
                  const firstItem = order.items?.[0];
                  const otherCount = (order.items?.length || 1) - 1;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold whitespace-nowrap">
                        <Link
                          href={`/seller/orders/${order.orderCode}`}
                          className="text-primary hover:underline"
                        >
                          #{order.orderCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-muted whitespace-nowrap">
                        {formatDate(order.completedAt || order.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        {order.receiverName || order.shipment?.receiverName || "Khách hàng"}
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px]">
                        {firstItem ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={firstItem.productImageSnapshot || "/images/placeholder.webp"}
                              alt={firstItem.productNameSnapshot}
                              className="h-7 w-7 rounded object-cover border border-line shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-800">
                                {firstItem.productNameSnapshot}
                              </p>
                              {otherCount > 0 && (
                                <p className="text-[10px] text-muted">+{otherCount} sản phẩm khác</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {order.paymentMethod || order.preferredPaymentMethod || "COD"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-muted font-medium">
                        {order.shipment?.shippingProviderName || "-"}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
                      </td>
                      <td className="px-4 py-3.5 font-bold text-right text-emerald-700 whitespace-nowrap text-sm">
                        {formatVnd(order.totalAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}

