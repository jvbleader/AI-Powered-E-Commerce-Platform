"use client";

import { Section } from "@/components/ui/containers";
import { MetricCard } from "@/components/shared/cards";
import { formatVnd } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function AdminDashboardPage() {
  const store = useMarketplaceStore();
  const completed = store.state.orders.filter((order) => order.orderStatus === "COMPLETED");

  return (
    <Section title="Admin dashboard">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Doanh thu toàn sàn"
          value={formatVnd(completed.reduce((sum, order) => sum + order.totalAmount, 0))}
        />
        <MetricCard label="Người dùng" value={`${store.state.users.length}`} />
        <MetricCard label="Người bán" value={`${store.state.shops.length}`} />
        <MetricCard
          label="Hồ sơ chờ duyệt"
          value={`${store.state.shops.filter((shop) => shop.status === "PENDING").length}`}
        />
      </div>
    </Section>
  );
}
