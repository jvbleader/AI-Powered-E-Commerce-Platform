"use client";

import { Section } from "@/components/ui/containers";
import { MetricCard } from "@/components/shared/cards";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function SupporterDashboardPage() {
  const store = useMarketplaceStore();

  const totalConversations = store.state.conversations.length;
  const openConversations = store.state.conversations.filter((conv) => conv.status === "OPEN").length;
  const unreadMessages = store.state.conversations
    .flatMap((conv) => conv.messages || [])
    .filter((msg) => !msg.isRead).length;

  return (
    <Section title="Supporter dashboard">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Assigned conversations" value={`${totalConversations}`} />
        <MetricCard label="Open" value={`${openConversations}`} />
        <MetricCard label="Unread" value={`${unreadMessages}`} />
      </div>
    </Section>
  );
}
