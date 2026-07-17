"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Panel, Section } from "@/components/ui/containers";
import { MetricCard } from "@/components/shared/cards";
import { formatVnd } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import Unauthorized from "@/components/shared/unauthorized-page";

export default function SellerRevenuePage() {
  const store = useMarketplaceStore();
  const shop = store.getCurrentShop();

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

  const completed = store.state.orders.filter(
    (order) => order.sellerId === shop.id && order.orderStatus === "COMPLETED"
  );
  const revenue = completed.reduce((sum, order) => sum + order.totalAmount, 0);
  const cancelledCount = store.state.orders.filter(
    (order) => order.sellerId === shop.id && order.orderStatus === "CANCELLED"
  ).length;

  return (
    <Section title="Doanh thu">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel>
          <Field label="Khoảng thời gian">
            <Select>
              <option>Ngày</option>
              <option>Tháng</option>
              <option>Năm</option>
            </Select>
          </Field>
          <Field label="Từ ngày">
            <Input type="date" />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" />
          </Field>
        </Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Doanh thu" value={formatVnd(revenue)} />
          <MetricCard label="Đơn hoàn thành" value={`${completed.length}`} />
          <MetricCard label="Đơn đã hủy" value={`${cancelledCount}`} />
        </div>
      </div>
    </Section>
  );
}
