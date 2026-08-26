"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";
import type { BackendSellerDashboardSummary } from "@/store/slices/types";

import { DashboardHeader } from "./components/dashboard-header";
import { ActionCenter } from "./components/action-center";
import { KpiMetrics } from "./components/kpi-metrics";
import { RevenueAnalyticsChart } from "./components/revenue-analytics-chart";
import { RecentOrdersTable } from "./components/recent-orders-table";
import { TopProductsWidget } from "./components/top-products-widget";

export default function SellerDashboardPage() {
  const router = useRouter();
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const [summary, setSummary] = useState<BackendSellerDashboardSummary | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  const handleFetchSummary = async (recalculate = false) => {
    if (recalculate) {
      if (cooldownLeft > 0) {
        const minutesLeft = Math.ceil(cooldownLeft / 60);
        store.showToast(
          `Bạn chỉ có thể cập nhật dữ liệu 5 phút một lần. Vui lòng thử lại sau ${minutesLeft} phút.`,
          "danger"
        );
        return;
      }
      setRecalculating(true);
    }
    try {
      const res = await store.fetchSellerDashboardSummary(recalculate);
      if (res.ok && res.summary) {
        setSummary(res.summary);
        if (recalculate) {
          store.showToast("Đã tính toán lại dữ liệu từ CSDL thành công!", "success");
        }
      } else if (res.message) {
        store.showToast(res.message, "danger");
      }
    } catch (err: any) {
      store.showToast(err.message || "Lỗi khi cập nhật dữ liệu", "danger");
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
    return (
      <Unauthorized
        title="Cần đăng nhập"
        description="Bạn cần đăng nhập trước khi truy cập dashboard người bán."
      />
    );
  }

  if (!shop) {
    return (
      <Section title="Kênh người bán">
        <EmptyState
          title="Chưa có hồ sơ shop"
          description="Bạn cần gửi hồ sơ mở shop trước khi truy cập dashboard người bán."
          action={<Button onClick={() => router.push("/seller/register")}>Gửi hồ sơ</Button>}
        />
      </Section>
    );
  }

  if (shop.status !== "APPROVED") {
    return (
      <Section title="Trạng thái shop">
        <Panel>
          <StatusBadge status={shop.status} label={sellerStatusLabel[shop.status]} />
          <p className="mt-2 text-sm leading-6 text-muted">Shop hiện chưa ở trạng thái được duyệt.</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => router.push(`/seller/${shop.status.toLowerCase()}`)}
          >
            Xem trạng thái
          </Button>
        </Panel>
      </Section>
    );
  }

  // Derive state for current shop
  const sellerOrders = store.state.orders.filter((order) => order.sellerId === shop.id);
  const sellerProducts = store.state.products.filter((product) => product.sellerId === shop.id);
  const sellerVariants = store.state.variants;

  // Fallbacks and counters (only subtotalAmount - tiền hàng)
  const revenueFallback = sellerOrders
    .filter((order) => order.orderStatus === "COMPLETED")
    .reduce((sum, order) => sum + (order.subtotalAmount ?? 0), 0);

  const pendingConfirmationCount = sellerOrders.filter(
    (order) => !order.sellerConfirmed && order.orderStatus === "PLACED"
  ).length;

  const readyToShipCount = sellerOrders.filter(
    (order) =>
      order.orderStatus === "READY_TO_SHIP" ||
      (order.sellerConfirmed && order.orderStatus === "PLACED")
  ).length;

  const lowStockCount = sellerProducts.filter((product) => {
    const variants = sellerVariants.filter((v) => v.productId === product.id);
    const stock = variants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0);
    return variants.length > 0 && stock <= 5;
  }).length;

  const returnRefundCount = sellerOrders.filter(
    (order) =>
      order.returnRequest?.returnStatus === "REQUESTED" ||
      order.returnRequest?.returnStatus === "DISPUTED" ||
      order.orderStatus === "RETURNED" ||
      (Boolean(order.returnTag) && order.returnTag !== "CANCELLED")
  ).length;

  const realtimeTotalSold = sellerOrders
    .filter((order) => order.orderStatus === "COMPLETED")
    .reduce(
      (sum, order) =>
        sum + (order.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0),
      0
    );

  const displayRevenue = sellerOrders.length > 0 ? revenueFallback : (summary?.total_revenue ?? 0);
  const displayTotalSold = sellerOrders.length > 0 ? realtimeTotalSold : (summary?.total_sold ?? shop.totalSold ?? 0);
  const displayTotalOrders = sellerOrders.length;
  const displayProducts = summary ? summary.total_products : sellerProducts.length;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
      <DashboardHeader
        shopName={shop.shopName}
        shopStatus={shop.status}
        updatedAt={summary?.updated_at}
        recalculating={recalculating}
        cooldownLeft={cooldownLeft}
        onRefresh={() => handleFetchSummary(true)}
      />

      {/* 2. Action Center (To-Do List) */}
      <ActionCenter
        pendingConfirmationCount={pendingConfirmationCount}
        readyToShipCount={readyToShipCount}
        lowStockCount={lowStockCount}
        returnRefundCount={returnRefundCount}
      />

      {/* 3. Core KPI Metrics */}
      <KpiMetrics
        totalRevenue={displayRevenue}
        totalSold={displayTotalSold}
        totalOrders={displayTotalOrders}
        totalProducts={displayProducts}
      />

      {/* 4. Interactive Revenue & Order Analytics Chart */}
      <RevenueAnalyticsChart orders={sellerOrders} />

      {/* 5. Split Section: Recent Orders (60%) & Top Products (40%) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <RecentOrdersTable orders={sellerOrders} />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <TopProductsWidget
            products={sellerProducts}
            variants={sellerVariants}
          />
        </div>
      </div>
    </div>
  );
}


