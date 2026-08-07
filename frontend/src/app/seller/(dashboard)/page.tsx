"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { MetricCard } from "@/components/shared/cards";
import { formatVnd, sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";
import type { BackendSellerDashboardSummary } from "@/store/slices/types";

const formatGmt7 = (isoString?: string | null) => {
  if (!isoString) return "";
  let cleanIso = isoString;
  if (!cleanIso.endsWith("Z") && !cleanIso.includes("+") && !cleanIso.includes("-", 10)) {
    cleanIso += "Z";
  }
  const date = new Date(cleanIso);
  if (isNaN(date.getTime())) return isoString;
  return (
    date.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }) + " (GMT+7)"
  );
};


export default function SellerDashboardPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const [summary, setSummary] = useState<BackendSellerDashboardSummary | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  const handleFetchSummary = async (recalculate = false) => {
    if (recalculate) {
      if (cooldownLeft > 0) {
        const minutesLeft = Math.ceil(cooldownLeft / 60);
        store.showToast(`Bạn chỉ có thể cập nhật dữ liệu 5 phút một lần. Vui lòng thử lại sau ${minutesLeft} phút.`, "danger");
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
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi truy cập dashboard người bán." />;
  }

  if (!shop) {
    return (
      <Section title="Kênh người bán">
        <EmptyState
          title="Chưa có hồ sơ shop"
          description="Bạn cần gửi hồ sơ mở shop trước khi truy cập dashboard người bán."
          action={<Button onClick={() => (window.location.href = "/seller/register")}>Gửi hồ sơ</Button>}
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
          <Button className="mt-4" variant="secondary" onClick={() => (window.location.href = `/seller/${shop.status.toLowerCase()}`)}>
            Xem trạng thái
          </Button>
        </Panel>
      </Section>
    );
  }

  const sellerOrders = store.state.orders.filter((order) => order.sellerId === shop?.id);
  const revenueFallback = sellerOrders.filter((order) => order.orderStatus === "COMPLETED").reduce((sum, order) => sum + order.totalAmount, 0);
  const waitingFallback = sellerOrders.filter((order) => !order.sellerConfirmed && order.orderStatus === "PLACED").length;

  const displayRevenue = summary ? summary.total_revenue : revenueFallback;
  const displayTotalSold = summary ? summary.total_sold : (shop?.totalSold ?? 0);
  const displayWaiting = summary ? summary.pending_orders : waitingFallback;
  const displayProducts = summary ? summary.total_products : store.state.products.filter((product) => product.sellerId === shop?.id).length;

  return (
    <Section title="Tổng quan">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-muted">
          {summary?.updated_at
            ? `Cập nhật gần nhất: ${formatGmt7(summary.updated_at)}`
            : "Chưa đồng bộ thống kê DB"}
        </span>
        <Button
          variant="secondary"
          onClick={() => handleFetchSummary(true)}
          disabled={recalculating || cooldownLeft > 0}
          className="flex items-center gap-1.5 text-xs min-h-8 py-1 px-3"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${recalculating ? "animate-spin" : ""}`} />
          {recalculating
            ? "Đang tính toán..."
            : cooldownLeft > 0
            ? `Cập nhật dữ liệu (${Math.floor(cooldownLeft / 60)}:${String(cooldownLeft % 60).padStart(2, "0")})`
            : "Cập nhật dữ liệu"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Doanh thu hoàn thành" value={formatVnd(displayRevenue)} />
        <MetricCard label="Tổng đã bán" value={`${displayTotalSold}`} />
        <MetricCard label="Đơn cần xác nhận" value={`${displayWaiting}`} />
        <MetricCard label="Sản phẩm" value={`${displayProducts}`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="font-bold">Thao tác nhanh</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => (window.location.href = "/seller/products/new")}>Tạo sản phẩm</Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/seller/orders")}>Xem đơn hàng</Button>
          </div>
        </Panel>
        <Panel>
          <h3 className="font-bold">Nhắc hạn xác nhận</h3>
          <p className="mt-2 text-sm text-muted">{displayWaiting} đơn đang chờ xác nhận.</p>
        </Panel>
      </div>
    </Section>
  );
}


