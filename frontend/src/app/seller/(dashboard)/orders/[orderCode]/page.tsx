"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/containers";
import { StatusBadge } from "@/components/ui/badge";
import { OrderTimeline } from "@/components/shared/cards";
import {
  canSellerCancel,
  canSellerConfirm,
  canSellerShip,
  formatVnd,
  orderStatusLabel,
  paymentStatusLabel
} from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

export default function SellerOrderDetailPage() {
  const params = useParams();
  const orderCode = params.orderCode as string;
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();
  const { showToast } = store;

  const order = store.state.orders.find(
    (item) => item.id === orderCode || item.orderCode === orderCode
  );

  useEffect(() => {
    if (!order && orderCode) {
      store.fetchSellerOrderDetail(orderCode);
    }
  }, [order, orderCode, store.fetchSellerOrderDetail]);

  if (!store.getCurrentUser()) {
    return <Unauthorized title="Cần đăng nhập" description="Bạn cần đăng nhập trước khi xem chi tiết đơn hàng." />;
  }

  if (!shop) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm font-semibold text-muted">Đang tải thông tin shop...</p>
      </main>
    );
  }

  if (!order) {
    return (
      <div className="flex justify-center p-8">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></span>
      </div>
    );
  }

  const orderShop = store.state.shops.find((s) => s.id === order.sellerId);

  return (
    <Section title={`Chi tiết đơn ${order.orderCode}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={order.orderStatus} label={orderStatusLabel[order.orderStatus]} />
              <StatusBadge status={order.paymentStatus} label={paymentStatusLabel[order.paymentStatus]} />
              <span className="text-sm text-muted">{orderShop?.shopName}</span>
            </div>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 border-t border-line pt-3">
                  <img src={item.productImageSnapshot} alt={item.productNameSnapshot} className="h-16 w-16 rounded-panel object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.productNameSnapshot}</p>
                    <p className="text-sm text-muted">{item.variantNameSnapshot} - SKU {item.skuSnapshot}</p>
                  </div>
                  <p className="font-bold">{formatVnd(item.subtotal)}</p>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <h3 className="font-bold">Timeline</h3>
            <div className="mt-3">
              <OrderTimeline order={order} />
            </div>
          </Panel>
        </div>
        <Panel className="h-fit">
          <h3 className="font-bold">Shipment snapshot</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {order.shipment.receiverName} - {order.shipment.receiverPhone}
            <br />
            {order.shipment.detailAddress}, {order.shipment.ward}, {order.shipment.district}, {order.shipment.province}
          </p>
          <div className="mt-4 grid gap-2">
            <InfoRow label="Subtotal" value={formatVnd(order.subtotalAmount)} />
            <InfoRow label="Phí ship" value={formatVnd(order.shippingFee)} />
            <InfoRow label="Tổng" value={formatVnd(order.totalAmount)} />
          </div>
          {canSellerConfirm(order) || canSellerShip(order) || canSellerCancel(order) ? (
            <div className="mt-4 grid gap-2">
              {canSellerConfirm(order) ? (
                <Button onClick={() => store.confirmSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã xác nhận đơn hàng.", "success"); else showToast(res.message || "Lỗi xác nhận", "danger"); })}>Xác nhận đơn</Button>
              ) : null}
              {canSellerShip(order) ? (
                <Button variant="secondary" onClick={() => store.shippingSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã chuyển shipping.", "success"); else showToast(res.message || "Lỗi chuyển shipping", "danger"); })}>Chuyển shipping</Button>
              ) : null}
              {canSellerCancel(order) ? (
                <Button variant="danger" onClick={() => store.cancelSellerOrder(order.id).then((res) => { if (res.ok) showToast("Đã từ chối đơn hàng.", "success"); else showToast(res.message || "Lỗi từ chối", "danger"); })}>Từ chối đơn</Button>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>
    </Section>
  );
}
