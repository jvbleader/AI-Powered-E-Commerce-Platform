"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { MetricCard } from "@/components/shared/cards";
import { formatVnd, sellerStatusLabel } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerDashboardPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();

  useEffect(() => {
    if (shop?.status === "APPROVED") {
      store.fetchSellerOrders();
      store.fetchSellerProducts();
    }
  }, [shop?.status, store.fetchSellerOrders, store.fetchSellerProducts]);

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
  const revenue = sellerOrders.filter((order) => order.orderStatus === "COMPLETED").reduce((sum, order) => sum + order.totalAmount, 0);
  const waiting = sellerOrders.filter((order) => !order.sellerConfirmed && order.orderStatus === "PLACED").length;

  return (
    <Section title="Seller dashboard">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Doanh thu hoàn thành" value={formatVnd(revenue)} />
        <MetricCard label="Tổng đã bán" value={`${shop?.totalSold ?? 0}`} />
        <MetricCard label="Đơn cần xác nhận" value={`${waiting}`} detail="Deadline xác nhận 2 ngày" />
        <MetricCard label="Sản phẩm" value={`${store.state.products.filter((product) => product.sellerId === shop?.id).length}`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="font-bold">Shortcut</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => (window.location.href = "/seller/products/new")}>Tạo sản phẩm</Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/seller/orders")}>Xem đơn hàng</Button>
          </div>
        </Panel>
        <Panel>
          <h3 className="font-bold">Nhắc hạn xác nhận</h3>
          <p className="mt-2 text-sm text-muted">{waiting} đơn đang chờ xác nhận.</p>
        </Panel>
      </div>
    </Section>
  );
}
