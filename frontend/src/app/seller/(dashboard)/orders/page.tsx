"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Section } from "@/components/ui/containers";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import {
  canSellerCancel,
  canSellerConfirm,
  canSellerShip,
  formatVnd,
  orderStatusLabel,
  paymentStatusLabel,
  sellerStatusLabel
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import type { Order, OrderStatus } from "@/types/models";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerOrdersPage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (shop) {
      store.fetchSellerOrders(status as OrderStatus | "");
    }
  }, [shop, status, store.fetchSellerOrders]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem đơn hàng." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  const orders = store.state.orders.filter((order) => {
    const belongs = order.sellerId === shop.id;
    return belongs && (!status || order.orderStatus === status);
  });

  const renderOrderAction = (order: Order) => {
    const showConfirm = canSellerConfirm(order);
    const showShip = canSellerShip(order);
    const showCancel = canSellerCancel(order);

    if (!showConfirm && !showShip && !showCancel) return <span className="text-muted">Theo dõi</span>;

    return (
      <div className="flex flex-wrap gap-2">
        {showConfirm ? <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận</Button> : null}
        {showShip ? <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Giao hàng</Button> : null}
        {showCancel ? <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>Từ chối</Button> : null}
      </div>
    );
  };

  return (
    <Section
      title="Đơn hàng shop"
      action={
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-48">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(orderStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
      }
    >
      <DataTable
        columns={["Mã đơn", "Shop", "Trạng thái", "Thanh toán", "Tổng", "Hành động"]}
        rows={orders.map((order) => [
          <a key="code" className="font-bold text-primary" href={`/seller/orders/${order.orderCode}`}>{order.orderCode}</a>,
          store.state.shops.find((s) => s.id === order.sellerId)?.shopName ?? "-",
          <StatusBadge key="st" status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />,
          <StatusBadge key="pay" status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />,
          formatVnd(order.totalAmount),
          renderOrderAction(order)
        ])}
      />
    </Section>
  );
}
