"use client";

import { Section } from "@/components/ui/containers";
import { MetricCard } from "@/components/shared/cards";
import { formatVnd } from "@/lib/helpers";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function AdminStatisticsPage() {
  const store = useMarketplaceStore();
  const completedOrders = store.state.orders.filter((order) => order.orderStatus === "COMPLETED");

  return (
    <Section title="Statistics">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Revenue toàn sàn"
          value={formatVnd(completedOrders.reduce((sum, order) => sum + order.totalAmount, 0))}
        />
        <MetricCard label="New users" value={`${store.state.users.length}`} />
        <MetricCard label="New sellers" value={`${store.state.shops.length}`} />
      </div>
    </Section>
  );
}
